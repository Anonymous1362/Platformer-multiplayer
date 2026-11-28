# Cosmic Drift: Roadmap (v2, 2026-11-28)

The owner's order of work after Pass 2B. The spec's owner amendments are in `docs/MASTER_SPEC.md` §0.8; status lives in `docs/PROGRESS.md`.

**Model:** Opus 5.5 all the way. Only the effort level changes per step.
**Rhythm (manual mode):** each step ends green in CI and pushed. Then I stop, report, and tell you which effort to set for the next step.

## Owner decisions (recorded in spec §0.8 by Step 1)
- **v1.0 is single-player.** The **Friends Edition "lite"** (co-op, 2–4 players, same code, free) comes right after Chapter 1.
- **Money:** a free Chapter 1 demo plus a one-time unlock for chapters 2–5. Same app and same save, so nobody restarts.
- **Kes is a man:** a properly built male body. A female character may come later.
- **Visor:** a teal line that flickers at story moments; red only in scripted story scenes.
- **Puzzles** are a core pillar, equal to combat. An automatic test bot checks that the jetpack can't skip any puzzle.
- **Checkpoints** are invisible, with a small save icon.
- **Touch buttons:** 4 on the right (Jump/jetpack, Shoot, Dash, Action).
- **World moments, thoughts and hints:** the giant's shadow, "…What was that?", ORRIN hints when you're stuck.
- **Look:** look B, reworked in the craft pass. Skills installed (`.claude/skills/README.md`).

## Effort levels: when to use which

| Setting | Use it for |
| --- | --- |
| **Max** | Taste and design decisions, level and puzzle design, bosses, the hard netcode, security review, final reviews, a bug that has already failed twice |
| **Extra** | Most building steps (code, Blender scripts, systems, docs) |
| **High** | Small fixes and docs only |
| **Ultracode** (switched on per step) | Many separate, similar jobs at once (asset batches, UI screens, content systems), plus big adversarial audits (bugs, security, performance). Its agents use the session's effort, so **ultracode plus Extra** is the normal pairing. Size: medium. This machine runs 2 agents at a time. |

## The steps

### Phase A: decisions and tools
| # | Step | Effort | Ultracode? |
| --- | --- | --- | --- |
| 1 | ✅ Write all the decisions into the spec (single-player v1.0, Friends Edition lite after Ch1, money, Kes male, puzzles, checkpoints, buttons, world moments, hints) and install the vetted skills | Extra | No |

### Phase B: the look (Art & UI B)
| # | Step | Effort | Ultracode? |
| --- | --- | --- | --- |
| 2 | **Craft pass** (images): designed platform in 2 finishes, rocks and shards in front, male Kes in darker B0 colours, crystal flicker and burst, idle GIF, Gemini's fixes. **You pick.** | Max | No |
| 3 | **B1b engine proof:** the real game in the new look, with a video | Extra (Max if stuck) | No |
| 4 | B2a characters: male Kes model and rig, smooth animations (idle 16, run 16, …), Crawler | Extra | **Yes** |
| 5 | B2b environment kit (tile variants, rocks, crystals, wreck, pylon) and ambient life (mites, giant, smoke) | Extra | **Yes** |
| 6 | B2c effects and post: rim, fog, shafts, crystal system, shard flight, enemy debris | Extra | **Yes** |
| 7 | B2d UI: simple settings (8 essentials plus "More options"), HUD, menus, 4-button touch layout | Extra | **Yes** |
| 8 | B2e sound: ambience bed with echo, layered foley, heartbeat and breathing, original distant-melody music bed | Extra | **Yes** |
| 9 | B3 polish and release 0.0.6 | Max | Audit only |

### Phase C: game framework (rest of Pass 2)
| # | Step | Effort | Ultracode? |
| --- | --- | --- | --- |
| 10 | 2C saves: encrypted, invisible checkpoints with autosave, "save code" for itch.io | Extra | No |
| 11 | 2D hub ship, Star Map, mission briefing, results | Extra | Optional (screens) |
| 12 | 2E cutscenes and dialogue: typing boxes, thoughts, ORRIN hints, **world moments** (camera takeover, letterbox, Kes reacts, control returns, checkpoint) | Max (design), then Extra | No |
| 13 | 2F level pipeline and the **puzzle toolkit** (crates, levers, plates, light beams, stealth, chases, dampening fields) plus the jetpack-skip test bot; level 1 `kepler_01` (tutorial) | Max | No |

