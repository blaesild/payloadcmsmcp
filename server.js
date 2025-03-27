#!/usr/bin/env node

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
    redisClient = redis.createClient({
      url: process.env.REDIS_URL
,
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
}
  } catch (err) {
    console.error('❌ Failed to initialize Redis client:', err);
  }


// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// MCP Server-Sent Events endpoint
app.get('/sse', sse.init);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
if (redisClient) {
    redisClient.connect().then(() => {
      sse.send('MCP Server ready', 'ready');
    });
  } else {
    console.warn('Redis URL not configured - MCP tools will not work');
  }
});

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