import { MemoryEngine } from '../core/memory.js';
import { TaskEngine } from '../core/tasks.js';
import { ContextEngine } from '../core/context.js';
import { SnapshotEngine } from '../core/snapshot.js';
import { MemoryCategory } from '../types/index.js';

export function getMcpToolsDefinition() {
  return [
    {
      name: 'beadless_remember',
      description: 'Store a project decision, lesson learned, architectural choice, or gotcha in git-native memory. Survives across agent sessions and git branches.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['decision', 'lesson', 'architecture', 'context', 'preference'],
            description: 'Type of memory to record'
          },
          title: {
            type: 'string',
            description: 'Short, descriptive title (e.g., "Use argon2 for password hashing")'
          },
          content: {
            type: 'string',
            description: 'Detailed reasoning, tradeoffs, or code gotcha'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for filtering (e.g., ["auth", "security"])'
          }
        },
        required: ['category', 'title', 'content']
      }
    },
    {
      name: 'beadless_snapshot',
      description: 'Capture a snapshot of the current workspace state, modified/untracked files, and git status into persistent memory.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Optional custom title for the snapshot'
          },
          message: {
            type: 'string',
            description: 'Optional note or summary of changes completed'
          },
          category: {
            type: 'string',
            enum: ['decision', 'lesson', 'architecture', 'context', 'preference'],
            description: 'Memory category (default: context)'
          },
          force: {
            type: 'boolean',
            description: 'Force snapshot even if working tree is clean'
          }
        }
      }
    },
    {
      name: 'beadless_recall',
      description: 'Search past project decisions, lessons, or architectural context using fuzzy search. Call this before making major architectural changes or when debugging unfamiliar code.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query or keyword (e.g. "auth", "theme", "database migration")'
          },
          category: {
            type: 'string',
            enum: ['decision', 'lesson', 'architecture', 'context', 'preference'],
            description: 'Filter by specific memory category'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default 5)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'beadless_context',
      description: 'Retrieve the project context briefing, including architecture overview, conventions, critical lessons, and active task queue. Call this at the start of an agent session.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'beadless_task_create',
      description: 'Create a new task with optional dependencies (blockedBy). Use this to decompose complex work into trackable steps.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Detailed specifications' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          blockedBy: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs that must be completed before this task can start'
          },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['title']
      }
    },
    {
      name: 'beadless_task_claim',
      description: 'Claim a task to signify an agent is actively working on it. Fails if dependencies are not yet completed.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID (e.g. "task-1")' },
          agentName: { type: 'string', description: 'Identifier of the agent or session' }
        },
        required: ['taskId', 'agentName']
      }
    },
    {
      name: 'beadless_task_complete',
      description: 'Mark a task as completed with an outcome summary. Automatically unblocks downstream dependent tasks.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID (e.g. "task-1")' },
          outcome: { type: 'string', description: 'Brief summary of what was accomplished' }
        },
        required: ['taskId']
      }
    },
    {
      name: 'beadless_task_list',
      description: 'List project tasks. Can filter by status or query only unblocked (ready) tasks.',
      inputSchema: {
        type: 'object',
        properties: {
          readyOnly: {
            type: 'boolean',
            description: 'If true, returns only tasks that are unblocked and ready for execution'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'blocked'],
            description: 'Filter by task status'
          }
        }
      }
    }
  ];
}

export async function handleMcpToolCall(
  name: string,
  args: any,
  engines: {
    memory: MemoryEngine;
    tasks: TaskEngine;
    context: ContextEngine;
    snapshot?: SnapshotEngine;
  }
) {
  // Normalize beadless_ or gitmem_ prefixes
  const normalized = name.replace(/^(beadless|gitmem)_/, '');

  switch (normalized) {
    case 'snapshot': {
      if (!engines.snapshot) {
        throw new Error('SnapshotEngine is not configured.');
      }
      const res = await engines.snapshot.takeSnapshot({
        title: args.title,
        message: args.message,
        category: args.category as MemoryCategory,
        force: args.force
      });
      if (!res) {
        return {
          content: [
            {
              type: 'text',
              text: 'Workspace is clean. No snapshot was taken (pass force: true to snapshot clean state).'
            }
          ]
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Snapshot recorded [${res.entry.id}]: "${res.entry.title}" (${res.summary})`
          }
        ]
      };
    }

    case 'remember': {
      const entry = await engines.memory.remember({
        category: args.category as MemoryCategory,
        title: args.title,
        content: args.content,
        tags: args.tags
      });
      return {
        content: [
          {
            type: 'text',
            text: `Saved to git-native memory [${entry.id}]: "${entry.title}" (${entry.category})`
          }
        ]
      };
    }

    case 'recall': {
      const results = await engines.memory.recall(args.query, {
        category: args.category as MemoryCategory,
        limit: args.limit || 5
      });
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No memories found matching query "${args.query}".`
            }
          ]
        };
      }
      const formatted = results.map(r => 
        `### [${r.category.toUpperCase()}] ${r.title} (ID: ${r.id})\n` +
        `*Date: ${new Date(r.createdAt).toLocaleDateString()} | Author: ${r.author || 'Agent'}*\n` +
        `${r.content}\n` +
        (r.tags.length > 0 ? `Tags: ${r.tags.join(', ')}\n` : '')
      ).join('\n---\n\n');

      return {
        content: [{ type: 'text', text: formatted }]
      };
    }

    case 'context': {
      const dump = await engines.context.getContextDump();
      return {
        content: [{ type: 'text', text: dump }]
      };
    }

    case 'task_create': {
      const task = await engines.tasks.create({
        title: args.title,
        description: args.description,
        priority: args.priority,
        blockedBy: args.blockedBy,
        tags: args.tags
      });
      return {
        content: [
          {
            type: 'text',
            text: `Created task [${task.id}]: "${task.title}" (Status: ${task.status}, Priority: ${task.priority})`
          }
        ]
      };
    }

    case 'task_claim': {
      const task = await engines.tasks.claim(args.taskId, args.agentName);
      return {
        content: [
          {
            type: 'text',
            text: `Task [${task.id}] claimed by "${task.claimedBy}". Status is now in_progress.`
          }
        ]
      };
    }

    case 'task_complete': {
      const task = await engines.tasks.complete(args.taskId, args.outcome);
      return {
        content: [
          {
            type: 'text',
            text: `Task [${task.id}] marked completed! Outcome: ${task.outcome || 'Done'}`
          }
        ]
      };
    }

    case 'task_list': {
      const list = await engines.tasks.list({
        readyOnly: args.readyOnly,
        status: args.status
      });
      if (list.length === 0) {
        return {
          content: [{ type: 'text', text: 'No matching tasks found.' }]
        };
      }
      const formatted = list.map(t => {
        const blockerStr = t.blockedBy.length > 0 ? ` (Blocked by: ${t.blockedBy.join(', ')})` : '';
        const claimStr = t.claimedBy ? ` [Claimed by ${t.claimedBy}]` : '';
        return `- [${t.id}] **${t.title}** (${t.status}, ${t.priority})${blockerStr}${claimStr}`;
      }).join('\n');

      return {
        content: [{ type: 'text', text: formatted }]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
