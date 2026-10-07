# Bloxodes skill execution

Follow root `AGENTS.md` and `dev-docs/operations/deployment.md` for task/release ownership. Stay in the T3-assigned worktree. Never create another task branch/worktree.

Run skill validation, page verifiers, typechecks, tests, builds and browser QA on GitHub. Commands in individual skills describe the checks to run there, not permission to run them locally. Research and authoring files stay local; publication uses exact approved CI batches.

Use the release-review skills and `bloxodes-release-e2e` for PRs targeting `production`, T3 linking/watching and selected content dispatch. Do not push directly to production. Retain all existing approval, source-proof, namespace and immutable dataset/media rules.

Installed detached automation runtimes keep their existing release until separately activated. Do not change their env, services or active jobs while updating skills or releasing agent work.
