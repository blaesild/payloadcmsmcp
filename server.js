#!/usr/bin/env node
const { initializeMcpApiHandler } = require('./dist/lib/mcp-api-handler');

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const SSE = require('express-sse');
const redis = require('redis');

// Initialize Express and SSE
const app = express();
const PORT = process.env.PORT || 8080;
const sse = new SSE();

// Enable CORS for all routes
app.use(cors());

// Initialize Redis connection
let redisClient;
if (process.env.REDIS_URL) {
  try {
    console.log(`Attempting to connect to Redis at: ${process.env.REDIS_URL}`);
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 5000)
      }
    });
    
    redisClient.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });
  } catch (err) {
    console.error('❌ Failed to initialize Redis client:', err);
  }
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Initialize MCP Server
const mcpHandler = initializeMcpApiHandler((server) => {
  // Register MCP tools here
  console.log('MCP Server initialized');
}, {
  redisUrl: process.env.REDIS_URL,
  redisPassword: process.env.REDIS_PASSWORD
});

// MCP Server-Sent Events endpoint
app.get('/sse', async (req, res) => {
  await mcpHandler(req, res);
});

// Start the server with Redis connection
// and MCP initialization
async function startServer() {
  if (redisClient) {
    try {
      await redisClient.connect();
      console.log('✅ Redis connection established');
      sse.send('MCP Server ready', 'ready');
    } catch (err) {
      console.error('❌ Failed to connect to Redis:', err);
    }
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer();

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  sse.send('MCP Server shutting down', 'shutdown');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  sse.send('MCP Server shutting down', 'shutdown');
  process.exit(0);
});