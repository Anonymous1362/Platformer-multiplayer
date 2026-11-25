# Release

## Android APK (free sideload route)

Builds run in GitHub Actions; no Android SDK is needed on any personal device.

1. Set `version` in `package.json` (semver) and add `release-notes/<version>.md`.
2. Commit, then push a matching tag: `git tag v<version> && git push origin v<version>`.
3. `.github/workflows/release.yml` runs `verify`, builds a signed release APK, checks the signing certificate, and publishes a GitHub Release with `cosmic-drift-<version>.apk` and its SHA-256.

`versionCode = major × 10000 + minor × 100 + patch` (spec section 21.3). A tag that does not match `package.json` fails the build.

### Signing (one-time setup by the owner)

Repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The release keystore (PKCS12) encoded as base64 on one line |
| `ANDROID_KEYSTORE_PASSWORD` | Its password (also the key password) |

The key alias is `cosmicdrift`. The workflow refuses any certificate whose SHA-256 is not
`94:1F:C2:E7:A8:6B:8F:CD:5F:68:AC:59:5F:F8:06:41:0E:4D:BF:D1:44:44:98:14:BC:6B:EE:14:88:61:73:84`.

**Every update must be signed with this same key** or Android refuses to install it over the old app.
The owner keeps an offline backup of the keystore file and password. Never commit either.

## Continuous Android check

`ci.yml` also builds a debug APK on every push to `main` (uploaded as a 7-day workflow artifact) so a broken Android build is caught immediately. Debug APKs use a throwaway key: do not share them.

## Web / PWA

Pass 7A. The final web host is chosen then, because the host's origin also owns PWA save storage (see `docs/DECISIONS.md`).
