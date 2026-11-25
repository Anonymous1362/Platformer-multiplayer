# Progress

| Pass | Status |
| --- | --- |
| 0 | DONE locally, awaiting owner approval. CI result for the first push is recorded below once seen. |
| 1A onward | Not started |

## Pass 0 evidence (2026-11-25, Node 22 in the authoring sandbox)

- `npm run verify`: passes (format, lint, typecheck, layer rules, stub scan, 38 unit and property tests, golden placeholder, levels guard, build).
- Browser tests in Chrome: 6 of 6 pass (16:9, 19.5:9, 4:3, wider than 21:9, narrower than 4:3, live window resize). Canvas size matches the expected stage and the screenshot is not blank.
- Shipped bundle: about 359 KB gzipped (budget 900 KB).

## Not verified yet

- WebKit (Safari engine) browser tests: could not install WebKit in the sandbox; CI installs it.
- Node 24: the sandbox has Node 22; CI uses Node 24.
- Android SDK and the APK build: Pass 7.

Distribution plan: Android sideload APK (built in GitHub Actions) plus an installable PWA for iPhone/iPad. Native iOS is optional and paid.
