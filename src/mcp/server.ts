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
import { SnapshotEngine } from '../core/snapshot.js';
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
  const snapshot = new SnapshotEngine(storage, git, memory);

  const server = new Server(
    {
      name: 'beadless',
      version: '0.2.1'
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
      return await handleMcpToolCall(name, args || {}, { memory, tasks, context, snapshot });
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `beadless error: ${error?.message || String(error)}`
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  runMcpServer().catch(err => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
