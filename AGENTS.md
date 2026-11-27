# Cosmic Drift — Agent Instructions

The full specification is docs/MASTER_SPEC.md. It overrides anything you assume.

## Every session
1. Read this file, docs/PROGRESS.md, and docs/HANDOFF.md.
2. Run `npm ci` and `npm run verify`; report the baseline before changing anything.
3. Work on the milestone marked IN PROGRESS, then the next one in spec §22.6 order (auto mode, below).
4. Read only the spec sections listed for that milestone in §23.

## Rules
- Follow the Sequential Build Protocol (spec §22). **Auto mode** (owner decision, 2026-11-27, latest): finish one
  milestone or sub-step completely (green locally and in CI, docs updated, pushed), then start the next one without
  waiting. Stop and ask the owner only when a step needs their device or accounts, a decision only they can make,
  or a §22.3 stop-the-line rule fires. One milestone per commit series; never mix milestones.
- Never claim success without running the command. Report exact commands and results.
- Never add `any`, `@ts-ignore`, disabled tests, or loosened lint/tsconfig rules to get green.
- `src/core/**` never imports Phaser, the DOM, Capacitor, PeerJS, or Web Audio.
- Phaser 4 only: read the v3→v4 migration guide and Phaser's agent skills before Phaser code.
- New dependency = one line in docs/DECISIONS.md first.
- Before the session ends: get to green or revert, commit, update docs/HANDOFF.md, push.

## Commands
npm run dev | npm run verify | npm run test:e2e | npm run levels:lint | npm run assets:build
