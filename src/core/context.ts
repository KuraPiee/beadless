import { StorageManager } from './storage.js';
import { GitManager } from './git.js';
import { ProjectContext } from '../types/index.js';

export class ContextEngine {
  private storage: StorageManager;
  private git: GitManager;

  constructor(storage: StorageManager, git: GitManager) {
    this.storage = storage;
    this.git = git;
  }

  async setContext(patch: Partial<ProjectContext>): Promise<ProjectContext> {
    const current = await this.storage.readContext();
    const updated: ProjectContext = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await this.storage.writeContext(updated);
    
    const config = await this.storage.readConfig();
    if (config.autoCommit) {
      await this.git.autoCommit('update project context', config.commitPrefix);
    }
    return updated;
  }

  async getContextDump(): Promise<string> {
    const context = await this.storage.readContext();
    const memories = await this.storage.readMemories();
    const tasks = await this.storage.readTasks();
    const branch = await this.git.getCurrentBranch();

    const decisions = memories.filter(m => m.category === 'decision').slice(0, 5);
    const lessons = memories.filter(m => m.category === 'lesson').slice(0, 5);

    const readyTasks = tasks.filter(t => {
      if (t.status !== 'pending') return false;
      return !t.blockedBy.some(bId => {
        const b = tasks.find(x => x.id === bId);
        return !b || b.status !== 'completed';
      });
    });

    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

    let out = `# 🧠 GitMem Context Briefing\n`;
    out += `**Branch:** \`${branch}\` | **Updated:** ${new Date().toLocaleTimeString()}\n\n`;

    if (context.name || context.summary) {
      out += `## 📦 Project Overview\n`;
      if (context.name) out += `- **Name:** ${context.name}\n`;
      if (context.summary) out += `- **Summary:** ${context.summary}\n`;
      if (context.stack && context.stack.length > 0) out += `- **Stack:** ${context.stack.join(', ')}\n`;
      if (context.conventions && context.conventions.length > 0) {
        out += `- **Conventions:**\n  * ${context.conventions.join('\n  * ')}\n`;
      }
      out += `\n`;
    }

    if (lessons.length > 0) {
      out += `## ⚠️ Critical Lessons & Gotchas (Do NOT repeat!)\n`;
      for (const l of lessons) {
        out += `- **${l.title}:** ${l.content}\n`;
      }
      out += `\n`;
    }

    if (decisions.length > 0) {
      out += `## 🏛️ Recent Architectural Decisions\n`;
      for (const d of decisions) {
        out += `- **${d.title}:** ${d.content}\n`;
      }
      out += `\n`;
    }

    if (inProgressTasks.length > 0 || readyTasks.length > 0) {
      out += `## 📋 Task Queue\n`;
      if (inProgressTasks.length > 0) {
        out += `### In Progress:\n`;
        for (const t of inProgressTasks) {
          out += `- [${t.id}] **${t.title}** (claimed by: ${t.claimedBy || 'Agent'})\n`;
        }
      }
      if (readyTasks.length > 0) {
        out += `### Ready to Start (Unblocked):\n`;
        for (const t of readyTasks.slice(0, 5)) {
          out += `- [${t.id}] **${t.title}** [${t.priority}]\n`;
        }
      }
      out += `\n`;
    }

    return out;
  }
}
