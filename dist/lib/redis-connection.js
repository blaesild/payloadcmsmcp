"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.getRedisPublisherClient = getRedisPublisherClient;
exports.ensureRedisConnection = ensureRedisConnection;
const redis_1 = require("redis");
// Global Redis client that persists between function invocations
let redisClient = null;
let redisPublisherClient = null;
let connectionAttempts = 0;
let isInitialized = false;
let pingIntervalId = null;
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
    if (redisClient && await isRedisConnected(redisClient)) {
        console.log("Using existing Redis client");
        connectionAttempts = 0;
        return redisClient;
    }
    console.log("Creating new Redis client");
    connectionAttempts++;
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
    setupRedisEventHandlers(redisClient, 'Redis');
    try {
        await redisClient.connect();
        // Set up a ping interval to keep the connection alive if not already set
        if (!isInitialized) {
            setupPingInterval();
            isInitialized = true;
        }
    }
    catch (error) {
        console.error("Failed to connect to Redis:", error);
        redisClient = null;
        throw error;
    }
    return redisClient;
}
// Get or create Redis publisher client
async function getRedisPublisherClient() {
    if (redisPublisherClient && await isRedisConnected(redisPublisherClient)) {
        console.log("Using existing Redis publisher client");
        return redisPublisherClient;
    }
    console.log("Creating new Redis publisher client");
    const redisUrl = cleanRedisUrl(process.env.REDIS_URL) || cleanRedisUrl(process.env.KV_URL);
    if (!redisUrl) {
        throw new Error("REDIS_URL or KV_URL environment variable is not set");
    }
    // Create Redis publisher client with maximum persistence settings
    redisPublisherClient = (0, redis_1.createClient)({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries) => {
                const delay = Math.min(Math.pow(1.5, retries) * 100, 5000);
                console.log(`Redis publisher reconnecting in ${delay}ms (attempt ${retries})`);
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
    setupRedisEventHandlers(redisPublisherClient, 'Redis Publisher');
    try {
        await redisPublisherClient.connect();
    }
    catch (error) {
        console.error("Failed to connect to Redis publisher:", error);
        redisPublisherClient = null;
        throw error;
    }
    return redisPublisherClient;
}
// Set up Redis event handlers
function setupRedisEventHandlers(client, clientName) {
    client.on("error", (err) => {
        console.error(`${clientName} error:`, err);
    });
    client.on("connect", () => {
        console.log(`${clientName} connected`);
    });
    client.on("ready", () => {
        console.log(`${clientName} ready`);
    });
    client.on("reconnecting", () => {
        console.log(`${clientName} reconnecting...`);
    });
    client.on("end", () => {
        console.log(`${clientName} disconnected`);
        if (clientName === 'Redis') {
            redisClient = null;
        }
        else {
            redisPublisherClient = null;
        }
    });
}
// Check if Redis is connected
async function isRedisConnected(client) {
    if (!client)
        return false;
    try {
        await client.ping();
        return true;
    }
    catch (error) {
        console.error("Redis connection check failed:", error);
        return false;
    }
}
// Set up a ping interval to keep the connection alive
function setupPingInterval() {
    if (pingIntervalId) {
        clearInterval(pingIntervalId);
    }
    pingIntervalId = setInterval(async () => {
        try {
            // Ping the main Redis client
            if (redisClient) {
                await redisClient.ping();
                console.log("Redis ping successful");
            }
            // Ping the publisher client if it exists
            if (redisPublisherClient) {
                await redisPublisherClient.ping();
                console.log("Redis publisher ping successful");
            }
            // If either client is null, try to reconnect
            if (!redisClient) {
                console.log("Redis client is null, attempting to reconnect");
                try {
                    await getRedisClient();
                }
                catch (error) {
                    console.error("Failed to reconnect Redis client:", error);
                }
            }
            if (!redisPublisherClient) {
                console.log("Redis publisher client is null, attempting to reconnect");
                try {
                    await getRedisPublisherClient();
                }
                catch (error) {
                    console.error("Failed to reconnect Redis publisher client:", error);
                }
            }
        }
        catch (error) {
            console.error("Ping interval error:", error);
            // Try to reconnect if ping fails
            try {
                if (redisClient) {
                    await redisClient.disconnect();
                    redisClient = null;
                }
                if (redisPublisherClient) {
                    await redisPublisherClient.disconnect();
                    redisPublisherClient = null;
                }
                await getRedisClient();
                await getRedisPublisherClient();
            }
            catch (reconnectError) {
                console.error("Failed to reconnect after ping failure:", reconnectError);
            }
        }
    }, 10000); // Ping every 10 seconds
    // Ensure the interval is cleaned up on process exit
    process.on('beforeExit', () => {
        if (pingIntervalId) {
            clearInterval(pingIntervalId);
        }
    });
}
// Initialize the Redis connection immediately
getRedisClient().catch(error => {
    console.error("Initial Redis connection failed:", error);
});
// Export a function to ensure Redis connection
async function ensureRedisConnection() {
    try {
        await getRedisClient();
        await getRedisPublisherClient();
        return true;
    }
    catch (error) {
        console.error("Failed to ensure Redis connection:", error);
        return false;
    }
}
