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
import { SnapshotEngine } from './core/snapshot.js';
import { ChatEngine } from './core/chat.js';
import { GlobalEngine } from './core/global.js';
import { runMcpServer } from './mcp/server.js';
import { MemoryCategory } from './types/index.js';

const program = new Command();

program
  .name('beadless')
  .description('🧠 Git-native persistent memory, multi-chat isolation & global intelligence for AI coding agents (Antigravity, Cursor, Claude Code)')
  .version('0.3.0');

// kurapiee easter egg & bio command
function printKurapieeBio() {
  console.log(pc.cyan(`
  ██╗  ██╗██╗   ██╗██████╗  █████╗ ██████╗ ██╗███████╗███████╗
  ██║ ██╔╝██║   ██║██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██╔════╝
  █████╔╝ ██║   ██║██████╔╝███████║██████╔╝██║█████╗  █████╗  
  ██╔═██╗ ██║   ██║██╔══██╗██╔══██║██╔═══╝ ██║██╔══╝  ██╔══╝  
  ██║  ██╗╚██████╔╝██║  ██║██║  ██║██║     ██║███████╗███████╗
  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝
`));
  console.log(pc.bold(pc.white('  ======================================================')));
  console.log(`  ${pc.bold(pc.green('👤 Creator:'))}      ${pc.bold(pc.white('KuraPiee'))} (Eren)`);
  console.log(`  ${pc.bold(pc.blue('🐙 GitHub:'))}       ${pc.cyan('https://github.com/KuraPiee')}`);
  console.log(`  ${pc.bold(pc.magenta('🌐 Platforms:'))}    ${pc.white('Docwyrm (docwyrm.com) & beadless')}`);
  console.log(`  ${pc.bold(pc.yellow('⚡ Speciality:'))}   ${pc.white('Agentic AI Systems, MCP Tooling & Open-Source')}`);
  console.log(`  ${pc.bold(pc.red('🔥 Mission:'))}      ${pc.white('Killing AI context amnesia with zero-bloat git tooling.')}`);
  console.log(pc.bold(pc.white('  ======================================================\n')));
}

program
  .command('whoami')
  .alias('kurapiee')
  .alias('about')
  .description('KuraPiee (Eren) kimdir? Geliştirici ve yaratıcı hakkında bilgi')
  .action(() => {
    printKurapieeBio();
  });

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
    if (query.toLowerCase() === 'kurapiee' || query.toLowerCase() === 'kurapiee kimdir') {
      printKurapieeBio();
      return;
    }

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

// snapshot
program
  .command('snapshot [title...]')
  .alias('snap')
  .description('Record an immediate snapshot of workspace changes and git status into memory')
  .option('-m, --message <message>', 'Detailed description of changes or focus')
  .option('-c, --category <category>', 'Memory category (context, architecture, lesson, decision)', 'context')
  .option('-f, --force', 'Force snapshot even if working tree is clean')
  .action(async (titleParts, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const memory = new MemoryEngine(storage, git);
    const snapshot = new SnapshotEngine(storage, git, memory);

    const title = Array.isArray(titleParts) && titleParts.length > 0 ? titleParts.join(' ').trim() : undefined;

    const res = await snapshot.takeSnapshot({
      title,
      message: opts.message,
      category: opts.category as MemoryCategory,
      force: true
    });

    if (!res) {
      console.log(pc.yellow('Working tree is clean. No snapshot recorded.'));
      return;
    }

    console.log(pc.green(`✔ Anlık kayıt alındı: ${pc.bold(`[${res.entry.id}]`)} "${res.entry.title}" (${res.summary})`));
    console.log(pc.gray('  Eski kayıtlar korundu. (.beadless/memories.json güncellendi)'));
  });

