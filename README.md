<p align="center">
  <h1 align="center">🧠 beadless</h1>
  <p align="center"><strong>Git-native persistent memory & task graph for AI coding agents.</strong></p>
  <p align="center">The lightweight, TypeScript-native alternative to Beads. Zero Dolt. Zero Go. Just pure git.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/beadless"><img src="https://img.shields.io/npm/v/beadless.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/KuraPiee/beadless/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Compatible-purple.svg?style=flat-square" alt="MCP Compatible" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Native-3178c6.svg?style=flat-square" alt="TypeScript" /></a>
</p>

---

## ⚡ The Problem

AI coding agents (**Antigravity, Claude Code, Cursor, Windsurf**) lose their memory between sessions. Every time you open a new conversation, clear context, or switch branches:
- Architectural decisions are forgotten.
- Past bugs and lessons are repeated.
- Complex multi-step task graphs get lost.

**Beads** introduced versioned agent memory, but requires a heavy **Go binary** and an external **Dolt SQL database** daemon running in the background.

**beadless** gives your agents persistent, dependency-aware memory stored as **plain JSON and Markdown committed directly into your repository**.

---

## 🥊 Beads vs. beadless

| Feature | Beads | 🧠 beadless |
| :--- | :--- | :--- |
| **Runtime** | Go binary daemon | **Node.js / TypeScript Native** |
| **Storage Engine** | Dolt SQL Database Daemon | **Plain Git (JSON + Readable Markdown)** |
| **Installation** | Heavy custom install / Dolt setup | **`npx beadless init` (Zero-config)** |
| **Install Size** | ~150 MB+ | **< 3 MB** |
| **PR & Code Review** | Hidden in Dolt binary storage | **Clean, reviewable `.beadless/` diffs** |
| **MCP Standard** | Custom protocol wrappers | **Native `@modelcontextprotocol/sdk`** |
| **Human Readable** | Requires SQL queries | **Auto-syncs `MEMORIES.md` & `TASKS.md`** |

---

## 🚀 30-Second Quickstart

In your repository root:

```bash
npx beadless init
```

That's it! `beadless` will scaffold `.beadless/` and automatically configure your **Antigravity**, **Cursor** (`.cursor/mcp.json`), or **Claude Desktop** environment.

### 🪐 Attach to Google Antigravity
Add to your Antigravity MCP settings (`~/.gemini/antigravity/mcp_config.json`):
```json
{
  "mcpServers": {
    "beadless": {
      "command": "npx",
      "args": ["-y", "beadless", "mcp"]
    }
  }
}
```

### 🤖 Attach to Claude Code
```bash
claude mcp add beadless npx -y beadless mcp
```

### 💻 Attach to Cursor / Windsurf
Add this to your MCP configuration (`.cursor/mcp.json` or settings):
```json
{
  "mcpServers": {
    "beadless": {
      "command": "npx",
      "args": ["-y", "beadless", "mcp"]
    }
  }
}
```

---

## 🛠️ MCP Tools for Agents

When attached to an agent, `beadless` exposes these standard MCP tools:

- `beadless_context`: Dumps instant project briefing (tech stack, conventions, critical gotchas, and top unblocked tasks).
- `beadless_snapshot`: Captures the current workspace state, modified/untracked files, and branch status into persistent memory.
- `beadless_remember`: Records an architectural decision, lesson, or preference.
- `beadless_recall`: Fuzzy-searches past decisions and gotchas to avoid repeating mistakes.
- `beadless_delete`: Removes a memory entry by ID or semantic description.
- `beadless_task_create`: Adds a task with dependency tracking (`blockedBy: ["task-1"]`).
- `beadless_task_claim`: Claims a task for the active agent session.
- `beadless_task_complete`: Marks task complete and automatically unblocks downstream tasks.
- `beadless_task_list`: Queries tasks (e.g. `--ready` for unblocked tasks only).

---

## 💻 CLI Usage

You can also use `beadless` directly from your terminal:

### Remember a Decision
```bash
npx beadless remember "Use Argon2 for password hashing" \
  --category decision \
  --message "Argon2id is memory-hard and prevents ASIC/GPU attacks." \
  --tags auth security
```

### Snapshot Workspace State (Auto-Recording)
```bash
# Capture immediate snapshot with automatic title and timestamp (keeps all old memories!)
npx beadless snap

# Custom snapshot title with description
npx beadless snap "Completed authentication and cookies"
```

### 🗑️ Delete / Forget Memories
```bash
# Interactive list of recent memories
npx beadless del

# Delete by exact ID
npx beadless del mem-1234

# Smart semantic deletion (understands what you mean and deletes matching memory)
npx beadless del "eski veritabanı kararı"
```

### ⏱️ Automatic Periodic Auto-Recorder (Watcher)
```bash
# Automatically records changes every 10 minutes (default)
npx beadless watch

# Custom interval (every 5 minutes, triggers on >= 2 modified files)
npx beadless auto --interval 5 --min-changes 2 --immediate
```

### Recall Memories
```bash
npx beadless recall "password"
```

### Manage Task Dependency Graph
```bash
# 1. Create root task
npx beadless tasks create "Design database schema" --priority high

# 2. Create dependent task (blocked by task-1)
npx beadless tasks create "Build authentication API" --blocked-by task-1

# 3. View task board
npx beadless tasks list

# 4. Complete root task (unblocks task-2)
npx beadless tasks done task-1 --outcome "Prisma schema created"
```

### Instant Agent Bootstrap
```bash
# Dump formatted project context to terminal or clipboard
npx beadless context
```

---

## 📂 Repository Layout

Everything is stored inside your repository under `.beadless/`:

```
your-repo/
├── .beadless/
│   ├── config.json         # beadless settings (auto-commit, prefix)
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
