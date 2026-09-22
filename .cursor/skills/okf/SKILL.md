---
name: okf
description: >-
  Read and update Sandustry OKF at docs/okf/. Use when a task needs a vanilla
  game or Sandkit fact, when editing docs/okf/, or when a session learns
  shipping-game behavior.
---

# OKF

OKF is the vanilla Sandustry fact bundle in the mod template checkout.
Mod behavior belongs in that mod's README or CHANGELOG.

## Read

1. If `docs/okf/AGENTS.md` is missing, run `npm run setup` in the template repo.
   Done when that file exists.
2. Follow the load order in `docs/okf/consume.md`.
   Done when one concept file answers the question, or the matching domain `gaps.md` already records the hole.
3. When OKF and the official Sandkit page disagree on a signature, follow the official page.
   Local copy: `.tmp/Sandkit - Sandustry Modding API.html`.
   URL: https://sandustry.com/sandkit.html.

## Write

1. Read `docs/okf/AGENTS.md` before the first edit.
   Done when the change matches that file's scope (shipping game and public Sandkit).
2. Follow **New findings** in that file.
   Done when the concept file is updated, missing proof is in that domain's `gaps.md`, and `docs/okf/log.md` has a line.
3. In `docs/okf/` prose, put each sentence on its own line.
   Tables, fenced code, and headings stay as blocks.
4. `docs/` is its own git checkout.
   Commit OKF there when the user asks to commit docs.

## Live game

Probe playbooks are under `docs/okf/live/`.
Read `docs/okf/live/evaluate.md` before `evaluate_script`.
Leave Sandustry running.
Ask the user for a hard reload.
Done when the returned JSON answers the question, or `docs/okf/live/triage.md` explains the miss.
