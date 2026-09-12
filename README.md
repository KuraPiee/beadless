<p align="center">
  <h1 align="center">🧠 gitmem</h1>
  <p align="center"><strong>Git-native persistent memory & task graph for AI coding agents.</strong></p>
  <p align="center">The lightweight, TypeScript-native alternative to Beads. Zero Dolt. Zero Go. Just pure git.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gitmem"><img src="https://img.shields.io/npm/v/gitmem.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/KuraPiee/gitmem/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Compatible-purple.svg?style=flat-square" alt="MCP Compatible" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Native-3178c6.svg?style=flat-square" alt="TypeScript" /></a>
</p>

---

## ⚡ The Problem

AI coding agents (**Claude Code, Cursor, Windsurf, Antigravity**) lose their memory between sessions. Every time you open a new conversation, change branches, or have a teammate pull the code:
- Architectural decisions are forgotten.
- Past bugs and lessons are repeated.
- Complex multi-step task graphs get lost.

**Beads** introduced versioned agent memory, but requires a heavy **Go binary** and an external **Dolt SQL database** daemon running on your machine.

**gitmem** gives your agents persistent, dependency-aware memory stored as **plain JSON and Markdown committed directly into your repository**.

---

## 🥊 Beads vs. gitmem

| Feature | Beads | 🧠 gitmem |
| :--- | :--- | :--- |
| **Runtime** | Go binary | **Node.js / TypeScript Native** |
| **Storage Engine** | Dolt SQL Database Daemon | **Plain Git (JSON + Readable Markdown)** |
| **Installation** | Heavy custom install / Dolt setup | **`npx gitmem init` (Zero-config)** |
| **Install Size** | ~150 MB+ | **< 3 MB** |
| **PR & Code Review** | Hidden in Dolt binary storage | **Clean, reviewable `.gitmem/` diffs** |
| **MCP Standard** | Custom protocol wrappers | **Native `@modelcontextprotocol/sdk`** |
| **Human Readable** | Requires SQL queries | **Auto-syncs `MEMORIES.md` & `TASKS.md`** |

---

## 🚀 30-Second Quickstart

In your repository root:

```bash
npx gitmem init
```

That's it! `gitmem` will scaffold `.gitmem/` and automatically configure your **Cursor** (`.cursor/mcp.json`) or **Claude Desktop** environment.

### Attach to Claude Code
```bash
claude mcp add gitmem npx -y gitmem mcp
```

### Attach to Cursor / Windsurf
Add this to your MCP configuration (`.cursor/mcp.json` or settings):
```json
{
  "mcpServers": {
    "gitmem": {
      "command": "npx",
      "args": ["-y", "gitmem", "mcp"]
    }
  }
}
```

---

## 🛠️ MCP Tools for Agents

When attached to an agent, `gitmem` exposes these standard MCP tools:

- `gitmem_context`: Dumps instant project briefing (tech stack, conventions, critical gotchas, and top unblocked tasks).
- `gitmem_remember`: Records an architectural decision, lesson, or preference.
- `gitmem_recall`: Fuzzy-searches past decisions and gotchas to avoid repeating mistakes.
- `gitmem_task_create`: Adds a task with dependency tracking (`blockedBy: ["task-1"]`).
- `gitmem_task_claim`: Claims a task for the active agent session.
- `gitmem_task_complete`: Marks task complete and automatically unblocks downstream tasks.
- `gitmem_task_list`: Queries tasks (e.g. `--ready` for unblocked tasks only).

---

## 💻 CLI Usage

You can also use `gitmem` directly from your terminal:

### Remember a Decision
```bash
npx gitmem remember "Use Argon2 for password hashing" \
  --category decision \
  --message "Argon2id is memory-hard and prevents ASIC/GPU attacks." \
  --tags auth security
```

### Recall Memories
```bash
npx gitmem recall "password"
```

### Manage Task Dependency Graph
```bash
# 1. Create root task
npx gitmem tasks create "Design database schema" --priority high

# 2. Create dependent task (blocked by task-1)
npx gitmem tasks create "Build authentication API" --blocked-by task-1

# 3. View task board
npx gitmem tasks list

# 4. Complete root task (unblocks task-2)
npx gitmem tasks done task-1 --outcome "Prisma schema created"
```

### Instant Agent Bootstrap
```bash
# Dump formatted project context to terminal or clipboard
npx gitmem context
```

---

## 📂 Repository Layout

Everything is stored inside your repository under `.gitmem/`:

```
your-repo/
├── .gitmem/
│   ├── config.json         # gitmem settings (auto-commit, prefix)
│   ├── memories.json       # Structured decisions, lessons, context
│   ├── MEMORIES.md         # Auto-generated human-readable memory log
│   ├── tasks.json          # Dependency graph (blockedBy, claimedBy)
│   ├── TASKS.md            # Auto-generated markdown task board
│   └── context.json        # Stack, conventions & non-negotiables
```

Because it lives in git:
- **Branch-aware:** Branches keep their own context or inherit from main.
- **Team-shared:** Every `git pull` updates your local agent's memory.
- **Reviewable:** You can see every AI agent decision in standard GitHub pull requests!

---

## 📜 License

MIT © [KuraPiee](https://github.com/KuraPiee) — Built with ❤️ by the Docwyrm Team.
