# ANGI — Git, Commits and Pull Requests

Rules for branches, commits and pull requests in `angi-frontend`. Every feature or fix traces back to its assigned Jira task (for example, `ANGI-F-17`, from the team tracker and `angi-backend/.docs/ANGI_Jira_Plan_Ver*.xlsx`). Commit messages, pull request titles and descriptions are in English.

## 0. Mandatory assistant restriction

The project owner has prohibited assistants from touching code commits. Assistants must:

- Leave changes unstaged and uncommitted for a human to review.
- Never stage files, create/amend commits, rewrite history, merge, rebase, cherry-pick, reset/revert commits, push branches, or create/merge pull requests.
- Use read-only inspection such as status and diff when needed, and report changed files and verification results.

Completing a task, passing checks, or following a Git convention is never permission to commit. The remaining sections describe the **human maintainer workflow**.

## 1. Branches

```text
<type>/<Jira-key>-<short-description>        feat/ANGI-F-17-frontend-foundation
<type>/<short-description>                 only for technical work without a task: chore/add-packages
```

```text
<type>/... ──pull request──▶ dev ──(release)──▶ main
```

- Use the actual assigned Jira key; the example is not a ticket assignment. Do not invent keys.
- Create the branch from the latest `dev`. One branch = one task.
- Never commit or push to `main` or `dev` directly; never force-push a shared branch.
- Pull `dev` into the branch before starting work and before opening the pull request.
- Resolve conflicts locally on the branch (pull `dev`, fix, build, test), never in the GitHub web editor for code files. If the intended resolution in someone else's code is unclear, ask instead of choosing.

## 2. Commit message

Conventional Commits:

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Example for a change under the assigned frontend task:

```text
fix(auth): retry unauthorized requests only once

An unbounded refresh retry can loop when the renewed session
is also rejected by the backend.

Refs: ANGI-F-17
```

### Type

| Type       | Use for                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| `feat`     | A new feature                                                                    |
| `fix`      | A bug fix                                                                        |
| `refactor` | Restructured code, same behavior                                                 |
| `test`     | Tests only                                                                       |
| `docs`     | Documentation only (`docs/`, `.agents`, README)                                  |
| `chore`    | Packages, config, `.gitignore`; adding a package is its own `chore(deps)` commit |
| `build`    | Build system, Node.js runtime or framework configuration                         |
| `ci`       | CI/CD workflows                                                                  |
| `perf`     | Performance                                                                      |
| `style`    | Formatting only; a UI behavior or appearance change uses `feat` or `fix`         |
| `revert`   | Reverting a commit: `revert: <original header>`                                  |

### Scope

Optional. A change that belongs to one feature uses the module, even across layers; a purely technical change uses the layer or area.

| Repo          | Module scopes                                                                                   | Layer / area scopes                                                |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| angi-frontend | `auth`, `platform`, `discovery`, `blogs`, `roadmaps`, `profile`, `owner`, `moderation`, `admin` | `ui`, `api`, `layout`, `styles`, `test`, `deps`, `.agents`, `docs` |

Use the existing frontend feature names; do not rename them to backend modules just to match a scope.

### Subject

- Imperative mood (`add`, `fix`, `remove`), lowercase first letter, no final period, at most ~70 characters.
- Says what changed concretely. Never `update`, `fix bug`, `wip`.

### Body

Add a body when the reason is not obvious from the diff. It explains **why**, not how, wrapped at ~72 characters, after one blank line.

### Footer

| Purpose                                   | Syntax                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Jira task (required for `feat` and `fix`) | `Refs: <actual-Jira-key>`; separate multiple assigned keys with commas            |
| Breaking change                           | `BREAKING CHANGE: <description>`, or `!` after the type/scope (`feat(api)!: ...`) |

Never use `Closes #12`: the team uses Jira for tasks, not GitHub Issues.

## 3. Before every commit

- One commit = one logical change. If the subject needs "and", split it.
- The commit builds and its tests pass. Run what CI runs for code changes:

  ```sh
  npm ci
  npm run lint
  npm test
  npm run build
  npm run typecheck
  ```

  Build before standalone typecheck on a fresh checkout so generated route types exist.

- Run relevant browser, accessibility, visual or asset checks when changing routes, interactions, layouts or assets ([coding_rule.md](coding_rule.md#13-checks-and-evidence)). These are additional local checks, not current CI jobs.
- For documentation-only edits, check formatting, links, paths, command/env names and the diff. Runtime checks are not needed for a local documentation edit; pull request CI still applies.
- Nothing generated or secret is staged: `node_modules/`, `.next/`, `.env.local`, other private env files, credentials, caches, generated screenshots or browser reports. Keep `.env.example` safe to share.
- Do not reformat or reorder unrelated files. Keep `package.json`, framework config and global styles changes scoped; update `package-lock.json` with npm, never by hand.
- Adding a feature follows the existing route, feature, service and UI boundaries ([coding_rule.md](coding_rule.md#1-scope-and-feature-ownership)). Keep `src/app` focused on routing and composition.

## 4. API contracts and configuration

- Verify endpoint methods/paths, DTOs, enums and error codes against the latest backend API Design and the implemented backend. Fixtures and Figma do not define server contracts ([project_architecture.md](project_architecture.md#0-sources-of-truth)).
- Keep backend DTOs separate from frontend view models. An API change must update the relevant types, service/mapping, proxy method/allowlist and error handling together ([coding_rule.md](coding_rule.md#7-adding-a-live-endpoint)).
- Frontend code does not create database migrations or access `core`/`recommendation` schemas directly. Coordinate schema changes in the owning backend repository.
- When adding or changing env variables, update `.env.example` and README/setup instructions in the same pull request. `NEXT_PUBLIC_*` values are public and embedded at build time; never put secrets in them.
- Document breaking API, route or configuration changes, including the required backend version or deployment order when relevant.

## 5. Pull requests

- Base branch `dev`. Only the release pull request from `dev` targets `main`.
- Title: the commit format (`feat(auth): add login form`); it becomes the squash commit message.
- Description starts with `Jira: <actual-Jira-key>`, then: what changed, why, how to verify. For technical work without an assigned task, state `Jira: none (technical work)`.
- Include relevant UI states, API/role coverage and integration limits. Add screenshots for visual changes when helpful; exclude private data.
- Merge only with **squash**. The squash body explains why and ends with `Refs: <actual-Jira-key>` when there is an assigned task.
- A pull request needs green CI (`frontend-checks`) and one approval. Never merge it yourself.
- Update architecture, coding rules, setup/design documentation and README in the same pull request when the code changes what they describe ([project_architecture.md](project_architecture.md#0-sources-of-truth)).
