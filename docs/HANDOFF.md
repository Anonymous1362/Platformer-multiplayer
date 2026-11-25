# Handoff

State: Pass 1A implemented and verified locally (see `docs/PROGRESS.md`); waiting for owner approval before 1B. The APK pipeline is in place; publishing `v0.0.1` needs the owner's signing secrets.

What exists for 1A:

- `src/assets/`: `AssetTypes` (Zod mini schema, manifest contract plus optional `width`/`height`), `ManifestValidation` (O3: shape, keys, scopes, duplicates, extension allow-list, path traversal, hashes, dimensions), `AssetRegistry` (statuses, procedural fallbacks, one warning per key, staging keys, late swaps only at scene boundaries, `procedural-only` policy, `ensure()` for unlisted keys), `ProceduralTextures` (canvas painters), `loadScope` (Phaser loader glue with per-file timeout and scope budget).
- `src/app/`: `Capabilities` (injectable env), `FrameStats` + `PerfBadge`, `ViewportGuards`, `WebGLRequiredScreen`, `GameServices` (scenes receive services through their constructors; no globals).
- `src/scenes/`: `BootScene` (manifest → validate → `global` scope → `HoldingScene`), `HoldingScene` (placeholder until the Title screen in 2A).
- `public/assets/ASSET_MANIFEST.json` (hand-written), `public/assets/global/bg_starfield.png` (from `tools/placeholder-art/make-starfield.mjs`), `public/icons/favicon.svg`.
- Test hooks: `window.__CD_TEST__` exists only with `?test=1` (read-only asset snapshot and capabilities).

Gotchas learned:

- **Phaser 4 loader timeout:** each file gets its own default `timeout: 0` in its XHR settings, and that overrides the game-wide `loader.timeout`. Pass `xhrSettings` with the timeout on every file (`assetXhrSettings()` in `loadScope.ts`). The e2e stalled-asset test guards this.
- Image decode failures do not emit `loaderror`; they surface at loader `complete`, where `endScope()` falls back (reason `not-loaded`).
- Late arrivals are dropped if their scene's loader shuts down first; with a 1500 ms per-file timeout and a 6000 ms scope budget this only happens if decoding stalls. Scope loading moves to a Loading scene in 2D.
- Phaser 4 `Scale.RESIZE` ignores `scale.resize()` inside the window `resize` event; `main.ts` defers it (Pass 0).
- The perf badge lives in `src/app/` (not `debug/`) because staging and phone builds need it behind `?debug=1`.

Next: Pass 1B (spec section 23): headless simulation (`GameConfig`, `DMath`, `WorldSimulation` skeleton, `StateHash`, replays, dt clamp, entity generations).
