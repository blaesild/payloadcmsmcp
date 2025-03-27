import fs from "fs";
import getRawBody from "raw-body";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "http";
import { createClient } from "redis";
import { Socket } from "net";
import { Readable } from "stream";
import { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
const vercelJson = JSON.parse(fs.readFileSync("../vercel.json", "utf-8"));

interface SerializedRequest {
  requestId: string;
  url: string;
  method: string;
  body: string;
  headers: IncomingHttpHeaders;
}

export function initializeMcpApiHandler(
  initializeServer: (server: McpServer) => void,
  serverOptions: ServerOptions = {}
) {
  const maxDuration =
    vercelJson?.functions?.["api/server.ts"]?.maxDuration || 800;
    
  // Clean the Redis URL if it contains variable name or quotes
  const cleanRedisUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    
    // If the URL contains KV_URL= or REDIS_URL=, extract just the URL part
    if (url.includes('KV_URL=') || url.includes('REDIS_URL=')) {
      const match = url.match(/(?:KV_URL=|REDIS_URL=)["']?(rediss?:\/\/[^"']+)["']?/);
      return match ? match[1] : url;
    }
    
    // Remove any surrounding quotes
    return url.replace(/^["'](.+)["']$/, '$1');
  };
  
  const redisUrl = cleanRedisUrl(process.env.REDIS_URL) || cleanRedisUrl(process.env.KV_URL);
  if (!redisUrl) {
    throw new Error("REDIS_URL or KV_URL environment variable is not set");
  }
  
  console.log("Using Redis URL:", redisUrl);
  
  // Get optional configuration from environment variables
  const connectTimeout = process.env.REDIS_CONNECT_TIMEOUT ? 
    parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) : 30000;
  const keepAlive = process.env.REDIS_KEEP_ALIVE ? 
    parseInt(process.env.REDIS_KEEP_ALIVE, 10) : 5000;
  const pingInterval = process.env.REDIS_PING_INTERVAL ? 
    parseInt(process.env.REDIS_PING_INTERVAL, 10) : 1000;
  const heartbeatInterval = process.env.REDIS_HEARTBEAT_INTERVAL ? 
    parseInt(process.env.REDIS_HEARTBEAT_INTERVAL, 10) : 30000;
  const persistenceInterval = process.env.REDIS_PERSISTENCE_INTERVAL ? 
    parseInt(process.env.REDIS_PERSISTENCE_INTERVAL, 10) : 60000;
  const maxReconnectAttempts = process.env.REDIS_MAX_RECONNECT_ATTEMPTS ? 
    parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS, 10) : 5;
  const tlsVerify = process.env.REDIS_TLS_VERIFY ? 
    process.env.REDIS_TLS_VERIFY.toLowerCase() === 'true' : false;
    
  // Global connection state
  let isRedisConnected = false;
  let isRedisPublisherConnected = false;
  let reconnectAttempts = 0;
  let heartbeatIntervalId: NodeJS.Timeout | null = null;
  let persistenceIntervalId: NodeJS.Timeout | null = null;
  
  // Create base socket configuration
  const baseSocketConfig: any = {
     connectTimeout: connectTimeout,
    reconnectStrategy: (retries: number) => {
      const delay = Math.min(Math.pow(1.5, retries) * 100, 5000);
      console.log(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      reconnectAttempts = retries;
      return delay;
    },
    keepAlive: keepAlive,
    noDelay: true
  };

  // Create socket configuration with proper TLS handling
  let redisSocketConfig: any = { ...baseSocketConfig };
  if (redisUrl.startsWith('rediss://')) {
    if (tlsVerify) {
      redisSocketConfig = { ...redisSocketConfig, tls: true };
    } else {
      redisSocketConfig = { ...redisSocketConfig, tls: { rejectUnauthorized: false } };
    }
  }

  // Create Redis clients with maximum persistence settings
  const redisOptions = {
    url: redisUrl as string,
    socket: redisSocketConfig,
    pingInterval: pingInterval,
    disableOfflineQueue: false, // Queue commands when disconnected
    // Force auto-reconnect
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 20, // Retry commands many times
  };

  const redis = createClient({
    ...redisOptions,
    socket: { ...redisSocketConfig,
 reconnectStrategy: (times: number) => Math.min(times * 100, 2000) }
  });
    const redisPublisher = createClient({
    ...redisOptions,
    socket: { ...redisSocketConfig, reconnectStrategy: (times: number) => Math.min(times * 100, 2000) }
  });
  
  // Enhanced event listeners
  redis.on("error", (err) => {
    console.error("Redis error", err);
    isRedisConnected = false;
    ensureRedisConnection();
  });
  redis.on("reconnecting", () => {
    console.log("Redis reconnecting...");
    isRedisConnected = false;
  });
  redis.on("connect", () => {
    console.log("Redis connected");
    isRedisConnected = true;
    reconnectAttempts = 0;
  });
  redis.on("end", () => {
    console.log("Redis disconnected");
    isRedisConnected = false;
    ensureRedisConnection();
  });
  redis.on("ready", () => {
    console.log("Redis ready");
    isRedisConnected = true;
  });
  
  redisPublisher.on("error", (err) => {
    console.error("Redis publisher error", err);
    isRedisPublisherConnected = false;
    ensureRedisConnection();
  });
  redisPublisher.on("reconnecting", () => {
    console.log("Redis publisher reconnecting...");
    isRedisPublisherConnected = false;
  });
  redisPublisher.on("connect", () => {
    console.log("Redis publisher connected");
    isRedisPublisherConnected = true;
  });
  redisPublisher.on("end", () => {
    console.log("Redis publisher disconnected");
    isRedisPublisherConnected = false;
    ensureRedisConnection();
  });
  redisPublisher.on("ready", () => {
    console.log("Redis publisher ready");
    isRedisPublisherConnected = true;
  });
  
  // Initial connection promise
  const redisPromise = Promise.all([redis.connect(), redisPublisher.connect()]);

  let servers: McpServer[] = [];
  
  // More aggressive function to handle reconnection
  const ensureRedisConnection = async () => {
    try {
      if (!isRedisConnected) {
        console.log("Ensuring Redis connection...");
        try {
          await redis.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        await redis.connect();
      }
      if (!isRedisPublisherConnected) {
        console.log("Ensuring Redis publisher connection...");
        try {
          await redisPublisher.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        await redisPublisher.connect();
      }
    } catch (error) {
      console.error("Failed to reconnect to Redis:", error);
      // Schedule another attempt
      setTimeout(ensureRedisConnection, 2000);
    }
  };
  
  // Set up a more frequent heartbeat to keep the Redis connection alive
  heartbeatIntervalId = setInterval(async () => {
    try {
      if (isRedisConnected) {
        // Send a ping to keep the connection alive
        await redis.ping();
        console.log("Redis heartbeat: connection alive");
      } else {
        console.log("Redis heartbeat: reconnecting...");
        await ensureRedisConnection();
      }
    } catch (error) {
      console.error("Redis heartbeat error:", error);
      isRedisConnected = false;
      await ensureRedisConnection();
    }
  }, heartbeatInterval);
  
  // Additional persistence interval that forces reconnection periodically
  persistenceIntervalId = setInterval(async () => {
    console.log("Persistence check: ensuring Redis connections are healthy");
    // Force a ping to check connection health
    try {
      await redis.ping();
      await redisPublisher.ping();
    } catch (error) {
      console.error("Persistence check failed:", error);
      await ensureRedisConnection();
    }
    
    // If we've had too many reconnect attempts, force a clean reconnection
    if (reconnectAttempts > maxReconnectAttempts) {
      console.log(`Too many reconnect attempts (${reconnectAttempts}/${maxReconnectAttempts}), forcing clean reconnection`);
      try {
        await redis.disconnect();
        await redisPublisher.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      
      // Short delay before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        await redis.connect();
        await redisPublisher.connect();
        reconnectAttempts = 0;
      } catch (error) {
        console.error("Forced reconnection failed:", error);
      }
    }
  }, persistenceInterval);
  
  // Handle process termination to clean up resources
  const handleTermination = async () => {
    console.log("Cleaning up resources before termination");
    if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
    if (persistenceIntervalId) clearInterval(persistenceIntervalId);
    try {
      await redis.disconnect();
      await redisPublisher.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    process.exit(0);
  };
  
  // Register termination handlers if they haven't been registered yet
  if (process.listenerCount('SIGTERM') === 0) {
    process.on('SIGTERM', handleTermination);
  }
  if (process.listenerCount('SIGINT') === 0) {
    process.on('SIGINT', handleTermination);
  }

  return async function mcpApiHandler(
    req: IncomingMessage,
    res: ServerResponse
  ) {
    // Ensure Redis connection before processing request
    await ensureRedisConnection();
    
    await redisPromise;
    const url = new URL(req.url || "", "https://example.com");
    if (url.pathname === "/sse") {
      console.log("Got new SSE connection");

      const transport = new SSEServerTransport("/message", res);
      const sessionId = transport.sessionId;
      const server = new McpServer(
        {
          name: "mcp-typescript server on vercel",
          version: "0.1.0",
        },
        serverOptions
      );
      initializeServer(server);

      servers.push(server);

      server.server.onclose = () => {
        console.log("SSE connection closed");
        servers = servers.filter((s) => s !== server);
      };

      let logs: {
        type: "log" | "error";
        messages: string[];
      }[] = [];
      // This ensures that we logs in the context of the right invocation since the subscriber
      // is not itself invoked in request context.
      function logInContext(severity: "log" | "error", ...messages: string[]) {
        logs.push({
          type: severity,
          messages,
        });
      }

      // Handles messages originally received via /message
      const handleMessage = async (message: string) => {
        console.log("Received message from Redis", message);
        logInContext("log", "Received message from Redis", message);
        const request = JSON.parse(message) as SerializedRequest;

        // Make in IncomingMessage object because that is what the SDK expects.
        const req = createFakeIncomingMessage({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        });
        const syntheticRes = new ServerResponse(req);
        let status = 100;
        let body = "";
        syntheticRes.writeHead = (statusCode: number) => {
          status = statusCode;
          return syntheticRes;
        };
        syntheticRes.end = (b: unknown) => {
          body = b as string;
          return syntheticRes;
        };
        await transport.handlePostMessage(req, syntheticRes);

        await redisPublisher.publish(
          `responses:${sessionId}:${request.requestId}`,
          JSON.stringify({
            status,
            body,
          })
        );

        if (status >= 200 && status < 300) {
          logInContext(
            "log",
            `Request ${sessionId}:${request.requestId} succeeded: ${body}`
          );
        } else {
          logInContext(
            "error",
            `Message for ${sessionId}:${request.requestId} failed with status ${status}: ${body}`
          );
        }
      };

      const interval = setInterval(() => {
        for (const log of logs) {
          console[log.type].call(console, ...log.messages);
        }
        logs = [];
      }, 100);

      await redis.subscribe(`requests:${sessionId}`, handleMessage);
      console.log(`Subscribed to requests:${sessionId}`);

      let timeout: NodeJS.Timeout;
      let resolveTimeout: (value: unknown) => void;
      const waitPromise = new Promise((resolve) => {
        resolveTimeout = resolve;
        timeout = setTimeout(() => {
          resolve("max duration reached");
        }, (maxDuration - 5) * 1000);
      });

      async function cleanup() {
        clearTimeout(timeout);
        clearInterval(interval);
        await redis.unsubscribe(`requests:${sessionId}`, handleMessage);
        console.log("Done");
        res.statusCode = 200;
        res.end();
      }
      req.on("close", () => resolveTimeout("client hang up"));

      // Handle process termination to clean up resources
      const handleSessionTermination = async () => {
        console.log("Cleaning up session resources before termination");
        await cleanup();
      };
      
      // Register session-specific cleanup
      if (process.listenerCount('SIGTERM') === 1) { // Only our global handler
        process.on('SIGTERM', handleSessionTermination);
      }
      if (process.listenerCount('SIGINT') === 1) { // Only our global handler
        process.on('SIGINT', handleSessionTermination);
      }

      await server.connect(transport);
      const closeReason = await waitPromise;
      console.log(closeReason);
      await cleanup();
      
      // Remove session-specific handlers
      process.removeListener('SIGTERM', handleSessionTermination);
      process.removeListener('SIGINT', handleSessionTermination);
    } else if (url.pathname === "/message") {
      console.log("Received message");

      const body = await getRawBody(req, {
        length: req.headers["content-length"],
        encoding: "utf-8",
      });

      const sessionId = url.searchParams.get("sessionId") || "";
      if (!sessionId) {
        res.statusCode = 400;
        res.end("No sessionId provided");
        return;
      }
      const requestId = crypto.randomUUID();
      const serializedRequest: SerializedRequest = {
        requestId,
        url: req.url || "",
        method: req.method || "",
        body: body,
        headers: req.headers,
      };

      // Handles responses from the /sse endpoint.
      await redis.subscribe(
        `responses:${sessionId}:${requestId}`,
        (message) => {
          clearTimeout(timeout);
          const response = JSON.parse(message) as {
            status: number;
            body: string;
          };
          res.statusCode = response.status;
          res.end(response.body);
        }
      );

      // Queue the request in Redis so that a subscriber can pick it up.
      // One queue per session.
      await redisPublisher.publish(
        `requests:${sessionId}`,
        JSON.stringify(serializedRequest)
      );
      console.log(`Published requests:${sessionId}`, serializedRequest);

      let timeout = setTimeout(async () => {
        await redis.unsubscribe(`responses:${sessionId}:${requestId}`);
        res.statusCode = 408;
        res.end("Request timed out");
      }, 10 * 1000);

      res.on("close", async () => {
        clearTimeout(timeout);
        await redis.unsubscribe(`responses:${sessionId}:${requestId}`);
      });
    } else {
      res.statusCode = 404;
      res.end("Not found");
    }
  };
}

// Define the options interface
interface FakeIncomingMessageOptions {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
  body?: string | Buffer | Record<string, any> | null;
  socket?: Socket;
}

export function createFakeIncomingMessage({
  method = "GET",
  url = "/",
  headers = {},
  body = null,
  socket = new Socket(),
}: FakeIncomingMessageOptions): IncomingMessage {
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = headers;

  if (body) {
    if (typeof body === "string" || Buffer.isBuffer(body)) {
      const stream = new Readable();
      stream.push(body);
      stream.push(null);
      Object.defineProperty(req, "body", {
        get() {
          return body;
        },
      });
      req.push(body);
      req.push(null);
    } else if (typeof body === "object") {
      const stream = new Readable();
      const json = JSON.stringify(body);
      stream.push(json);
      stream.push(null);
      Object.defineProperty(req, "body", {
        get() {
          return json;
        },
      });
      req.push(json);
      req.push(null);
    }
  }

  return req;
}
