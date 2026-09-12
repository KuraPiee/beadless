import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageManager } from '../src/core/storage.js';
import { GitManager } from '../src/core/git.js';
import { MemoryEngine } from '../src/core/memory.js';
import { TaskEngine } from '../src/core/tasks.js';
import { ContextEngine } from '../src/core/context.js';
import { handleMcpToolCall } from '../src/mcp/tools.js';

const TEST_DIR = path.join(process.cwd(), 'tests', 'sandbox');

describe('gitmem Core Engine', () => {
  let storage: StorageManager;
  let git: GitManager;
  let memory: MemoryEngine;
  let tasks: TaskEngine;
  let context: ContextEngine;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new StorageManager(TEST_DIR);
    git = new GitManager(TEST_DIR);
    await storage.init('test-project');
    memory = new MemoryEngine(storage, git);
    tasks = new TaskEngine(storage, git);
    context = new ContextEngine(storage, git);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('initializes .gitmem structure properly', async () => {
    expect(storage.isInitialized()).toBe(true);
    const config = await storage.readConfig();
    expect(config.version).toBe('0.1.0');
    expect(config.autoCommit).toBe(true);
  });

  it('remembers and recalls with fuzzy search', async () => {
    await memory.remember({
      category: 'decision',
      title: 'Use Argon2 for password hashing',
      content: 'Argon2id is superior to bcrypt for memory-hard defense against ASIC attacks.',
      tags: ['security', 'auth']
    });

    await memory.remember({
      category: 'lesson',
      title: 'PostgreSQL connection timeout in Docker',
      content: 'Docker networks need healthcheck wait before running migrations.',
      tags: ['database', 'docker']
    });

    // Exact search
    const results1 = await memory.recall('Argon2');
    expect(results1.length).toBeGreaterThan(0);
    expect(results1[0].title).toContain('Argon2');

    // Fuzzy search
    const results2 = await memory.recall('password hash');
    expect(results2.length).toBeGreaterThan(0);
    expect(results2[0].title).toContain('Argon2');

    // Category filter
    const lessons = await memory.recall('', { category: 'lesson' });
    expect(lessons.length).toBe(1);
    expect(lessons[0].title).toContain('PostgreSQL');
  });

  it('handles task dependencies and automatic unblocking', async () => {
    // 1. Create root task
    const t1 = await tasks.create({
      title: 'Design Database Schema',
      priority: 'high'
    });
    expect(t1.status).toBe('pending');

    // 2. Create dependent task
    const t2 = await tasks.create({
      title: 'Build User API Endpoints',
      priority: 'high',
      blockedBy: [t1.id]
    });
    expect(t2.status).toBe('blocked');

    // 3. Claiming t2 should fail because t1 is not completed
    await expect(tasks.claim(t2.id, 'Agent-1')).rejects.toThrow(/blocked by/);

    // 4. Claim and complete t1
    await tasks.claim(t1.id, 'Agent-1');
    await tasks.complete(t1.id, 'Schema created in Prisma');

    // 5. Check if t2 is automatically unblocked
    const list = await tasks.list();
    const updatedT2 = list.find(t => t.id === t2.id);
    expect(updatedT2?.status).toBe('pending');

    // 6. Now claiming t2 should succeed
    const claimedT2 = await tasks.claim(t2.id, 'Agent-2');
    expect(claimedT2.status).toBe('in_progress');
    expect(claimedT2.claimedBy).toBe('Agent-2');
  });

  it('generates rich context briefings for agent bootstrap', async () => {
    await context.setContext({
      name: 'SuperApp',
      summary: 'Next-gen SaaS platform',
      stack: ['Next.js 15', 'TypeScript', 'Tailwind CSS'],
      conventions: ['Never use ANY type', 'All DB queries go through services']
    });

    await memory.remember({
      category: 'lesson',
      title: 'Do not import server actions in client components',
      content: 'Causes bundle size blowout and build errors.'
    });

    const dump = await context.getContextDump();
    expect(dump).toContain('SuperApp');
    expect(dump).toContain('Next-gen SaaS platform');
    expect(dump).toContain('Next.js 15');
    expect(dump).toContain('Do not import server actions in client components');
  });

  it('executes MCP tool calls cleanly', async () => {
    const res = await handleMcpToolCall('gitmem_remember', {
      category: 'architecture',
      title: 'Monorepo structure with pnpm workspaces',
      content: 'apps/web and packages/shared architecture.'
    }, { memory, tasks, context });

    expect(res.content[0].text).toContain('Saved to git-native memory');

    const recallRes = await handleMcpToolCall('gitmem_recall', {
      query: 'monorepo'
    }, { memory, tasks, context });

    expect(recallRes.content[0].text).toContain('Monorepo structure');
  });
});
