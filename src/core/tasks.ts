import { StorageManager } from './storage.js';
import { GitManager } from './git.js';
import { TaskItem, TaskPriority, TaskStatus } from '../types/index.js';

export class TaskEngine {
  private storage: StorageManager;
  private git: GitManager;

  constructor(storage: StorageManager, git: GitManager) {
    this.storage = storage;
    this.git = git;
  }

  async create(input: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    blockedBy?: string[];
    tags?: string[];
  }): Promise<TaskItem> {
    const tasks = await this.storage.readTasks();
    const config = await this.storage.readConfig();
    const branch = await this.git.getCurrentBranch();

    const id = `task-${tasks.length + 1}`;
    const now = new Date().toISOString();

    const task: TaskItem = {
      id,
      title: input.title.trim(),
      description: input.description?.trim(),
      status: (input.blockedBy && input.blockedBy.length > 0) ? 'blocked' : 'pending',
      priority: input.priority || 'medium',
      blockedBy: input.blockedBy || [],
      branch,
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now
    };

    tasks.push(task);
    await this.storage.writeTasks(tasks);

    if (config.autoCommit) {
      await this.git.autoCommit(`task created: [${task.id}] ${task.title}`, config.commitPrefix);
    }

    return task;
  }

  async claim(taskId: string, agentName: string): Promise<TaskItem> {
    const tasks = await this.storage.readTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Check if task is blocked
    const uncompletedBlockers = task.blockedBy.filter(bId => {
      const blocker = tasks.find(t => t.id === bId);
      return !blocker || blocker.status !== 'completed';
    });

    if (uncompletedBlockers.length > 0) {
      throw new Error(`Cannot claim task ${taskId}: blocked by ${uncompletedBlockers.join(', ')}`);
    }

    task.status = 'in_progress';
    task.claimedBy = agentName;
    task.claimedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();

    await this.storage.writeTasks(tasks);

    const config = await this.storage.readConfig();
    if (config.autoCommit) {
      await this.git.autoCommit(`task claimed: [${task.id}] by ${agentName}`, config.commitPrefix);
    }

    return task;
  }

  async complete(taskId: string, outcome?: string): Promise<TaskItem> {
    const tasks = await this.storage.readTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.outcome = outcome;
    task.updatedAt = new Date().toISOString();

    // Re-evaluate blocked status of downstream tasks
    for (const other of tasks) {
      if (other.status === 'blocked') {
        const stillBlocked = other.blockedBy.some(bId => {
          const blocker = tasks.find(t => t.id === bId);
          return !blocker || blocker.status !== 'completed';
        });
        if (!stillBlocked) {
          other.status = 'pending';
        }
      }
    }

    await this.storage.writeTasks(tasks);

    const config = await this.storage.readConfig();
    if (config.autoCommit) {
      await this.git.autoCommit(`task completed: [${task.id}] ${task.title}`, config.commitPrefix);
    }

    return task;
  }

  async list(filter?: { status?: TaskStatus; readyOnly?: boolean }): Promise<TaskItem[]> {
    const tasks = await this.storage.readTasks();
    
    if (filter?.readyOnly) {
      return tasks.filter(t => {
        if (t.status !== 'pending') return false;
        const hasUnfinishedBlockers = t.blockedBy.some(bId => {
          const blocker = tasks.find(x => x.id === bId);
          return !blocker || blocker.status !== 'completed';
        });
        return !hasUnfinishedBlockers;
      });
    }

    if (filter?.status) {
      return tasks.filter(t => t.status === filter.status);
    }

    return tasks;
  }
}