### Phase D: Chapter 1, the demo (Pass 3)
| # | Step | Effort | Ultracode? |
| --- | --- | --- | --- |
| 14 | 3A enemy AI, parry (with glint cue), slam, blaster overheat | Extra (Max for AI feel) | No |
| 15 | 3B levels 2–3 with puzzles, Echoes, Star Vaults; dressing and playtest sweeps | Max (design) | **Yes** (dressing, bot playtests) |
| 16 | 3C boss framework and Hive Warden, with a boss intro cinematic | Max | No |
| 17 | 3D upgrades, cosmetics, contracts, achievements, crew requests | Extra | **Yes** |
| 18 | 3E Chapter 1 polish; demo build; store page kit (trailer, screenshots, 10 TikTok-ready clips) | Max | **Yes** (large audit: bugs, perf, readability) |
| — | **Publish the demo:** itch.io (free). Google Play: developer account ($25 once), then a closed test with 12 testers for 14 days (your friends can be the testers), then public. | You | — |

### Phase E: Friends Edition "lite" (you and your friends; APK + browser)
| # | Step | Effort | Ultracode? |
| --- | --- | --- | --- |
| 19 | 4A connection, room codes, handshake with build check | Extra | No |
| 20 | 4B lobby | Extra | No |
| 21 | 4C netcode (prediction, smoothing) | **Max** | No |
| 22 | 4E co-op through Chapter 1 (boss scaling, rescue pods) | Extra | No |
| 23 | 4F hardening and security review (cheating, tampering, network attacks) | Max | **Yes** (adversarial security audit) |

### Phase F onward: the full game
| Part | What | Effort / ultracode |
| --- | --- | --- |
| Pass 5 | Chapters 2–5 (Vulcanis, Cryos-9, Aether-V, Obsidian Core) and post-game | Max for each chapter's design, ultracode plus Extra for content volume |
| Pass 6 | Polish: art and audio lock, feel tuning, accessibility, performance | Max reviews, ultracode audits |
| Pass 7 | Release: payments (Play Billing unlock), stores, security (7D), updates, v1.0 | Extra; Max for security |
| Later | Friends Edition full (party modes, up to 8), optional cloud saves | — |

## Cutscenes (step 12, plus boss and chapter moments)
1. **World moments (in-engine, 3–8 s):** for example, the controls fade, the camera slowly pulls back as the giant's shadow crosses the fog, Kes turns his head, a typing box reads "…What was that?", the camera eases back, control returns, and it saves silently. Only first-time moments are unskippable, never in danger, and they always end with a checkpoint.
2. **Story scenes (in-engine):** letterbox bars, slow camera moves, character close-ups, typing dialogue.
3. **Big cinematics (pre-rendered in Blender):** the prologue crash, the *Lantern* breaking, chapter endings, boss reveals. Real camera language: slow push-ins, a feet-to-head tilt reveal, a low angle on the giant, focus pulls, a little handheld weight.
4. **"Intense, not cringe" rules:**
   - Restraint: silence before impact, few words, and sound carries the fear.
   - No meme effects or slow-motion spam.
   - Boss intros at most 25 s, story scenes at most 90 s (spec).
5. **TikTok-friendly moments built into the game:** the giant reveal, close-call escapes, crystal bursts, parry flashes, boss phase changes. Later, the replay system could let players save their last 10 seconds as a clip.

## Music and copyright (I'm not a lawyer; this is the general rule)
- **Putting a song in the game** needs a licence from its owners. Crediting it is not permission.
- **Playing the same melody on other instruments** is still that song: an arrangement, which needs permission. Changing a few notes doesn't make it yours if people can recognize it.
- **A vibe is free.** "Backrooms"-style liminal hum, or a distant, muffled, lonely melody, is a style, not a song. We can make our own.
- **Safe paths:** an original soundtrack (I can write original dark melodies and treat them to sound far away: reverb, low-pass filter, tape wobble), CC0 music, CC-BY music with credits, or a hired composer.
- **TikTok:** keep the game's audio original, so your clips never get muted or claimed. Creators add trending sounds inside TikTok themselves; business accounts are limited to TikTok's Commercial Music Library, so check that for your official account.

## Outside sites
I'll ask before using any, with what and why, plus links. Examples for later:
- Poly Haven CC0 textures and models: https://polyhaven.com (downloads via https://dl.polyhaven.org)
- ambientCG CC0 textures: https://ambientcg.com
- Freesound sounds (check each licence): https://freesound.org
- Kenney CC0 game assets: https://kenney.nl
