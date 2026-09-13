import Fuse from 'fuse.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { StorageManager } from './storage.js';
import { ChatEngine } from './chat.js';
import { GitManager } from './git.js';
import { GlobalSearchResult, MemoryEntry, ChatEntry, MemoryCategory } from '../types/index.js';

export class GlobalEngine {
  private storage: StorageManager;
  private chatEngine: ChatEngine;
  private git: GitManager;

  constructor(storage: StorageManager, git: GitManager, chatEngine?: ChatEngine) {
    this.storage = storage;
    this.git = git;
    this.chatEngine = chatEngine || new ChatEngine(storage, git);
  }

  async rememberGlobal(input: {
    category: MemoryCategory;
    title: string;
    content: string;
    tags?: string[];
  }): Promise<MemoryEntry> {
    const memories = await this.storage.readGlobalMemories();
    const id = `gmem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
      id,
      category: input.category,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
      author: 'GlobalAgent'
    };

    memories.unshift(entry);
    await this.storage.writeGlobalMemories(memories);
    return entry;
  }

  async search(
    query: string,
    options?: {
      limit?: number;
      includeAntigravity?: boolean;
    }
  ): Promise<GlobalSearchResult[]> {
    const limit = options?.limit || 10;
    const trimmed = query.trim();
    const results: GlobalSearchResult[] = [];

    // 1. Gather all recorded chats (both workspace and global)
    const chats = await this.storage.readAllChats(false);
    
    // 2. Gather workspace memories
    const workspaceMemories = await this.storage.readMemories();

    // 3. Gather global memories
    const globalMemories = await this.storage.readGlobalMemories();

    // If query is empty or "all" / "list" / "eriş"
    if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'list' || trimmed.toLowerCase() === 'eriş') {
      for (const c of chats.slice(0, limit)) {
        results.push({
          id: c.id,
          type: 'chat',
          title: c.title,
          snippet: c.summary || (c.decisions?.length ? `Decisions: ${c.decisions.join('; ')}` : 'Chat session'),
          workspace: c.workspace,
          date: c.updatedAt,
          tags: c.tags,
          urlOrPath: `chats/${c.id}.json`
        });
      }
      for (const m of globalMemories.slice(0, limit)) {
        results.push({
          id: m.id,
          type: 'memory',
          title: `[Global] ${m.title}`,
          snippet: m.content.substring(0, 150),
          workspace: 'global',
          date: m.updatedAt,
          tags: m.tags
        });
      }
      return results.slice(0, limit);
    }

    // 4. Fuzzy search across chats & memories
    type SearchableItem = {
      id: string;
      type: 'chat' | 'memory';
      title: string;
      body: string;
      tags: string[];
      workspace?: string;
      date: string;
    };

    const searchPool: SearchableItem[] = [
      ...chats.map(c => ({
        id: c.id,
        type: 'chat' as const,
        title: c.title,
        body: `${c.summary} ${(c.decisions || []).join(' ')} ${(c.filesTouched || []).join(' ')}`,
        tags: c.tags,
        workspace: c.workspace,
        date: c.updatedAt
      })),
      ...workspaceMemories.map(m => ({
        id: m.id,
        type: 'memory' as const,
        title: `[${m.category}] ${m.title}`,
        body: m.content,
        tags: m.tags,
        workspace: 'current-workspace',
        date: m.updatedAt
      })),
      ...globalMemories.map(m => ({
        id: m.id,
        type: 'memory' as const,
        title: `[Global ${m.category}] ${m.title}`,
        body: m.content,
        tags: m.tags,
        workspace: 'global',
        date: m.updatedAt
      }))
    ];

    const fuse = new Fuse(searchPool, {
      keys: [
        { name: 'title', weight: 0.5 },
        { name: 'body', weight: 0.3 },
        { name: 'tags', weight: 0.2 }
      ],
      threshold: 0.4,
      ignoreLocation: true
    });

    const matches = fuse.search(trimmed);
    for (const m of matches) {
      results.push({
        id: m.item.id,
        type: m.item.type,
        title: m.item.title,
        snippet: m.item.body.substring(0, 200),
        workspace: m.item.workspace,
        date: m.item.date,
        tags: m.item.tags
      });
    }

    // 5. If includeAntigravity !== false and we have space or need deeper search,
    // search directly in Antigravity transcripts for exact/token matches
    if (options?.includeAntigravity !== false) {
      const agyResults = await this.searchAntigravityTranscripts(trimmed, Math.max(3, limit - results.length));
      for (const agy of agyResults) {
        if (!results.some(r => r.id === agy.id)) {
          results.push(agy);
        }
      }
    }

    return results.slice(0, limit);
  }

  async searchAntigravityTranscripts(query: string, limit = 5): Promise<GlobalSearchResult[]> {
    const brainDir = this.chatEngine.getAntigravityBrainDir();
    if (!existsSync(brainDir)) return [];

    const results: GlobalSearchResult[] = [];
    const queryLower = query.toLowerCase();

    try {
      const entries = await fs.readdir(brainDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => ({
        name: e.name,
        fullPath: path.join(brainDir, e.name)
      }));

      // Sort dirs by modification time to inspect newer ones first
      const statsList = await Promise.all(
        dirs.map(async d => {
          try {
            const st = await fs.stat(d.fullPath);
            return { ...d, mtime: st.mtimeMs };
          } catch {
            return { ...d, mtime: 0 };
          }
        })
      );
      statsList.sort((a, b) => b.mtime - a.mtime);

      // Check top 35 recent conversations
      for (const d of statsList.slice(0, 35)) {
        if (results.length >= limit) break;
        const transcriptPath = path.join(d.fullPath, '.system_generated', 'logs', 'transcript.jsonl');
        if (!existsSync(transcriptPath)) continue;

        try {
          const content = await fs.readFile(transcriptPath, 'utf-8');
          if (content.toLowerCase().includes(queryLower)) {
            // Found a match! Extract relevant user inputs or snippets
            const lines = content.split('\n');
            let matchedSnippet = '';
            let firstPrompt = '';
            let date = '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const item = JSON.parse(line);
                if (item.created_at && !date) date = item.created_at;
                const text = (item.content || '').toString();
                if (item.type === 'USER_INPUT' && text && !firstPrompt) {
                  firstPrompt = text
                    .replace(/<USER_REQUEST>/gi, '')
                    .replace(/<\/USER_REQUEST>/gi, '')
                    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
                    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
                    .trim()
                    .split('\n')[0]
                    .substring(0, 90);
                }
                if (!matchedSnippet && text.toLowerCase().includes(queryLower)) {
                  const clean = text
                    .replace(/<USER_REQUEST>/gi, '')
                    .replace(/<\/USER_REQUEST>/gi, '')
                    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
                    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
                    .trim();
                  matchedSnippet = clean.substring(0, 200);
                }
              } catch {}
            }

            results.push({
              id: d.name,
              type: 'antigravity_session',
              title: firstPrompt ? `AGY: ${firstPrompt}` : `Antigravity Session (${d.name.substring(0, 8)})`,
              snippet: matchedSnippet || `Matched keyword "${query}" in conversation history`,
              workspace: 'antigravity',
              date: date || new Date(d.mtime).toISOString(),
              tags: ['antigravity', 'transcript-match']
            });
          }
        } catch {}
      }
    } catch {}

    return results;
  }

  async getOverview(): Promise<{
    workspaceChats: number;
    globalChats: number;
    globalMemories: number;
    workspaceMemories: number;
    antigravitySessionsDetected: number;
  }> {
    const workspaceChats = (await this.storage.readAllChats(true)).length;
    const allChats = (await this.storage.readAllChats(false)).length;
    const globalChats = allChats - workspaceChats;
    const globalMemories = (await this.storage.readGlobalMemories()).length;
    const workspaceMemories = (await this.storage.readMemories()).length;

    let agyCount = 0;
    const brainDir = this.chatEngine.getAntigravityBrainDir();
    if (existsSync(brainDir)) {
      try {
        const entries = await fs.readdir(brainDir, { withFileTypes: true });
        agyCount = entries.filter(e => e.isDirectory()).length;
      } catch {}
    }

    return {
      workspaceChats,
      globalChats: Math.max(0, globalChats),
      globalMemories,
      workspaceMemories,
      antigravitySessionsDetected: agyCount
    };
  }
}
