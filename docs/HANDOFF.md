# Handoff

State: Pass 0 implemented and verified locally (see `docs/PROGRESS.md`). Waiting for the owner to approve before Pass 1A.

What exists: Vite + strict TypeScript 6 + Phaser 4 project; `FixedLoop`, `Random` (sfc32), `StickMath` (deadzone), stage sizing (4:3 to 21:9 clamp); layer rules in `.dependency-cruiser.cjs`; ESLint rules that keep `src/core` platform-free; `stub:scan`; a `levels:lint` guard that fails if level files appear before LevelLint exists; Playwright canvas tests; `.github/workflows/ci.yml`.

Gotchas learned:

- Phaser 4 in `Scale.RESIZE` mode ignores `scale.resize()` called inside the window `resize` event; `main.ts` defers it with `setTimeout(0)`. Keep the e2e resize test.
- `Random` must match the public sfc32 reference; the first draft added the counter too early and the reference vector test caught it.
- `package.json` has `engines.node >= 24`; the sandbox used Node 22, so npm prints an engine warning there only.

Next: Pass 1A (spec section 23): `BootScene`, asset registry, capability matrix, WebGL-required screen.
