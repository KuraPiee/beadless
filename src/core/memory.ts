import Fuse from 'fuse.js';
import { StorageManager } from './storage.js';
import { GitManager } from './git.js';
import { MemoryEntry, MemoryCategory } from '../types/index.js';

export class MemoryEngine {
  private storage: StorageManager;
  private git: GitManager;

  constructor(storage: StorageManager, git: GitManager) {
    this.storage = storage;
    this.git = git;
  }

  async remember(input: {
    category: MemoryCategory;
    title: string;
    content: string;
    tags?: string[];
    author?: string;
  }): Promise<MemoryEntry> {
    const memories = await this.storage.readMemories();
    const config = await this.storage.readConfig();

    const branch = await this.git.getCurrentBranch();
    const commitHash = await this.git.getLatestCommit();
    const defaultAuthor = await this.git.getAuthor();

    const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
      id,
      category: input.category,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
      author: input.author || defaultAuthor,
      commitHash,
      branch
    };

    memories.unshift(entry);
    await this.storage.writeMemories(memories);

    if (config.autoCommit) {
      await this.git.autoCommit(`remember: ${entry.title} [${entry.category}]`, config.commitPrefix);
    }

    return entry;
  }

  async recall(
    query: string,
    options?: {
      category?: MemoryCategory;
      limit?: number;
      tags?: string[];
    }
  ): Promise<MemoryEntry[]> {
    let memories = await this.storage.readMemories();

    if (options?.category) {
      memories = memories.filter(m => m.category === options.category);
    }

    if (options?.tags && options.tags.length > 0) {
      memories = memories.filter(m => 
        options.tags!.some(t => m.tags.map(tag => tag.toLowerCase()).includes(t.toLowerCase()))
      );
    }

    if (!query || query.trim() === '') {
      return memories.slice(0, options?.limit || 10);
    }

    const fuse = new Fuse(memories, {
      keys: [
        { name: 'title', weight: 0.5 },
        { name: 'content', weight: 0.3 },
        { name: 'tags', weight: 0.2 }
      ],
      threshold: 0.4,
      ignoreLocation: true
    });

    const results = fuse.search(query);
    const mapped = results.map(r => r.item);
    return mapped.slice(0, options?.limit || 10);
  }

  async list(category?: MemoryCategory, limit = 20): Promise<MemoryEntry[]> {
    const memories = await this.storage.readMemories();
    if (!category) return memories.slice(0, limit);
    return memories.filter(m => m.category === category).slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    const memories = await this.storage.readMemories();
    const initialLen = memories.length;
    const filtered = memories.filter(m => m.id !== id);
    if (filtered.length === initialLen) return false;

    await this.storage.writeMemories(filtered);
    const config = await this.storage.readConfig();
    if (config.autoCommit) {
      await this.git.autoCommit(`forget: ${id}`, config.commitPrefix);
    }
    return true;
  }
}
