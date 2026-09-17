---
title: 1brain
description: Zero-model recall over your files, as a CLI and an MCP server.
---

1brain answers questions about a folder of files without calling a model. Ask a question and it
returns the exact section that answers it and the file it came from, in about a millisecond.

It exists because agents answer questions about a workspace by grepping and then reading whole files,
and every line they open costs context whether or not it was relevant. 1brain does the searching and
narrowing in plain code, then hands the model one small, packed answer. Measured against a
grep-and-read agent over the same corpus, it put **97.8% fewer tokens** into context across 12
questions ([methodology](https://github.com/Laika-Dynamics-Ltd/laika-orbit/blob/main/bench/RESULTS.md)).

## Two ways to use it

- **In Claude Code**, as an MCP server: `claude mcp add 1brain -- npx -y 1brain mcp`.
  [Details](/docs/1brain/mcp/).
- **In the terminal**: `npx 1brain recall "…"`. [CLI reference](/docs/1brain/cli/).

It works on any folder of Markdown and text, and answers best when you add
[router files](/docs/1brain/routers/).

## What it isn't

Not semantic search, and not a vector database. It matches words, weighted by where they appear. That
makes it fast, predictable and free to run, and it reports **no match** plainly instead of guessing.
Recall quality depends on your router files more than on the engine.
