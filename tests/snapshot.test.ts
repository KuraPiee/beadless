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

describe('SnapshotEngine & Auto-Recorder', () => {
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

  it('records a snapshot when force is enabled or title is given', async () => {
    const res = await snapshot.takeSnapshot({
      title: 'Manual Test Snapshot',
      message: 'Initial state before refactor',
      force: true
    });

    expect(res).not.toBeNull();
    expect(res?.entry.title).toBe('Manual Test Snapshot');
    expect(res?.entry.tags).toContain('snapshot');

    const memories = await memory.recall('Manual Test');
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].content).toContain('Initial state before refactor');
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

  it('watcher starts and can be stopped cleanly', async () => {
    let snapshotCount = 0;
    const watcher = snapshot.startWatcher({
      intervalMinutes: 1,
      minChanges: 1,
      onSnapshot: () => {
        snapshotCount++;
      }
    });

    expect(watcher.isRunning()).toBe(true);
    watcher.stop();
    expect(watcher.isRunning()).toBe(false);
  });
});
