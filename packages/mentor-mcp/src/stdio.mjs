#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.mjs';

try {
  await createServer().connect(new StdioServerTransport());
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
