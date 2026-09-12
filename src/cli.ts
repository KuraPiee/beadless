import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { StorageManager } from './core/storage.js';
import { GitManager } from './core/git.js';
import { MemoryEngine } from './core/memory.js';
import { TaskEngine } from './core/tasks.js';
import { ContextEngine } from './core/context.js';
import { runMcpServer } from './mcp/server.js';
import { MemoryCategory } from './types/index.js';

const program = new Command();

program
  .name('beadless')
  .description('🧠 Git-native persistent memory & task graph for AI coding agents (Claude Code, Cursor, Antigravity)')
  .version('0.1.0');

// init
program
  .command('init')
  .description('Initialize beadless in current repository and configure MCP clients')
  .option('--cursor', 'Generate .cursor/mcp.json configuration')
  .option('--antigravity', 'Configure Google Antigravity MCP settings')
  .option('--claude', 'Print Claude Desktop MCP configuration')
  .action(async (opts) => {
    const cwd = process.cwd();
    const storage = new StorageManager(cwd);
    const git = new GitManager(cwd);

    console.log(pc.cyan('\n🧠 Initializing beadless...'));

    const isRepo = await git.isGitRepo();
    if (!isRepo) {
      console.log(pc.yellow('⚠️  Warning: Current directory is not a git repository. Some git-native features will be paused.'));
    }

    await storage.init();
    console.log(pc.green('✔ Initialized .beadless/ directory'));
    console.log(pc.gray('  - .beadless/config.json'));
    console.log(pc.gray('  - .beadless/memories.json & MEMORIES.md'));
    console.log(pc.gray('  - .beadless/tasks.json & TASKS.md'));
    console.log(pc.gray('  - .beadless/context.json'));

    // 1. Configure Cursor if .cursor directory exists or --cursor requested
    const cursorDir = path.join(cwd, '.cursor');
    const cursorMcpPath = path.join(cursorDir, 'mcp.json');
    if (opts.cursor || existsSync(cursorDir)) {
      if (!existsSync(cursorDir)) await fs.mkdir(cursorDir, { recursive: true });
      let cursorMcp: any = { mcpServers: {} };
      if (existsSync(cursorMcpPath)) {
        try {
          cursorMcp = JSON.parse(await fs.readFile(cursorMcpPath, 'utf-8'));
        } catch {}
      }
      cursorMcp.mcpServers = cursorMcp.mcpServers || {};
      cursorMcp.mcpServers.beadless = {
        command: 'npx',
        args: ['-y', 'beadless', 'mcp']
      };
      await fs.writeFile(cursorMcpPath, JSON.stringify(cursorMcp, null, 2), 'utf-8');
      console.log(pc.green('✔ Configured Cursor MCP (.cursor/mcp.json)'));
    }

    // 2. Configure Antigravity / Gemini CLI if detected
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    const antigravityDir = path.join(homeDir, '.gemini', 'antigravity');
    const antigravityConfigPath = path.join(antigravityDir, 'mcp_config.json');
    if (opts.antigravity || existsSync(antigravityDir)) {
      try {
        let agyConfig: any = { mcpServers: {} };
        if (existsSync(antigravityConfigPath)) {
          agyConfig = JSON.parse(await fs.readFile(antigravityConfigPath, 'utf-8'));
        }
        agyConfig.mcpServers = agyConfig.mcpServers || {};
        agyConfig.mcpServers.beadless = {
          command: 'npx',
          args: ['-y', 'beadless', 'mcp']
        };
        await fs.writeFile(antigravityConfigPath, JSON.stringify(agyConfig, null, 2), 'utf-8');
        console.log(pc.green('✔ Configured Google Antigravity MCP (~/.gemini/antigravity/mcp_config.json)'));
      } catch {}
    }

    console.log(pc.bold('\n🚀 Ready to supercharge your coding agents!'));
    console.log(`Add to your ${pc.bold('Antigravity / Cursor / Claude Code / Windsurf')} MCP settings:`);
    console.log(pc.gray(JSON.stringify({
      beadless: {
        command: "npx",
        args: ["-y", "beadless", "mcp"]
      }
    }, null, 2)));
    console.log('\n');
  });

// remember
program
  .command('remember <title>')
  .description('Save a memory, decision, or lesson')
  .option('-c, --category <category>', 'Category (decision, lesson, architecture, context, preference)', 'decision')
  .option('-m, --message <content>', 'Detailed memory content/reasoning')
  .option('-t, --tags <tags...>', 'Tags for organization')
  .action(async (title, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const memory = new MemoryEngine(storage, git);

    const entry = await memory.remember({
      category: opts.category as MemoryCategory,
      title,
      content: opts.message || title,
      tags: opts.tags || []
    });

    console.log(pc.green(`✔ Saved ${pc.bold(`[${entry.category}]`)}: "${entry.title}" (${entry.id})`));
  });

