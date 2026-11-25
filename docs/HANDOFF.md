# Handoff

State: spec v3.1 committed; `package.json` lists the planned dependencies (installed and audited once; production audit clean). Nothing is built.

Next: Pass 0 (spec section 23). Note TypeScript is pinned to 6.x on purpose; TS 7 only by ADR. Playwright browsers and the Android SDK could not be downloaded in the authoring sandbox, so install them in CI or locally.

`npm run verify` does not exist yet; creating it is part of Pass 0.