// delete / del / forget
program
  .command('del [queryOrId...]')
  .alias('delete')
  .alias('rm')
  .alias('forget')
  .description('Delete a memory entry by ID or by describing what to delete (smart matching)')
  .option('-f, --force', 'Force delete first match if multiple found')
  .action(async (args, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const memory = new MemoryEngine(storage, git);

    const input = Array.isArray(args) && args.length > 0 ? args.join(' ').trim() : '';

    if (!input) {
      const recent = await memory.list(undefined, 8);
      console.log(pc.cyan('\n🗑️ beadless Kayıt Silme'));
      console.log(pc.gray('===================================='));
      if (recent.length === 0) {
        console.log(pc.yellow('Hafızada kayıtlı hiçbir bellek bulunmuyor.'));
        return;
      }
      console.log(pc.white('Silmek istediğin kaydın ID\'sini veya anlatımını belirt:'));
      console.log(pc.gray('Örnek: ') + pc.yellow('beadless del <ID>') + pc.gray(' veya ') + pc.yellow('beadless del "eski db kararı"') + '\n');
      console.log(pc.bold('Mevcut Son Kayıtlar:'));
      for (const m of recent) {
        console.log(`- ${pc.magenta(`[${m.id}]`)} ${pc.bold(m.title)} ${pc.gray(`(${m.category}, ${new Date(m.createdAt).toLocaleDateString()})`)}`);
      }
      console.log(pc.gray('====================================\n'));
      return;
    }

    const res = await memory.deleteByQueryOrId(input);
    if (res.success && res.deleted) {
      console.log(pc.green(`✔ Silindi: ${pc.bold(`[${res.deleted.id}]`)} "${res.deleted.title}"`));
      if (res.deleted.content) {
        console.log(pc.gray(`  Açıklama: ${res.deleted.content.slice(0, 100)}...`));
      }
    } else {
      if (res.matches && res.matches.length > 1) {
        if (opts.force) {
          const target = res.matches[0];
          await memory.delete(target.id);
          console.log(pc.green(`✔ (--force) En iyi eşleşen silindi: ${pc.bold(`[${target.id}]`)} "${target.title}"`));
          return;
        }
        console.log(pc.yellow(`\n⚠️  "${input}" ifadesiyle birden fazla (${res.matches.length}) kayıt eşleşti:`));
        for (const m of res.matches) {
          console.log(`  - ${pc.magenta(`[${m.id}]`)} ${pc.bold(m.title)} ${pc.gray(`(${m.category})`)}`);
        }
        console.log(pc.cyan('\nSilmek istediğin kaydın tam ID\'sini yaz:'));
        console.log(pc.white(`  beadless del ${res.matches[0].id}\n`));
      } else {
        console.log(pc.red(`❌ ${res.message}`));
      }
    }
  });

// watch / auto periodic recorder
program
  .command('watch')
  .alias('auto')
  .description('Start periodic auto-snapshot watcher to continuously record repository changes')
  .option('-i, --interval <minutes>', 'Interval in minutes between auto-snapshots', '10')
  .option('-m, --min-changes <number>', 'Minimum changed files required to trigger a snapshot', '1')
  .option('--immediate', 'Take an immediate snapshot on start', false)
  .action(async (opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const memory = new MemoryEngine(storage, git);
    const snapshot = new SnapshotEngine(storage, git, memory);

    const intervalMinutes = parseFloat(opts.interval) || 10;
    const minChanges = parseInt(opts.minChanges, 10) || 1;

    console.log(pc.cyan('\n🧠 beadless Auto-Snapshot Watcher'));
    console.log(pc.gray('===================================='));
    console.log(`Interval:    ${pc.bold(`Every ${intervalMinutes} minute(s)`)}`);
    console.log(`Min changes: ${pc.bold(minChanges.toString())} file(s)`);
    console.log(`Storage:     ${storage.getDir()}`);
    console.log(pc.gray('Auto-recording active. Press Ctrl+C to stop.\n'));

    const watcher = snapshot.startWatcher({
      intervalMinutes,
      immediate: opts.immediate,
      minChanges,
      onSnapshot: (res) => {
        const time = new Date().toLocaleTimeString();
        console.log(`[${pc.gray(time)}] ${pc.green('✔ Auto-Snapshot:')} ${pc.bold(res.entry.title)} ${pc.gray(`(${res.entry.id}, ${res.summary})`)}`);
      },
      onError: (err) => {
        console.error(pc.red(`⚠️  Watcher error: ${err?.message || err}`));
      }
    });

    process.on('SIGINT', () => {
      console.log(pc.yellow('\nStopping auto-snapshot watcher...'));
      watcher.stop();
      process.exit(0);
    });
  });

// mcp
program
  .command('mcp')
  .description('Run beadless as an MCP stdio server')
  .action(async () => {
    await runMcpServer();
  });

