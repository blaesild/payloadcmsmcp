"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const redis_1 = require("redis");
// Global Redis client that persists between function invocations
let redisClient = null;
let lastPingTime = 0;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 10;
// Clean the Redis URL if it contains variable name or quotes
const cleanRedisUrl = (url) => {
    if (!url)
        return undefined;
    // If the URL contains KV_URL= or REDIS_URL=, extract just the URL part
    if (url.includes('KV_URL=') || url.includes('REDIS_URL=')) {
        const match = url.match(/(?:KV_URL=|REDIS_URL=)["']?(rediss?:\/\/[^"']+)["']?/);
        return match ? match[1] : url;
    }
    // Remove any surrounding quotes
    return url.replace(/^["'](.+)["']$/, '$1');
};
// Initialize Redis client if not already initialized
async function getRedisClient() {
    if (redisClient && await isRedisConnected()) {
        console.log("Using existing Redis client");
        connectionAttempts = 0;
        return redisClient;
    }
    console.log("Creating new Redis client");
    connectionAttempts++;
    if (connectionAttempts > MAX_CONNECTION_ATTEMPTS) {
        console.log(`Exceeded maximum connection attempts (${MAX_CONNECTION_ATTEMPTS}). Resetting counter.`);
        connectionAttempts = 1;
    }
    const redisUrl = cleanRedisUrl(process.env.REDIS_URL) || cleanRedisUrl(process.env.KV_URL);
    if (!redisUrl) {
        throw new Error("REDIS_URL or KV_URL environment variable is not set");
    }
    // Create Redis client with maximum persistence settings
    redisClient = (0, redis_1.createClient)({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries) => {
                const delay = Math.min(Math.pow(1.5, retries) * 100, 5000);
                console.log(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                return delay;
            },
            connectTimeout: 30000,
            keepAlive: 5000,
            noDelay: true,
            tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        },
        pingInterval: 1000,
        disableOfflineQueue: false,
        commandTimeout: 5000,
        retryStrategy: () => 1000, // Retry every second
        autoResubscribe: true,
        autoResendUnfulfilledCommands: true,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        maxRetriesPerRequest: 50,
    });
    redisClient.on("error", (err) => {
        console.error("Redis error", err);
        // Don't set redisClient to null here, let the reconnection strategy handle it
    });
    redisClient.on("connect", () => {
        console.log("Redis connected");
    });
    redisClient.on("ready", () => {
        console.log("Redis ready");
    });
    redisClient.on("end", () => {
        console.log("Redis disconnected");
        redisClient = null; // Reset client so we create a new one next time
    });
    try {
        await redisClient.connect();
        // Set up a ping interval to keep the connection alive
        setInterval(async () => {
            try {
                if (redisClient) {
                    await redisClient.ping();
                    console.log("Internal ping successful");
                }
            }
            catch (error) {
                console.error("Internal ping failed:", error);
            }
        }, 10000); // Ping every 10 seconds
    }
    catch (error) {
        console.error("Failed to connect to Redis:", error);
        redisClient = null;
        throw error;
    }
    return redisClient;
}
// Check if Redis is connected
async function isRedisConnected() {
    if (!redisClient)
        return false;
    try {
        await redisClient.ping();
        return true;
    }
    catch (error) {
        console.error("Redis connection check failed:", error);
        return false;
    }
}
// Perform Redis operations to keep the connection active
async function performRedisOperations(redis) {
    const now = Date.now();
    // Store the current time in Redis
    await redis.set('last_cron_keepalive', now.toString());
    // Get the stored value
    const storedValue = await redis.get('last_cron_keepalive');
    // Get some stats
    const info = await redis.info();
    // Perform a simple list operation
    await redis.lPush('keepalive_list', now.toString());
    await redis.lTrim('keepalive_list', 0, 9); // Keep only the last 10 entries
    // Get the list
    const list = await redis.lRange('keepalive_list', 0, -1);
    return {
        storedValue,
        info: info.substring(0, 500) + '...', // Truncate info to avoid large response
        list
    };
}
// Handler for the cron endpoint
async function handler(req, res) {
    try {
        // Check for authorization header if needed
        const authHeader = req.headers.authorization;
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const now = Date.now();
        const timeSinceLastPing = now - lastPingTime;
        lastPingTime = now;
        console.log(`Cron keep-alive endpoint called. Time since last ping: ${timeSinceLastPing}ms`);
        const redis = await getRedisClient();
        const pingResult = await redis.ping();
        // Perform various Redis operations to ensure the connection stays active
        const operationResults = await performRedisOperations(redis);
        res.status(200).json({
            status: 'ok',
            ping: pingResult,
            lastPingTime: lastPingTime,
            timeSinceLastPing: timeSinceLastPing,
            connectionAttempts,
            operations: operationResults,
            timestamp: now
        });
    }
    catch (error) {
        console.error("Cron keep-alive error:", error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        });
    }
}
