---
title: Use Laika Orbit recall with Claude Code
description: Add the Laika Orbit recall MCP server so Claude recalls instead of grepping.
---

```bash
claude mcp add 1brain -- npx -y 1brain mcp
```

That's all: Claude Code starts the server in your project folder when a session begins. Requires Node
22 or newer.

## Tools

| Tool | What it does |
|---|---|
| `recall` | Answers a plain-English question with the matching section(s), their paths and line ranges, and a confidence margin. Says so when nothing matches. |
| `get` | Reads one file by its path relative to the root. |
| `status` | Index size: documents, tokens, routers, pointers. |

## Another folder

```bash
claude mcp add brain-notes -- npx -y 1brain mcp --root ~/notes
```

The index is built on the first call and refreshed at most every `refreshSecs` (see
[Index configuration](/docs/recall/configuration/)), re-reading only files that changed.

## Nudging Claude to use it

The `recall` tool describes itself as the thing to prefer over grep and whole-file reads for
questions about the workspace. For stronger steering, add a line to your project's `CLAUDE.md`:

```markdown
For questions about this project, call the 1brain `recall` tool before searching files.
```
