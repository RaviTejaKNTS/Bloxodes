# Rough Notes and Historical Documents

Status: Non-canonical
Policy effective: 2026-08-13

This directory contains plans, investigations, audits, source lists, reports, experiments, and historical runbooks. A file here may be outdated, partially implemented, or describe work that never shipped.

For current architecture and operations, start at `dev-docs/README.md` and use the closest `AGENTS.md` for mandatory rules.

New Markdown notes should use an ISO date prefix:

```text
docs/YYYY-MM-DD-topic.md
```

Exceptions are machine-consumed or generated artifacts that cannot be moved immediately. When touching one, move it to `data/`, a pipeline input directory, or a dedicated report location if references permit. Do not bulk-move existing files without checking consumers.

If a rough note changes the current operating model, update the existing owning `dev-docs/` file with the verified state, `Last verified`, evidence, known limitations, and code links. Do not create a replacement current-state document. Add a new canonical file only when no existing document owns the new system or pipeline.
