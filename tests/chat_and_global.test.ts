import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageManager } from '../src/core/storage.js';
import { GitManager } from '../src/core/git.js';
import { MemoryEngine } from '../src/core/memory.js';
import { TaskEngine } from '../src/core/tasks.js';
import { ContextEngine } from '../src/core/context.js';
import { SnapshotEngine } from '../src/core/snapshot.js';
import { ChatEngine } from '../src/core/chat.js';
import { GlobalEngine } from '../src/core/global.js';
import { handleMcpToolCall } from '../src/mcp/tools.js';

const TEST_DIR = path.join(process.cwd(), 'tests', 'sandbox_chat_global');

describe('ChatEngine & GlobalEngine', () => {
  let storage: StorageManager;
  let git: GitManager;
  let memory: MemoryEngine;
  let tasks: TaskEngine;
  let context: ContextEngine;
  let snapshot: SnapshotEngine;
  let chat: ChatEngine;
  let globalEngine: GlobalEngine;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new StorageManager(TEST_DIR);
    git = new GitManager(TEST_DIR);
    await storage.init('test-chat-global-project');
    memory = new MemoryEngine(storage, git);
    tasks = new TaskEngine(storage, git);
    context = new ContextEngine(storage, git);
    snapshot = new SnapshotEngine(storage, git, memory);
    chat = new ChatEngine(storage, git);
    globalEngine = new GlobalEngine(storage, git, chat);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('records separate chat sessions with decisions and retrieves them', async () => {
    const c1 = await chat.recordChat({
      id: 'chat-pie-canvas',
      title: 'Pie Bot Canvas Font Fix',
      summary: 'Configured fontconfig and installed Noto Sans fonts on Linux VDS for Discord Canvas cards.',
      decisions: ['Use system DejaVu and Noto Sans CJK', 'Avoid pure webfonts in node-canvas without fontconfig'],
      tags: ['canvas', 'pie-bot', 'font'],
      filesTouched: ['src/cards/itiraf.js', 'src/cards/turta.js']
    });

    expect(c1.id).toBe('chat-pie-canvas');
    expect(c1.title).toBe('Pie Bot Canvas Font Fix');

    const retrieved = await chat.getChat('chat-pie-canvas');
    expect(retrieved).toBeDefined();
    expect(retrieved?.summary).toContain('Configured fontconfig');
    expect(retrieved?.decisions).toHaveLength(2);

    const list = await chat.listChats();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some(c => c.id === 'chat-pie-canvas')).toBe(true);
  });

  it('searches across chat sessions and memories globally with GlobalEngine', async () => {
    // 1. Save chat session
    await chat.recordChat({
      id: 'chat-gods-eye',
      title: 'Gods Eye View Coordinates Parser',
      summary: 'Added offline MGRS and DMS coordinate parser for keyless search.',
      decisions: ['Place coordinate geocoder before Google API'],
      tags: ['geoint', 'cesium', 'coordinates']
    });

    // 2. Save memory in workspace
    await memory.remember({
      category: 'architecture',
      title: 'Decouple Cesium dependencies in search boundary',
      content: 'Never import Cesium in placeSearch boundary module.'
    });

    // 3. Search via GlobalEngine
    const results = await globalEngine.search('coordinates');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.id === 'chat-gods-eye' || r.title.includes('Coordinates'))).toBe(true);

    const archResults = await globalEngine.search('Cesium');
    expect(archResults.length).toBeGreaterThanOrEqual(1);
    expect(archResults.some(r => r.title.includes('Cesium'))).toBe(true);
  });

  it('executes beadless_chat_save, beadless_chat_list and beadless_global_recall MCP tools', async () => {
    // 1. Save chat via MCP
    const saveRes = await handleMcpToolCall(
      'beadless_chat_save',
      {
        id: 'chat-mcp-test',
        title: 'Authentication overhaul session',
        summary: 'Migrated from JWT to Argon2 sessions.',
        decisions: ['Store refresh tokens in httpOnly cookies'],
        tags: ['auth', 'security']
      },
      { memory, tasks, context, snapshot, chat, globalEngine }
    );

    expect(saveRes.content[0].text).toContain('Saved chat session [chat-mcp-test]');

    // 2. List chats via MCP
    const listRes = await handleMcpToolCall(
      'beadless_chat_list',
      {},
      { memory, tasks, context, snapshot, chat, globalEngine }
    );
    expect(listRes.content[0].text).toContain('Authentication overhaul session');

    // 3. Global recall via MCP
    const recallRes = await handleMcpToolCall(
      'beadless_global_recall',
      { query: 'Argon2' },
      { memory, tasks, context, snapshot, chat, globalEngine }
    );
    expect(recallRes.content[0].text).toContain('Authentication overhaul session');
  });

  it('deletes a chat session cleanly', async () => {
    await chat.recordChat({
      id: 'chat-temp',
      title: 'Temporary Chat',
      summary: 'To be deleted'
    });

    expect(await chat.getChat('chat-temp')).not.toBeNull();

    const deleted = await chat.deleteChat('chat-temp');
    expect(deleted).toBe(true);
    expect(await chat.getChat('chat-temp')).toBeNull();
  });
});
