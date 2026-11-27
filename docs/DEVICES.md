# Device record (Pass 1F, O5/O6)

Measured on 2026-11-27 with build 0.0.3 + Pass 1F. Frame times come from the performance overlay
(pause menu → Performance overlay) or the `?debug=1` badge: FPS, average (EMA) frame time, and p95.

| Device / browser | How | Result | Notes |
| --- | --- | --- | --- |
| Linux cloud VM, Chrome 153, software WebGL (SwiftShader, 2 cores) | Local runs, `?test=1` | 1280 × 720: 17 sim ticks/s (Battery look). 844 × 390: 55 ticks/s. Heap 40 MB after 50 restarts; 27 textures, 11.6 MB | No GPU, so far below real phones; the game picks the Battery tier here automatically |
| GitHub Actions, Chromium 159 headless shell + WebKit (Playwright) | CI on every push to main | All browser tests pass | Functional only, no frame-time targets (software WebGL) |
| Owner's Android phone (APK 0.0.3) | **Pending** | — | Steps below |
| Owner's phone browser (web build) | **Pending** | — | Steps below |

Owner steps: install the latest APK, open the pause menu, turn **Performance overlay: On**, play the arena for two
minutes (run, jump, shoot, jetpack), then send a screenshot of the overlay (FPS · ms · p95 · heap) and the phone model.
Also check: two and three fingers at once (move + jump + shoot), lifting one finger keeps the others' actions, and a
Bluetooth controller if you have one.

## Memory observations

- 50 level restarts return every counter to its baseline: 57 listeners, 1 timer (the overlay), 14 DOM nodes under the
  game root, 27 textures (11.6 MB), 165 display objects, 0 tweens, 0 audio voices (browser test).
- JS heap after the restart run: 40 MB (Chrome).

## Known limitations

- No real-device numbers yet (above). Software WebGL runs the game slower than real time; tests poll instead of timing.
- The render-scale part of quality tiers (internal height 1080/900/720) and the Battery 30 fps cap wait for 6D.
- Audio was checked offline (peak 0.61 under a worst-case burst), not yet on phone speakers.