// recall
program
  .command('recall [query]')
  .description('Search memories by query or category')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <number>', 'Result limit', '5')
  .action(async (query = '', opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const memory = new MemoryEngine(storage, git);

    const results = await memory.recall(query, {
      category: opts.category as MemoryCategory,
      limit: parseInt(opts.limit, 10)
    });

    if (results.length === 0) {
      console.log(pc.yellow('No memories found.'));
      return;
    }

    console.log(pc.cyan(`\nFound ${results.length} memories:\n`));
    for (const r of results) {
      console.log(pc.bold(pc.white(`[${r.category.toUpperCase()}] ${r.title}`)) + pc.gray(` (${r.id})`));
      console.log(pc.gray(`Branch: ${r.branch || 'main'} | Date: ${new Date(r.createdAt).toLocaleDateString()}`));
      console.log(r.content);
      if (r.tags.length > 0) {
        console.log(pc.blue(`Tags: ${r.tags.join(', ')}`));
      }
      console.log(pc.gray('----------------------------------------'));
    }
  });

// context
program
  .command('context')
  .description('Print the full project briefing for fresh agent sessions')
  .action(async () => {
    const storage = new StorageManager();
    const git = new GitManager();
    const context = new ContextEngine(storage, git);

    const dump = await context.getContextDump();
    console.log(dump);
  });

// tasks
const tasksCmd = program.command('tasks').description('Manage task graph & dependencies');

tasksCmd
  .command('list')
  .description('List tasks')
  .option('-r, --ready', 'Show only unblocked tasks ready to work on')
  .action(async (opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const tasks = new TaskEngine(storage, git);

    const list = await tasks.list({ readyOnly: opts.ready });
    if (list.length === 0) {
      console.log(pc.yellow('No tasks found.'));
      return;
    }

    console.log(pc.cyan('\n📋 Task Board:\n'));
    for (const t of list) {
      const statusIcon = t.status === 'completed' ? pc.green('✔') :
                         t.status === 'in_progress' ? pc.blue('⚡') :
                         t.status === 'blocked' ? pc.red('⛔') : pc.gray('⏳');
      const blockerStr = t.blockedBy.length > 0 ? pc.red(` [Blocked by: ${t.blockedBy.join(', ')}]`) : '';
      const claimStr = t.claimedBy ? pc.magenta(` [Claimed: ${t.claimedBy}]`) : '';
      
      console.log(`${statusIcon} ${pc.bold(`[${t.id}]`)} ${t.title} (${t.priority})${blockerStr}${claimStr}`);
    }
    console.log('');
  });

tasksCmd
  .command('create <title>')
  .description('Create a new task')
  .option('-d, --desc <desc>', 'Description')
  .option('-p, --priority <priority>', 'Priority (low, medium, high, critical)', 'medium')
  .option('-b, --blocked-by <ids...>', 'IDs of blocker tasks')
  .action(async (title, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const tasks = new TaskEngine(storage, git);

    const task = await tasks.create({
      title,
      description: opts.desc,
      priority: opts.priority,
      blockedBy: opts.blockedBy
    });

    console.log(pc.green(`✔ Created [${task.id}]: "${task.title}" (Status: ${task.status})`));
  });

tasksCmd
  .command('done <taskId>')
  .description('Mark a task completed and unblock downstream items')
  .option('-o, --outcome <outcome>', 'Brief outcome summary')
  .action(async (taskId, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const tasks = new TaskEngine(storage, git);

    const task = await tasks.complete(taskId, opts.outcome);
    console.log(pc.green(`✔ Marked [${task.id}] completed! Downstream tasks re-evaluated.`));
  });

// mcp
program
  .command('mcp')
  .description('Run beadless as an MCP stdio server')
  .action(async () => {
    await runMcpServer();
  });

// status
program
  .command('status')
  .description('Show beadless repository status')
  .action(async () => {
    const storage = new StorageManager();
    const git = new GitManager();

    if (!storage.isInitialized()) {
      console.log(pc.yellow('beadless is not initialized in this repo. Run: npx beadless init'));
      return;
    }

    const branch = await git.getCurrentBranch();
    const memories = await storage.readMemories();
    const tasks = await storage.readTasks();
    const config = await storage.readConfig();

    console.log(pc.cyan('\n🧠 beadless Status'));
    console.log(pc.gray('===================================='));
    console.log(`Git Branch:     ${pc.bold(branch)}`);
    console.log(`Auto Commit:    ${config.autoCommit ? pc.green('ENABLED') : pc.gray('DISABLED')}`);
    console.log(`Total Memories: ${pc.bold(memories.length.toString())}`);
    console.log(`Total Tasks:    ${pc.bold(tasks.length.toString())} (${tasks.filter(t => t.status === 'completed').length} done, ${tasks.filter(t => t.status === 'in_progress').length} in progress)`);
    console.log(`Storage:        ${storage.getDir()}`);
    console.log(pc.gray('====================================\n'));
  });

program.parse();
