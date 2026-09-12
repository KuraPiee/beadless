import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { StorageManager } from '../core/storage.js';
import { GitManager } from '../core/git.js';
import { MemoryEngine } from '../core/memory.js';
import { TaskEngine } from '../core/tasks.js';
import { ContextEngine } from '../core/context.js';
import { getMcpToolsDefinition, handleMcpToolCall } from './tools.js';

export async function runMcpServer(cwd: string = process.cwd()) {
  const storage = new StorageManager(cwd);
  if (!storage.isInitialized()) {
    await storage.init();
  }

  const git = new GitManager(cwd);
  const memory = new MemoryEngine(storage, git);
  const tasks = new TaskEngine(storage, git);
  const context = new ContextEngine(storage, git);

  const server = new Server(
    {
      name: 'gitmem',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getMcpToolsDefinition()
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await handleMcpToolCall(name, args || {}, { memory, tasks, context });
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `gitmem error: ${error?.message || String(error)}`
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// If directly executed via node/tsx
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  runMcpServer().catch(err => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
