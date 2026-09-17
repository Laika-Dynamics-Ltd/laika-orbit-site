---
title: How recall works
description: The seven steps from question to answer, none of them a model call.
---

Each step is a pure function with its own tests.

1. **Tokenise.** Lowercase, strip punctuation, drop stop words, matched on word boundaries, so
   `everyone` and `milestone` survive and removing `one` never corrupts `Done`.
2. **Score.** Sum weights across an inverted index: topic > router description > file name >
   content. No file is opened yet, and the cost grows with the question, not the corpus.
3. **Select.** Keep the top five with a confidence margin. When two sources are close, both come back,
   marked as ambiguous. When nothing matches, it says **no match**.
4. **Read.** Open only the winner.
5. **Slice.** Keep the `##` section whose heading matches, or a window around the densest lines.
6. **Hop.** Follow at most one pointer out of that slice. The cap of one is enforced by a test.
7. **Pack.** Question, evidence and one instruction, capped at 9KB.

## Why no model

Scoring takes well under a millisecond, so there's no reason to spend tokens deciding where to look,
and the result is the same every time for the same files. A model is only needed for what comes after:
reading the evidence and answering.

The benchmarks, including the methodology mistakes found while producing them, are in
[`bench/RESULTS.md`](https://github.com/Laika-Dynamics-Ltd/laika-orbit/blob/main/bench/RESULTS.md).
