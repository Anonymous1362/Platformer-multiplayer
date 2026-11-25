# Progress

| Pass | Status |
| --- | --- |
| 0 | DONE and green in CI, awaiting owner approval. |
| 1A onward | Not started |

## Pass 0 evidence (2026-11-25, Node 22 in the authoring sandbox)

- `npm run verify`: passes (format, lint, typecheck, layer rules, stub scan, 38 unit and property tests, golden placeholder, levels guard, build).
- Browser tests in Chrome: 6 of 6 pass (16:9, 19.5:9, 4:3, wider than 21:9, narrower than 4:3, live window resize). Canvas size matches the expected stage and the screenshot is not blank.
- Shipped bundle: about 359 KB gzipped (budget 900 KB).

## CI

GitHub Actions run 45580294451 on `main` passed: Node 24, `npm ci`, `npm run verify`, Chromium and WebKit browser tests, production dependency audit (about 1m21s). GitHub warns that `checkout`, `setup-node`, and `upload-artifact` v4 target Node 20; bump them when v5 is current.

## Not verified yet

- Android SDK and the APK build: Pass 7.

Distribution plan: Android sideload APK (built in GitHub Actions) plus an installable PWA for iPhone/iPad. Native iOS is optional and paid.
