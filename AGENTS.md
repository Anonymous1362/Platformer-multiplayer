# Cosmic Drift — Agent Instructions

The full specification is docs/MASTER_SPEC.md. It overrides anything you assume.

## Every session
1. Read this file, docs/PROGRESS.md, and docs/HANDOFF.md.
2. Run `npm ci` and `npm run verify`; report the baseline before changing anything.
3. Work only on the milestone marked IN PROGRESS (or the one the user approved).
4. Read only the spec sections listed for that milestone in §23.

## Rules
- Follow the Sequential Build Protocol (spec §22). One milestone, then STOP for approval.
- Never claim success without running the command. Report exact commands and results.
- Never add `any`, `@ts-ignore`, disabled tests, or loosened lint/tsconfig rules to get green.
- `src/core/**` never imports Phaser, the DOM, Capacitor, PeerJS, or Web Audio.
- Phaser 4 only: read the v3→v4 migration guide and Phaser's agent skills before Phaser code.
- New dependency = one line in docs/DECISIONS.md first.
- Before the session ends: get to green or revert, commit, update docs/HANDOFF.md, push.

## Commands
npm run dev | npm run verify | npm run test:e2e | npm run levels:lint | npm run assets:build