// global
program
  .command('global [query...]')
  .alias('g')
  .alias('global-recall')
  .description('Search across all chat sessions, global memories, and Antigravity conversation transcripts')
  .option('-l, --limit <number>', 'Maximum number of results to display', '8')
  .option('--no-antigravity', 'Disable live search in Antigravity transcripts')
  .action(async (queryParts, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const chat = new ChatEngine(storage, git);
    const globalEngine = new GlobalEngine(storage, git, chat);

    const query = Array.isArray(queryParts) && queryParts.length > 0 ? queryParts.join(' ').trim() : '';

    if (!query) {
      const overview = await globalEngine.getOverview();
      console.log(pc.cyan('\n🌐 beadless Global Hafıza & Sohbet Merkezi'));
      console.log(pc.gray('======================================================'));
      console.log(`Bu Çalışma Alanı Sohbetleri:     ${pc.bold(overview.workspaceChats.toString())}`);
      console.log(`Genel (Global) Sohbet Kayıtları: ${pc.bold(overview.globalChats.toString())}`);
      console.log(`Global Bellekler:                ${pc.bold(overview.globalMemories.toString())}`);
      console.log(`Mevcut Repo Bellekleri:          ${pc.bold(overview.workspaceMemories.toString())}`);
      console.log(`Tespit Edilen AGY Oturumları:    ${pc.bold(overview.antigravitySessionsDetected.toString())}`);
      console.log(pc.gray('------------------------------------------------------'));
      console.log(pc.white('Tüm chat ve oturumlar arasında arama yapmak için:'));
      console.log(pc.yellow('  beadless global <konu / soru / kelime>'));
      console.log(pc.gray('Örnekler:'));
      console.log(pc.gray('  beadless global "canvas font"') + pc.white(' -> Tüm chatlerde Canvas font çözümlerini arar'));
      console.log(pc.gray('  beadless global "gods-eye-view"') + pc.white(' -> Projeyle ilgili geçmiş oturumları bulur'));
      console.log(pc.gray('  beadless chat sync') + pc.white(' -> Antigravity geçmişini beadless belleğine endeksler'));
      console.log(pc.gray('======================================================\n'));
      return;
    }

    console.log(pc.cyan(`\n🔍 Global Arama: "${pc.bold(query)}"`));
    console.log(pc.gray('======================================================'));

    const results = await globalEngine.search(query, {
      limit: parseInt(opts.limit, 10),
      includeAntigravity: opts.antigravity !== false
    });

    if (results.length === 0) {
      console.log(pc.yellow(`"${query}" ile eşleşen hiçbir sohbet kaydı veya bellek bulunamadı.`));
      return;
    }

    for (const r of results) {
      const typeBadge = r.type === 'chat' ? pc.bgBlue(pc.white(' CHAT ')) :
                        r.type === 'antigravity_session' ? pc.bgMagenta(pc.white(' AGY OTURUM ')) :
                        pc.bgGreen(pc.black(' BELLEK '));
      const dateStr = r.date ? new Date(r.date).toLocaleDateString() : '';
      console.log(`\n${typeBadge} ${pc.bold(pc.white(r.title))} ${pc.gray(`(${r.id})`)}`);
      console.log(pc.gray(`Konum/Kaynak: ${r.workspace || 'global'} | Tarih: ${dateStr}`));
      console.log(r.snippet);
      if (r.tags && r.tags.length > 0) {
        console.log(pc.blue(`Etiketler: ${r.tags.join(', ')}`));
      }
      console.log(pc.gray('------------------------------------------------------'));
    }
    console.log('');
  });

// chat
const chatCmd = program.command('chat').description('Manage separate chat sessions and conversation memories');

chatCmd
  .command('save <title...>')
  .description('Save or update the current chat session')
  .option('-s, --summary <summary>', 'Summary of what was discussed and accomplished')
  .option('-t, --tags <tags...>', 'Tags for organization')
  .option('-d, --decisions <decisions...>', 'Key decisions made')
  .option('-f, --files <files...>', 'Files touched / modified')
  .option('--id <id>', 'Specific conversation or chat ID')
  .action(async (titleParts, opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const chat = new ChatEngine(storage, git);

    const title = Array.isArray(titleParts) ? titleParts.join(' ').trim() : String(titleParts);
    const summary = opts.summary || title;

    const entry = await chat.recordChat({
      id: opts.id,
      title,
      summary,
      tags: opts.tags,
      decisions: opts.decisions,
      filesTouched: opts.files,
      source: 'manual'
    });

    console.log(pc.green(`✔ Sohbet oturumu kaydedildi: ${pc.bold(`[${entry.id}]`)} "${entry.title}"`));
    console.log(pc.gray(`  Yerel ve global hafızaya yansıtıldı (.beadless/chats/${entry.id}.json)`));
  });

