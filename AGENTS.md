# Repository workflow

- Maintain one long-lived `testing` branch for development and app review.
- Reuse `testing` for features and fixes; do not create a branch per feature unless Damon explicitly requests it.
- Keep `main` as the release branch. The current GitHub Pages workflow deploys pushes to `main`.
- Before starting work, fetch remote history and inspect the working tree. Preserve unrelated local changes.
- Integrate newer `main` commits into `testing` without discarding testing work or rewriting shared history.
- Changes to `testing` do not automatically publish a testing website under the current workflow.
