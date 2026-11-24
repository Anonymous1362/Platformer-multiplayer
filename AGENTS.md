# Cosmic Drift — Agent Instructions

The complete source of truth is [`docs/MASTER_SPEC.md`](docs/MASTER_SPEC.md).

## Every session

1. Read this file, `docs/PROGRESS.md`, and `docs/HANDOFF.md`.
2. Run `npm ci` and `npm run verify`; report the baseline before changing anything.
3. Work only on the milestone marked **IN PROGRESS**, or the single milestone the user explicitly approved.
4. Read only the specification sections listed for that milestone in §23.

## Rules

- Follow the Sequential Build Protocol in spec §22. One milestone, then stop for approval.
- Never claim success without running the command. Report exact commands and results.
- Never add `any`, `@ts-ignore`, disabled tests, or loosened lint/TypeScript rules to get a green build.
- `src/core/**` imports only `src/core/**`; it never imports Phaser, DOM APIs, Capacitor, PeerJS, or Web Audio.
- Phaser 4 only. Before Phaser code, read the official v3→v4 migration guide and Phaser's agent skills.
- Record every new dependency in `docs/DECISIONS.md` before installing it.
- Before ending a milestone: reach green or revert, update the handoff, push this branch, and stop for approval.

## Commands

`npm run dev` · `npm run verify` · `npm run test:e2e` · `npm run levels:lint` · `npm run assets:build`
