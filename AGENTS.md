# Agent workflow preferences

## Find context efficiently

- `agent-docs/ROADMAP.md` is the authoritative list of project priorities, open work and checkpoint status. `agent-docs/README.md` maps the other documents.
- Read only the documentation and source files relevant to the task. Do not treat the old migration kickoff, proposed roadmap or checkpoint reports as current instructions; they are retained temporarily for reconciliation.
- Inspect the actual code and Git state before claiming something is implemented, tested, committed or safe to remove. Do not infer current state solely from documentation.

## Planning and review

- For substantial implementation work, inspect the affected area and propose a **complete** plan before changing code. Include acceptance criteria, meaningful verification steps, dependencies, and suggested review/commit boundaries. Wait for explicit approval. Skip this ceremony for small, straightforward requests.
- Use native task tracking when available. Track the _full approved scope_, not just the next review slice. A review boundary is **not** task completion. Clearly identify remaining work even when presenting a partial diff.
- Prefer coherent, independently verifiable increments over a giant diff. At agreed review boundaries, summarize changes, tests actually run, limitations and what's next. Present changes for user review **before committing**. Never create a commit without explicit approval; never stage unrelated user changes.
- Preserve user work. No destructive Git operations, unrequested deletion/movement of sources or assets, or new dependencies, browser/runtime/system software without explicit approval. Avoid changes outside the task's scope.

## Application versioning

- Follow the [workbench versioning convention](web/README.md#application-versioning), the authoritative reference for package metadata, version bumps and release scope.

## Python environment

- Dependency installation is manual: provide the owner with exact installation commands; do not run package installers yourself, even when a dependency is approved for the project.
- Run Python commands and helper scripts with `python-src/venv/bin/python` from the repository root (or the equivalent relative path from another directory), including one-off editing scripts. Use `python-src/venv/bin/python -m pip` for package installation.

## Keep the backlog and documentation current

- Capture actionable suggestions, bugs, follow-ups and deferred requirements in `agent-docs/ROADMAP.md` as **unprioritized** work if not implemented in the current task. Avoid duplicates; link to an existing detailed document where possible. Casual ideas are not authorization to implement them.
- At the end of a meaningful implementation slice, update relevant documentation to reflect verified behavior and unresolved work. Distinguish proposed, implemented, accepted and independently verified states. Do not silently change priorities, acceptance criteria or scope.
- Propose removal/merging of obsolete documentation instead of deleting it during unrelated implementation. Prefer one useful living reference for each sufficiently complex topic; history already exists in Git.

## Subagents

When substantial screenshot inspection, regression failure investigation, or a
bounded review could benefit from a cheaper subagent, suggest that option to the
user before delegating. Explain briefly what the subagent would inspect and why
delegation may reduce cost. Avoid suggesting delegation for routine passing test
runs or small tasks where coordination overhead is likely to outweigh savings.

If the user approves, give the subagent focused context and request a concise
report with actionable findings and supporting evidence. Avoid inheriting the
full conversation when the task can be explained independently. Do not claim
guaranteed cost savings.
