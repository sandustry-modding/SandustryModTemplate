# Rules

Skills and `docs/` carry vanilla game and kit facts.
Document new vanilla findings in a skill.

## Markdown prose

Put each sentence on its own line in markdown files.  
Do not join multiple sentences on one line.  
Tables, fenced code blocks, and headings are excluded.

The template guide lives in the root `README.md`.  
Kit and API pages live under `docs/`.  
Only `template` ships with this repo.  
Sample mods live in [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples). `npm run examples` clones that repo into `examples/`.
Every other mod documents in its own repo: `README.md` and `CHANGELOG.md`.
Its behavior, options, controls, and internals stay there.

Official Sandkit signatures: `.tmp/Sandkit - Sandustry Modding API.html` or https://sandustry.com/sandkit.html.
Do not invent APIs.

Vanilla facts: Read `.cursor/skills/sandustry/SKILL.md`, then **one** domain `SKILL.md` from its table.

Live session: **sandustry-mcp**.
Do not kill Sandustry.
Ask the user for a hard reload.

`sandustry/` is gitignored; `npm run setup` creates it.

- `source/` — asar extract (refreshed each setup)
- `logs/` / `saves/` / `workshop/` — links to OS / Steam folders
  Full layout: root `README.md` → Folder layout → `sandustry/`.
