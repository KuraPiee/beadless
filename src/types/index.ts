export type MemoryCategory = 'decision' | 'lesson' | 'architecture' | 'context' | 'preference';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author?: string;
  commitHash?: string;
  branch?: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  blockedBy: string[];
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
  outcome?: string;
  branch?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContext {
  name?: string;
  summary?: string;
  stack?: string[];
  conventions?: string[];
  nonNegotiables?: string[];
  keyPaths?: Record<string, string>;
  updatedAt?: string;
}

export interface GitStatusSummary {
  isClean: boolean;
  modified: string[];
  notAdded: string[];
  created: string[];
  deleted: string[];
  staged: string[];
  currentBranch: string;
}

export interface SnapshotResult {
  entry: MemoryEntry;
  changesCount: number;
  summary: string;
}

export interface BeadlessConfig {
  version: string;
  autoCommit: boolean;
  commitPrefix: string;
  branchAware: boolean;
  maxRecentDecisions: number;
  autoSnapshot?: {
    enabled: boolean;
    intervalMinutes: number;
  };
}
export type GitMemConfig = BeadlessConfig;

