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

MCP namespace `sandustry` is always available against a real running game for query and test.
Session globals such as `sandkit` are available in that instance.

## Markdown

One sentence per line.
Exceptions: tables, fenced code, headings.
