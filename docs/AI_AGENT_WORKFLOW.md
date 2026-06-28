# AI agent workflow

This repository uses labels and GitHub Project fields as an AI work queue. GitHub assignees remain for humans; Claude and Codex are represented by labels and the Project `Agent` field.

## What is configured

- Repository labels:
  - `agent:claude`
  - `agent:codex`
  - `agent:review`
  - `agent:human`
- GitHub Project fields:
  - Project #9 `IşıkSchedule — Backend Hardening & Audit`: `Agent`
  - Project #4 `IşıkSchedule Fullstack Delivery (Alpha -> Beta -> Production)`: `Agent`
- GitHub Actions:
  - `.github/workflows/claude-agent.yml`
  - `.github/workflows/codex-agent.yml`

## Required secrets

Add these under GitHub repository settings, `Secrets and variables` -> `Actions`:

- `ANTHROPIC_API_KEY` for Claude.
- `OPENAI_API_KEY` for Codex.

Do not commit API keys to the repository.

## How to route work

Use the GitHub Project `Agent` field for planning and filtering. Use labels only when you actually want an automation to run.

For Claude:

1. Set Project `Agent` to `Claude` if you want the board to show Claude ownership.
2. Add `agent:claude` to start Claude on the issue, or comment with `@claude ...`.
3. Review the PR or response before merging.

For Codex:

1. Set Project `Agent` to `Codex` if you want the board to show Codex ownership.
2. Add `agent:codex` to start the Codex workflow.
3. Codex runs in a read-only GitHub token job, produces a patch, and a separate job opens a draft PR.
4. Review the draft PR before marking it ready.

For humans:

1. Use normal GitHub assignees for human ownership.
2. Use `agent:human` when the task should not be automated.
3. Use `agent:review` when a human decision is needed before or after AI work.

## Suggested routing

- Use `Human` or `Review needed` for secrets, credential rotation, legal/KVKK decisions, production risk acceptance, and dependency exceptions.
- Use `Claude` for issue refinement, documentation drafts, broad refactor plans, and investigation-heavy tasks.
- Use `Codex` for scoped code changes, tests, CI fixes, backend route fixes, frontend component fixes, and mechanical cleanup.

## Safety notes

- AI-created PRs must stay draft until reviewed by a human.
- Do not add both `agent:claude` and `agent:codex` to the same issue unless you intentionally want two independent attempts.
- Label-triggered runs should be started only by repository collaborators.
- If a workflow fails immediately, check that the corresponding API key secret exists.