chatCmd
  .command('list')
  .description('List recorded chat sessions')
  .option('-w, --workspace-only', 'List only chats for this workspace', false)
  .action(async (opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const chat = new ChatEngine(storage, git);

    const chats = await chat.listChats(opts.workspaceOnly);
    if (chats.length === 0) {
      console.log(pc.yellow('Kayıtlı herhangi bir sohbet bulunamadı.'));
      return;
    }

    console.log(pc.cyan(`\n💬 Kayıtlı Sohbetler (${chats.length}):\n`));
    for (const c of chats) {
      const dateStr = new Date(c.updatedAt).toLocaleDateString();
      const filesCount = c.filesTouched?.length ? ` | 📁 ${c.filesTouched.length} dosya` : '';
      console.log(`- ${pc.magenta(`[${c.id}]`)} ${pc.bold(c.title)} ${pc.gray(`(${c.workspace}, ${dateStr}${filesCount})`)}`);
      if (c.summary) {
        console.log(pc.gray(`  ${c.summary.substring(0, 120)}${c.summary.length > 120 ? '...' : ''}`));
      }
    }
    console.log('');
  });

chatCmd
  .command('sync')
  .description('Scan and index recent Antigravity conversation transcripts into beadless')
  .option('-l, --limit <number>', 'Number of recent sessions to index', '25')
  .action(async (opts) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const chat = new ChatEngine(storage, git);

    const limit = parseInt(opts.limit, 10) || 25;
    console.log(pc.cyan(`\n🛰️ Antigravity oturumları taranıyor ve endeksleniyor (son ${limit} oturum)...`));

    const res = await chat.syncAntigravityRecent(limit);
    console.log(pc.green(`✔ ${res.synced} Antigravity oturumu başarıyla beadless global hafızasına endekslendi!`));
    console.log(pc.gray('Artık "beadless global <konu>" ile tüm bu oturumlar içinde anında arama yapabilirsiniz.\n'));
  });

chatCmd
  .command('show <chatId>')
  .description('Show details of a specific chat session')
  .action(async (chatId) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const chat = new ChatEngine(storage, git);

    const entry = await chat.getChat(chatId);
    if (!entry) {
      console.log(pc.red(`"${chatId}" ID'sine sahip bir sohbet kaydı bulunamadı.`));
      return;
    }

    console.log(pc.cyan(`\n💬 Sohbet Detayı: ${pc.bold(entry.title)}`));
    console.log(pc.gray('======================================================'));
    console.log(`ID:           ${entry.id}`);
    console.log(`Workspace:    ${entry.workspace}`);
    console.log(`Tarih:        ${new Date(entry.createdAt).toLocaleString()}`);
    console.log(`Kaynak:       ${entry.source || 'mcp'}`);
    console.log(`Özet:\n${entry.summary}\n`);

    if (entry.decisions && entry.decisions.length > 0) {
      console.log(pc.bold('Alınan Kararlar:'));
      for (const d of entry.decisions) console.log(`  - ${d}`);
      console.log('');
    }

    if (entry.filesTouched && entry.filesTouched.length > 0) {
      console.log(pc.bold('Dokunulan Dosyalar:'));
      for (const f of entry.filesTouched) console.log(`  - ${f}`);
      console.log('');
    }

    if (entry.tags && entry.tags.length > 0) {
      console.log(pc.blue(`Etiketler: ${entry.tags.join(', ')}`));
    }
    console.log(pc.gray('======================================================\n'));
  });

chatCmd
  .command('del <chatId>')
  .description('Delete a chat session')
  .action(async (chatId) => {
    const storage = new StorageManager();
    const git = new GitManager();
    const chat = new ChatEngine(storage, git);

    const deleted = await chat.deleteChat(chatId);
    if (deleted) {
      console.log(pc.green(`✔ Sohbet kaydı [${chatId}] başarıyla silindi.`));
    } else {
      console.log(pc.red(`[${chatId}] bulunamadı veya silinemedi.`));
    }
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

// Check if user ran `beadless kurapiee` or `beadless whoami`
const rawArgs = process.argv.slice(2);
if (rawArgs.length > 0 && (rawArgs[0] === 'kurapiee' || rawArgs[0] === 'whoami' || rawArgs[0] === 'kurapiee-kimdir')) {
  printKurapieeBio();
  process.exit(0);
}

program.parse();
