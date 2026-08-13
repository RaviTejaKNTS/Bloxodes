# Canonical Developer Documentation Rules

Scope: `dev-docs/`.
Last verified: 2026-08-13

- These are stable current-state documents, not dated snapshots. Keep their existing filenames and update the owning document in place.
- Every Markdown file must include `Last verified: YYYY-MM-DD` and a concrete evidence boundary near the top.
- Change `Last verified` only after checking the relevant code/configuration and, when accessible, the live service read-only. If a boundary could not be checked, state that explicitly.
- When code, env ownership, infrastructure, deployment, data flow, or a pipeline changes, update the existing canonical document in the same change. Do not create a second current-state document for the same subject.
- Create a new canonical document only when a genuinely new system or pipeline has no existing owner. Add it to `dev-docs/README.md` immediately.
- Keep plans, investigations, incident records, and point-in-time audits in `docs/` with an ISO date prefix. Fold their verified current-state conclusions into the existing canonical document rather than treating the note as the new authority.
- Preserve known degraded states and evidence dates. Do not silently replace observed behavior with intended behavior.
