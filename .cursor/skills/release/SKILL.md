---
name: release
description: >-
  Prepare and ship a Sandustry mod release from src/<folder>/: tests, version
  bump, CHANGELOG, commit, push, and Steam Workshop publish. Use when the user
  asks to release, ship, publish, or get ready to release a mod, minor release,
  patch release, or Workshop upload.
disable-model-invocation: true
---

# Sandustry mod release

Release one mod under `src/<folder>/`.
Each mod is its own git repo.
Work in that folder for git commands.
Run template commands from the repo root.

Use **AskQuestion** at every gate below.
Stop when the user picks **Cancel** or **Skip**.
Do not commit, push, or publish without passing the gate for that step.

## Gate map

| Gate | When                          | Ask                          |
| ---- | ----------------------------- | ---------------------------- |
| 0    | Mod is not obvious            | Which mod to release?        |
| A    | Mod and version are known     | Start this release?          |
| B    | Tests pass                    | Apply version and CHANGELOG? |
| C    | Working tree is release-ready | Commit in the mod repo?      |
| D    | Commit exists locally         | Push to origin?              |
| E    | Push finished (or skipped)    | Upload to Steam Workshop?    |

## Step 0 — Pick mod and survey

### Find candidate mods

From the template root, list `src/<folder>/` dirs that have `modinfo.ts` or `modinfo.json`.

For each candidate, read:

- `modinfo.ts` — `id`, `name`, `version`
- `CHANGELOG.md` — `## Unreleased` body (empty or not)
- `git status -sb` and `git diff --stat` inside that mod repo

Skip `template` unless the user names it.

### Gate 0 — Pick mod

Use AskQuestion when **any** of these is true:

- The user did not name a mod folder or mod id.
- More than one mod has unreleased `CHANGELOG` entries or dirty git state.
- Named mod does not match any `src/<folder>/`.

Do **not** ask when the user clearly names one mod (folder, id, or common name like "selection capture" → `irishbruse.selection-capture`).

AskQuestion:

- **prompt:** `Which mod should be released?`
- **options:** one per candidate mod.
  - **id:** folder name (e.g. `irishbruse.selection-capture`)
  - **label:** `<folder> · v<version>` plus a short hint when useful:
    - `(unreleased changelog)` when `## Unreleased` has bullets
    - `(dirty)` when the mod repo has uncommitted changes
    - `(clean)` when neither applies
  - Put the best candidate first and mark it **(Recommended)** when it is the only mod with unreleased changelog or the user’s wording points at it.
  - Always include **Cancel**.

When only one mod has unreleased changelog and the user said "release" with no name, still ask Gate 0 with that single mod as Recommended plus Cancel.

After Gate 0, set `<folder>` to the chosen option id.

### Survey chosen mod

Run in parallel:

```bash
cd src/<folder> && git status -sb && git log -8 --oneline && git diff --stat
```

Also read:

- `src/<folder>/modinfo.ts` — current `version`
- `src/<folder>/CHANGELOG.md` — `## Unreleased` body
- `src/<folder>/workshop/workshop.json` — existing `publishedFileId`, if any

Propose the next semver from `## Unreleased`:

| Unreleased content             | Bump  |
| ------------------------------ | ----- |
| Breaking change                | major |
| New feature or behavior change | minor |
| Fixes only                     | patch |

If `## Unreleased` is empty, stop and tell the user.

### Gate A — Start release

AskQuestion:

- **prompt:** `Release src/<folder>/ as <proposed-version>?`
- **options:**
  - Proceed (Recommended)
  - Pick a different version
  - Cancel

When the user picks **Pick a different version**, ask again with patch / minor / major choices or accept their text, then continue.

## Step 1 — Verify

From the template root:

```bash
npm test -- --mod <folder>
npm run test:integration -- --mod <folder>
```

Fix failures in the mod before the next gate.
Report pre-existing failures outside the mod, but do not block on them.

Optional release build check:

```bash
node scripts/build/esbuild.config.mjs --mod <folder>
```

Preview Steam change notes:

