import { StorageManager } from './storage.js';
import { GitManager } from './git.js';
import { MemoryEngine } from './memory.js';
import { MemoryCategory, MemoryEntry, SnapshotResult, GitStatusSummary } from '../types/index.js';

export interface SnapshotOptions {
  title?: string;
  message?: string;
  category?: MemoryCategory;
  force?: boolean;
  tags?: string[];
}

export interface WatcherOptions {
  intervalMinutes?: number;
  immediate?: boolean;
  minChanges?: number;
  onSnapshot?: (result: SnapshotResult) => void;
  onError?: (err: any) => void;
}

export class SnapshotEngine {
  private storage: StorageManager;
  private git: GitManager;
  private memory: MemoryEngine;
  private lastSnapshotSignature: string = '';

  constructor(storage: StorageManager, git: GitManager, memory?: MemoryEngine) {
    this.storage = storage;
    this.git = git;
    this.memory = memory || new MemoryEngine(storage, git);
  }

  async getRepoStatus(): Promise<GitStatusSummary | null> {
    return await this.git.getStatus();
  }

  async takeSnapshot(options: SnapshotOptions = {}): Promise<SnapshotResult | null> {
    const status = await this.git.getStatus();
    const branch = status?.currentBranch || (await this.git.getCurrentBranch());
    const commitHash = await this.git.getLatestCommit();

    const changedFiles = [
      ...(status?.modified || []),
      ...(status?.notAdded || []),
      ...(status?.created || []),
      ...(status?.deleted || []),
      ...(status?.staged || [])
    ];
    const uniqueChanged = Array.from(new Set(changedFiles));
    const isClean = !status || uniqueChanged.length === 0;

    if (isClean && !options.force && !options.title) {
      return null;
    }

    const title = options.title || 
      (uniqueChanged.length > 0 
        ? `Snapshot: ${uniqueChanged.length} file(s) changed on [${branch}]`
        : `Snapshot: Clean workspace state on [${branch}]`);

    const contentLines: string[] = [];
    if (options.message) {
      contentLines.push(options.message, '');
    }

    contentLines.push(`**Branch:** \`${branch}\``);
    if (commitHash) {
      contentLines.push(`**Latest Commit:** \`${commitHash.substring(0, 7)}\``);
    }
    contentLines.push(`**Timestamp:** ${new Date().toISOString()}`);

    if (status) {
      contentLines.push('');
      contentLines.push('### Working Tree Changes:');
      if (status.modified.length > 0) {
        contentLines.push(`- **Modified (${status.modified.length}):** \`${status.modified.slice(0, 20).join('`, `')}\`${status.modified.length > 20 ? ' ...' : ''}`);
      }
      if (status.notAdded.length > 0) {
        contentLines.push(`- **Untracked (${status.notAdded.length}):** \`${status.notAdded.slice(0, 20).join('`, `')}\`${status.notAdded.length > 20 ? ' ...' : ''}`);
      }
      if (status.created.length > 0) {
        contentLines.push(`- **Created (${status.created.length}):** \`${status.created.slice(0, 20).join('`, `')}\`${status.created.length > 20 ? ' ...' : ''}`);
      }
      if (status.deleted.length > 0) {
        contentLines.push(`- **Deleted (${status.deleted.length}):** \`${status.deleted.slice(0, 20).join('`, `')}\`${status.deleted.length > 20 ? ' ...' : ''}`);
      }
      if (status.staged.length > 0) {
        contentLines.push(`- **Staged (${status.staged.length}):** \`${status.staged.slice(0, 20).join('`, `')}\`${status.staged.length > 20 ? ' ...' : ''}`);
      }
      if (uniqueChanged.length === 0) {
        contentLines.push('- *Working tree is clean.*');
      }
    }

    const content = contentLines.join('\n');
    const tags = ['snapshot', 'auto-record', ...(options.tags || [])];

    const entry = await this.memory.remember({
      category: options.category || 'context',
      title,
      content,
      tags
    });

    const summary = `${uniqueChanged.length} file(s) recorded`;
    return {
      entry,
      changesCount: uniqueChanged.length,
      summary
    };
  }

  startWatcher(options: WatcherOptions = {}): { stop: () => void; isRunning: () => boolean } {
    const intervalMinutes = options.intervalMinutes || 10;
    const intervalMs = Math.max(1000, intervalMinutes * 60 * 1000);
    const minChanges = options.minChanges ?? 1;

    let active = true;

    const runCheck = async () => {
      if (!active) return;
      try {
        const status = await this.git.getStatus();
        if (!status) return;

        const totalChanges = status.modified.length + status.notAdded.length + status.created.length + status.deleted.length;
        if (totalChanges >= minChanges) {
          const currentSignature = `${totalChanges}:${status.modified.sort().join(',')}:${status.notAdded.sort().join(',')}`;
          if (currentSignature !== this.lastSnapshotSignature) {
            this.lastSnapshotSignature = currentSignature;
            const res = await this.takeSnapshot({
              title: `Auto-Snapshot: ${totalChanges} file(s) active on [${status.currentBranch}]`
            });
            if (res && options.onSnapshot) {
              options.onSnapshot(res);
            }
          }
        }
      } catch (err) {
        if (options.onError) {
          options.onError(err);
        }
      }
    };

    if (options.immediate) {
      runCheck();
    }

    const timer = setInterval(runCheck, intervalMs);

    return {
      stop: () => {
        active = false;
        clearInterval(timer);
      },
      isRunning: () => active
    };
  }
}
