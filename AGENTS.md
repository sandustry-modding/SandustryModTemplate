# Template workspace

## Docs

`docs/` is a gitignored clone of the [docs site](https://github.com/sandustry-modding/sandustry-modding.github.io).
Run `npm run setup` when it is missing.

For game or Sandkit facts, load in order:

1. `docs/llms.txt`
2. `docs/okf/consume.md`
3. One matching domain index under `docs/okf/`
4. One concept file — stop when it answers

OKF is game-only.
Read `docs/okf/AGENTS.md` before you edit that tree.
When you learn a vanilla game or Sandkit fact, write it into `docs/okf/` before you finish.
Follow `docs/okf/AGENTS.md` → New findings.
Mod behavior stays in that mod's `README.md` or `CHANGELOG.md`.
Template and kit: root `README.md` and `docs/modkit/`.
Use official Sandkit signatures only: `.tmp/Sandkit - Sandustry Modding API.html` or https://sandustry.com/sandkit.html.

`SandustryTypes/` is the local `@sandustry-modding/types` clone.
Read `SandustryTypes/AGENTS.md` before you edit it.

## Live game

CDP `:9222` (F5 / Steam / `npm run sandustry`).
MCP namespace `sandustry` for snapshot, click, type, screenshot, evaluate.
`sandkit` is a global in that session.
Integration tests: CDP `:9224` (`npm run test:integration`).
Attach, evaluate, `__debug`: `docs/okf/live/`.
Ask the user for a hard reload.
Keep Sandustry running.
Restart (F5) after `worker.js` or `patches.json` changes.

## Markdown

One sentence per line.
Exceptions: tables, fenced code, headings.

## Mods

Root `README.md` is the template guide.
Only `template` ships here.
Samples: `npm run examples` → [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples).
Other mods: their own `README.md` and `CHANGELOG.md`.
`sandustry/` layout: root `README.md` → Folder layout → `sandustry/`.
