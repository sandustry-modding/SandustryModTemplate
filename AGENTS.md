# Rules

## Documentation

`docs/` is the Sandustry modding docs site.
It is a gitignored clone of [sandustry-modding.github.io](https://github.com/sandustry-modding/sandustry-modding.github.io).
Run `npm run setup` to create it.

After setup, load knowledge in this order:

1. `docs/llms.txt`
2. `docs/okf/consume.md`
3. **One** domain index under `docs/okf/` that matches the task
4. **One** concept file from that domain — stop when it answers the question

Use `docs/okf/` for vanilla game and Sandkit facts only.
Read `docs/okf/AGENTS.md` before you edit that tree.
Use root `README.md` and `docs/modkit/` for the mod template — not OKF.
Do not invent Sandkit APIs.
Official signatures: `.tmp/Sandkit - Sandustry Modding API.html` or https://sandustry.com/sandkit.html.

[SandustryTypes](https://github.com/sandustry-modding/SandustryTypes) is a gitignored clone at `SandustryTypes/`.
`npm install` creates it when missing.
`npm run setup` fast-forwards `origin/main`.
The template links it as `@sandustry-modding/types` (`file:SandustryTypes`), not the npm registry package.
See `SandustryTypes/AGENTS.md` when you edit that clone.

## Live game

F5, Steam, and `npm run sandustry` expose the Electron renderer on CDP `:9222`.
Use the MCP namespace `sandustry` to test and interact with the running game (snapshot, click, type, screenshot, evaluate).
`sandkit` is a global in that session.
Integration tests use CDP `:9224` (`npm run test:integration`).
For attach, evaluate, and `__debug` probes, read `docs/okf/live/`.
Ask the user for a hard reload.
Do not kill Sandustry.
Restart the game (F5) after `worker.js` or `patches.json` changes.

## Markdown prose

Put each sentence on its own line in markdown files.
Do not join multiple sentences on one line.
Tables, fenced code blocks, and headings are excluded.

## Template and mods

The template guide lives in the root `README.md`.
Kit pages live under `docs/modkit/` after setup.
Only `template` ships with this repo.
Sample mods live in [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples).
`npm run examples` clones that repo into `examples/`.
Every other mod documents in its own repo: `README.md` and `CHANGELOG.md`.

## Sandustry install

`sandustry/` is gitignored; `npm run setup` creates it.

- `source/` — asar extract (refreshed each setup)
- `logs/` / `saves/` / `workshop/` — links to OS / Steam folders

Full layout: root `README.md` → Folder layout → `sandustry/`.
