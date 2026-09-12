import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageManager } from '../src/core/storage.js';
import { GitManager } from '../src/core/git.js';
import { MemoryEngine } from '../src/core/memory.js';
import { TaskEngine } from '../src/core/tasks.js';
import { ContextEngine } from '../src/core/context.js';
import { SnapshotEngine } from '../src/core/snapshot.js';
import { handleMcpToolCall } from '../src/mcp/tools.js';

const TEST_DIR = path.join(process.cwd(), 'tests', 'sandbox_snapshot');

describe('SnapshotEngine & Smart Deletion', () => {
  let storage: StorageManager;
  let git: GitManager;
  let memory: MemoryEngine;
  let tasks: TaskEngine;
  let context: ContextEngine;
  let snapshot: SnapshotEngine;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new StorageManager(TEST_DIR);
    git = new GitManager(TEST_DIR);
    await storage.init('test-snapshot-project');
    memory = new MemoryEngine(storage, git);
    tasks = new TaskEngine(storage, git);
    context = new ContextEngine(storage, git);
    snapshot = new SnapshotEngine(storage, git, memory);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('records a snapshot without title and preserves previous memories', async () => {
    // 1. Initial memory
    const m1 = await memory.remember({
      category: 'decision',
      title: 'Initial Architecture Decision',
      content: 'Core layout using modules'
    });

    // 2. Take automatic snapshot
    const snap = await snapshot.takeSnapshot();
    expect(snap).not.toBeNull();
    expect(snap?.entry.tags).toContain('snapshot');

    // 3. Ensure previous memory was NOT deleted
    const all = await memory.list();
    expect(all.length).toBe(2);
    expect(all.some(m => m.id === m1.id)).toBe(true);
  });

  it('executes beadless_snapshot MCP tool call cleanly', async () => {
    const res = await handleMcpToolCall('beadless_snapshot', {
      title: 'MCP Snapshot Milestone 1',
      message: 'Completed auth module',
      force: true
    }, { memory, tasks, context, snapshot });

    expect(res.content[0].text).toContain('Snapshot recorded');
    expect(res.content[0].text).toContain('MCP Snapshot Milestone 1');

    const list = await memory.list('context');
    expect(list.some(m => m.title === 'MCP Snapshot Milestone 1')).toBe(true);
  });

  it('deletes by exact ID cleanly', async () => {
    const m = await memory.remember({
      category: 'lesson',
      title: 'Temporary Bug In SQLite Driver',
      content: 'Fixed by updating bindings'
    });

    const delRes = await memory.deleteByQueryOrId(m.id);
    expect(delRes.success).toBe(true);
    expect(delRes.deleted?.id).toBe(m.id);

    const list = await memory.list();
    expect(list.some(item => item.id === m.id)).toBe(false);
  });

  it('deletes by semantic query / description cleanly', async () => {
    await memory.remember({
      category: 'decision',
      title: 'Use Redis for Session Storage',
      content: 'Redis memory store provides sub-millisecond lookups.'
    });

    // Delete by saying what to delete
    const delRes = await memory.deleteByQueryOrId('Redis session storage');
    expect(delRes.success).toBe(true);
    expect(delRes.deleted?.title).toContain('Redis');

    const check = await memory.recall('Redis');
    expect(check.length).toBe(0);
  });

  it('executes beadless_delete MCP tool call cleanly', async () => {
    const target = await memory.remember({
      category: 'architecture',
      title: 'Kafka event queue setup',
      content: 'Distributed message log.'
    });

    const res = await handleMcpToolCall('beadless_delete', {
      queryOrId: target.id
    }, { memory, tasks, context, snapshot });

    expect(res.content[0].text).toContain('Silindi');
  });

  it('watcher starts and can be stopped cleanly', async () => {
    const watcher = snapshot.startWatcher({
      intervalMinutes: 1,
      minChanges: 1
    });

    expect(watcher.isRunning()).toBe(true);
    watcher.stop();
    expect(watcher.isRunning()).toBe(false);
  });
});
