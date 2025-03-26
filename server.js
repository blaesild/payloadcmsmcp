#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');
const SSE = require('express-sse');

const app = express();
const PORT = process.env.PORT || 8080;
const sse = new SSE();

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// MCP Server-Sent Events endpoint
app.get('/sse', sse.init);

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  sse.send('MCP Server ready', 'ready');
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