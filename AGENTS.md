# Rules

## Documentation

`docs/` is the Sandustry modding docs site.
It is a gitignored clone of [sandustry-modding.github.io](https://github.com/sandustry-modding/sandustry-modding.github.io).
Run `npm run setup` to create it.

| Path | Role |
| --- | --- |
| `docs/llms.txt` | Agent entry point — site map and OKF links |
| `docs/okf/` | Open Knowledge Format bundle — **vanilla game and Sandkit facts only** |
| `docs/okf/AGENTS.md` | Scope rules for OKF — read before editing `docs/okf/` |
| `docs/okf/consume.md` | Load order — read after `llms.txt` |
| `docs/okf/index.md` | OKF root — domain index list |
| `docs/AGENTS.md` | Rules when editing the docs site itself |
| `docs/modkit/` | Mod template kit — not OKF |
| `docs/README.md` | Human Docsify landing page |

After `npm run setup`, load knowledge in this order:

1. `docs/llms.txt`
2. `docs/okf/consume.md`
3. **One** domain index under `docs/okf/` that matches the task
4. **One** concept file from that domain — stop when it answers the question

For mod template workflow, use root `README.md` and `docs/modkit/` — not OKF.

Document new vanilla findings in `docs/okf/` under the matching domain.
Follow `docs/okf/AGENTS.md`.
Do not invent Sandkit APIs.
Official Sandkit signatures: `.tmp/Sandkit - Sandustry Modding API.html` or https://sandustry.com/sandkit.html.

[SandustryTypes](https://github.com/sandustry-modding/SandustryTypes) follows the same game-only rule for types and generated API docs.
See `SandustryTypes/AGENTS.md` when editing that clone.

## Live game

F5, Steam, and `npm run sandustry` expose the Electron renderer on CDP `:9222`.
Use `agent-browser` on that port to snapshot, click, type, and screenshot the running game.
Load `agent-browser skills get electron`, then run `agent-browser connect 9222`.
Run `agent-browser tab` and pick title **Sandustry**, URL `file://.../dist/index.html`.
Use `agent-browser snapshot -i` and click `@eN` refs from the **latest** snapshot.
Integration tests use CDP `:9224` (`npm run test:integration`).
For `sandkit` / `__debug` probes and attach failures, read `docs/okf/live/`.
MCP namespace `sandustry` is the same `:9222` endpoint when you need Chrome DevTools MCP tools.
Do not kill Sandustry.
Ask the user for a hard reload.
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
Its behavior, options, controls, and internals stay there.

## Sandustry install

`sandustry/` is gitignored; `npm run setup` creates it.

- `source/` — asar extract (refreshed each setup)
- `logs/` / `saves/` / `workshop/` — links to OS / Steam folders

Full layout: root `README.md` → Folder layout → `sandustry/`.
