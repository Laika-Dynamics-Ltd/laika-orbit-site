---
title: Index configuration
description: brain/index.config.json, shared by the app, the CLI and the MCP server.
---

What gets indexed, and how, lives in `brain/index.config.json` under the root. The app's index
settings (<kbd>i</kbd>) edit it, and the CLI and MCP server read it, so the index you tune is the
index your agents recall against. Without the file, the defaults index the root folder only.

```json
{
  "version": 1,
  "sources": [
    { "id": "workspace", "label": "This workspace", "path": ".", "enabled": true,
      "include": [], "exclude": [], "content": true, "maxDepth": 0 },
    { "id": "notes", "label": "Notes", "path": "~/Documents/Notes", "enabled": true,
      "include": ["*.md", "*.pdf"], "exclude": ["archive/"], "content": true, "maxDepth": 0 }
  ],
  "exclude": [],
  "ignoreDirs": [],
  "extract": true,
  "content": { "enabled": true, "maxTokensPerDoc": 400, "maxBytes": 2097152 },
  "weights": { "topic": 8, "catalogue": 4, "filename": 2, "content": 1 },
  "topics": {},
  "maxFilesPerSource": 50000,
  "refreshSecs": 10
}
```

## Sources

| Field | Meaning |
|---|---|
| `id` | Short slug. Files from any source but the first are addressed as `@<id>/…`. |
| `path` | Folder to walk: relative to the root, absolute, or `~/…`. |
| `include` | When non-empty, a file must match one of these patterns. |
| `exclude` | Files matching any of these are skipped. |
| `content` | Index contents, not just paths. |
| `maxDepth` | Directory levels to descend; `0` is unlimited. |

## Everything else

| Field | Meaning |
|---|---|
| `exclude` | Patterns skipped in every source. |
| `ignoreDirs` | Directory names skipped anywhere, on top of the built-in list (`node_modules`, `.git`, …). |
| `extract` | Pull text from PDF, DOCX, RTF, ODT and HTML with system tools. |
| `content.maxTokensPerDoc` | Distinct words kept per document, so one huge file can't dominate. |
| `content.maxBytes` | Larger files are indexed by path only. |
| `weights` | How much a match counts in a topic, a router description, a file name, or content. |
| `topics` | Keyword → path that always answers it. |
| `maxFilesPerSource` | Safety cap per source. |
| `refreshSecs` | How long an index is reused before re-scanning; `0` means only on demand. |
