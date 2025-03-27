"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const redis_connection_1 = require("../lib/redis-connection");
async function handler(req, res) {
    try {
        // Ensure Redis connection is established
        const isConnected = await (0, redis_connection_1.ensureRedisConnection)();
        res.status(200).json({
            status: isConnected ? 'ok' : 'redis_disconnected',
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error("Health check error:", error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
        });
    }
}
