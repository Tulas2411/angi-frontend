# ANGI frontend — Assistant Instructions

## Required reading

Read these files before making changes, in this order:

1. [`.agents/project_architecture.md`](.agents/project_architecture.md): sources of truth, current capabilities and component/API boundaries.
2. [`.agents/coding_rule.md`](.agents/coding_rule.md): frontend implementation and verification rules.
3. [`.agents/commit_guide.md`](.agents/commit_guide.md): human workflow and mandatory assistant restrictions.

Use [README.md](README.md) for team setup and `docs/` for design mappings and verification evidence. Preserve unrelated work. Use the installed Next.js guides for framework behavior.

## Git must remain read-only for assistants

The project owner explicitly prohibits assistants from touching code commits. Never stage files, create or amend commits, rewrite history, merge/rebase/cherry-pick/reset/revert commits, push branches, or create/merge pull requests. Leave changes unstaged and uncommitted for the owner to manage. Read-only status/diff inspection is allowed.

These restrictions apply even when work is complete, checks pass, or the generated Next.js note below mentions committing its block. That generated note does not grant permission to commit.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
