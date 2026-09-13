import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { StorageManager } from './storage.js';
import { GitManager } from './git.js';
import { ChatEntry, ChatSnippet } from '../types/index.js';

export interface RecordChatInput {
  id?: string;
  title: string;
  summary: string;
  workspace?: string;
  branch?: string;
  tags?: string[];
  decisions?: string[];
  filesTouched?: string[];
  messagesCount?: number;
  snippets?: ChatSnippet[];
  source?: 'antigravity' | 'manual' | 'mcp' | 'cursor' | 'claude';
}

export class ChatEngine {
  private storage: StorageManager;
  private git: GitManager;

  constructor(storage: StorageManager, git: GitManager) {
    this.storage = storage;
    this.git = git;
  }

  async recordChat(input: RecordChatInput): Promise<ChatEntry> {
    const branch = input.branch || (await this.git.getCurrentBranch());
    const workspace = input.workspace || path.basename(process.cwd());
    const id = input.id || `chat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const existing = await this.storage.readChat(id);
    const createdAt = existing ? existing.createdAt : now;

    const entry: ChatEntry = {
      id,
      title: input.title.trim(),
      summary: input.summary.trim(),
      workspace,
      branch,
      createdAt,
      updatedAt: now,
      tags: input.tags || existing?.tags || [],
      decisions: input.decisions || existing?.decisions || [],
      filesTouched: input.filesTouched || existing?.filesTouched || [],
      messagesCount: input.messagesCount ?? (existing?.messagesCount || (input.snippets?.length || 0)),
      snippets: input.snippets || existing?.snippets || [],
      source: input.source || existing?.source || 'mcp'
    };

    await this.storage.saveChat(entry, true);
    return entry;
  }

  async getChat(id: string): Promise<ChatEntry | null> {
    return await this.storage.readChat(id);
  }

  async listChats(workspaceOnly = false): Promise<ChatEntry[]> {
    return await this.storage.readAllChats(workspaceOnly);
  }

  async deleteChat(id: string): Promise<boolean> {
    return await this.storage.deleteChat(id);
  }

  getAntigravityBrainDir(): string {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(home, '.gemini', 'antigravity', 'brain');
  }

  async parseAntigravityTranscript(convDir: string): Promise<Partial<ChatEntry> | null> {
    const logPath = path.join(convDir, '.system_generated', 'logs', 'transcript.jsonl');
    if (!existsSync(logPath)) return null;

    try {
      const raw = await fs.readFile(logPath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim().length > 0);
      if (lines.length === 0) return null;

      const convId = path.basename(convDir);
      let firstUserRequest = '';
      let firstTimestamp = '';
      let lastTimestamp = '';
      const userRequests: string[] = [];
      const totalSteps = lines.length;

      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          if (item.created_at) {
            if (!firstTimestamp) firstTimestamp = item.created_at;
            lastTimestamp = item.created_at;
          }
          if (item.type === 'USER_INPUT' && item.content) {
            // Strip <USER_REQUEST> tags if present
            const clean = item.content
              .replace(/<USER_REQUEST>/gi, '')
              .replace(/<\/USER_REQUEST>/gi, '')
              .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
              .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
              .trim();
            if (clean && !firstUserRequest) {
              firstUserRequest = clean.split('\n')[0].substring(0, 100);
            }
            if (clean) {
              userRequests.push(clean.substring(0, 300));
            }
          }
        } catch {}
      }

      const title = firstUserRequest ? `AGY: ${firstUserRequest}` : `Antigravity Session ${convId.substring(0, 8)}`;
      const summary = userRequests.length > 0 
        ? userRequests.slice(0, 3).join(' | ') 
        : `Antigravity conversation ${convId} with ${totalSteps} interaction steps.`;

      return {
        id: convId,
        title,
        summary,
        workspace: 'antigravity',
        createdAt: firstTimestamp || new Date().toISOString(),
        updatedAt: lastTimestamp || new Date().toISOString(),
        tags: ['antigravity', 'agent-session', 'auto-indexed'],
        decisions: [],
        filesTouched: [],
        messagesCount: userRequests.length,
        source: 'antigravity'
      };
    } catch {
      return null;
    }
  }

  async syncAntigravityRecent(limit = 25): Promise<{ synced: number; chats: ChatEntry[] }> {
    const brainDir = this.getAntigravityBrainDir();
    if (!existsSync(brainDir)) return { synced: 0, chats: [] };

    const entries = await fs.readdir(brainDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => ({
      name: e.name,
      fullPath: path.join(brainDir, e.name)
    }));

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
    const topDirs = statsList.slice(0, limit);

    const syncedChats: ChatEntry[] = [];

    for (const d of topDirs) {
      const parsed = await this.parseAntigravityTranscript(d.fullPath);
      if (parsed && parsed.id) {
        const fullChat: ChatEntry = {
          id: parsed.id,
          title: parsed.title || `Antigravity: ${parsed.id.substring(0, 8)}`,
          summary: parsed.summary || 'Antigravity session transcript',
          workspace: parsed.workspace || 'antigravity',
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          tags: parsed.tags || ['antigravity'],
          decisions: parsed.decisions || [],
          filesTouched: parsed.filesTouched || [],
          messagesCount: parsed.messagesCount || 0,
          source: 'antigravity'
        };
        await this.storage.saveChat(fullChat, true);
        syncedChats.push(fullChat);
      }
    }

    return {
      synced: syncedChats.length,
      chats: syncedChats
    };
  }
}
