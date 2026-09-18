---
title: CLI
description: Laika Orbit recall commands and options.
---

```bash
npx laikaorbit <command> [--root <dir>]
```

Or install it: `npm install -g laikaorbit`.

| Command | What it does |
|---|---|
| `laikaorbit index` | Builds the index and reports its size and build time. |
| `laikaorbit status` | Index health: documents, tokens, routers, pointers, topics. |
| `laikaorbit lint` | Checks router files for malformed pointers and pointers to files that don't exist. Exits 1 when it finds any. |
| `laikaorbit recall "<question>"` | Shows the retrieval: candidates with scores, the margin, the evidence sections, and what it cost. |
| `laikaorbit ask "<question>"` | Prints only the packed prompt (question, evidence, instruction) for piping into a model. |
| `laikaorbit mcp` | Serves the MCP tools over stdio. |

## Choosing the folder

`--root <dir>` wins, then the `BRAIN_ROOT` environment variable, then the working directory.

## Example

```text
$ npx laikaorbit recall "how do I roll back a deploy"
how do I roll back a deploy
tokens: roll, back, deploy
margin 82%
    11  100%  notes/deploy.md
     2   18%  brain/routers/OPS.md

notes/deploy.md › Rolling back (lines 3-6)
  ## Rolling back

  Run `make rollback TAG=<previous>` and watch the canary for ten minutes.

2 scored · 151B read · 0 hop · score 1.08ms · total 9.0ms · 0 tokens
```

`lint` exits non-zero on problems, so it fits in CI:

```yaml
- run: npx laikaorbit lint
```
