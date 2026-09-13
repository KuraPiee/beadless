import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { BeadlessConfig, MemoryEntry, TaskItem, ProjectContext, ChatEntry } from '../types/index.js';

export class StorageManager {
  private baseDir: string;
  private beadlessDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    // Support either .beadless or fallback to .gitmem
    if (existsSync(path.join(baseDir, '.gitmem')) && !existsSync(path.join(baseDir, '.beadless'))) {
      this.beadlessDir = path.join(baseDir, '.gitmem');
    } else {
      this.beadlessDir = path.join(baseDir, '.beadless');
    }
  }

  getDir(): string {
    return this.beadlessDir;
  }

  isInitialized(): boolean {
    return existsSync(this.beadlessDir) && existsSync(path.join(this.beadlessDir, 'config.json'));
  }

  async ensureDir(): Promise<void> {
    if (!existsSync(this.beadlessDir)) {
      await fs.mkdir(this.beadlessDir, { recursive: true });
    }
  }

  async init(projectName?: string): Promise<void> {
    await this.ensureDir();

    const defaultConfig: BeadlessConfig = {
      version: '0.1.0',
      autoCommit: true,
      commitPrefix: 'chore(beadless): ',
      branchAware: true,
      maxRecentDecisions: 10
    };

    const initialContext: ProjectContext = {
      name: projectName || path.basename(this.baseDir),
      summary: 'Project managed with beadless - Git-native agent memory & task graph',
      stack: [],
      conventions: [],
      nonNegotiables: [],
      keyPaths: {},
      updatedAt: new Date().toISOString()
    };

    if (!existsSync(path.join(this.beadlessDir, 'config.json'))) {
      await this.writeJson('config.json', defaultConfig);
    }
    if (!existsSync(path.join(this.beadlessDir, 'memories.json'))) {
      await this.writeJson('memories.json', []);
    }
    if (!existsSync(path.join(this.beadlessDir, 'tasks.json'))) {
      await this.writeJson('tasks.json', []);
    }
    if (!existsSync(path.join(this.beadlessDir, 'context.json'))) {
      await this.writeJson('context.json', initialContext);
    }

    await this.syncMarkdownViews([], []);
  }

  async readConfig(): Promise<BeadlessConfig> {
    const defaultCfg: BeadlessConfig = {
      version: '0.2.0',
      autoCommit: true,
      commitPrefix: 'chore(beadless): ',
      branchAware: true,
      maxRecentDecisions: 10,
      autoSnapshot: {
        enabled: false,
        intervalMinutes: 10
      }
    };
    return await this.readJson<BeadlessConfig>('config.json', defaultCfg);
  }

  async writeConfig(config: BeadlessConfig): Promise<void> {
    await this.writeJson('config.json', config);
  }

  async readMemories(): Promise<MemoryEntry[]> {
    return await this.readJson<MemoryEntry[]>('memories.json', []);
  }

  async writeMemories(memories: MemoryEntry[]): Promise<void> {
    await this.writeJson('memories.json', memories);
    const tasks = await this.readTasks();
    await this.syncMarkdownViews(memories, tasks);
  }

  async readTasks(): Promise<TaskItem[]> {
    return await this.readJson<TaskItem[]>('tasks.json', []);
  }

  async writeTasks(tasks: TaskItem[]): Promise<void> {
    await this.writeJson('tasks.json', tasks);
    const memories = await this.readMemories();
    await this.syncMarkdownViews(memories, tasks);
  }

  async readContext(): Promise<ProjectContext> {
    return await this.readJson<ProjectContext>('context.json', {});
  }

  async writeContext(context: ProjectContext): Promise<void> {
    context.updatedAt = new Date().toISOString();
    await this.writeJson('context.json', context);
  }

  getChatsDir(): string {
    return path.join(this.beadlessDir, 'chats');
  }

  getGlobalDir(): string {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(home, '.beadless');
  }

  getGlobalChatsDir(): string {
    return path.join(this.getGlobalDir(), 'chats');
  }

  async ensureChatsDir(): Promise<void> {
    const dir = this.getChatsDir();
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async ensureGlobalDir(): Promise<void> {
    const globalDir = this.getGlobalDir();
    if (!existsSync(globalDir)) {
      await fs.mkdir(globalDir, { recursive: true });
    }
    const globalChats = this.getGlobalChatsDir();
    if (!existsSync(globalChats)) {
      await fs.mkdir(globalChats, { recursive: true });
    }
  }

  async saveChat(chat: ChatEntry, mirrorGlobal: boolean = true): Promise<void> {
    await this.ensureChatsDir();
    const localPath = path.join(this.getChatsDir(), `${chat.id}.json`);
    await fs.writeFile(localPath, JSON.stringify(chat, null, 2), 'utf-8');

    if (mirrorGlobal) {
      try {
        await this.ensureGlobalDir();
        const globalPath = path.join(this.getGlobalChatsDir(), `${chat.id}.json`);
        await fs.writeFile(globalPath, JSON.stringify(chat, null, 2), 'utf-8');
      } catch {
        // Non-critical global mirror failure
      }
    }
  }

  async readChat(id: string): Promise<ChatEntry | null> {
    const localPath = path.join(this.getChatsDir(), `${id}.json`);
    if (existsSync(localPath)) {
      try {
        const content = await fs.readFile(localPath, 'utf-8');
        return JSON.parse(content) as ChatEntry;
      } catch {}
    }
    const globalPath = path.join(this.getGlobalChatsDir(), `${id}.json`);
    if (existsSync(globalPath)) {
      try {
        const content = await fs.readFile(globalPath, 'utf-8');
        return JSON.parse(content) as ChatEntry;
      } catch {}
    }
    return null;
  }

  async readAllChats(workspaceOnly: boolean = false): Promise<ChatEntry[]> {
    const map = new Map<string, ChatEntry>();

    // 1. Read workspace chats
    const localDir = this.getChatsDir();
    if (existsSync(localDir)) {
      try {
        const files = await fs.readdir(localDir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            try {
              const raw = await fs.readFile(path.join(localDir, f), 'utf-8');
              const parsed = JSON.parse(raw) as ChatEntry;
              map.set(parsed.id, parsed);
            } catch {}
          }
        }
      } catch {}
    }

    // 2. Read global chats unless workspaceOnly is true
    if (!workspaceOnly) {
      const globalChatsDir = this.getGlobalChatsDir();
      if (existsSync(globalChatsDir)) {
        try {
          const files = await fs.readdir(globalChatsDir);
          for (const f of files) {
            if (f.endsWith('.json')) {
              try {
                const raw = await fs.readFile(path.join(globalChatsDir, f), 'utf-8');
                const parsed = JSON.parse(raw) as ChatEntry;
                if (!map.has(parsed.id)) {
                  map.set(parsed.id, parsed);
                }
              } catch {}
            }
          }
        } catch {}
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async deleteChat(id: string): Promise<boolean> {
    let deleted = false;
    const localPath = path.join(this.getChatsDir(), `${id}.json`);
    if (existsSync(localPath)) {
      await fs.unlink(localPath);
      deleted = true;
    }
    const globalPath = path.join(this.getGlobalChatsDir(), `${id}.json`);
    if (existsSync(globalPath)) {
      await fs.unlink(globalPath);
      deleted = true;
    }
    return deleted;
  }

  async readGlobalMemories(): Promise<MemoryEntry[]> {
    const globalPath = path.join(this.getGlobalDir(), 'global_memories.json');
    if (!existsSync(globalPath)) return [];
    try {
      const data = await fs.readFile(globalPath, 'utf-8');
      return JSON.parse(data) as MemoryEntry[];
    } catch {
      return [];
    }
  }

  async writeGlobalMemories(memories: MemoryEntry[]): Promise<void> {
    await this.ensureGlobalDir();
    const globalPath = path.join(this.getGlobalDir(), 'global_memories.json');
    await fs.writeFile(globalPath, JSON.stringify(memories, null, 2), 'utf-8');
  }

  private async syncMarkdownViews(memories: MemoryEntry[], tasks: TaskItem[]): Promise<void> {
    try {
      let memMd = `# 🧠 Project Memory Log\n\n> Auto-generated by **[beadless](https://github.com/KuraPiee/beadless)**. Committed directly to git.\n\n`;
      
      const categories = ['decision', 'lesson', 'architecture', 'context', 'preference'] as const;
      for (const cat of categories) {
        const items = memories.filter(m => m.category === cat);
        if (items.length > 0) {
          memMd += `## ${cat.toUpperCase()}S (${items.length})\n\n`;
          for (const item of items) {
            memMd += `### ${item.title}\n`;
            memMd += `*Added: ${new Date(item.createdAt).toLocaleDateString()} | Author: ${item.author || 'Agent'} | Tags: ${item.tags.join(', ') || 'none'}*\n\n`;
            memMd += `${item.content}\n\n---\n\n`;
          }
        }
      }
      await fs.writeFile(path.join(this.beadlessDir, 'MEMORIES.md'), memMd, 'utf-8');

      let taskMd = `# 📋 Task Dependency Graph\n\n> Auto-generated by **[beadless](https://github.com/KuraPiee/beadless)**.\n\n`;
      const pending = tasks.filter(t => t.status === 'pending');
      const inProgress = tasks.filter(t => t.status === 'in_progress');
      const completed = tasks.filter(t => t.status === 'completed');

      taskMd += `## 🚀 In Progress (${inProgress.length})\n`;
      for (const t of inProgress) {
        taskMd += `- **[${t.id}] ${t.title}** (Claimed by: \`${t.claimedBy || 'Agent'}\`)\n`;
      }

      taskMd += `\n## ⏳ Pending / Ready (${pending.length})\n`;
      for (const t of pending) {
        const blockerText = t.blockedBy.length > 0 ? ` _(Blocked by: ${t.blockedBy.join(', ')})_` : ' _(Unblocked)_';
        taskMd += `- [${t.priority}] **[${t.id}] ${t.title}**${blockerText}\n`;
      }

      taskMd += `\n## ✅ Completed (${completed.length})\n`;
      for (const t of completed.slice(-10)) {
        taskMd += `- ~~**[${t.id}] ${t.title}**~~ (${t.outcome || 'Done'})\n`;
      }

      await fs.writeFile(path.join(this.beadlessDir, 'TASKS.md'), taskMd, 'utf-8');
    } catch {
      // Non-critical markdown sync failure
    }
  }

  private async readJson<T>(filename: string, fallback: T): Promise<T> {
    const filePath = path.join(this.beadlessDir, filename);
    if (!existsSync(filePath)) return fallback;
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson<T>(filename: string, data: T): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.beadlessDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
