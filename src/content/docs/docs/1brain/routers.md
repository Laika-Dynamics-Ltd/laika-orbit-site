---
title: Router files
description: Typed pointer files that turn fast search into answers.
---

Router files are short Markdown files in `brain/routers/` that say where things are. They're the
curated index: 1brain weighs them above file names and contents, so a good router line is how a
question finds its answer.

```markdown
## 1 — deploys

- Files: notes/deploy.md — how production deploys are rolled back
- Rules: notes/freeze.md — no deploys on Fridays after 2pm
- Reference: docs/architecture.md — how the services talk to each other
```

## Format

Group pointers under `##` headings (stages or topics). Each pointer is one line:

```text
- <Type>: <path or name> — <description>
```

| Type | Use it for |
|---|---|
| `Files` | A concrete file or glob |
| `Reference` | Background material |
| `Rules` | Hard constraints |
| `Thinking` | Principles and canonical notes |
| `Skills` | A capability or command to run |

## Writing descriptions

**The description is what gets scored.** Write it the way the question will be asked, not the way the
file is named:

- ✗ `notes/deploy.md — deploy doc`
- ✓ `notes/deploy.md — how production deploys are rolled back`

When recall answers from a router line, it follows that one pointer to the file and returns the
matching section: one hop, never more.

## Checking them

```bash
npx 1brain lint
```

reports malformed lines and pointers to files that don't exist.