```bash
node -e "
import { readChangelogChangeNote, workshopPublishReadiness } from './scripts/lib/workshop-files.js';
import { join } from 'node:path';
const dir = join(process.cwd(), 'src/<folder>');
console.log(readChangelogChangeNote(dir, '<version>')?.text ?? '(no section)');
console.log(workshopPublishReadiness(dir));
"
```

Show the user:

- test results
- proposed `## <version>` changelog bullets
- Steam change-note preview
- publish readiness (`preview.gif` or `preview.png`, `workshop/workshop.md`)

### Gate B — Version and CHANGELOG

AskQuestion:

- **prompt:** `Apply version <version> and finalize CHANGELOG for src/<folder>/?`
- **options:**
  - Yes (Recommended)
  - Edit docs first
  - Cancel

When the user picks **Edit docs first**, update what they name, then ask Gate B again.

## Step 2 — Apply release edits

In `src/<folder>/`:

1. Set `version` in `modinfo.ts` (and `modinfo.json` when present).
2. Move `## Unreleased` bullets into `## <version>`.
   Leave an empty `## Unreleased` heading.
3. Update user-facing docs when behavior changed:
   - `README.md`
   - `workshop/workshop.md`
4. Do not edit `workshop/workshop.json` by hand.

Match prior release commit style in that mod repo.
Recent examples use the version alone: `0.9.0`.

Re-run tests when code changed after Step 1.

## Step 3 — Commit

Stage only release files in `src/<folder>/`.
Warn once if secrets or unrelated paths are dirty.

### Gate C — Commit

AskQuestion:

- **prompt:** `Commit <version> in src/<folder>/?`
- **options:**
  - Commit (Recommended)
  - Show diff again
  - Cancel

Commit with a HEREDOC message.
Use the version string when that matches recent `git log` in the mod repo:

```bash
cd src/<folder>
git add <paths>
git commit -m "$(cat <<'EOF'
<version>

EOF
)"
```

On hook failure: fix, then make a **new** commit.
Never `--amend` unless user rules allow it.

## Step 4 — Push

### Gate D — Push

AskQuestion:

- **prompt:** `Push <version> from src/<folder>/ to origin?`
- **options:**
  - Push (Recommended)
  - Skip push
  - Cancel

When the user picks **Push**:

```bash
cd src/<folder> && git push -u origin HEAD && git status -sb
```

When the user picks **Skip push**, continue only if they asked to publish from local commits.

## Step 5 — Steam Workshop

Requires cached SteamCMD login.
See `docs/guides/publishing.md` and `docs/builds.md`.

### Gate E — Publish

AskQuestion:

- **prompt:** `Upload src/<folder>/ (<version>) to Steam Workshop?`
- **options:**
  - Publish interactively (Recommended)
  - Publish with --yes
  - Skip publish

From the template root:

```bash
npm run publish -- --mod <folder>
npm run publish -- --mod <folder> --yes
```

`npm run publish` runs a release build, then uploads.
Change notes come from `CHANGELOG.md` `## <version>`.
Do not pass `--watch`, `--debug`, or `--game`.

## Report

Always end with:

| Item       | Value                                           |
| ---------- | ----------------------------------------------- |
| Mod        | `src/<folder>/`                                 |
| Version    | `<version>`                                     |
| Commit     | hash or "not committed"                         |
| Push       | pushed / skipped                                |
| Workshop   | uploaded / skipped / failed                     |
| Steam item | `publishedFileId` from `workshop/workshop.json` |

List anything still dirty.
Note if the remote reports a moved repo URL.

## Examples

**Minor release**

User: `get ready to release the selection capture minor release`

1. Survey `src/irishbruse.selection-capture/`, propose `0.9.0`.
2. Gate A → Proceed.
3. Run tests and integration tests.
4. Gate B → Yes.
5. Edit `modinfo.ts`, `CHANGELOG.md`, `README.md`, `workshop/workshop.md`.
6. Gate C → Commit.
7. Gate D → user says `push` → Push.
8. Gate E → user choice.

**Patch-only**

Unreleased has fixes only → propose patch bump → same gates.

**Unnamed release**

User: `release a mod`

1. Scan `src/*/`, build Gate 0 options from changelog and git state.
2. Gate 0 → user picks `irishbruse.selection-capture`.
3. Continue from survey → Gate A.
