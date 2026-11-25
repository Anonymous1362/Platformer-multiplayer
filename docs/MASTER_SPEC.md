# COSMIC DRIFT — Master Game & Build Specification v3.1

> ## ⛔ MANDATORY RULE — SEQUENTIAL BUILD PROTOCOL (read first, obey always)
>
> **Never build the whole game at once.** Work one milestone at a time, in the order in §23. Every milestone runs the cycle **Audit → Plan → Implement → Test → Review → Fix & Polish → Handoff → STOP** (§22).
>
> - Do **not** start the next milestone until the current one passes **every** acceptance item **and** the user explicitly approves (e.g., "Approved: proceed to 1B"). A bare "continue" approves **only** the next single milestone.
> - Never leave a file, feature, or milestone half-built and move on. If you cannot finish, stop, commit the work to a branch, and report exactly what is unfinished (§24).
> - If a later milestone exposes a defect in an earlier one, **reopen** the earlier milestone, fix it with a regression test, re-run every earlier gate, then resume.
> - Never claim something works unless you ran it. Report exact commands and results.
>
> The same rule is repeated at the end of this document.

---

## 0. How to Use This File

### 0.1 What this file is

This is the single source of truth for **Cosmic Drift**: product design (Part I), engineering (Part II), and the production process (Part III). It is written for an AI coding agent (or a human team) working **inside a Git repository** with a terminal, package manager, and test runner.

It is **not** a one-shot prompt. No AI can generate this game correctly in one response. Tools that accept a single prompt and return a single page will truncate, simplify, or fake most of it. Use an agentic coding tool that can read the repository, run commands, and commit (for example Claude Code, OpenAI Codex, or Cursor's agent), and feed it one milestone at a time.

### 0.2 Repository placement

- Save this file as `docs/MASTER_SPEC.md` in a **private** GitHub repository.
- Create `AGENTS.md` (template in Appendix C) at the repository root. Agents that read `CLAUDE.md` get a one-line `CLAUDE.md` that imports `AGENTS.md`.
- Progress lives in `docs/PROGRESS.md`, the latest session handoff in `docs/HANDOFF.md`, and architecture decisions in `docs/DECISIONS.md` (§24).

### 0.3 Precedence

1. Part III (production protocol, §22–§26) governs **how** work happens.
2. Part II (engineering, §11–§21) governs **how** things are built.
3. Part I (design, §1–§10) governs **what** is built.
4. A more specific rule beats a general one. If two rules genuinely conflict, stop, explain the conflict in two sentences, propose a resolution, and record the decision in `docs/DECISIONS.md` once approved.

### 0.4 Kickoff prompt (paste this to start a new project)

```text
You are the lead engineer on Cosmic Drift. The complete specification is docs/MASTER_SPEC.md.
1. Read §0, §22, §23, and §24 in full.
2. Read only the sections that §23 lists for the current milestone.
3. Execute Pass 0 only, following the Sequential Build Protocol (§22).
4. Finish with the §24 handoff report, update docs/PROGRESS.md and docs/HANDOFF.md, and STOP.
Do not write code for any later milestone.
```

### 0.5 Resume prompt (paste this when a new session or a different AI takes over)

```text
Continue Cosmic Drift. Read AGENTS.md, docs/PROGRESS.md, and docs/HANDOFF.md first.
Run the quality gates (§20.1) and report the baseline before changing anything.
Continue only the milestone marked IN PROGRESS. Do not start a new milestone without my approval.
```

### 0.6 Truth rules

- Never write "zero lag", "bug-free", "uncrackable", "unhackable", "guaranteed 120 FPS", or "100% offline multiplayer". They are false for this architecture. Use measured numbers.
- "Production-ready" means one thing in this project: the release checklist in §26.3 passes on the device matrix in §26.1.
- Numbers marked **(baseline)** are starting values to tune in playtests; tests pin them through `GameConfig` so changes are deliberate. Numbers marked **(contract)** are fixed interfaces (packet layouts, save schema, IDs) and change only through a versioned migration.

### 0.7 Conventions

- **MUST / MUST NOT / SHOULD / MAY** follow RFC 2119 meaning.
- **World units:** 1 unit = 1 pixel at the 1080p logical resolution. **1 tile = 64 units.** The camera shows 1080 units of height at every resolution (§13.6).
- **Time:** design tables use milliseconds or seconds; the simulation converts them to integer **ticks** at 60 Hz in `GameConfig` (1 tick = 16.667 ms; durations round to the nearest tick).
- **IDs:** lowercase `snake_case`, stable forever (Appendix B). Display names come from localization files, never from IDs.
- **File names:** TypeScript modules use `PascalCase.ts` for classes and `camelCase.ts` for function modules; content files use `snake_case`.

---

# PART I — PRODUCT

## 1. Vision & Scope

### 1.1 Pitch

Cosmic Drift is a premium 2.5D sci-fi action-platformer for phones, tablets, and browsers. It combines tight jetpack platforming, parry-driven combat, five handcrafted worlds, a story told through in-engine cinematics, and 1–4 player cross-play co-op and party modes across Android, iOS, and the web.

**Tagline:** *No one drifts alone.*

### 1.2 Design pillars (each has a test)

| # | Pillar | What it means | How it is tested |
| --- | --- | --- | --- |
| P1 | **Feel first** | Every input is acknowledged on the next rendered frame; movement is forgiving at the edges (coyote time, buffering, corner correction). | Input-to-photon check on device (§20.5); blind playtest rating ≥ 4/5 for "controls feel good". |
| P2 | **Read at a glance** | On a 6-inch phone, every threat, platform, and pickup reads by silhouette and value contrast; color is never the only cue. | Grayscale screenshot review per level; colorblind-filter review (§8.12). |
| P3 | **A world worth saving** | Every planet has a mechanical identity and a story purpose; characters have distinct voices. | Each level maps to a story beat (§3.2); dialogue review against §2.6. |
| P4 | **Better together** | A friend can join your room in under 30 seconds; co-op and party modes share the campaign's feel. | Timed join test on two devices (§23, Pass 4 acceptance). |
| P5 | **Respect the player** | Fair checkpoints, autosave, no data loss, no dark patterns, no ads or purchases in 1.0, full accessibility options. | Save fuzz tests (§20.2), accessibility checklist (§8.12). |

### 1.3 Platforms and technical targets

| Item | Target |
| --- | --- |
| Platforms | **Free distribution route (default):** Android via a Capacitor-wrapped sideload `.apk`; iPhone and iPad via the installable PWA (Safari → Add to Home Screen); desktop browsers via the same web build. Native iOS (Capacitor + TestFlight/App Store) is **optional and paid** (Apple Developer Program, US$99/year) and is not part of 1.0 unless the owner opts in. One TypeScript codebase. |
| Store build rules | Apply only if the owner publishes to a store. Google Play: new apps and updates must target API level 36 (Android 16) since 31 Aug 2026. Apple: uploads must be built with Xcode 26 and the iOS 26 SDK since 28 Apr 2026. Re-check both at Pass 7; they change yearly. A sideload `.apk` should still target a current API level. |
| Browsers | Current and previous major versions of Chrome, Edge, Firefox, and Safari. WebGL is required; without it, show a friendly "WebGL required" screen. |
| Orientation | Landscape only. Supported aspect ratios 4:3 to 21:9; outside that range, pillarbox or letterbox with decorative bars. |
| Frame rate (goals) | Simulation fixed at 60 Hz everywhere. Rendering at the display rate (60/90/120 Hz) when the device allows; Battery preset caps rendering at 30 fps. |
| Players | 1 (campaign), 1–4 (online modes). The protocol reserves 8 slots for a later party mode. |
| Network | Single-player works fully offline. Online modes need internet for signaling and, on many mobile networks, a TURN relay (§16.8). |
| Monetization (1.0) | None. No ads, no purchases, no loot boxes. Nothing in the architecture prevents adding them later. |
| Languages | English at launch; every string externalized (§8.11). |

### 1.4 Content manifest for 1.0

| Area | Content |
| --- | --- |
| Story | Prologue, four acts, finale, and a true-ending epilogue; 19 cutscenes (§7.3); 10 speaking characters (§2.3). |
| Campaign | 5 planets × (3 levels + 1 boss arena) = 20 missions; 15 Echoes (lore collectibles); 15 Star Vaults (secret rooms). Estimated 3.5–5 hours for a first completion (validate in playtests). |
| Enemies | 6 archetypes, 3 elite modifiers. |
| Bosses | 5 (Hive Warden, Solar Leviathan, Cryos Overlord, Aether Archon, The Hollow Crown). |
| Player kit | 5 weapons, 4 gadgets, 3 suit classes, 5 power-ups, 6 upgrade tracks, 4 mutators, 24 cosmetic items. |
| Hub | The *Lantern* ship with 6 stations (§8.5). |
| Multiplayer | 4 modes (Orbital Co-op, Shard Rush, King of the Beacon, Boss Rush Gauntlet); 5 arenas plus co-op campaign levels. |
| Difficulty | Story, Standard, Drift+ (post-game), plus independent Assist options. |
| Achievements | 30 (local; platform services optional later). |

### 1.5 Non-goals for 1.0

Open world; procedurally generated campaign levels; ranked PvP and global leaderboards (they need a server, §21.7); text or voice chat (quick-chat and emotes only); user-generated levels; monetization; offline LAN multiplayer (a browser cannot host a LAN server); host migration; full voice acting (dialogue uses voice "blips").

### 1.6 Craft bar

Award juries judge cohesion and craft: art direction, audio, narrative, game design and feel, accessibility, and technical polish. This spec makes each measurable: art (§9), audio (§10), narrative (§2, §7), feel (§4, §20.5), accessibility (§8.12), technical quality (§18, §20). No document guarantees recognition; repeated playtesting and polish do the rest, and the plan budgets time for both (Pass 6).

## 2. Story & World Bible

### 2.1 Logline and premise

**Logline:** When a corporate experiment shatters the artificial star that links five worlds, a courier pilot and the strange new mind in her helmet race across the broken system to recover its fragments, and learn that the "monsters" guarding them are the last defenders of the people the star is made of.

**Theme:** connection. The Lattice connected worlds; the Drift severed them; the player reconnects them, and multiplayer is framed as the same act ("Relay": linking Drifters across the Verge).

### 2.2 The world

**The Halcyon Verge** is a five-world system orbiting the **Heartstar**, an artificial star built by the vanished **Aurai**. The Heartstar powers the **Lattice**, a ring of jump-gates that made the five worlds one civilization. Humans arrived two centuries ago and built colonies run by the **Meridian Consortium**.

| Term | Meaning | Gameplay role |
| --- | --- | --- |
| Heartstar | The artificial star at the system's center. Secretly the Aurai themselves, who became light to power the Lattice. | Visible in every sky; its color dims act by act (§2.7). |
| Shardfall | The event that starts the game: Meridian overloads the Heartstar, it fractures, and fragments rain onto every world. | Prologue. |
| The Drift | The isolation after Shardfall: gates dark, ships stranded. | Framing for travel by short-range drive only. |
| Star Shards | Gold fragments of Heartstar light. | Soft currency (`starShards`). |
| Nebula Cores | Violet, condensed shard resonance. | Rare currency (`nebulaCores`). |
| Keystones | Three large Heartstar fragments, each guarded by a boss. | Story macguffins; needed to reignite the star. |
| Echoes | Aurai memory fragments that speak when touched. | 15 lore collectibles; all 15 unlock the true ending. |
| Custodians | Aurai-built guardian constructs, dormant for millennia, woken by Shardfall. They swarm anything carrying shards. | All six enemy archetypes and the Hive Warden, Solar Leviathan, and Aether Archon bosses. |
| Meridian Consortium | The company that runs the Verge. | Human antagonists, mining rigs, turrets, Cryos Overlord mech. |
| The Crown | Voss's device to lock every gate under one controller. | Final boss form. |
| Drifters | Salvage and courier pilots. | Player characters in multiplayer. |
| The *Lantern* | Kes's courier ship, wrecked in the prologue and rebuilt as the hub. | Hub, shops, mission select, multiplayer relay. |

**Planets** (mechanics carried over from v2 and kept exact):

| Planet | Nickname | Gravity | Other physics | Look | Story role |
| --- | --- | --- | --- | --- | --- |
| Kepler-186f | The Garden | 0.58× | Air drag 0.85× | Teal-cyan crystal forests, floating platforms, the *Lantern* wreck | Crash, survival, waking ORRIN |
| Vulcanis | The Forge | 1.05× | Air drag 1.0× | Molten orange lava fields, Meridian strip mines | Meridian's exploitation; rescue Pike |
| Cryos-9 | The Archive | 0.95× | Ground friction 0.25× (ice) | Glacial blue, frozen research station | The truth about Custodians; rescue Halloran; Rusk |
| Aether-V | The Choir | 0.75× | Directional wind currents | Ethereal violet floating Aurai ruins | The revelation about the Heartstar and ORRIN |
| Obsidian Core | The Heart | 1.0× | Polarity-flip zones, zero-G chambers | Crimson-magenta shattered core, Meridian Crown platform | Finale |

### 2.3 Cast

| ID | Name | Role | Want / arc | Voice | Sample line |
| --- | --- | --- | --- | --- | --- |
| `kes` | **Kes Arden** | Protagonist; courier pilot of the *Lantern*. | Wants her crew home. Learns to rely on others: from "I fly alone, I get paid" to "No one drifts alone." | Dry, quick, deflects with humor, sincere under pressure. | "I deliver packages. I don't do prophecies." |
| `orrin` | **ORRIN** | The AI in Kes's visor. Secretly an Aurai fragment that bonded with her suit during the crash. | Wants to understand what it is; chooses to return to the Heartstar. | Curious, literal, gentle, accidentally funny. | "I don't remember being born. I remember waking up because you were falling." |
| `tavi` | **Tavi Sen** | Navigator, 22, youngest crew member; leg injured in the crash, runs the *Lantern* bridge. | Wants to be trusted with more than the radio. | Fast, upbeat, nervous jokes. | "Good news: I found you on the scanner. Bad news: so did eleven things with teeth." |
| `bram` | **Bram Okoye** | Engineer. Runs the Workshop (upgrades). | Wants the ship whole again; treats it like a person. | Gruff warmth, superstitious about machines. | "She's not broken. She's sulking. Hand me the spanner and stop insulting her." |
| `pike` | **Pike** | Quartermaster and gunsmith; ex-Meridian. Runs the Armory. | Wants to atone for the weapons he built. | Laconic; few words, all of them dry. | "Point the shiny end at the problem." |
| `halloran` | **Dr. Ines Halloran** | Xenobiologist. Runs the Codex. | Wants to understand the Custodians, not kill them. | Precise, awed, talks fast when excited. | "They're not hunting you. They're guarding something, and you're carrying it." |
| `reyes` | **Captain Marisol Reyes** | The *Lantern*'s captain and Kes's mentor; Voss's prisoner until Act IV. | Wants her crew to outgrow needing her. | Calm authority. | "A crew is the only engine that runs on trust. Keep it fueled." |
| `voss` | **Director Hale Voss** | Meridian director; caused Shardfall. Lost the Ashfall colony to a gate failure twelve years ago. | Wants one hand on every gate so no world is ever cut off again. Becomes the Hollow Crown. | Measured, persuasive, never shouts. | "Freedom is a lovely word for people who've never watched a gate fail." |
| `rusk` | **Commander Dara Rusk** | Meridian enforcer; pilots the Cryos Overlord. | Loyal until loyalty means a cage. Redeems herself in Act IV. | Clipped, military. | "Orders are orders, Arden. Mine say you don't leave this ice." |
| `archon` | **The Aether Archon** | The last waking Aurai mind; guardian of Aether-V. | Wants the Aurai carried home. Speaks as "we". | Ancient, patient, kind. | "We did not build the star. We became it." |

Portraits: every speaker has five expressions: `neutral`, `happy`, `angry`, `worried`, `surprised`. ORRIN's portrait is an animated holographic glyph-face; the Archon's is a slowly rotating light-sculpture. Model sheets come before any portrait (§9.5).

### 2.4 Plot by act

**Prologue — Shardfall (Kepler-186f).** The *Lantern* is mid-jump through the Lattice when Meridian test-fires the Crown at Obsidian Core. The Heartstar fractures; shards rain across the Verge; gates collapse; the *Lantern* tears apart and the crew scatters. Kes crash-lands in Kepler's crystal forest. Her suit's dormant assistant boots up as ORRIN, with a personality nobody installed. (`cs_01_shardfall`, `cs_02_orrin_wakes`)

**Act I-a — The Garden (Kepler-186f).** Kes learns that Custodians swarm anyone carrying shards. Tavi, trapped in the surviving bridge section, guides her by radio. Kes finds the wreck, frees Bram from a Custodian cocoon, and destroys the Hive Warden nesting in the drive bay. Bram patches the *Lantern* into a short-range ship: no gates, but enough to hop between planets. Voss broadcasts across the Verge: surrender all shards to Meridian collection points. (`cs_03`, `cs_04`)

**Act I-b — The Forge (Vulcanis).** Meridian strip-mines shards from lava fields with Custodian-suppression pylons. Kes frees Pike from a work camp; he hands her the Grapple Hook he was forced to build. The Solar Leviathan has swallowed the first Keystone; Kes recovers it. A hologram of Voss appears: he holds Captain Reyes and offers a trade, the Keystones for her life. Kes refuses. (`cs_05`–`cs_07`)

**Act II — The Archive (Cryos-9).** In a frozen Meridian research station, Kes rescues Dr. Halloran, whose data shows the Custodians are guardians, not invaders, and that Heartstar light carries structure "like memory". Commander Rusk ambushes Kes in the Cryos Overlord mech. Beaten, Rusk retreats with a warning: Voss did not break the star by accident; he is building a cage. (`cs_08`–`cs_10`)

**Act III — The Choir (Aether-V).** Among floating Aurai ruins, Echoes become audible. The Aether Archon tests Kes in combat, then tells the truth: the Aurai became the Heartstar to power the Lattice for everyone; every shard is a piece of them; the fracture is killing them; the Crown would bind them forever as a power source under one hand. ORRIN is an Aurai fragment that bonded with Kes's suit at the moment of the crash. ORRIN asks whether it was ever "real"; Kes answers, "You were real enough to save my life. That counts." The Archon gives Kes the third Keystone: "Carry us home." (`cs_11`–`cs_13`)

**Act IV — The Heart (Obsidian Core).** The *Lantern* dives into the shattered core. Kes breaches the Crown platform, then frees Captain Reyes from the prison spire; Rusk, seeing what the Crown is, shuts down the spire's security grid. In the zero-G heart, Voss has fused with the Crown using Meridian's hoarded shards. (`cs_14`, `cs_15`)

**Finale.** Kes breaks the Hollow Crown. The Heartstar is collapsing; reigniting it means carrying the Keystones into the light. ORRIN can, because it is Aurai, and doing so means rejoining the Choir. ORRIN chooses to go: "Every gate that opens, that's me saying hello." The gates relight. Rusk arrests Voss: "Director. You're relieved." (`cs_16`, credits `cs_17`)

**True ending (all 15 Echoes).** Back on the *Lantern*, the Echoes Kes carried resonate in her visor. ORRIN's pattern reassembles: "I followed the voices you kept. Turns out you kept enough of me." Unlocks the ORRIN visor cosmetic. (`cs_18_true_ending`)

### 2.5 Endings

One canonical ending plus the true-ending epilogue. No branching choices in 1.0: the emotional choice belongs to ORRIN and is scripted. Finishing the campaign unlocks Drift+ difficulty and the full Boss Rush regardless of Echo count.

### 2.6 Writing style guide

- **Tone:** warm, witty, sincere. Stakes are personal. Humor never undercuts a sad beat.
- **Length:** at most 3 lines and 90 characters per line in one dialogue box. Story cutscenes at most 90 seconds; boss intros at most 25 seconds.
- **Every scene changes something:** information, a relationship, or a goal. Cut any scene that does not.
- **Clarity:** no technobabble without a plain translation in the next line. Mission goals are restated in the HUD objective line, never only in dialogue.
- **Villains have real arguments.** Voss is wrong about the solution, not about the danger.
- **Rating target:** fantasy violence, no blood, mild language at most ("damn"). Aim for an E10+ / PEGI 7 equivalent through the IARC questionnaire at Pass 7.
- **Barks** (in-level radio lines from ORRIN or Tavi): one line each, at most one every 30 seconds unless scripted, never during a boss telegraph, and always skippable by moving on.
- **Localization:** jokes and wordplay get translator notes; critical information never depends on a pun.

### 2.7 Environmental storytelling

- The Heartstar is visible in every sky. Its color temperature shifts per act: white-gold (Prologue), amber (Act I), pale blue (Act II), violet (Act III), flickering crimson (Act IV), restored white-gold (post-game hub).
- Meridian presence escalates: survey beacons on Kepler, mining rigs and banners on Vulcanis, a whole station on Cryos-9, gunships over Aether-V, the Crown platform at the core.
- Echo terminals show 2–4 lines of Aurai memory as holographic glyphs with translated subtitles. Each planet's three Echoes form one small story; all fifteen together foreshadow the twist.
- After the Act III reveal, Codex entries for every Custodian update with Halloran's new notes. Enemies do not change behavior; the player's understanding does.

---

## 3. Campaign Structure

### 3.1 Chapters

| Chapter | Planet | Levels + boss | New mechanics | New enemies | Unlocks on completion |
| --- | --- | --- | --- | --- | --- |
| Prologue + Act I-a | Kepler-186f | `kepler_01`–`03`, `kepler_boss` | Full move set, one-way platforms, wall-jump, jetpack, dash, shoot, parry, moving platforms | Crawler, Hover Seeker | Workshop, Wardrobe, Contracts; Relay unlocks after `kepler_01` |
| Act I-b | Vulcanis | `vulcanis_01`–`03`, `vulcanis_boss` | Timed geysers, collapsing bridges, grapple points, rising-lava chase | Armored Trooper, Ceiling/Wall Turret | Armory (opens mid-chapter when Pike is rescued in `vulcanis_02`: weapons, gadgets, suits); Grapple Hook (story) |
| Act II | Cryos-9 | `cryos_01`–`03`, `cryos_boss` | Ice friction, doors and switches, fog visibility layers | Cryo Bomber | Codex |
| Act III | Aether-V | `aether_01`–`03`, `aether_boss` | Wind currents, dash rings, light beacons | Phase Blinker | Echo Gallery |
| Act IV + Finale | Obsidian Core | `obsidian_01`–`03`, `obsidian_boss` | Polarity-flip zones, zero-G chambers, elite modifiers | Elite variants of all six | Drift+, full Boss Rush, cutscene theater |

### 3.2 Mission list

Length targets are for a first attempt on Standard. Every level has 3–6 checkpoints, one Echo, one Star Vault, and a par time.

| ID | Name | Beats | Length |
| --- | --- | --- | --- |
| `kepler_01` | First Light | Tutorial in the crash crater: move, variable jump, drop-through, wall-jump, jetpack, dash, shoot, parry (each introduced by a diegetic holo-sign and a safe practice space). First Crawlers. Ends at the *Lantern* bridge with Tavi. | 6–8 min |
| `kepler_02` | Glasswood | Vertical crystal shafts in low gravity. Hover Seekers and parryable bolts. First Echo and the first Star Vault teach secrets (cracked wall glints; shoot it). | 7–9 min |
| `kepler_03` | Wreckfall | The *Lantern* debris field. Moving platforms on rails, collapsing hull plates. Free Bram by destroying three cocoon nodes. | 8–10 min |
| `kepler_boss` | Hive Warden | Drive-bay arena (§4.5). | 3–5 min |
| `vulcanis_01` | Slag Run | Timed lava geysers, collapsing magma bridges, first Armored Trooper (teaches slam and flanking). | 7–9 min |
| `vulcanis_02` | Camp Ember | Meridian work camp. Turrets and searchlights (being spotted triggers a trooper wave; avoiding it is optional). Free Pike; receive the Grapple Hook at the exit. | 8–10 min |
| `vulcanis_03` | The Crucible | Grapple traversal, then a rising-lava chase set piece with a fixed upward-scrolling camera. | 7–9 min |
| `vulcanis_boss` | Solar Leviathan | Lava-lake arena (§4.5). | 4–6 min |
| `cryos_01` | Whiteout | Ice friction outdoors; fog layers limit visibility; Cryo Bombers and frost mines. | 7–9 min |
| `cryos_02` | Station Halcyon | Research-station interior: doors, switches, turret corridors. Rescue Halloran. | 8–10 min |
| `cryos_03` | Glacier Heart | Momentum slides on ice, turret gauntlets, descent to the reactor where Rusk waits. | 8–10 min |
| `cryos_boss` | Cryos Overlord | Reactor arena (§4.5). | 4–6 min |
| `aether_01` | Skyfall Ruins | Wind currents and dash rings; Phase Blinkers teach "watch the shimmer". | 7–9 min |
| `aether_02` | The Choir Stairs | Vertical ascent through shifting winds; light beacons rotate to open paths; dense with Echo story. | 8–10 min |
| `aether_03` | Archon's Path | Trial chambers combining every mechanic learned so far. | 8–10 min |
| `aether_boss` | Aether Archon | Floating-ring arena (§4.5). | 5–7 min |
| `obsidian_01` | Breach | Polarity-flip zones (walk on ceilings); elite modifiers introduced one at a time. | 8–10 min |
| `obsidian_02` | The Spire | Prison spire. Rescue Reyes; midway, Rusk disables the security grid (scripted). | 8–10 min |
| `obsidian_03` | Zero Point | Zero-G chambers with thrust movement, then the climb to the Crown chamber. | 8–10 min |
| `obsidian_boss` | The Hollow Crown | Crown chamber (§4.5). | 6–8 min |

### 3.3 Unlock flow

1. New save starts at `cs_01` → `kepler_01`. Players may skip the tutorial from the title screen's "Skip tutorial" toggle; skipping marks `kepler_01` complete and unlocks the Relay.
2. Relay (multiplayer) unlocks after `kepler_01` so friends can play together within about 10 minutes.
3. Each mission unlocks the next. Completed missions stay replayable from the Star Map.
4. Hub stations open as listed in §3.1. A station that is not open yet shows the silhouette of its owner and the line "Find them first."
5. The Armory opens the moment Pike is rescued in `vulcanis_02`, with Tier 2 in stock. Tier 3 unlocks after `vulcanis_boss`, Tier 4 after `cryos_boss`, Tier 5 after `aether_boss`.
6. Multiplayer arenas unlock with their planet in the campaign; the host's unlocks decide what a room can pick.

### 3.4 Difficulty and Assist

| Setting | Effect |
| --- | --- |
| Story | Damage taken −50%, enemy fire rate −25%, boss HP −20%, boss phase checkpoints always on. |
| Standard | Baseline values in §4. |
| Drift+ (post-game) | Elite modifiers on 30% of enemies, damage taken +30%, telegraphs 20% shorter (never below 300 ms), checkpoints at half density. |

**Assist options** (independent of difficulty, change any time, never block progression; only Drift+ achievements require them off): invulnerability; infinite jetpack fuel; game speed 70/80/90%; auto-fire; boss phase checkpoints; hazard respawn without damage. Assist changes the simulation speed by scaling the *simulation step count per real second*, never `FIXED_DT`, so physics stay deterministic (§13.2).

### 3.5 Collectibles and completion

| Item | Rules |
| --- | --- |
| Star Shards | Pickups and enemy drops. A full clear of a standard level yields about 300 shards (baseline). Collected shards bank at checkpoints; on death, shards collected since the last checkpoint are lost and respawn in the level. Replays respawn everything. |
| Echoes | One per level (15). ID pattern `echo_<planet>_<n>`. Persist on pickup immediately (autosave). |
| Star Vaults | One secret room per level (15). Worth 100 shards. Entrances are always signposted for attentive players (glinting cracks, wind-ruffled vines, off-pattern tiles). Some require the Grapple Hook and are marked in the Star Map as "return later". |
| Nebula Cores | 5 per boss on first clear; 2 per planet when all three of its Echoes are found; 5 for the true ending; 1–3 per Contract; 1 per multiplayer win. |
| Par times | Shown per level; beating all three par times on a planet unlocks that planet's trail cosmetic. |

Per-level record: shards collected %, Echo found, Vault found, best time, par beaten. Death counts appear only in the Stats screen, never on results screens.

### 3.6 Post-game

Drift+ difficulty, Boss Rush with all five bosses (solo or online), all missions replayable, Contracts continue, the Echo Gallery, a cutscene theater, and credits replay.

### 3.7 Playtime estimate (validate in playtests)

15 levels × 7–10 min + 5 bosses × 3–8 min + cutscenes (about 20 min) ≈ 3.5–5 hours for a first completion; 7–9 hours for 100%.

## 4. Gameplay Systems

All values live in `src/core/GameConfig.ts` (§13.3). Durations convert to ticks at 60 Hz, rounded to the nearest tick. Values are **(baseline)** unless marked **(contract)**.

### 4.1 Movement

**Player collider:** 40 × 88 units, origin at bottom-center. Hurtbox 32 × 76 (smaller than the sprite, M5). Sprite frame 128 × 128.

| Parameter | Value | Ticks / notes |
| --- | --- | --- |
| Max run speed | 420 u/s | Striker suit +15% |
| Ground accel / decel | 3600 / 4200 u/s² | Ice: accel ×0.5, decel ×0.25 (Cryos-9 ground friction 0.25×) |
| Air accel / decel | 2400 / 1800 u/s² | Kepler-186f air drag 0.85× → air decel ×0.85 |
| Gravity (rising, jump held) | 2600 u/s² × planet gravity | |
| Gravity (falling or jump released) | 4160 u/s² × planet gravity | Fall multiplier 1.6 |
| Terminal fall speed | 1500 u/s | |
| Jump velocity | 1040 u/s × √(planet gravity) | Keeps jump **height** equal on every planet; low gravity changes hang time and reach instead. |
| Variable jump cut | vy × 0.45 on release while rising | Only after a minimum hold of 50 ms (3 ticks), so taps still clear one tile. |
| Coyote time | 110 ms | 7 ticks |
| Jump buffer | 130 ms | 8 ticks |
| Corner correction | Nudge up to 10 u sideways when the head clips a ceiling corner while rising | Prevents "bonked" jumps |
| Ledge forgiveness | Pop onto a ledge whose top is within 14 u above the feet when moving into it | Applies to walking, jumping, dashing |
| Wall slide | Max fall speed 260 u/s while pressing into a wall | Refreshes air dash; recharges jetpack |
| Wall jump | vx 520 away, vy −980; horizontal input ignored for 120 ms | 7 ticks |
| Jetpack | Hold Jump while airborne (after coyote time) with fuel > 0: vy moves toward −140 u/s at 2400 u/s² | Fuel 1.00 s at Lv0; drains 1.0/s (Phantom ×0.8); recharges only when grounded or wall-sliding |
| Dash | 1100 u/s for 160 ms, gravity 0, vy 0; exits at max run speed | 10 ticks; one air dash per airtime; cooldown 950 ms after the dash ends (57 ticks); i-frames 140 ms (8 ticks) |
| Slam | Airborne + Down + Jump press: vy = +1600, vx = 0 | Landing: 120 u shockwave, 20 damage, 0.4 s stun; 120 ms landing recovery |
| Drop-through | Down + Jump while standing on a one-way platform | 150 ms re-land grace (N2) |
| Moving platforms | Riders move with the platform before their own integration; jumping inherits platform velocity, capped at 300 u/s | Crushing between solids triggers a hazard respawn, never a stuck state |

**Derived reach** (computed with semi-implicit Euler at 60 Hz; tests pin these within ±2 u):

| Planet | Gravity | Full-jump apex | Flat jump distance | Base jetpack apex | Base jetpack distance |
| --- | --- | --- | --- | --- | --- |
| Kepler-186f | 0.58× | 201 u (3.1 tiles) | 392 u (6.1 tiles) | 343 u (5.4 tiles) | 910 u (14.2 tiles) |
| Vulcanis | 1.05× | 199 u (3.1) | 294 u (4.6) | 337 u (5.3) | 777 u (12.1) |
| Cryos-9 | 0.95× | 200 u (3.1) | 308 u (4.8) | 338 u (5.3) | 798 u (12.5) |
| Aether-V | 0.75× | 201 u (3.1) | 343 u (5.4) | 341 u (5.3) | 847 u (13.2) |
| Obsidian Core | 1.0× | 199 u (3.1) | 301 u (4.7) | 339 u (5.3) | 784 u (12.2) |

A tap jump (released immediately) peaks at 77 u (1.2 tiles). The dash covers 176 u (2.75 tiles). Jetpack height gain from the apex grows with fuel upgrades: +137 u (Lv0), +165, +198, +230, +268, +305, +347 u (Lv6).

**Environment modifiers**

| Modifier | Rule |
| --- | --- |
| Wind zone (Aether-V) | Adds 900 u/s² in the zone direction to airborne entities (×0.3 when grounded); wind-added speed capped at 360 u/s. Gravity Boots ignore wind. |
| Ice (Cryos-9 `%` tiles) | Ground accel ×0.5, decel ×0.25. Gravity Boots ignore ice. |
| Polarity-flip zone (Obsidian Core) | Gravity direction becomes −1 inside the zone. All "down" logic (ground checks, one-way platforms, coyote time, slam, drop-through) uses the gravity sign. The simulation flips instantly; the sprite flip is a 150 ms render tween. |
| Zero-G chamber (Obsidian Core) | Gravity 0. The stick thrusts in its direction at 1600 u/s² up to 360 u/s, with exponential drag 1.5/s when not thrusting. No fuel cost. Jump while touching a surface pushes off at 520 u/s. Dash works in 8 directions. |
| Grapple Hook (traversal) | Unlocked in `vulcanis_02`. When a grapple anchor is within 320 u with line of sight, the Gadget button shows a grapple prompt and overrides the equipped gadget. Press: zip to the anchor at 1400 u/s, then release with vy −600 and 420 u/s in the facing direction. 400 ms cooldown. Zip, not swing: easier on touch and deterministic. |

### 4.2 Combat

**Shooting.** Hold Shoot to fire the equipped weapon (§4.7). Projectiles are swept every tick (N3). Aim modes:

| Aim mode | Behavior |
| --- | --- |
| Auto (default on touch) | Fires at the nearest enemy inside a 30° half-angle cone in the facing direction, within 900 u and line of sight; otherwise straight ahead. |
| Assisted | Fires in the stick direction (8-way) with 12° magnetism toward enemies. |
| Manual | Dragging on the Shoot button aims freely through 360°; releasing stops firing. Default for keyboard and mouse is mouse aim. |

**Heat.** Every weapon builds heat (0–100). Heat dissipates at 12/s while firing and 40/s when idle. At 100 the weapon vents for 1.2 s (amber vent effect, ring on the Shoot button). Per-shot heat is in §4.7.

**Parry (energy blade).** 180 ms active window (11 ticks), 600 ms cooldown. A 100° arc in front of the player, 84 u reach, 15 damage to enemies inside it.
- Enemy plasma bolts that enter the arc during the window are reflected toward their shooter (or the aim direction if the shooter is gone) at 2.0× damage and 1.25× speed. Reflected bolts bypass frontal shields.
- **Perfect parry:** the first 60 ms (4 ticks) of the window also stuns melee attackers for 0.6 s.
- A successful parry refunds 50% of the parry cooldown, restores 5 shield, and triggers the 45 ms hit-stop, camera kick, and haptic (render-only, §13.8).

**Damage types:** `plasma`, `melee`, `explosive`, `hazard`, `crush`. Each enemy has resistances in data (default 1.0).

**Player versus player.** There is no player-killing. In Shard Rush, a hit from another player knocks back and drops 20% of carried shards. In King of the Beacon, a hit knocks back and staggers for 1.0 s. In co-op, players cannot hurt each other. With the `friendlyBump` rule on, player bodies push each other.

### 4.3 Health, damage, death, and respawn

| Rule | Value |
| --- | --- |
| Base HP / shield | 100 / 40 (Hull upgrades raise both) |
| Shield recharge | Starts 3.0 s after the last hit (upgradable to 1.5 s), then 20 shield/s |
| Damage order | Shield first, then HP |
| Hurt invulnerability | 800 ms, with a blinking sprite (a reduced-motion variant uses a steady outline) |
| Knockback | 280 u/s away from the source, vy −320 |
| Hazard contact (spikes, lava, pit) | 25 damage, then a 0.5 s fade and respawn at the last safe ground position (solid ground, at least 1 s old, not within 2 tiles of a hazard) |
| Death | 1.2 s death sequence, then respawn at the last checkpoint. Shards collected since that checkpoint are lost and respawn in the level; enemies in the current section reset. |
| Checkpoint | Touching a checkpoint banks shards, restores full HP and shield, and autosaves (§15.4). |
| Co-op downed state | At 0 HP a player enters a Cryo Rescue Pod for 15 s; a teammate inside 96 u for a cumulative 2.0 s revives them at 50% HP. If the timer runs out, they respawn at the last checkpoint after 5 s. If every player is downed, the team respawns at the checkpoint. |

### 4.4 Enemies

Every enemy uses the same state machine: `idle → patrol → alert (0.4 s "!" cue and sound) → engage → windup (telegraph) → attack → recover → (stunned) → dead`. Enemies activate when any player is within 1400 u and sleep (keeping their state) when every player is more than 2200 u away. Engage range is at most 800 u horizontally and 450 u vertically so attacks always start on screen at the narrowest supported aspect ratio (4:3).

| ID | Name | HP | Movement | Attack and telegraph | Weakness / counter | Shards | First seen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `crawler` | Crawler | 30 | Ground patrol 120 u/s; turns at edges and walls | Crouches and eye-glows 0.35 s, then charges at 260 u/s for 15 contact damage | Jump over the charge; any attack | 3 | `kepler_01` |
| `hover_seeker` | Hover Seeker | 40 | Flies, holds about 4 tiles of distance | Charges 0.5 s (glow), fires one bolt: 10 damage, 420 u/s, every 2.2 s | Bolts are parryable | 4 | `kepler_02` |
| `armored_trooper` | Armored Trooper | 120 | Walks 90 u/s | Frontal shield absorbs shots from the front; 0.6 s raise-and-aim telegraph, then a 3-round burst (8 damage each) every 3 s | Shoot from behind or above; slam breaks the shield for 3 s; reflected bolts bypass the shield | 10 | `vulcanis_01` |
| `turret` | Ceiling/Wall Turret | 75 | Static, mounted on a surface | Laser sight thickens over 0.8 s, then a 0.4 s beam for 20 damage | Break line of sight; destroy it | 6 | `vulcanis_02` |
| `phase_blinker` | Phase Blinker | 65 | Teleports behind the player | Shimmer appears at the destination 0.4 s before it arrives; 18-damage slash; 3.5 s cooldown | Watch the shimmer; a perfect parry stuns it | 8 | `aether_01` |
| `cryo_bomber` | Cryo Bomber | 90 | Flies a patrol path | Drops frost mines: arm after 0.5 s, last 6 s, blast for 10 damage and 40% slow for 2 s | Shoot mines to detonate them safely | 9 | `cryos_01` |

**Elite modifiers** (Obsidian Core and Drift+):

| ID | Effect | Counter |
| --- | --- | --- |
| `shielded` | Energy shield absorbing 60 damage | A reflected bolt or a slam breaks it instantly |
| `volatile` | Explodes 0.8 s after death (120 u radius, 20 damage) with a growing ring telegraph | Keep distance |
| `swift` | +35% movement and attack speed; telegraph durations unchanged | Same counters, tighter timing |

Elites show a shape cue (a hexagonal halo for `shielded`, a pulsing crack pattern for `volatile`, speed streaks for `swift`), never color alone.

### 4.5 Bosses

Every boss has a 2–3 second intro (or a cutscene), a top-center health bar with phase notches, phase checkpoints on Story difficulty or with the Assist option, and telegraphs that are never shorter than 300 ms. **Co-op scaling:** HP × (1 + 0.6 × (players − 1)); add waves +1 enemy per extra player; telegraphs unchanged. **Rewards:** 150 shards and 5 Nebula Cores on first clear; 60 shards on replays.

| Boss | Arena | Phases (HP thresholds) | Signature attacks and counters |
| --- | --- | --- | --- |
| **Hive Warden** (`kepler_boss`, 600 HP) | *Lantern* drive bay, flat floor, two one-way ledges | P1 100–60%: figure-eight flight, drops 2 Crawlers every 8 s. P2 60–0%: adds 2 Hover Seekers and a double ground pound. | **Ground pound:** shadow grows for 0.8 s, then a floor shockwave (40 u tall, 600 u/s); jump it. Its underside core glows for 1.5 s after landing (2× damage). **Stinger lunge** (P2): a perfect parry exposes the core for 3 s. Teaches jump-over, weak points, parry. |
| **Solar Leviathan** (`vulcanis_boss`, 1,400 HP) | Lava lake with five basalt platforms (two sink) | P1 100–70%: surfaces at an edge and sweeps a lava wave. P2 70–35%: magma pillars and lobbed fireballs. P3 35–0%: lava rises; the fight continues on rising basalt platforms while it coils around the central pillar. | Surfacing: bubbles and glow for 1.0 s; the wave is 1.5 tiles tall (jump or jetpack). Gills glow when surfaced (2× damage). Pillars: glowing cracks for 0.8 s. Fireballs are parryable. Holds Keystone #1. |
| **Cryos Overlord** (`cryos_boss`, 1,500 HP, piloted by Rusk) | Reactor floor on ice (friction 0.25×), two ledges, icicle ceiling | P1 100–65%: ice spikes, cryo-bolt volleys, stomp shockwave. P2 65–30%: core shield; parry 3 cryo-bolts back into it (3 pips on the boss bar) to expose the core for 4 s. P3 30–0%: aerial slams with ring shockwaves; faster spikes. | Ice spikes: shadow on the floor for 0.7 s. Volleys of 3 parryable bolts. Rusk has mid-fight barks. Holds Keystone #2. |
| **Aether Archon** (`aether_boss`, 1,600 HP) | Three floating rings over a void (falling = hazard respawn); shifting wind | P1 100–66%: wind vortex pulls toward the center; summons 2 Seekers. P2 66–33%: rapid crossfire in lanes with visible safe gaps. P3 33–0%: wind direction rotates every 6 s; the Archon splits into three light-forms. | Vortex: dash out of the pull. Crossfire lanes show for 0.6 s first. In P3 only the form whose chest glyph matches the glyph on the HUD is real: a shape cue, not a color cue. Grants Keystone #3. |
| **The Hollow Crown** (`obsidian_boss`, 1,800 HP) | Crown chamber with polarity bands and a zero-G core | P1 100–60%: remixed Keystone powers one at a time (lava wave, ice spikes, wind pull) with the original telegraphs. P2 60–25%: the arena flips polarity every 8 s (2 s warning hum and arrows); homing shard volleys (parryable). P3 25–0%: zero-G; destroy three Keystone housings (150 HP each, counted in the total). | **Finale beat — Starfall:** the Crown charges a giant bolt that must be parried (300 ms window; 600 ms on Story). A miss restarts this beat instantly with no damage. Success plays `cs_16_finale`. |

### 4.6 Power-ups

Placed in campaign levels; in multiplayer arenas one spawns every 25 s at a seeded node. Each shows a HUD timer and spins as a pre-rendered 3D ring (§9.3).

| ID | Name | Effect |
| --- | --- | --- |
| `overdrive_jetpack` | Overdrive Jetpack | 8 s infinite fuel |
| `plasma_spread` | Plasma Spread | 10 s, +2 projectiles per shot |
| `aegis_bubble` | Aegis Bubble | Absorbs the next 2 hits |
| `super_magnet` | Super Magnet | 8 s full-screen shard pull |
| `gravity_boots` | Gravity Boots | 10 s, ignore ice and wind physics |

### 4.7 Weapons

Tiers are kept exactly from v2. Blaster Overclock (§4.8) adds +8% fire rate and +6% projectile speed per level on top of the equipped tier.

| ID | Tier | Price | Fire rate | Damage | Projectile | Heat/shot |
| --- | --- | --- | --- | --- | --- | --- |
| `pulse_blaster` | 1 (default) | — | 5.0/s (200 ms) | 10 | Single bolt, 750 u/s | 4 |
| `spread_array` | 2 | 180 shards | 5.5/s (182 ms) | 3 × 8 (up to 24 point-blank) | 3 bolts in a 14° cone | 6 |
| `overclocked_repeater` | 3 | 420 shards | 8.5/s (118 ms) | 11 | 950 u/s, 5° spread | 4 |
| `rail_lance` | 4 | 12 cores | 2.5/s (400 ms) | 34 | Fast bolt, pierces up to 3 enemies | 18 |
| `nova_cannon` | 5 | 25 cores | 1.8/s (550 ms) | 45 + 20 splash | Heavy orb, 70 u splash radius | 25 |

### 4.8 Upgrades and economy

Cost formula **(contract):** `cost = Math.round(baseCost * Math.pow(costMultiplier, currentLevel))`, with 0-indexed `currentLevel` (the level you are buying from). Costs below were computed with that formula.

| ID | Upgrade | Levels | Base × mult | Effect per level (Lv0 → max) | Cost per level | Total |
| --- | --- | --- | --- | --- | --- | --- |
| `jetpack_fuel` | Jetpack Fuel Capacity | 6 | 40 × 1.45 | 1.00 → 1.20 → 1.42 → 1.66 → 1.92 → 2.20 → 2.50 s burn | 40, 58, 84, 122, 177, 256 | 737 |
| `jetpack_recharge` | Jetpack Recharge Rate | 5 | 50 × 1.48 | 0.55 → 0.68 → 0.84 → 1.02 → 1.24 → 1.50 fuel/s | 50, 74, 110, 162, 240 | 636 |
| `dash_tuning` | Dash Cooldown & I-Frames | 5 | 60 × 1.50 | Cooldown 950 → 864 → 778 → 692 → 606 → 520 ms; i-frames 140 → 160 → 180 → 200 → 220 → 240 ms | 60, 90, 135, 203, 304 | 792 |
| `hull_shield` | Hull & Shield Tuning | 6 | 45 × 1.45 | +20 HP, +15 shield, −0.25 s recharge delay per level (Lv6: 220 HP, 130 shield, 1.5 s) | 45, 65, 95, 137, 199, 288 | 829 |
| `shard_magnet` | Shard Magnet Radius | 5 | 35 × 1.40 | 65 → 94 → 123 → 152 → 181 → 210 u | 35, 49, 69, 96, 134 | 383 |
| `blaster_overclock` | Blaster Overclock | 5 | 55 × 1.45 | +8% fire rate, +6% projectile speed per level | 55, 80, 116, 168, 243 | 662 |

Maxing every upgrade costs **4,039 shards**.

**Other prices:** Holo-Decoy 300 shards; Gravity Mine 350 shards; Phase Blink 8 cores; Vanguard suit 400 shards (after `vulcanis_boss`); Phantom suit 10 cores (after `cryos_boss`); each mutator 6 cores (after `cryos_boss`); cosmetics 2–8 cores or earned.

**Economy budget (first completion):**

| | Star Shards | Nebula Cores |
| --- | --- | --- |
| Total sinks | 5,689 (upgrades 4,039 + weapons 600 + gadgets 650 + Vanguard 400) | 79 + cosmetics (weapons 37, Phase Blink 8, Phantom 10, mutators 24) |
| Sources at 100% | 6,750 (15 levels × ~300 + 15 vaults × 100 + 5 bosses × 150) | 40 (bosses 25, Echo sets 10, true ending 5) plus Contracts and multiplayer wins |

A typical first run collects about 75–85% of level shards, so players can afford most of the kit by the finale but not all of it without replays, Contracts, or multiplayer. Tune with playtest telemetry (§19.3).

**Economy rules (tested, §20.2):** balances never go negative; purchases and refunds are atomic; every reward carries a unique `rewardId` recorded in a ledger so it can never be granted twice; wallet values cap at 9,999,999. **Respec:** refunds 100% of shards spent on upgrade levels (not weapons, gadgets, or suits), free, any time in the hub.

### 4.9 Suits, gadgets, mutators, cosmetics

| Category | Items |
| --- | --- |
| Suit classes | **Striker** (default): +15% move and dash speed. **Vanguard**: +30% max shield and +30% parry reflect radius. **Phantom**: +25% jetpack efficiency (fuel drain ×0.8) and stealth for 1.0 s after a dash (enemies lose their target). |
| Gadgets | **Grapple Hook** (traversal, story unlock, always available at anchors, §4.1). Slot gadgets, one equipped: **Holo-Decoy** (deploys a 40 HP decoy that enemies target for 4 s; 12 s cooldown), **Gravity Mine** (thrown; pulls enemies within 160 u for 1.5 s at 15 damage/s; 10 s cooldown), **Phase Blink** (teleports 192 u in the aim or move direction, stopping at the first solid tile so walls can never be skipped; 100 ms i-frames; 6 s cooldown). |
| Mutators (one equipped) | **Vampiric Rounds**: heal 1 HP per 30 damage dealt, −10% max HP. **Low-Gravity Anchor**: personal gravity ×0.85, dash cooldown +15%. **Glass Cannon**: +25% damage dealt, +50% damage taken. **Shard Siphon**: +25% shards from enemies, −25% max shield. |
| Cosmetics (24) | 8 suit skins, 8 jetpack trails, 8 visors. Sources: Wardrobe purchases, par-time sets (one trail per planet), achievements, the true ending (ORRIN visor). Cosmetics never change hitboxes or stats. |

### 4.10 Contracts and achievements

**Contracts:** three active at a time, refreshed at local midnight from templates seeded by date and save ID (e.g., "Defeat 25 Crawlers", "Collect 600 shards", "Parry 15 bolts", "Finish a level without taking damage", "Win 2 Shard Rush matches"). Rewards 1–3 cores. One free reroll per day. Changing the device clock can reroll Contracts; that only affects the player's own single-player progress and is accepted.

**Achievements:** 30, listed in Appendix B. Local first; Google Play Games and Game Center integration is optional post-launch.

---

## 5. Level & Map Design

### 5.1 Design rules derived from §4.1

| Rule | Value |
| --- | --- |
| Required gap without jetpack (center-to-center) | ≤ 80% of the planet's flat jump distance: Kepler 4 tiles, Vulcanis 3, Cryos 3, Aether 4, Obsidian 3 |
| Required gap with jetpack | ≤ 70% of base jetpack distance: Kepler 9 tiles, Vulcanis 8, Cryos 8, Aether 9, Obsidian 8 |
| Required climb | ≤ 2.5 tiles without jetpack; ≤ 4 tiles with base jetpack; taller climbs use wall-jump shafts or grapple anchors |
| Wall-jump shafts | 3–5 tiles wide, walls at least 3 tiles tall |
| Corridor height | ≥ 2 tiles (the player is 88 u tall) |
| Checkpoint spacing | 45–90 s of play; always before a boss, set piece, or new mechanic |
| Optional content | Upgraded fuel, grapple, and gadgets may open optional routes and vaults only, never the required path, unless the level comes after the unlock |

### 5.2 Level file format (contract)

Levels are JSON files at `content/levels/<planet>/<level_id>.json`. Static geometry is an **ASCII grid** that AI agents and humans can read and diff; everything dynamic is an object. Coordinates are in tiles from the top-left (fractions allowed for objects).

```json
{
  "schemaVersion": 1,
  "id": "kepler_01",
  "planet": "kepler",
  "nameKey": "level.kepler_01.name",
  "size": { "w": 180, "h": 40 },
  "parTimeSec": 420,
  "musicId": "mus_kepler_explore",
  "rows": ["...", "..."],
  "objects": [
    { "id": "spawn", "type": "player_spawn", "x": 4, "y": 33 },
    { "id": "cp_01", "type": "checkpoint", "x": 40, "y": 31 },
    { "id": "e_001", "type": "enemy", "archetype": "crawler", "x": 22, "y": 33, "patrol": [18, 27] }
  ],
  "zones": [
    { "id": "cam_a", "type": "camera_bounds", "x": 0, "y": 0, "w": 90, "h": 40 },
    { "id": "sec_1", "type": "section", "x": 0, "y": 0, "w": 40, "h": 40 }
  ],
  "decor": [
    { "piece": "kepler_crystal_cluster_a", "x": 10.5, "y": 30, "layer": "mid", "scale": 1.0, "flipX": false }
  ],
  "triggers": [
    { "zoneId": "intro_zone", "action": "bark", "lineId": "bark.kepler_01.intro" }
  ]
}
```

**Tile legend:** `.` empty · `#` solid · `=` one-way platform · `^` spikes · `~` lava · `%` ice (solid, Cryos-9) · `x` crumbling block (falls 0.5 s after contact, returns after 3 s) · `c` cracked wall (destructible secret wall).

**Object types:** `player_spawn`, `checkpoint`, `exit`, `shard`, `shard_line` (count, spacing), `shard_arc`, `echo`, `vault_entrance`, `enemy` (archetype, patrol, elite, facing), `turret` (surface normal), `power_up`, `moving_platform` (path, speed, wait, oneWay), `geyser` (period, offset, height), `collapse_bridge`, `grapple_anchor`, `dash_ring`, `wind_zone` (direction, strength), `polarity_zone`, `zerog_zone`, `door` + `switch` (linked by `switchId`), `light_beacon`, `crate` (drops), `npc` (rescue target), `rising_hazard` (speed, start delay), `cutscene_trigger`, `boss_spawn`, `music_trigger`, `camera_lock`.

**Zone types:** `camera_bounds`, `section` (enemy reset scope), `kill_plane`, `no_safe_ground` (excluded from hazard-respawn points).

Humans may author in Tiled; `tools/tiled-import` converts `.tmj` files into this format. The JSON above remains the only format the game loads.

### 5.3 Tiles and 2.5D dressing

- **Autotiling:** a 4-neighbor mask picks 16 variants for each solid tile (caps, edges, inner corners). The renderer merges horizontal runs into platform "slabs" for extrusion (§13.7).
- **Extrusion:** every slab shows a front face, a lit top lip, and side faces whose width follows the camera (parallax extrusion). Collision ignores all of it.
- **Decor layers:** `far` (0.45 parallax), `mid` (1.0, behind the action), `near` (1.0, in front of the background tiles), `fg` (1.15, in front of the player; at most 25% opacity over gameplay areas).
- **Readability rule:** background art is at least 40% darker and less saturated than gameplay tiles (value contrast check in §9.7).

### 5.4 Planet kits

| Planet | Tiles | Decor (8–12 pieces each) | Hazards | Background layers |
| --- | --- | --- | --- | --- |
| Kepler-186f | Frosted crystal, moss-covered titanium debris | Crystal clusters, giant ferns, *Lantern* hull plates, survey beacons | Spikes, pits | Nebula sky, star field, aurora, crystal mountains, floating spores |
| Vulcanis | Basalt, Meridian steel grating | Mining rigs, pylons, banners, slag carts | Lava, geysers, collapsing bridges | Smoke sky, embers, volcano ridges, refinery silhouettes |
| Cryos-9 | Ice, station panels | Pipes, frozen consoles, lab tanks, icicles | Turret beams, frost mines, ice spikes | Polar sky, snowfall, glacier walls, station towers |
| Aether-V | Ancient stone, energy glass | Ruined arches, glyph monoliths, floating stones | Void falls, wind shear | Violet sky, star rivers, distant islands, light pillars |
| Obsidian Core | Obsidian, Crown alloy | Shattered conduits, Keystone sockets, Meridian scaffolds | Polarity bands, energy grids | Fractured star core, shard storm, conduits, Crown silhouette |

### 5.5 Level structure

- **Teach → test → twist → reward:** introduce each mechanic in a safe space, test it with mild risk, combine it with something known, then reward mastery (shards, a vault, a view).
- **No blind jumps:** the landing must be visible before the player commits. Use camera bounds and look-ahead; never require a leap of faith.
- **Every dead end rewards** exploration.
- **Respawn safety:** checkpoints and safe-ground points sit on solid ground away from hazards and enemy lines of fire.
- **Set pieces** (lava chase, prison grid, Crown climb) get a checkpoint immediately before them and a short practice beat.

### 5.6 LevelLint (CI tool)

`npm run levels:lint` validates every level and fails CI on errors:

1. Schema valid; all rows have length `w`; only legend characters.
2. Exactly one `player_spawn`; at least one `exit`; checkpoint spacing within §5.1.
3. No object overlaps solid tiles; enemies have patrol space; turrets sit on surfaces.
4. **Reachability:** builds a graph of standable cells with edges for walk, fall, jump, wall-jump, jetpack, dash, and grapple using the planet's §5.1 metrics and only the abilities the player has at that point in the campaign. The exit and every required pickup MUST be reachable; Echoes and vaults declare `requires` when they need later abilities.
5. Width ≤ 400 tiles and height ≤ 200 tiles (the network encodes positions as `Uint16` half-units, max 32,767 u = 511 tiles, §16.4).
6. A kill plane under every open bottom edge; camera bounds cover all playable space.
7. Output: a JSON report plus an ASCII map that marks unreachable cells.

Each level also ships a **golden ghost run**: recorded inputs that finish the level. CI replays it after any physics or level change (§20.3).

### 5.7 Multiplayer arenas

Five arenas (`arena_kepler`, `arena_vulcanis`, `arena_cryos`, `arena_aether`, `arena_obsidian`), each at most 60 × 34 tiles, mirror- or rotation-symmetric for fairness, with 4 active spawn points (+4 reserved), beacon path nodes, shard spawn nodes, and power-up nodes. Planet hazards appear in a toned-down form. Co-op uses the campaign levels with enemy counts scaled by player count.

## 6. Multiplayer Design

### 6.1 Modes

| Mode | Players | Length | Goal and rules | Tie-break | Rewards (to each player's own save) |
| --- | --- | --- | --- | --- | --- |
| **Orbital Co-op** | 2–4 | A campaign mission or Boss Rush | Play the host's unlocked missions together. Downed players enter a Cryo Rescue Pod (§4.3). Guests keep shards, cores, and Echoes they pick up, but get mission-complete credit only for missions they have already unlocked themselves. | — | Normal campaign rewards |
| **Shard Rush** | 2–4 | 150 s | Shards spawn in seeded waves. Being hit by a player or enemy drops 20% of carried shards. Highest total wins. | 30 s sudden death: the next shard collected wins | 50% of collected shards banked (max 300 per match); +1 core to the winner |
| **King of the Beacon** | 2–4 | 180 s | A capture beacon moves along path nodes every 30 s (2.5 s warning). A sole occupant gains 2 points/s; a contested beacon gains nothing. First to 100 or highest at time. | Sudden death: next point scored wins | 100 shards to everyone; +1 core to the winner |
| **Boss Rush Gauntlet** | 1–4 | 5 bosses | Back-to-back bosses (only those the host has defeated until the campaign is complete). Three shared revive tokens instantly revive a downed player. A 10 s intermission between bosses heals 50% and refills fuel. | Score is total time | Boss replay rewards; local best times per player count |

Multiplayer wins grant at most 5 cores per day per save (anti-farming, configurable in `GameConfig`).

### 6.2 Relay and Lobby

**Relay screen** (hub bridge, Tavi's station): two large cards, **Host a room** and **Join a room**, plus the connection status chip (`idle | connecting | connected | reconnecting | failed`, M9).

- **Join:** four code boxes that auto-advance, auto-uppercase, accept paste, and use the unambiguous alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`. The last three room codes appear as "recent" chips.
- **Invite links:** `https://<game-domain>/?room=X7K9` on the web and `cosmicdrift://join/X7K9` in the native apps (Capacitor App URL handling). Opening a link pre-fills the code and asks for confirmation.
- **Share:** a Share button uses the native share sheet (Web Share API or Capacitor Share) with the code and link.

**Lobby scene — the hangar.** A 2.5D hangar deck with the bay doors open to space. The selected arena's planet hangs outside and rotates slowly; changing the arena cross-fades the planet over 600 ms with a slight camera dolly. Ambience: maintenance drones, steam vents, light shafts, drifting dust; a gentle camera sway (static under reduced motion).

**Formation: standing, not lined up.** Players stand in a loose crescent, not a line:

| Slot | Offset from center (u) | Depth scale | Notes |
| --- | --- | --- | --- |
| 0 (host) | (0, 0) | 1.00 | Front center; small crown icon on the nameplate |
| 1 | (−210, −18) | 0.92 | |
| 2 | (+220, −12) | 0.94 | |
| 3 | (−400, −34) | 0.86 | |
| 4–7 | Reserved for party mode | 0.80–0.84 | Second, deeper arc |

Each slot adds a jitter seeded by the slot number (±14 u x, ±6 u y), a facing toward the center (one in four faces the camera for variety), a depth-sorted draw order, a contact shadow, and a random idle-animation phase so nobody moves in sync. Players keep their slot until they leave; nobody reshuffles. New players take the lowest free slot.

**Lobby animations:**

| Event | Animation |
| --- | --- |
| Player joins | Beam-in: a 2.5D light column, 0.6 s materialize shimmer, landing puff, join sound |
| Player leaves | Beam-out in reverse |
| Ready | Visor flares cyan, small jetpack hop (0.4 s), nameplate badge turns to "READY" with a check icon |
| Unready | Visor dims |
| Emote | Wave, thumbs-up, salute, or a 3 s dance loop |
| Loadout change | Suit and trail swap with a quick shimmer |
| Countdown (last 3 s) | Hangar lights shift, camera pushes in, jetpacks ignite |
| Launch | Everyone rockets upward, white flash, iris transition into the match |

**Lobby UI** (DOM overlay over the hangar):

- Left column: room-code card (large code, Copy, Share), mode carousel, arena picker, and rule toggles (`friendlyBump`, `hazardSpeed`, `suddenDeath`, `lowGravityChaos`, `instagib`, `doubleShards`). Guests see the rules read-only.
- Right column: roster cards with callsign, platform icon (Android, iOS, Web), suit chip, ping bars, and ready state. The host can kick from a card's menu (with confirmation).
- Bottom bar: a large **Ready** button, Loadout (suit, weapon, gadget, cosmetics), Emote, and Leave. The host's **Start** button activates when everyone is ready and the mode's minimum player count is met.
- When everyone is ready, a 5 s countdown starts; any un-ready cancels it.

**Callsigns:** 3–16 characters (letters, digits, spaces, underscores), filtered against a small local blocklist.

### 6.3 Match flow

1. Lobby → countdown → launch transition.
2. Load and sync behind the transition. If loading runs long, show "Syncing…" until every client reports ready; the host starts the match tick when all are ready or after 15 s (unresponsive clients are dropped with a message).
3. Intro flyby: a 3 s camera pan of the arena (skippable once every player taps).
4. "3-2-1-GO".
5. The match. At the end, the simulation stops and a 1 s victory freeze plays.
6. **Podium scene:** a 2.5D podium (1st center and highest, 2nd left, 3rd right, 4th on the floor), winner pose, shard-colored confetti, and MVP cards (*Most Shards*, *Most Revives*, *Close Calls*, *Highest Speed*, *Parry Master*).
7. Rewards banked → rematch vote (majority) or return to the lobby; the host can change mode.

### 6.4 Social features

- **Quick-chat and ping wheel:** Help!, Boss Core!, On My Way, GG, Thanks, Nice!. On touch, a small HUD button opens the wheel; "Ping here" marks the player's position or aim point for 4 s with an off-screen arrow.
- **Drone spectator cam:** when downed with no revive possible (co-op, Boss Rush), follow a teammate; tap to switch.
- **No text or voice chat** in 1.0.

### 6.5 Fairness and trust

- Every player runs the same `GameConfig`; the handshake rejects mismatched config or content hashes (§16.3).
- The host has zero latency. This is accepted for friendly play; a "fair host" option that delays the host's own input by the median client latency is deferred.
- In competitive modes, the visible world width is capped at a 19.5:9 aspect ratio; wider screens get decorative side bars so nobody sees more of the arena.
- The host is trusted in 1.0 (friends-only rooms). Rewards come from the host's `match:end` event. Public matchmaking or leaderboards require a server (§21.7).
- If the host's device benchmarks as Low tier (§18.2), the Host card warns: "Your device may struggle to host. Let a friend host for the smoothest match."

---

## 7. Cinematics & Dialogue

### 7.1 Cutscene types

| Type | Used for | Look |
| --- | --- | --- |
| **In-engine cutscene** | Most story scenes | Real game assets, 12% letterbox bars, scripted camera (pan, zoom, dolly-by-parallax, shake), actors, VFX, music cues |
| **Motion-panel cutscene** | Shardfall, the truth, the finale, the true ending | Illustrated panels split into 3–6 depth layers with slow parallax ("2.5D motion comic"), light sweeps, particles |
| **In-level scene** | Rescues, short story beats | No letterbox; input locks briefly; camera focuses; dialogue box |
| **Boss intro** | Every boss | At most 25 s; ends on a name card ("SOLAR LEVIATHAN — Keystone Devourer") |

No pre-rendered video: in-engine scenes keep the art consistent, stay small, and localize easily.

### 7.2 Timeline format (contract)

Cutscenes are JSON timelines in `content/cutscenes/<id>.json`, played by `CutscenePlayer` on render time (the simulation is paused or input-locked during them).

```json
{
  "schemaVersion": 1,
  "id": "cs_06_leviathan_intro",
  "skippable": true,
  "letterbox": true,
  "tracks": [
    { "t": 0,    "type": "camera", "action": "moveTo", "x": 1820, "y": 940, "zoom": 1.1, "ms": 1200, "ease": "emphasizedDecel" },
    { "t": 0,    "type": "audio",  "action": "music", "id": "mus_vulcanis_boss_intro", "fadeMs": 600 },
    { "t": 900,  "type": "vfx",    "action": "spawn", "id": "vfx_lava_bubble_burst", "x": 1900, "y": 1010 },
    { "t": 1400, "type": "actor",  "action": "play", "actor": "leviathan", "anim": "surface_roar" },
    { "t": 1500, "type": "screen", "action": "shake", "intensity": 0.6, "ms": 500 },
    { "t": 2200, "type": "dialogue", "lineId": "cs06.orrin.01" },
    { "t": 2200, "type": "wait",   "for": "dialogueComplete" },
    { "t": 0,    "type": "screen", "action": "titleCard", "textKey": "boss.leviathan.title", "ms": 1800, "after": "previous" },
    { "t": 0,    "type": "event",  "action": "setFlag", "flag": "seen_leviathan", "after": "previous" }
  ]
}
```

Rules:
- Track types: `camera`, `actor`, `dialogue`, `audio`, `vfx`, `screen` (fade, letterbox, flash, shake, titleCard), `wait` (time, input, `dialogueComplete`), `event` (`setFlag`, `giveItem`, `unlock`, `startMission`).
- `"after": "previous"` chains a track after the preceding blocking track; otherwise `t` is absolute milliseconds.
- **Skipping MUST apply every `event` track's side effects in order** and leave actors, camera, and music in the timeline's final state. A skipped cutscene and a watched one produce identical saves (tested, §20.2).
- Skip: hold the Skip button for 0.8 s (a ring fills). The first viewing is skippable too.
- The app going to the background pauses the timeline; resuming continues it.
- Flashes in cutscenes obey the photosensitivity rule (§8.12).

### 7.3 Cutscene list

| ID | Trigger | Type | Length | Beats | Anchor line |
| --- | --- | --- | --- | --- | --- |
| `cs_00_title_attract` | Title idle 20 s | In-engine | 60 s loop | Gameplay vignettes from unlocked planets | — |
| `cs_01_shardfall` | New game | Motion-panel + in-engine | 75 s | The *Lantern* mid-jump; the Crown test; the Heartstar fractures; the ship tears apart; Kes falls | Reyes: "Everyone grab something. Now!" |
| `cs_02_orrin_wakes` | Start of `kepler_01` | In-engine | 50 s | Kes wakes in the crater; the visor boots with a personality | ORRIN: "Hello. You were falling. I'd rather you didn't." |
| `cs_03_warden_intro` | `kepler_boss` | Boss intro | 20 s | The Hive Warden unfolds from the drive bay | Tavi: "That's not a nest. That's a landlord." |
| `cs_04_kepler_outro` | After `kepler_boss` | In-engine | 70 s | Bram restarts the *Lantern*; Voss's broadcast | Voss: "Surrender your shards. The Verge needs one steady hand." |
| `cs_05_vulcanis_arrival` | Start of `vulcanis_01` | In-engine | 40 s | Strip mines; suppression pylons | Kes: "They're mining the sky." |
| `cs_06_leviathan_intro` | `vulcanis_boss` | Boss intro | 22 s | The Leviathan surfaces with a Keystone glowing inside | ORRIN: "The shard is inside it. So is the problem." |
| `cs_07_vulcanis_outro` | After `vulcanis_boss` | In-engine | 75 s | Keystone #1 recovered; Voss's hologram reveals he holds Reyes and offers a trade | Voss: "Keystones for your captain. A fair exchange." |
| `cs_08_cryos_arrival` | Start of `cryos_01` | In-engine | 40 s | A frozen station; a distress loop in Halloran's voice | Halloran (recording): "If anyone hears this, they're not attacking us." |
| `cs_09_overlord_intro` | `cryos_boss` | Boss intro | 25 s | Rusk powers up the Overlord | Rusk: "Orders are orders, Arden." |
| `cs_10_cryos_outro` | After `cryos_boss` | In-engine | 60 s | Rusk retreats with her warning | Rusk: "He didn't break the star by accident. He's building a cage." |
| `cs_11_aether_arrival` | Start of `aether_01` | Motion-panel | 45 s | Floating ruins; the Echoes become audible | ORRIN: "Do you hear singing? I hear singing." |
| `cs_12_archon_intro` | `aether_boss` | Boss intro | 25 s | The Archon descends; a trial, not hatred | Archon: "Show us what you carry." |
| `cs_13_the_truth` | After `aether_boss` | Motion-panel + in-engine | 90 s | The Aurai became the Heartstar; ORRIN's origin; the third Keystone | Kes: "You were real enough to save my life. That counts." |
| `cs_14_obsidian_arrival` | Start of `obsidian_01` | In-engine | 50 s | The *Lantern* dives into the broken core | Bram: "She'll hold. She's stubborn. Like someone I know." |
| `cs_15_crown_intro` | `obsidian_boss` | Boss intro | 25 s | Voss fused with the Crown | Voss: "I'm not breaking the Verge. I'm putting a lock on it." |
| `cs_16_finale` | Starfall parried | Motion-panel + in-engine | 90 s | The Crown breaks; ORRIN carries the Keystones home; the gates relight; Rusk arrests Voss | ORRIN: "Every gate that opens, that's me saying hello." |
| `cs_17_credits` | After `cs_16` | In-engine | 3–4 min | Credits over vignettes of the reunited crew | — |
| `cs_18_true_ending` | Credits end with all 15 Echoes | Motion-panel | 40 s | ORRIN's pattern reassembles in the visor | ORRIN: "I followed the voices you kept. Turns out you kept enough of me." |

In-level scenes use IDs `scene_<mission>_<n>` (for example `scene_vulcanis_02_pike`). Barks use `bark.<mission>.<n>`.

### 7.4 Dialogue box

| Property | Spec |
| --- | --- |
| Position | Bottom center during cutscenes (controls hidden); **top** center during gameplay so it never covers touch controls |
| Size | Width min(1100 logical units, 70% of the safe area); padding 24; radius 20 (`radius.lg`) |
| Style | Glass panel (§8.3); speaker name in a pill above the box, tinted with the speaker's color token |
| Portrait | 160 × 160 in a rounded frame with a speaker-colored rim; expression changes cross-fade in 120 ms |
| Text | 26 logical units at 100% text size; at most 3 lines; scales with the Text Size setting |
| Typewriter | 45 characters/s (Normal); Slow 25, Fast 80, Instant. Pauses: 120 ms after `.` `!` `?`, 60 ms after `,` |
| Voice blips | One blip per 2 characters; pitch and timbre per speaker; volume from the Voice slider |
| Advance | Tap once to finish the line, tap again to advance. A bouncing ▸ shows when ready. Auto-advance option: 1.2 s + 30 ms per character. |
| Log | Backlog button shows the last 50 lines |
| Motion | Open: scale 0.96 → 1 and y +16 → 0 over 220 ms (`ease.emphasizedDecel`); close: 140 ms fade (`ease.accel`) |
| Accessibility | Mirrored into an `aria-live="polite"` region; high-contrast mode uses an opaque panel |

### 7.5 Captions

Dialogue subtitles are always on in cutscenes. Optional sound captions (for example "[Heartstar cracking]") for story-critical sounds are on by default when the "Sound captions" setting is on.

### 7.6 Script files

- Lines live in `content/dialogue/<scene_id>.json` as `{ id, speaker, emotion, textKey, blipProfile?, autoAdvanceMs? }`; text lives in `content/locale/en.json` under `textKey`.
- Budget: 15–40 lines per cutscene, 4–12 per in-level scene.
- Line IDs never change once shipped (saves and the backlog reference them).

---

## 8. UX & UI

### 8.1 Screen map

```text
Boot → Photosensitivity notice (first launch) → Title ─┬→ Save Slots → Hub (Lantern)
                                                      └→ Settings / Credits
Hub ─┬→ Star Map → Mission Briefing → Loading → Level ⇄ Pause → Results → Hub
     ├→ Workshop · Armory · Wardrobe · Codex · Contracts · Settings · Stats
     └→ Relay → Host | Join → Lobby → Match → Podium → Lobby | Hub
Any screen → Error / Recovery screen (§19.2)
```

**UI technology split:** menus, panels, settings, dialogue, and lobby panels are a DOM overlay (Preact, §11) for crisp text at any pixel density, native text input, scrolling, and screen-reader labels. The world, HUD, touch-control visuals, hub diorama, lobby hangar, and podium render in Phaser. The DOM layer never updates every frame.

### 8.2 Design tokens (contract: `src/ui/tokens.css` + `src/theme/ThemePalette.ts`)

| Token group | Values |
| --- | --- |
| Radius | `xs` 6, `sm` 10, `md` 14, `lg` 20, `xl` 28, `pill` 999 (CSS px). Buttons `md`, panels `lg`, modals `xl`, chips and toggles `pill`. **No square corners anywhere in the UI.** |
| Spacing | 4, 8, 12, 16, 24, 32, 48 |
| Type | Display: **Exo 2** 700; UI and body: **Inter** 500/600 with tabular numerals (`font-feature-settings: "tnum"`). Both are SIL OFL fonts, bundled locally (no font CDN). Sizes: display 40/32, title 24, body 18, caption 14; scale with the Text Size setting; body never below 16 CSS px on phones. |
| Color (semantic) | `bg.deep` #080B1A, `bg.panel` rgba(15,23,42,0.78), `stroke` rgba(100,116,139,0.35), `text.primary` #E2E8F0, `text.secondary` #94A3B8, `accent` #00F5D4, `currency.shard` #FFB703, `currency.core` #A855F7, `danger` #FF2A85, `warning` #FB923C, `success` #34D399, `focus` #00F5D4 (2 px ring, 2 px offset) |
| Glass | Panel fill above + `backdrop-filter: blur(12px)` on Mid/High tiers; an opaque `#0F172A` fallback on Low tier or in high-contrast mode; 1 px stroke; soft shadow `0 12px 32px rgba(0,0,0,0.45)` |
| Contrast | Text ≥ 4.5:1, large text and UI components ≥ 3:1 against their real background (checked in CI with axe, §20.4) |

### 8.3 Components

Button (primary, secondary, ghost, danger, icon), Panel, Side Sheet, Modal, Tabs, Slider (value bubble while dragging), Toggle (pill with spring knob), Segmented control, Stepper, Item Card, Toast, Confirm dialog, Number counter, Code input, Progress ring, Badge/Chip, scroll list with snap.

Every component: minimum touch target 48 × 48 CSS px; states default, pressed, focused, disabled, selected (and hover on desktop); a UI sound (`sfx_ui_tap`, `sfx_ui_back`, `sfx_ui_toggle`, `sfx_ui_error`); a light haptic on press where haptics are on; keyboard and gamepad focus navigation in a predictable order.

### 8.4 Motion system

| Token | Value |
| --- | --- |
| Durations | `instant` 80 ms, `fast` 140 ms, `base` 220 ms, `slow` 360 ms, `cinematic` 600–900 ms |
| Easing | `standard` cubic-bezier(0.2, 0, 0, 1); `emphasizedDecel` cubic-bezier(0.05, 0.7, 0.1, 1); `accel` cubic-bezier(0.3, 0, 0.8, 0.15) |
| Springs (mass 1) | `snappy` stiffness 420 / damping 32; `gentle` 220 / 26; `bouncy` 300 / 18 |

| Transition | Spec | Reduced motion |
| --- | --- | --- |
| Panel or modal open | Backdrop fades in over 160 ms; panel scale 0.94 → 1, opacity 0 → 1, y +12 → 0 over 220 ms `emphasizedDecel` | Opacity only, 120 ms |
| Panel close | 140 ms `accel` to scale 0.97 and opacity 0 | Opacity only |
| Side sheet | Slides from the right edge with the `gentle` spring | Fade |
| Settings pop-up (from pause or hub) | Rises from the gear icon's position (transform origin at the icon), `snappy` spring | Fade |
| Tab switch | Cross-fade plus a 16-unit slide in the direction of travel, 180 ms | Cross-fade |
| List entrance | Items stagger 30 ms apart (max 8 staggered), y +10 → 0 | No stagger |
| Button press | Scale to 0.93 (large game buttons) or 0.97 (list items), release with `bouncy` | Color change only |
| Toggle | Knob slides with `snappy`; track color cross-fades 140 ms | Instant knob |
| Currency counters | Roll over 600 ms with ease-out; tick sound throttled to 20/s | Instant value |
| Scene: menu ↔ menu | Fade through `bg.deep`, 300 ms | Same |
| Scene: hub → mission | Iris wipe centered on the selected planet, 450 ms | Fade |
| Scene: planet travel | "Warp" star-streak, 900 ms | Fade |
| Toast | Drops from the top, 220 ms; auto-dismiss after 3 s | Fade |

Performance rules: animate only `transform` and `opacity`; no layout-triggering properties in animations; at most one `backdrop-filter` layer on screen on Low tier; never animate while the game simulation is running at full load unless the element is a HUD effect rendered in Phaser.

### 8.5 Screens

| Screen | Contents and behavior |
| --- | --- |
| **Title** | Logo assembles from shards (1.2 s), "Tap to start", attract loop after 20 s idle, Settings and Credits buttons, version string, "Skip tutorial" toggle on a new save. |
| **Save Slots** | Three slots: planet icon, play time, completion %, last played. Actions: Continue, New, Delete (double confirmation), Export, Import. |
| **Hub — the *Lantern*** | A 2.5D side-view cutaway of the ship. Rooms: Bridge (Star Map, Relay, Contracts — Tavi), Workshop (Bram), Armory (Pike), Codex lab (Halloran), Kes's bunk (Wardrobe, Settings, Stats, Achievements). Swipe or tap the station bar at the bottom; the camera eases to the room in 600 ms, the NPC greets with one line, and the station panel slides in as a side sheet. Unopened stations are dark with the owner's silhouette ("Find them first"). The current planet is visible through the windows. |
| **Star Map** | A 2.5D orbital view: five planets around the Heartstar; drag to rotate; tap a planet to warp in; mission cards show Echo, Vault, par medal, and shard %. Locked planets are silhouettes; vaults that need later gear show "Return later". |
| **Mission Briefing** | Name, objective, best time, collectibles, quick loadout change, Start. |
| **Loading** | Planet art, a gameplay tip or lore line, a progress ring with real progress. Shown at least 400 ms (no flash); after 10 s, add "Still loading…" with details. |
| **Pause** | Resume, Restart from checkpoint, Settings, Controls, Quit to Hub (confirms and warns about unbanked shards). In multiplayer the match continues; the menu says so. |
| **Results** | Time, shards (rolling counter), collectibles, par medal, unlocks revealed as card flips, Continue and Replay. |
| **Workshop** | Six upgrade cards: icon, level pips, current → next value, cost button (disabled with a reason when unaffordable). Purchase: pips fill, spark, counter rolls. Respec with a confirmation that shows the exact refund. |
| **Armory** | Tabs: Weapons, Gadgets, Suits, Mutators. Rotating pedestal preview; stat comparison bars; Buy, then Equip. |
| **Wardrobe** | Suit skins, trails, visors on a live turntable of Kes's rig; locked items show how to earn them. |
| **Codex** | Bestiary (updates after the reveal), Lore (the Echo Gallery), Characters, Theater (watched cutscenes, after the finale). |
| **Contracts** | Three cards with progress bars; Reroll; Claim with a core-burst animation. |
| **Credits** | Scrolling credits with vignettes; "Open-source licenses" link. |
| **Error / Recovery** | Plain-language message, error code, Retry, Restart, Safe Mode, Copy diagnostics (§19.2). |

### 8.6 Settings (full specification)

Every setting applies live with a preview, persists immediately (§15.3), and each tab has "Restore defaults".

| Tab | Setting | Range / options | Default |
| --- | --- | --- | --- |
| **Audio** | Master, Music, SFX, UI, Voice blips | 0–100 each | 80, 70, 80, 70, 60 |
| | Mute when in background | On/Off | On |
| | Mono audio | On/Off | Off |
| | Dynamic range | Full / Night (compressed) | Full |
| **Graphics** | Quality preset | Auto / Battery / Balanced / High | Auto |
| | Frame-rate cap | 30 / 60 / Display max | Display max |
| | Render scale | 70–100% | Preset-driven |
| | Particles | Low / Medium / High | Preset-driven |
| | Post effects (bloom, heat haze, frost) | On/Off | Preset-driven |
| | Parallax layers | 3 / 5 | Preset-driven |
| | Menu background | Animated / Static / Current planet | Animated |
| | Background effects intensity | 0–100 | 100 |
| | Show FPS and frame time | On/Off | Off |
| **Controls** | Layout preset | Classic / Simple (auto-fire) / Left-handed | Classic |
| | Edit layout | Opens the editor (§8.8) | — |
| | Stick type | Floating / Fixed | Floating |
| | Button size, opacity | 75–150%, 30–100% | 100%, 70% |
| | Stick deadzone, outer saturation, response curve | 5–30%, 70–98%, exponent 1.0–2.5 | 14%, 88%, 1.6 |
| | Aim mode | Auto / Assisted / Manual | Auto (touch), Manual (mouse) |
| | Shoot | Hold / Toggle | Hold |
| | Haptics | Off / Light / Full | Light |
| | Keyboard and gamepad bindings | Rebind any action; conflicts are flagged | §8.9 |
| **Gameplay** | Difficulty | Story / Standard / Drift+ (when unlocked) | Standard |
| | Assist options | §3.4 list | All off |
| | Camera shake, hit-stop | 0–100, On/Off | 100, On |
| | Screen flashes | Full / Reduced / Off | Reduced |
| | Damage numbers, tutorial hints | On/Off | On, On |
| **Accessibility** | Text size | 90–150% | 100% |
| | Dialogue speed, auto-advance | Slow / Normal / Fast / Instant; On/Off | Normal, Off |
| | Sound captions | On/Off | On |
| | High-contrast HUD | On/Off | Off |
| | Colorblind palette | Off / Protanopia / Deuteranopia / Tritanopia (palette swaps of semantic tokens; hazard patterns are always on) | Off |
| | Reduce motion | System / On / Off | System |
| **Language** | Language | English (more later) | Device language if supported |
| **Data** | Save slots, Export backup, Import backup, Delete save | Confirmations required | — |
| | Network privacy | Direct / Relay only (hides your IP address from other players, may add latency; §16.8) | Direct |
| | Anonymous diagnostics | On/Off (§19.3) | Off |
| **About** | Version, build ID, credits, licenses, privacy policy | — | — |

### 8.7 HUD

Laid out inside the safe area; scales with the HUD-scale portion of Text Size; hidden during cutscenes.

| Position | Element |
| --- | --- |
| Top-left | HP bar (rounded pill, 280 × 18) with the shield bar overlaid; below it the jetpack fuel gauge; below that active power-up timers |
| Top-center | Objective line (one short sentence) or the mode timer; boss bar with phase notches during bosses |
| Top-right | Shards and cores counters; pause button (48 × 48); in multiplayer, the RTT and packet-loss badge |
| Screen edges | Off-screen indicators for teammates, objectives, and pings |
| Bottom | Touch controls (§8.8); cooldown rings on Dash, Parry, and Gadget; heat ring on Shoot |
| Full-screen | Damage vignette; low-HP pulse (below 25% HP: heartbeat sound and a slow vignette pulse; under reduced motion, a steady red outline) |

### 8.8 Touch controls and layout editor

Sizes in CSS px (density-independent). Positions are offsets of the button center from the nearest bottom corner of the safe area. All values are **(baseline)**; tune on real devices.

| Control | Size | Default position | Notes |
| --- | --- | --- | --- |
| Move stick | Base radius 64, knob 28 | Floating anywhere in the left 40% × bottom 60% of the screen; Fixed mode at (+120, +120) from bottom-left | Knob springs home on release |
| Jump | 84 diameter | (−88, +88) from bottom-right | Largest button; hold for jetpack |
| Shoot | 76 | (−196, +72) | Drag to aim in Manual mode |
| Dash | 64 | (−84, +196) | Cooldown ring |
| Parry | 64 | (−192, +180) | Cooldown ring |
| Gadget / Grapple | 56 | (−144, +284) | Shows the grapple icon when an anchor is in range |
| Pause | 44 | Top-right, inside the safe area | Requires a deliberate tap; never sits next to gameplay buttons |

- **Hit areas** extend 12 px beyond the visual edge, but neighbors split overlapping areas down the middle, so a press never triggers two buttons.
- **Feedback:** pressed buttons scale to 0.93 and glow; on cooldown they dim to 60% with a radial sweep; a light haptic fires on press (if enabled).
- **Presets:** Classic (above), Simple (auto-fire on; Shoot button hidden), Left-handed (mirrored).
- **Editor:** drag any control, pinch or use a slider to resize (75–150%), set opacity, toggle the floating stick, test buttons live, "Reset to preset". Layouts save per device and per orientation-safe-area profile.

### 8.9 Keyboard, mouse, and gamepad defaults

| Action | Keyboard + mouse | Keyboard only | Gamepad (standard mapping) |
| --- | --- | --- | --- |
| Move | A / D | ← / → | Left stick, D-pad |
| Down (drop, slam) | S | ↓ | Left stick down |
| Jump / jetpack | Space | Z | A (south) |
| Shoot | Left mouse (mouse aims) | X (auto-aim) | X (west) or RT; right stick aims |
| Dash | Shift | C | B (east) |
| Parry | Right mouse | V | RB |
| Gadget / Grapple | E | B | Y (north) |
| Ping wheel / quick-chat | Tab / 1–4 | Tab / 1–4 | LB |
| Pause | Esc | P | Start |

Both keyboard columns work at the same time with no conflicts. Everything is rebindable. Gamepads arrive in Pass 6 (§23).

### 8.10 Onboarding

- `kepler_01` teaches each action with a diegetic holo-sign and a safe practice space; the prompt disappears after the player performs the action twice.
- Control glyphs follow the last-used input device (touch icons, key caps, or gamepad buttons).
- First visits to each hub station show a one-line NPC introduction, never a tutorial wall.
- "Tutorial hints" (Gameplay settings) turns off contextual prompts.

### 8.11 Localization

- Every player-facing string lives in `content/locale/<lang>.json` under a stable key; no string concatenation; placeholders like `{count}` with `Intl.PluralRules`; numbers through `Intl.NumberFormat`.
- Layouts tolerate 35% text expansion; dialogue boxes wrap rather than shrink text.
- Inter and Exo 2 cover Latin, Greek, and Cyrillic; CJK languages add a lazily loaded Noto Sans CJK subset (OFL). Right-to-left languages are out of scope for 1.0, but CSS uses logical properties (`margin-inline-start`) to ease adding them.
- A pseudo-locale (`en-XA`, accented and 35% longer) runs in CI screenshot tests to catch hard-coded strings and overflow.

### 8.12 Accessibility checklist

- Text contrast and touch targets per §8.2–§8.3; focus rings for keyboard and gamepad navigation; screen-reader labels on every DOM control.
- **Photosensitivity:** nothing flashes more than three times per second (WCAG 2.3.1); a photosensitivity notice appears on first launch; the Screen Flashes setting defaults to Reduced.
- Reduced motion follows the system setting and can be forced on or off.
- Color is never the only cue: hazards carry stripe patterns, elites carry shape halos, the Archon puzzle uses glyph shapes.
- Remappable inputs, a touch layout editor, hold-or-toggle shooting, auto-fire, Assist options, subtitles, sound captions, mono audio.
- Known limitation for 1.0: no one-handed touch layout.

## 9. Art Direction & Asset Pipeline

### 9.1 Neo-Celestial art bible

| Aspect | Rule |
| --- | --- |
| Read | Premium sci-fi platform adventure: mysterious, tactile, atmospheric, readable at phone size. No generic flat neon, no noisy cyberpunk clutter, no photorealism. |
| Projection | Side-on 2.5D. Characters and interactive objects read from a side or three-quarter-side view. Platforms show a front face and consistent extruded depth. Collision is strictly 2D; depth is visual only. |
| Shape language | Broad, confident silhouettes; rounded bevels mixed with angular industrial cuts; restrained panel seams; large forms before micro-detail. Each planet and faction has a silhouette motif (Aurai: arcs and rings; Meridian: hard chevrons; Custodians: segmented organic-mechanical curves). |
| Materials | Brushed titanium, ceramic composite, dark anodized metal, frosted crystal, volcanic basalt, translucent energy glass. One consistent roughness/specular language. Never mix painterly, pixel art, flat vector, and photoreal in one set. |
| Lighting | One key light from the upper-left front; cool ambient fill; restrained emissive accents; contact shadows under grounded objects; a subtle planet-tinted rim light. |
| Detail density | Medium-low at gameplay scale. No tiny text, random greebles, or thin high-frequency lines that vanish on a phone. |
| Readability | Silhouette and value separation against dark and bright backgrounds. No thick cartoon outlines unless the whole direction changes by ADR. |
| Camera | Fixed side-scrolling camera with mild look-ahead; parallax is visual only. |

### 9.2 Palette tokens (from v2, unchanged)

| Role | Tokens |
| --- | --- |
| Deep-space backgrounds | Deep Cosmos `#080B1A`, Abyssal Navy `#0F172A`, Slate Hull `#1E293B` (low saturation so gameplay pops) |
| Structure (platforms, walls) | Titanium Gunmetal `#334155`, Cool Steel bevel highlight `#64748B`, planet-tinted top rim |
| Friendly, energy, collectibles | Electric Cyan `#00F5D4` (thrusters, shields, friendly plasma, UI highlights), Starlight Gold `#FFB703` (Star Shards), Nebula Violet `#A855F7` (Nebula Cores, portals) |
| Danger | Neon Crimson-Magenta `#FF2A85` (enemy plasma, laser sights, hazards, weak points), Magma Amber `#FB923C` (overheat, lava warnings) |
| Planet rim tints | Kepler-186f `#00F5D4`, Vulcanis `#F97316`, Cryos-9 `#7DD3FC`, Aether-V `#C084FC`, Obsidian Core `#FF2A85` |

**Colorblind palettes:** for each mode (protanopia, deuteranopia, tritanopia), choose alternates for `accent`, `danger`, `currency.shard`, and `currency.core` such that, under a color-vision-deficiency simulation (Machado 2009 matrices), every pair differs by ΔE2000 ≥ 20. Record the chosen values in `ThemePalette.ts`; a unit test runs the simulation. Shape cues remain the primary signal.

### 9.3 2.5D techniques (render-only)

| Technique | Implementation |
| --- | --- |
| Parallax | Five layers with depth factors 0.05 (nebula sky), 0.12 (stars, additive), 0.25 (dust or aurora), 0.45 (megastructure silhouettes), 1.15 (foreground motes). Layers 1–3 tile horizontally. Battery preset uses layers 1, 4, 5. |
| Platform extrusion | Each slab has a recessed back face (14 u deep, darker), a lit top lip, and side faces whose drawn width follows the camera: `sideWidth = clamp((slabEdgeX − cameraCenterX) × 0.035, −24, 24)`. Side faces are pre-made sprites whose `displayWidth` changes per frame; no per-frame vector tessellation. |
| Projected props | Decor and props use `offset = (entityPos − cameraMid) × depthFactor` for subtle depth parallax. |
| 3D-looking spinners | Star Shards, Nebula Cores, Keystones, beacons, and power-up rings use **pre-rendered rotation strips** (24 frames) from Blender or the procedural baker, played as sprite animations. Cheap at runtime, consistent in look. |
| Contact shadows | A soft ellipse under every grounded or hovering entity; scale and alpha follow height above the ground (the simulation exposes the ground distance). |
| Rim light | A rim-light layer on characters, tinted by the planet token. |
| Light shafts | Additive gradient sprites with slow drift. |
| Filters (Phaser 4) | Bloom/glow on energy, heat haze (Vulcanis), frost vignette (Cryos-9), foreground depth-of-field blur. Gated by quality tier and the Post Effects setting; the game must look correct with all of them off. |
| Lighting | Phaser 4 lights with normal maps only on High tier, for hub and cutscenes first; gameplay must not depend on them. |

### 9.4 Character animation: PartRig

Characters, NPCs, and bosses use **cutout rigs** (bones with attached part sprites) driven by keyframe clips plus procedural layers.

**Why:** every frame reuses the same parts, so AI-generated or hand-painted characters stay on-model; clips interpolate, so animation is smooth at 60, 90, or 120 Hz; memory stays small; and procedural layers (lean, squash, aim) come for free.

| Element | Spec |
| --- | --- |
| Bones (player) | `root`, `hips`, `torso`, `head`, `visor`, `arm_upper_l/r`, `arm_lower_l/r`, `hand_l/r`, `leg_upper_l/r`, `leg_lower_l/r`, `foot_l/r`, `jetpack`, `weapon` |
| Keys | Rotation (degrees), x, y, scaleX, scaleY, alpha, attachment swap; per-key easing |
| Events | `footstep`, `muzzle`, `thrust_start`, `impact` (drive sounds and VFX) |
| Player clips | `idle`, `run`, `jump_rise`, `jump_apex`, `fall`, `land`, `wall_slide`, `wall_jump`, `jetpack`, `dash`, `slam_fall`, `slam_land`, `parry`, `hurt`, `death`, `revive`, `victory`, `emote_wave`, `emote_thumbs`, `emote_salute`, `emote_dance`, `lobby_idle_a`, `lobby_idle_b` |
| Layers | Upper-body overlay for shooting (`shoot_forward`, `shoot_up`, `shoot_down`) while legs run |
| Blending | 80–120 ms cross-fades between clips |
| Procedural (v2 values kept) | Squash and stretch on jump launch (0.82× / 1.22×) and landing (1.24× / 0.78×) through `SpringTween`; forward lean ±10° from velocity; visor tracks the aim; weapon recoil kickback; multi-segment thruster ribbon in `#00F5D4`; two-bone IK points the arms at the aim angle |

Frame-by-frame sprite sheets remain supported per key (`kind: "spritesheet"` in the manifest) for VFX and small creatures. A dev-only **Rig Viewer** scene previews clips, scrubs time, and toggles procedural layers. The rig JSON schema is in Appendix A.

### 9.5 Asset specifications

Art is authored at **2× texture density** (2 texture pixels per world unit). The pipeline exports 1× for Low and Balanced tiers and keeps 2× for High tier on screens at least 1440 physical pixels tall.

| Category | Key pattern | Source size (2×) | Format | Animation | Notes |
| --- | --- | --- | --- | --- | --- |
| Character parts | `chr_<id>_<part>` | Fits a 256 px-tall character | PNG, alpha | PartRig clips | Model sheet first: turnaround, expressions, scale lineup |
| Portraits | `por_<speaker>_<emotion>` | 512 × 512 (exported 320) | PNG | Static (ORRIN and Archon: short loops) | 5 expressions per speaker |
| Enemies | `enm_<id>_*` | Readable at 48–96 u | PNG parts or sheet | Rig or sheet | Distinct silhouette per archetype |
| Bosses | `boss_<id>_*` | Scale sheet against the player | PNG parts | Rig | Weak points consistent across phases |
| Tiles | `tile_<planet>_<variant>` | 128 × 128 per tile | PNG | — | 16 autotile variants + caps + damage states; collision independent of padding |
| Slab faces | `slab_<planet>_<face>` | 128-tall strips | PNG | — | Front, top lip, side, back |
| Decor | `dec_<planet>_<piece>` | Varies | PNG | Optional loop | 8–12 pieces per planet |
| Parallax planes | `bg_<planet>_<layer>` | 1× only, ≤ 2048 wide, seamless | WebP (lossy) | — | Far layers can be half resolution on Low tier |
| Spinners | `spin_<id>` | 24 frames | PNG strip | 24-frame loop | Shards, cores, Keystones, beacons, power-ups |
| VFX | `vfx_<id>` | 8–24 frames | PNG sheet | 30 fps | Additive glow on a separate layer where practical |
| UI icons | `ico_<id>` | SVG source | SVG (DOM), PNG (HUD) | — | 24-unit grid, 2-unit stroke, rounded joins |
| Panels and motion comics | `pnl_<cutscene>_<n>_<layer>` | 1× 2560 wide | WebP | Parallax layers | 3–6 layers per panel |
| App icon and splash | — | 1024 master | PNG | — | Generated with `@capacitor/assets` at Pass 7 |

### 9.6 Asset sources and switches

Every asset key can have up to three **candidate sources**, chosen by policy:

| Source | Meaning |
| --- | --- |
| `custom` | Hand-made or licensed art/audio dropped into the source folders |
| `ai` | AI-generated art/audio that passed the review in §9.8 |
| `procedural` | Code-generated fallback (shapes baked into the atlas at boot; synthesized Web Audio sounds). Every key has one so the game never shows a missing texture or plays silence. |

- **Global policy** `VITE_ASSET_POLICY`: `custom>ai>procedural` (default), `ai>custom>procedural`, or `procedural-only` (debugging and performance baseline). Dev builds can switch policy at runtime from the Dev Menu; the change applies at the next scene boundary.
- **Per-key override** in the source metadata: `"force": "procedural" | "ai" | "custom"`.
- **Asset Gallery** (dev scene): every key with a source badge (CUSTOM / AI / PROC / MISSING), side-by-side candidate comparison, grayscale and phone-size previews (48 and 96 u), playback of animations, preview over every planet background, and live swapping.
- **Release builds** include only the candidate the policy selects for each key; unused candidates are stripped.

### 9.7 Import pipeline

**Source layout** (large binaries tracked with Git LFS):

```text
assets_src/
  _reference/                      # model sheets, style frames, palette swatches
  characters/kes/{custom,ai}/...   # parts + meta.json (pivots, rig, license)
  enemies/... bosses/... tiles/... decor/... backgrounds/... vfx/... ui/... cutscenes/...
  audio/sfx/<key>/{custom,ai}/*.wav  audio/music/<key>/{custom,ai}/*.wav
  LICENSES.csv
```

**`npm run assets:build`** (Node, uses `sharp` for image work and a MaxRects packer):

1. Validate names, dimensions, alpha, frame counts, `meta.json` schema, and the license row for every file.
2. Trim transparent borders while preserving pivots; export 1× and 2×; optional palette harmonization (opt-in per key); lossless PNG for alpha art, lossy WebP for backgrounds and panels.
3. Pack atlases per scope (`global`, `ui`, `hub`, `<planet>`, `<boss>`) with pages of at most 2048 × 2048 on Low tier and 4096 × 4096 on High tier (the runtime picks by `MAX_TEXTURE_SIZE`).
4. Emit `public/assets/ASSET_MANIFEST.json` with keys, selected source, content-hashed filenames, frames, pivots, rig references, and scopes.
5. Report atlas sizes and estimated GPU memory per scope against §18.4 budgets; warn when a background layer's luminance is too close to gameplay tiles (value-contrast check) or a sprite's dominant hues fall outside the palette.

**`npm run audio:build`** is described in §10.5. Both commands are deterministic: the same inputs produce byte-identical outputs.

**Runtime** (`AssetRegistry`, M3 and O3): validates the manifest, loads scopes lazily (a planet's scope at the planet's loading screen), applies the 1500 ms per-asset timeout and the boot budget, records a status per key (`custom`, `ai`, `procedural_fallback`, `missing_required`, `optional_missing`), and never loads assets during gameplay.

### 9.8 AI-assisted art workflow

1. **Lock references first:** model sheets (turnaround, expressions, scale lineup), planet style frames, and the palette swatch live in `assets_src/_reference/`.
2. **Prompt with the template below and attach the references** every time. Record the tool, model, seed, and settings in `meta.json`.
3. **Rig characters:** generate the character once in a neutral pose, then separate it into parts. Never ask an image model to invent a different design per animation frame.
4. **Post-process:** clean alpha (inspect over magenta to catch halos), harmonize to the palette, resize to spec, sharpen at the target size.
5. **Review in the Asset Gallery** at phone size, in grayscale, over every planet background.
6. **Reject:** extra or fused limbs and fingers, warped symmetry, illegible micro-detail, any text or watermark, light that is not from the upper-left, style drift from the references.
7. **Record provenance** (§9.9). Confirm the generation tool's terms allow commercial use.

**Asset prompt template** (kept from v2):

```text
Create a production-ready game asset for Cosmic Drift, a premium Neo-Celestial 2.5D sci-fi platformer.

ASSET: [specific object / character / environment piece]
ROLE: [gameplay purpose and visual priority]
VIEW: side-on 2.5D, three-quarter side view where appropriate; consistent camera and perspective.
SILHOUETTE: [distinct readable outline and key proportions]
MATERIALS: [brushed titanium / ceramic / basalt / frosted crystal / energy glass]
LIGHTING: upper-left/front key light, cool ambient fill, restrained emissive accents, subtle contact shadow.
PALETTE: neutral deep-space structural colors plus [planet accent token]; preserve readable hazard/friendly color semantics.
STYLE: cohesive Neo-Celestial art direction; tactile semi-stylized 2.5D game art; clean forms, controlled bevels, medium-low detail density.
BACKGROUND: transparent PNG for isolated sprites; no floor, no environment, no text, no watermark, no border.
TECHNICAL: [target pixel dimensions], centered visual bounds, consistent pivot/origin, clean alpha edges, no baked UI, no unintended crop.
ANIMATION: [frame count, frame order, frame size, loop behavior, timing] or "static" (rig parts: "isolated part, neutral pose").
NEGATIVE: photorealism, flat vector icon style, pixel-art mismatch, painterly texture, random extra objects, illegible micro-detail, excessive bloom, text, logo, watermark, cast shadow outside the asset bounds.
```

### 9.9 Provenance ledger

`assets_src/LICENSES.csv` has one row per shipped file: `key, source (custom|ai|third_party|procedural), author_or_tool, license, date, prompt_or_seed, notes`. CI (`npm run licenses:check`) fails if a shipped asset has no row. Keep this ledger complete: stores, festivals, and award submissions increasingly ask how AI was used.

---

## 10. Audio Direction & Pipeline

### 10.1 Musical identity

A recurring five-note **Heartstar motif** threads through every track and is re-orchestrated per planet: warm analog synth pads and live-feeling percussion form the base.

| Context | Orchestration |
| --- | --- |
| Title, hub | The motif on piano and pads; warm, nostalgic |
| Lobby | Upbeat groove version of the motif |
| Kepler-186f | Glassy bells, marimba, airy pads |
| Vulcanis | Taiko, distorted bass, brass stabs |
| Cryos-9 | Celesta, sparse piano, cold strings |
| Aether-V | Choir pads, harp, shimmering textures |
| Obsidian Core | Dark synths, full orchestra, the motif in minor |
| Bosses | Driving percussion; each boss quotes the motif differently |
| Finale and credits | The motif finally resolves |

### 10.2 Music list

`mus_title`, `mus_hub`, `mus_lobby`, `mus_<planet>_explore`, `mus_<planet>_combat`, `mus_<planet>_boss` (×5 planets), `mus_finale`, `mus_credits` — 20 tracks — plus stingers (`stg_boss_intro`, `stg_victory`, `stg_defeat`, `stg_unlock`, `stg_echo`).

- **Adaptive music:** explore ↔ combat cross-fades over 1.5 s at the next bar line (BPM and bar offsets in metadata) when enemies engage or disengage, with 4 s hysteresis.
- **Boss music** jumps to section cue points at phase changes.

### 10.3 Sound-effect inventory (about 150 keys)

| Group | Keys (representative; the asset manifest holds the full list) |
| --- | --- |
| Player | `sfx_jump`, `sfx_land`, `sfx_jetpack_loop`, `sfx_dash`, `sfx_slam`, `sfx_parry`, `sfx_parry_perfect`, `sfx_hurt`, `sfx_death`, `sfx_revive`, `sfx_footstep_<surface>` |
| Weapons | `sfx_shoot_<weapon>`, `sfx_overheat_vent`, `sfx_reflect`, `sfx_impact_<surface>` |
| Enemies | `sfx_<archetype>_{alert,windup,attack,hurt,death}` |
| Bosses | `sfx_<boss>_<attack>` |
| World | `sfx_shard_pickup` (pitch rises along a chain), `sfx_core_pickup`, `sfx_echo_hum`, `sfx_checkpoint`, `sfx_door`, `sfx_switch`, `sfx_geyser`, `sfx_wind_loop`, `sfx_ice_crack`, `sfx_polarity_hum`, `sfx_zerog_whoosh` |
| UI | `sfx_ui_tap`, `sfx_ui_back`, `sfx_ui_toggle`, `sfx_ui_error`, `sfx_ui_purchase`, `sfx_ui_counter_tick`, `sfx_ui_unlock` |
| Multiplayer | `sfx_mp_join`, `sfx_mp_leave`, `sfx_mp_ready`, `sfx_mp_countdown`, `sfx_mp_go`, `sfx_mp_win`, `sfx_mp_lose` |
| Ambience | `amb_<planet>_a`, `amb_<planet>_b` (two layered loops per planet), `amb_hub`, `amb_hangar` |
| Voice blips | `vox_<speaker>` (short syllable sets per speaker) |

### 10.4 Mixing

- **Buses:** `master → {music, sfx, ui, voice, ambience}` (M4).
- **Ducking:** music −6 to −9 dB on boss hits and alerts (80 ms attack, 400 ms release); −3 dB while dialogue types.
- **Master limiter:** a `DynamicsCompressorNode` configured as a limiter (threshold −3 dB, ratio 20, attack 3 ms, release 250 ms) prevents clipping.
- **Loudness targets:** music about −16 to −18 LUFS integrated; true peak ≤ −1 dBTP; SFX normalized per category.
- **Space:** stereo pan from screen position (max ±0.6); off-screen sounds attenuate about −6 dB per screen width.
- **Polyphony (N12):** voices per bus: sfx 24, ui 6, ambience 4, voice 2; minimum 40 ms between repeats of rapid sounds; when full, steal the oldest or quietest voice. Frequent sounds get ±3–5% pitch variation from a render-side random generator (never the simulation's).

### 10.5 Formats and pipeline

- **Source:** WAV, 48 kHz, 24-bit, in `assets_src/audio/...`.
- **`npm run audio:build`** (ffmpeg): trim silence, two-pass EBU R128 loudness normalization, encode **AAC `.m4a`** (plays everywhere) and **Opus** (used where `canPlayType` reports support). SFX are mono unless stereo matters; music 96–128 kbps; SFX 64–96 kbps. Loop points (seconds) go into metadata.
- **Playback:** SFX are decoded `AudioBuffer`s. Music streams through `HTMLAudioElement → MediaElementAudioSourceNode → music bus`. **iOS ignores `HTMLMediaElement.volume`, so all volume control must go through Web Audio gain nodes.** Seamless loops use two media elements with a 50 ms equal-power cross-fade at the loop point; tracks of 60 s or less may be decoded instead on Mid and High tiers.
- **Memory budget:** decoded audio ≤ 48 MB (Low tier ≤ 24 MB).
- **Procedural fallback:** every SFX key has a Web Audio synth recipe so the game is never silent during development.
- **Lifecycle:** one `AudioContext`, owned by `SoundEngine` (Phaser's own audio is disabled so there are never two contexts); unlock on the first user gesture; suspend on background, resume on foreground. QA checks the iOS ring/silent switch in both positions.

### 10.6 Haptics map

| Strength | Events |
| --- | --- |
| Light | Jump, landing from more than 2 tiles, UI taps, every 10th shard in a chain |
| Medium | Dash, successful parry, checkpoint |
| Heavy | Boss phase break, death, Starfall parry |

Native apps use Capacitor Haptics; the web uses `navigator.vibrate` where supported (not in iOS Safari). Minimum 60 ms between haptics. The Haptics setting (Off / Light / Full) scales or disables them.

---

# PART II — ENGINEERING

## 11. Tech Stack & Dependencies

Versions verified in November 2026. Re-verify at the start of every pass, pin exact versions (`save-exact=true`), and record changes in `docs/DECISIONS.md`.

| Package / tool | Use | Introduced | Notes |
| --- | --- | --- | --- |
| Node.js 24 LTS or 26 LTS | Tooling runtime | Pass 0 | Pin in `.nvmrc` and `package.json#engines`. Node 24 is supported until April 2028; Node 26 until April 2029. |
| npm | Package manager | Pass 0 | Commit `package-lock.json`; CI uses `npm ci`. |
| TypeScript 6.x (6.0.3 verified) | Language (strict) | Pass 0 | TS 6 is the last JavaScript-based compiler and changes several defaults; keep the explicit `tsconfig` in §13.1. TS 7.0 (native compiler) is released; adopt it only by ADR after `npm run verify` passes with it and typescript-eslint, Vite, and Vitest support it. |
| Vite 8.x | Dev server and bundler (Rolldown) | Pass 0 | |
| Phaser 4.x (≥ 4.1) | Rendering, scenes, input plumbing | Pass 0 | Stable since April 2026. Agents MUST read the official v3 → v4 migration guide and Phaser's AI-agent `skills/` material before writing Phaser code, and MUST NOT use Phaser 3-only APIs (for example `preFX`/`postFX` pipelines or `setTintFill`); use Filters and `setTintMode`. WebGL renderer only. Phaser's physics engines are not used. |
| Preact (current stable) | DOM UI layer | Pass 2 | Small, React-like API every agent knows. `@preact/signals` for UI state is optional. |
| Zod 4 | Runtime validation of saves, manifests, levels, cutscenes, settings | Pass 1 | Use `zod/mini` in the runtime bundle; generate JSON Schemas for editor validation of content files. Network packets are validated by hand in the codec (hot path). |
| peerjs 1.x + `peer` (PeerServer) | WebRTC transport and signaling | Pass 4 | Self-host PeerServer for release (§16.8). Check maintenance status at Pass 4. |
| Capacitor 8.x (≥ 8.5): core, cli, android (`ios` only if the owner opts into native iOS) | Native packaging | Pass 7 | Capacitor 8 uses Swift Package Manager by default on iOS and adds a SystemBars API for Android edge-to-edge. Check whether Capacitor 9 is stable at Pass 7 (ADR). |
| `@capacitor/app`, `haptics`, `screen-orientation`, `filesystem`, `preferences`, `share`, `splash-screen` | Lifecycle, deep links, back button, haptics, orientation lock, saves, settings, share sheet, splash | Pass 7 (web fallbacks earlier) | Each wrapped in an adapter under `src/native/` |
| `vite-plugin-pwa` | Service worker and offline web | Pass 7 | Confirm Vite 8 compatibility at install |
| Vitest 5.x (5.1.1 verified) | Unit, simulation, and golden-replay tests | Pass 0 | |
| `@playwright/test` | End-to-end, multi-client network tests, screenshots | Pass 0 | |
| `@axe-core/playwright` | Accessibility checks of DOM UI | Pass 2 | |
| `fast-check` | Property-based tests (codec, collision) | Pass 1 | |
| ESLint (flat config) + typescript-eslint, Prettier | Lint and format | Pass 0 | |
| `dependency-cruiser` | Enforce import layers, forbid cycles | Pass 0 | |
| `sharp`, a MaxRects packer | Asset pipeline | Pass 2 | Dev dependencies only |
| ffmpeg (system binary or `ffmpeg-static`) | Audio pipeline | Pass 2 | |
| `javascript-obfuscator` (or equivalent) | Release hardening of non-hot-path modules | Pass 7 | §17.4 |

**Deliberately not used:** React (Preact is enough), global state libraries, Phaser Arcade/Matter physics (the simulation is custom and deterministic), Howler (own Web Audio engine), Firebase/Supabase/any backend in 1.0, Lodash, date libraries.

**Dependency policy:** every new package needs one line in `docs/DECISIONS.md` (why, alternatives, size). Renovate or Dependabot opens grouped weekly update PRs. CI runs `npm audit --omit=dev` (fail on high or critical) and a license check (allow MIT, ISC, BSD, Apache-2.0, OFL for fonts; flag anything copyleft).

## 12. Repository Layout & Architecture

### 12.1 Repository tree

```text
cosmic-drift/
  AGENTS.md  CLAUDE.md  README.md  .nvmrc  package.json  package-lock.json
  tsconfig.json  vite.config.ts  vitest.config.ts  playwright.config.ts
  eslint.config.js  .dependency-cruiser.cjs  .gitattributes (LFS)  .gitignore
  capacitor.config.ts                     # Pass 7
  docs/  MASTER_SPEC.md PROGRESS.md HANDOFF.md DECISIONS.md TESTING.md RELEASE.md PRIVACY.md CREDITS.md
  content/
    levels/<planet>/*.json  arenas/*.json  cutscenes/*.json  dialogue/*.json
    rigs/*.json  locale/<lang>.json  schemas/*.json (generated)
  assets_src/ ...                         # §9.7, Git LFS
  public/
    assets/ASSET_MANIFEST.json  assets/**  (generated by the pipelines)
    fonts/  icons/
  src/
    main.ts                               # composition root
    app/        createGame.ts  LifecycleController.ts  Capabilities.ts  ErrorBoundary.ts  QualityTiers.ts
    core/       GameConfig.ts  Ids.ts  FixedLoop.ts  Random.ts  DMath.ts  StateHash.ts  EntityIds.ts
                ObjectPool.ts  SpatialHash.ts  SpringTween.ts  SimulationTypes.ts  InputTypes.ts
                SimulationEvents.ts  WorldSimulation.ts  Collision.ts  Replay.ts
                player/  enemies/  bosses/  projectiles/  pickups/  hazards/  modes/
                level/   (LevelTypes, AsciiParser, Reachability shared with tools)
                economy/ progression/
    input/      TouchControls.ts  KeyboardMouseControls.ts  GamepadControls.ts  InputRouter.ts
    render/     world/  entities/  rig/ (PartRig runtime)  fx/  camera/  parallax/
    hud/        Hud.ts  TouchControlView.ts  BossBar.ts  OffscreenIndicators.ts
    ui/         tokens.css  components/  screens/  router.ts  (Preact)
    cinematics/ CutscenePlayer.ts  DialogueController.ts  Timeline.ts
    audio/      SoundEngine.ts  MusicDirector.ts  SynthFallbacks.ts
    assets/     AssetRegistry.ts  AssetTypes.ts  ProceduralTextures.ts
    persistence/ SaveStore.ts  SaveEnvelope.ts  Migrations.ts  SettingsStore.ts  storage/ (web, native)
    net/        BinaryCodec.ts  PeerManager.ts  NetworkTypes.ts  Handshake.ts  Prediction.ts  Interpolation.ts
    security/   Integrity.ts  OwnerToken.ts  BuildInfo.ts
    i18n/       Strings.ts
    native/     HapticsBridge.ts  ShareBridge.ts  LifecycleBridge.ts  FileBridge.ts
    scenes/     BootScene.ts TitleScene.ts HubScene.ts StarMapScene.ts LevelScene.ts
                LobbyScene.ts PodiumScene.ts CutsceneScene.ts
    debug/      DevMenu.ts AssetGalleryScene.ts RigViewerScene.ts (dev builds only)
    theme/      ThemePalette.ts ThemeRules.ts
  tools/        assets-build/ audio-build/ levels-lint/ tiled-import/ content-sign/ owner-keygen/
                owner-token/ save-tool/ replay-run/ perf-bench/ licenses-check/ stub-scan/
  tests/        unit/ sim/ golden/ input/ net/ e2e/ visual/ a11y/ perf/ fixtures/
  .github/workflows/ ci.yml release.yml
  android/ ios/                           # generated at Pass 7, committed
```

### 12.2 Layers and import rules (enforced by dependency-cruiser in CI)

- `core/**` imports only `core/**`. It never imports `phaser`, DOM globals (`window`, `document`, `navigator`), Capacitor, PeerJS, Web Audio, Preact, or `Math.random`. It must run in Node.
- `input/**` depends on `core/InputTypes.ts` only; `core` never imports `input`.
- `render/**`, `hud/**`, `audio/**`, `ui/**`, `cinematics/**`, `native/**` adapt core data to platforms; `core` never imports them.
- `net/**` imports core types and codecs; `core` never imports `net`.
- `scenes/**` and `main.ts` are the only composition layers that wire everything together.
- `debug/**` is imported only behind `import.meta.env.DEV` so release builds tree-shake it away; a CI check greps the release bundle for dev-only markers.
- No cycles. Shared types move down to the lowest layer that needs them. No barrel files that create cycles.
- Events between layers use typed channels created in the composition root (`EventChannel<T>`), not a global event bus.

### 12.3 Boot sequence (`main.ts`)

1. Install global error handlers (§19.1) and read the capability matrix (WebGL, WebAudio, storage, touch, native shell, `isSecureContext`, reduced motion, DPR, `MAX_TEXTURE_SIZE`).
2. Load settings (§15.3) and pick the quality tier (§18.2).
3. Initialize storage and the save store (§15).
4. Create `SoundEngine` (suspended until the first gesture).
5. Create the Phaser game (`createGame.ts`) with WebGL, `Scale.EXPAND` within the supported aspect range, Phaser audio disabled, and the DOM UI root mounted above the canvas.
6. `BootScene`: manifest validation, atlas scopes `global` + `ui` + `hub`, font readiness (`document.fonts.load` before any Phaser text), filter pre-warm, then `TitleScene`.

### 12.4 State ownership

| State | Owner | Notes |
| --- | --- | --- |
| Simulation (`WorldState`) | `core/WorldSimulation` | Plain data, deterministic, hashable |
| Profile (wallet, unlocks, progress, stats) | `persistence/SaveStore` | Immutable updates through named actions (`purchaseUpgrade`, `grantReward`), each validated and logged to the reward ledger |
| Settings | `persistence/SettingsStore` | Separate from the save, per device |
| UI state | Preact signals in `ui/` | Never holds gameplay truth |
| Network session | `net/PeerManager` | Typed connection state machine |

## 13. Core Runtime

### 13.1 TypeScript contract

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "strict": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "tools", "vite.config.ts", "capacitor.config.ts"]
}
```

TypeScript 6 changed several defaults (including `types`), so every option above is explicit. Set Vite's `build.target` to cover the oldest WebView supported by the pinned Capacitor version (check its minimum iOS version at Pass 7).

**Code rules:** no `any`, no non-null assertions (`!`), no `@ts-ignore`/`@ts-expect-error` without an ADR-linked comment; `unknown` for untrusted input, narrowed by Zod or type guards; discriminated unions for inputs, events, packets, and scene transitions; `readonly` for configuration and snapshots; units in names (`durationMs`, `velocityUps`, `worldX`, `screenX`); no Phaser objects, DOM nodes, audio nodes, timers, or plugin instances inside simulation state.

### 13.2 Fixed loop

- `FIXED_DT = 1/60` **(contract)**. `FixedLoop` accumulates real frame time and runs zero or more simulation steps per rendered frame.
- Frame delta is clamped to 100 ms (M7). At most 4 steps run per frame; leftover backlog beyond that is dropped (the game slows briefly instead of spiraling).
- After pause, backgrounding, or a WebGL context restore, the accumulator resets to zero; the game never simulates a backlog.
- `renderAlpha = accumulator / FIXED_DT` goes only to rendering.
- **Assist game speed** (70/80/90%) scales the real time fed into the accumulator, never `FIXED_DT`.
- The simulation never reads wall-clock time (`performance.now`, `Date.now`, `requestAnimationFrame` timestamps).

### 13.3 `GameConfig` (N9)

One typed `as const` object in `src/core/GameConfig.ts` holds every gameplay constant from §4 (physics, timings, hitboxes, enemy and boss stats, economy formulas, network thresholds). Tick values are derived once at module load (`msToTicks`). A **config hash** (FNV-1a over a canonical JSON serialization of the config) is generated at build time; it goes into replays, the multiplayer handshake, and the debug overlay. Changing a constant changes the hash, which invalidates golden replays deliberately until they are re-recorded and reviewed.

### 13.4 Simulation step

```ts
export interface InputFrame {            // (contract) one per player per tick
  readonly moveX: number;                // −1..1 after deadzone/curve
  readonly moveY: number;                // −1..1, +1 = down (screen space)
  readonly held: number;                 // bitmask: 0 jump, 1 dash, 2 shoot, 3 parry, 4 gadget, 5 interact
  readonly aimMrad: number;              // aim angle in milliradians, Int16 range
}

export interface SimulationStepResult {
  readonly events: readonly SimulationEvent[];
}

export interface Simulation {
  step(state: WorldState, inputs: readonly InputFrame[], tick: number): SimulationStepResult;
}
```

- The simulation derives **pressed/released edges itself** by comparing each player's `held` bits with the previous tick's (stored in `WorldState`). Local and remote inputs therefore behave identically.
- **Per-tick order** (stable iteration by ascending entity ID):
  1. Apply input intents and tick timers.
  2. Move kinematic entities (moving platforms, crumble blocks, doors) and carry their riders.
  3. Players: integrate and resolve X, then integrate and resolve Y (N1).
  4. Enemies and bosses: AI decisions, then movement with the same resolver.
  5. Projectiles: swept movement and hits (N3).
  6. Hazards, pickups, triggers, zones.
  7. Mode rules and progression events.
  8. Despawn to pools; emit events.
- **Randomness:** a seeded PRNG (`sfc32` or `xoshiro128**`, implemented in `core/Random.ts`) owned by `WorldState`. Rendering, audio pitch variation, and particles use a separate render-side generator.
- **Deterministic math:** `core/DMath.ts` provides table-based `sin`/`cos` (4096 entries) and a polynomial `atan2` for the simulation; engine `Math.sin`/`Math.cos`/`Math.pow` are not used in simulation code (they can differ between JavaScript engines). `Math.sqrt`, `abs`, `min`, `max`, `floor`, `round`, `trunc` are allowed.
- **Determinism scope:** identical results are required within one JavaScript engine (replays, tests, golden runs). Multiplayer does **not** depend on cross-engine determinism; it is host-authoritative (§16).
- **State hash:** FNV-1a over a canonical serialization of `WorldState` (fixed field order; numbers written as Float64 bytes), computed every 60 ticks in dev builds and at the end of every test run.
- **Entity IDs** carry a generation counter (N4); stale references are discarded.

### 13.5 Collision

- **World:** a tile grid of flags (`solid`, `oneWay`, `hazard`, `ice`, `crumble`, `cracked`) plus kinematic AABBs (moving platforms, doors). No slopes in 1.0 (deliberate: it removes a large class of bugs).
- **Axis-separated resolution (N1):** move along X; if the collider overlaps solids, push it out to the nearest tile edge opposite the motion and zero `vx`; then do the same for Y. Corner correction and ledge forgiveness apply here (§4.1).
- **One-way platforms (N2):** collide only on the gravity-ward axis, only when the feet were at or above the platform top on the previous tick and are below it now (a crossing test, which cannot tunnel at any speed), with a 6 u landing snap tolerance, and never during the 150 ms drop-through grace.
- **Speed limits:** terminal fall (25 u/tick), slam (26.7 u/tick), and dash (18.3 u/tick) all stay well under the 64 u tile size, so axis resolution cannot skip a tile. Any future movement faster than 32 u/tick MUST sub-step.
- **Projectiles (N3):** every projectile is a swept segment each tick (grid traversal against tiles, slab test against hurtboxes), superseding the v2 "≤ 18 px/step clamp".
- **Entity queries:** `SpatialHash` broadphase with a configurable cell size (default 128 u; benchmark it, §18.7).
- **Moving platforms:** before a platform moves, find riders standing on it (within 2 u); after it moves, apply the same delta to them and resolve. If a body cannot be resolved because it is squeezed between solids, players take a hazard respawn and enemies die. Nothing ever ends up stuck inside geometry.
- **Gravity sign:** every "down" check uses the entity's gravity sign, so polarity-flip zones reuse the same code.
- **Hitboxes vs hurtboxes:** attacks use hitboxes; damage checks use hurtboxes (smaller than sprites, M5); pickups use enlarged radii.

### 13.6 Camera and resolution

- The camera always shows **1080 world units of height**. `camera.zoom = renderHeight / 1080`.
- Phaser's Scale Manager uses `EXPAND` within the supported 4:3–21:9 range; outside it, the canvas is pillarboxed or letterboxed with decorative bars. Competitive modes cap the visible width at 19.5:9 (§6.5).
- **Render scale** = quality tier × the Render Scale setting: internal height 1080 (High), 900 (Balanced), 720 (Battery), always multiplied by the setting (70–100%).
- **Follow:** look-ahead 160 u in the movement/facing direction with a `gentle` spring; vertical deadzone 120 u; while grounded the camera tracks ground height (no bobbing during jumps); when the player falls more than 300 u below center, the camera catches up faster.
- **Zones:** level `camera_bounds` and `camera_lock` zones constrain the camera; boss arenas lock it.
- **Shake:** a trauma model, `offset = trauma² × 18 u`, rotation `trauma² × 1.5°`, trauma decays 1.6/s; scaled by the Camera Shake setting; capped at 25% under reduced motion.
- Enemy activation and attacks use world-space distances (§4.4), never the viewport, so screen size can never change the simulation.

### 13.7 Rendering pipeline

Per rendered frame:

1. Interpolate each entity between the previous and current simulation snapshot using `renderAlpha`.
2. Update pooled display objects keyed by entity ID + generation (no create/destroy during gameplay).
3. Update parallax layers, slab side faces, contact shadows.
4. Advance PartRig clips by real frame time; apply procedural layers.
5. Consume this tick's simulation events exactly once and spawn effects (§13.8).
6. Update the HUD (text objects change only when their value changes).
7. Apply filters per tier.

Atlases are grouped by scope to keep texture switches low. Hit-stop is **render-only**: the involved sprites freeze and the camera kicks for 45 ms while the simulation continues (multiplayer-safe and replay-safe).

### 13.8 Effects and game feel

Every effect is triggered by a simulation event and never feeds back into the simulation (O7).

| Event | Effects |
| --- | --- |
| `ShotFired` | Muzzle flash, recoil kick, weapon sound |
| `Hit` | Impact sparks, 60 ms white hit-flash on the target, damage number, sound |
| `ParrySuccess` | 45 ms hit-stop, radial burst, shockwave ring, medium haptic, parry sound |
| `Landed` (height > 2 tiles) | Dust puff, landing squash, sound, light haptic |
| `DashStarted` | Three afterimages, whoosh, medium haptic |
| `ShardCollected` | Sparkle, rising-pitch chain sound, counter bump |
| `EnemyDefeated` | Dissolve into shard light, drop burst |
| `CheckpointReached` | Light beam, chime, "Saved" ring |
| `BossPhaseChanged` | Flash (respects Screen Flashes), shake, roar, music section change, heavy haptic |

Particle caps: Battery 300, Balanced 600, High 1200 live particles; each effect has a per-instance budget in its definition.

### 13.9 Cutscene, dialogue, and UI runtime

- `CutscenePlayer` runs timelines on render time (§7.2) while the simulation is paused or input-locked; event tracks apply flags and rewards through `SaveStore` actions, so skipping is equivalent to watching.
- The Preact UI root sits above the canvas. While a DOM panel is open, gameplay input is disabled and touches do not reach the canvas.
- **Android back button:** closes the top panel, then opens Pause, then asks to quit to the hub. It never exits the app from gameplay.

### 13.10 Lifecycle

On `visibilitychange` (hidden), Capacitor `appStateChange` (inactive), `pagehide`, or a focus loss: pause the simulation, clear all input (M6), flush the save queue, and suspend audio. On return: reset the accumulator, resume audio after a gesture if required, and show the pause menu in single-player (multiplayer continues).

On `webglcontextlost`: stop rendering, show "Restoring graphics…", and on `webglcontextrestored` rebuild textures from loaded files and the procedural baker, then resume (N13).

---

## 14. Input

### 14.1 Data model

```ts
export type TouchControlRole = "move" | "jump" | "dash" | "parry" | "gadget" | "shoot";

export interface ActiveTouch {
  readonly identifier: number;
  role: TouchControlRole;
  startX: number; startY: number;
  currentX: number; currentY: number;
  readonly startedAtMs: number;
}

export interface StickState {
  x: number;          // −1..1 after deadzone and response curve
  y: number;          // −1..1, +1 = down
  magnitude: number;  // 0..1
  active: boolean;
}
```

`InputRouter` merges the touch, keyboard/mouse, and gamepad adapters into one `InputFrame` per tick (§13.4). It **latches** buttons: if a button went down at any moment since the last tick, its `held` bit is set for that tick even if it was released before the tick ran, so a very fast tap is never lost.

### 14.2 Finger ownership

- Keep a `Map<number, ActiveTouch>` keyed by `Touch.identifier`, plus a role → identifier ownership map. A finger owns at most one role; a role has at most one owner.
- On `touchstart`, assign each changed touch to the control region where it began. A finger that starts on the stick stays the stick finger even if it slides over a button; a finger that starts on a button never steals the stick.
- On `touchmove`, update only the matching identifier. Never re-assign ownership because another finger moved or `TouchList` order changed.
- On `touchend` and `touchcancel`, release only the identifiers in `changedTouches`; other held actions continue.
- Release every role on `pointercancel`, `blur`, orientation change, backgrounding, scene teardown, or when a DOM panel opens (M6).
- Listen with `{ passive: false }` on the game canvas only, and call `preventDefault()` there; menus and text fields keep normal scrolling and typing.
- Do not mix Pointer Events and Touch Events for the same contact.
- Recompute control bounds from the current canvas rectangle and safe area on every resize; never cache startup coordinates.

### 14.3 Thumbstick math

- Radial deadzone (not per-axis): inner deadzone 0.14 of the radius, outer saturation 0.88 (both adjustable in Settings).
- `r = min(1, hypot(dx, dy) / radius)`. If `r ≤ inner`, output (0, 0). Otherwise normalize the direction and remap: `m = clamp((r − inner) / (outer − inner), 0, 1)`, then apply the response exponent (default 1.6): `mOut = m^exponent`.
- Clamp the final vector magnitude to 1 so diagonals are never faster. Keyboard and gamepad produce the same normalized range.
- Hysteresis prevents drift: once the stick returns inside the deadzone, the output is exactly zero; release resets to zero.
- `moveY ≥ 0.6` counts as **Down** for drop-through and slam.

### 14.4 Keyboard, mouse, and gamepad

- Keyboard mappings per §8.9; OS key repeat is ignored (only physical down/up changes state); every binding can be remapped and conflicts are flagged in Settings.
- Mouse: left button shoots toward the cursor (aim angle from player to cursor in world space); right button parries.
- Gamepad (Pass 6): standard mapping via the Gamepad API; right stick aims; dead zones per §14.3; hot-plug supported; the last-used device decides on-screen glyphs.

### 14.5 Required input tests

Two-finger move + jump; three-finger move + jump + shoot; release jump while moving continues; touch cancel; finger crossing regions; resize and orientation change mid-touch; two fingers on the same button (first owner wins); no-drift deadzone; diagonal normalization; sub-tick tap latching; blur and visibility clearing; DOM panel opening during a held touch; keyboard and touch active at the same time.

---

## 15. Persistence, Autosave & Data Protection

### 15.1 Storage backends

| Platform | Saves | Settings |
| --- | --- | --- |
| Web | IndexedDB | IndexedDB (localStorage fallback) |
| Native (Capacitor) | `@capacitor/filesystem` in the app's data directory (not WebView localStorage, which the OS may evict) | `@capacitor/preferences` |

All access goes through an async `KeyValueStore` interface with web and native implementations.

### 15.2 Save envelope (contract)

```json
{ "f": "cdsv", "v": 1, "slot": 0, "n": 42, "salt": "<base64 16B>", "iv": "<base64 12B>", "ct": "<base64 ciphertext+tag>" }
```

- `ct` is the AES-GCM-256 encryption of the JSON `PlayerProfile` (Appendix A) using WebCrypto.
- Key = HKDF-SHA-256(app secret embedded in the build, per-save random `salt`). A fresh random `iv` for every write.
- Additional authenticated data = `"cdsv|" + v + "|" + slot + "|" + n`, so a save cannot be moved to another slot or have its header edited without detection.
- The GCM authentication tag detects both corruption and tampering, superseding the v2 FNV-1a save checksum.
- Because the salt travels with the save, an exported backup decrypts on any install of the same game (portable), while edits still fail authentication.
- **Honest limit:** the key derivation lives in the app, so this stops casual editing, not reverse engineering (§17).
- Refuse to run crypto-dependent features if `window.isSecureContext` is false and report it in development.

### 15.3 Settings

Plain JSON, versioned, validated with Zod, stored per device, not encrypted (nothing to protect, easier support). Invalid or missing fields fall back to defaults individually; one bad value never resets everything.

### 15.4 Autosave

| Trigger | Notes |
| --- | --- |
| Checkpoint reached | Includes banked shards and the resume point |
| Mission complete | Rewards granted through the ledger first |
| Echo or Vault collected | Immediately |
| Purchase, equip, respec, contract claim | Immediately |
| Cutscene finished or skipped | Flags and rewards from event tracks |
| App backgrounded, quit to hub | Flush the queue |
| Hub idle | Every 60 s if anything changed |

Writes are debounced (500 ms), serialized through one queue (never two writes at once), and run off the render hot path. A small ring icon with "Saving…" shows for at least 600 ms. **Resume:** the profile stores `resume = { missionId, checkpointId, bankedShards, collectedIds, timestampMs }`; the title screen offers "Continue: Glasswood — Checkpoint 3".

### 15.5 Atomic writes and recovery (O8)

- Two physical copies per slot (A/B). Write to the copy that does not hold the latest valid save, read it back, decrypt and validate it, and only then switch the pointer. Native writes go to a temporary file and are renamed into place.
- Keep the previous valid copy as last-known-good.
- On load failure: try the other copy; if both fail, move the blobs to a quarantine key (kept for the owner's diagnosis) and start fresh with a clear, non-destructive notice.
- A save from a **newer** schema version is never overwritten: show "This save is from a newer version of the game" and stop.

### 15.6 Migrations

`persistence/Migrations.ts` holds ordered pure functions (`v1 → v2 → …`). Every version has fixture saves and tests. Fields are never removed without a migration. Unknown fields are preserved.

### 15.7 Backups

Export writes the envelope as a `.cdsave` file via the share sheet (native) or a download (web). Import decrypts, validates with Zod, applies range and sanity checks (wallet ≤ cap, levels within bounds, unlock combinations consistent), shows a summary, and asks before overwriting a slot.

### 15.8 Replays and local metrics

IndexedDB stores replays (dev and playtest builds) and local playtest metrics, capped at 20 MB with least-recently-used eviction.

---

## 16. Networking

### 16.1 Topology

Host-authoritative star: the host runs the authoritative simulation; clients send inputs only, predict their own player, and interpolate everyone else. 2–4 players in 1.0; the protocol reserves 8 slots.

### 16.2 Channels

| Channel | Settings | Carries |
| --- | --- | --- |
| Realtime | Unordered, no retransmits | `input:frames`, `world:snap`, `ping`/`pong` |
| Reliable | Ordered, reliable | Handshake, lobby state, match events (spawns, hits, pickups, scores, `match:end`) |

**PeerJS caveat:** verify how the pinned PeerJS version maps its connection options to `RTCDataChannelInit` and whether it can send raw `ArrayBuffer`s without extra serialization. If it cannot create an unordered, zero-retransmit binary channel, use PeerJS only for signaling and create the data channels directly on the underlying `RTCPeerConnection`.

### 16.3 Handshake

1. Client → host (reliable): `hello { protocolVersion, buildId, contentHash, configHash, callsign, platform, cosmetics }`.
2. Host checks versions and hashes. On mismatch it replies `reject { reason: "version" }` and the client shows "Your game version doesn't match the host's. Update and try again."
3. Host replies `welcome { slot, mode, arenaId, rules, peers[] }` and broadcasts the roster.
4. Match start: `match:start { seed, startTick, arenaId, mode, rules, players[] }`.

The host binds each connection to its assigned slot and **ignores the slot byte in client packets**: a client can only ever control its own player.

### 16.4 Binary packets (little-endian, contract)

**`0x11` `input:frames` (client → host, 30 Hz):** replaces the v2 11-byte `0x01` packet (N6).

| Offset | Type | Field |
| --- | --- | --- |
| 0 | u8 | type = `0x11` |
| 1 | u8 | slot (informational; host uses the connection's slot) |
| 2–3 | u16 | `newestTick` (target host tick of frame 0) |
| 4–5 | u16 | `ackWorldTick` |
| 6 | u8 | `frameCount` N (1–8, normally 4: two new + two redundant) |
| 7 … 7+5N−1 | N × 5 B | Frames, newest first: `i8 moveX_q` (×127), `i8 moveY_q` (×127), `u8 held`, `i16 aimMrad` |
| 7+5N | u8 | CRC-8 (polynomial 0x07, init 0x00) over all previous bytes |

Size = 8 + 5N bytes (28 B for N = 4).

**`0x02` `world:snap` (host → client, 20 Hz):** the v2 layout with one change: positions are **unsigned**, `Uint16(round(x × 2))`, because world coordinates are non-negative; this doubles the usable range to 32,767 u (LevelLint enforces it, §5.6).

- Header (12 B): `u8 type`, `u8 modeStateFlags` (bits 0–1 matchPhase, bit 2 suddenDeath, bit 3 bossActive), `u16 worldTick`, `u16 matchTimerDeciseconds`, `u8 playerCount`, `u8 enemyCount`, `u16 beaconOrBossMetric`, `u16 eventBitmask`.
- Player stride (16 B): `u8 slot`, `u8 stateFlags` (alive, inCryoPod, dashing, parrying, facingLeft, grounded, jetpacking), `u16 lastProcessedTick`, `u16 x×2`, `u16 y×2`, `i16 vx`, `i16 vy`, `u8 hp`, `u8 shield`, `u16 modeScoreOrShards`.
- Enemy stride (10 B): `u16 enemyNetId`, `u8 archetypeAndState` (bits 0–2 archetype, 3–6 AI state, 7 alive), `u16 x×2`, `u16 y×2`, `i16 vx`, `u8 hpPercent`.
- **Interest management** replaces v2 delta compression for 1.0: each client gets the enemies within 1600 u of its player, nearest first, up to 48 per snapshot, rotating the rest. Add delta compression only if measurements demand it.
- Snapshots stay at or below **1,200 bytes** so they never fragment (a lost fragment drops the whole unreliable message).

**`0x03` / `0x04` `ping` / `pong` (17 B):** unchanged from v2: `u8 type`, `f64 t0`, `f64 t1`.

**Reliable events** use compact binary messages with a type byte (`proj:spawn`, `hit`, `pickup`, `score`, `revive`, `match:end`); lobby and handshake messages may be JSON.

**Validation (N11):** exact length checks, enum ranges, finite numbers, CRC, sequence checks with modular `Uint16` comparison (N5), and a 60 packets/s rate limit per client. Invalid packets are counted and dropped, never thrown on.

### 16.5 Timing and input flow

- The host simulates at 60 Hz and sends snapshots at 20 Hz.
- Clients run **ahead** of the host by about half the RTT plus 2 ticks, stamping each input frame with the host tick it is meant for. Clock sync from ping/pong (every 2 s; RTT and offset with smoothing) adjusts the client's step rate by up to ±2% to hold that lead.
- The host keeps a small per-client input buffer (target 2 ticks). If a frame is missing when its tick runs, the host repeats the last known held state and counts a "late input".

### 16.6 Prediction and reconciliation

- A 64-tick ring buffer stores each local input frame and the predicted player state.
- When a snapshot arrives, compare the authoritative state at `lastProcessedTick` with the prediction. If they differ by more than 2 u, rewind to the authoritative state and re-simulate the unacknowledged inputs.
- **Visual smoothing (M2):** the correction becomes a visual offset that decays with a ~100 ms half-life; only errors above 160 u (`SNAP_THRESHOLD`) teleport.
- The local player's shots are predicted immediately (cosmetic) and matched to the host's `proj:spawn` by a client-generated ID.

### 16.7 Interpolation

Remote players and enemies render at `now − interpDelay`, where `interpDelay = 1.5 × snapshotInterval + 2 × jitter`, clamped to 75–150 ms at 20 Hz (v2's 45 ms floor is too short for 20 Hz snapshots). When starved, extrapolate up to 100 ms, then hold. Projectiles spawned by events are fast-forwarded by `(currentTick − spawnTick)` so they line up.

### 16.8 Signaling, NAT traversal, and TURN

- **PeerServer:** self-host the `peer` signaling server over HTTPS/WSS for release; the public PeerJS cloud server is fine only for development. Host peer ID: `cosmicdrift-<ROOMCODE>`; clients use random IDs.
- **STUN** for direct paths; **TURN** is required for a real share of mobile and carrier-NAT connections. Use a TURN provider or self-hosted coturn, and fetch **short-lived** TURN credentials from a tiny HTTPS endpoint. Never ship long-lived TURN secrets in the client (acceptable only for private testing, with a documented risk).
- **Privacy option:** Settings → Data → "Network privacy: Direct / Relay only". Relay only sets `iceTransportPolicy: "relay"` so peers never see each other's IP addresses (may add latency).
- The debug overlay shows the selected candidate pair (direct or relay) from `getStats()`.

### 16.9 Disconnects and failures (N8)

- No packets for 3.0 s → the player shows "reconnecting" and their character is held in stasis; if they return within the 3.0 s grace window, they resume; otherwise they are removed deterministically (entities and timers cleaned up, uncollected shards dropped).
- Host loss → every client returns to a summary or lobby screen with a clear message. Host migration is deferred.
- No mid-match joining in 1.0.
- ICE or signaling failure shows a plain message with next steps ("Couldn't connect. Try Relay-only mode or a different network.").

### 16.10 Bandwidth budget

| Direction | Estimate |
| --- | --- |
| Client upload | 28 B × 30 Hz ≈ 0.8 KB/s payload (about 2.5 KB/s with transport overhead) |
| Host upload per client | ≤ 1,200 B × 20 Hz = 24 KB/s; 3 clients ≈ 75 KB/s (about 0.6 Mbit/s) |

---

## 17. Security & Anti-Tamper

### 17.1 The honest baseline

Everything the game needs to run is on the player's device, so **no technique can make client code or data impossible to read or change**. Encryption with a key inside the app is obfuscation, not secrecy. "Uncrackable" and "unhackable" are not achievable claims for any client-side game. The only way to make values truly unchangeable by players is to keep authority on a server the owner controls (§21.7).

What this project can do: make tampering **hard, detectable, and pointless** for friends-only play, and give the owner capabilities nobody else can forge.

### 17.2 Threat model

| Attacker | Example | Defenses | Result |
| --- | --- | --- | --- |
| Casual | Edits a save file or browser storage; opens devtools on the web build | AES-GCM authenticated saves (§15.2); devtools disabled in native release builds; no plaintext values in storage | Blocked: edited saves fail authentication and the last good copy loads |
| Save sharer | Copies a save to a friend | Backups are portable but tamper-evident; imports are validated | Allowed, but not editable |
| Memory editor | Cheat tools that scan RAM on rooted phones or desktops | Optional (Pass 7): wallet values kept masked in memory and verified on every read | Naive scans defeated; determined users can still bypass |
| Intermediate | Unpacks the APK and reads the JavaScript | Minified and selectively obfuscated release bundle, no shipped source maps, no secrets in the client | Can read logic; changing it requires rebuilding and re-signing the app |
| Modder | Patches the JavaScript and re-signs the APK | A re-signed app cannot install over the original (the original must be uninstalled, which deletes its data); the multiplayer handshake compares build and content hashes | Casual cheating in friend rooms blocked; a determined modder can spoof hashes |
| Network cheater | Forges packets | Clients send inputs only; the host ignores client slot claims, positions, and damage; rate and range validation | Mostly blocked (the host is trusted) |
| Malicious host | Runs a modified host | None in 1.0 | Accepted for friends-only rooms; public play needs servers |

### 17.3 Owner-only capabilities

1. **Owner signing key:** `npm run owner:keygen` creates an ECDSA P-256 key pair, writes the private key to `~/.cosmicdrift/owner_private.pem` (outside the repository), and prints the public key for `src/security/ownerPublicKey.ts`. The private key is never committed (gitignore patterns plus secret scanning in CI); back it up offline.
2. **Signed content packs:** any content loaded from outside the app bundle (balance hotfixes, event packs, downloadable levels) must be signed with `npm run content:sign` and is verified with WebCrypto `crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, …)` against the embedded public key. Unsigned or invalid packs are rejected. **Node signing MUST use `dsaEncoding: "ieee-p1363"`**, because WebCrypto ECDSA signatures are raw `r‖s`, not DER; a round-trip test guards this.
3. **Owner unlock token:** `tools/owner-token` signs `{ installId, scopes: ["devmenu", "cheats", "content_override"], expiresAt }`. Entering it in Settings → About (tap the version seven times to reveal the field) enables those tools on that one install. Friends cannot forge a token without the private key; they could only patch the app.
4. **Owner save tool:** `tools/save-tool` decrypts, edits, and re-encrypts saves using the build's app secret. It runs only from the private repository.

### 17.4 Release hardening (Pass 7)

- Release builds are minified, ship no source maps (keep them privately for crash analysis), strip `debug/**` and dev logging, and are checked in CI for leaked dev-only markers.
- Obfuscate only the `security`, `persistence`, and `economy` chunks with settings that keep performance acceptable (no control-flow flattening near hot paths); never obfuscate the simulation loop. Measure frame time before and after.
- Split the app secret across modules and assemble it at runtime; rotate it with each major version (with a save migration).
- Disable WebView debugging in release builds (verify Capacitor's per-platform defaults and set them explicitly).
- Keep Android Auto Backup enabled for the save directory so players don't lose progress when changing phones (saves are encrypted and portable).
- No `eval`, no `new Function`, no remote code. The web build ships a strict Content-Security-Policy (start from `default-src 'self'; connect-src 'self' wss://<signaling-host> https://<turn-credential-host>; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'` and add only what testing proves necessary).
- At boot, verify the bundled content hash against the build manifest (catches corrupted or partially modified installs).
- Platform attestation (Play Integrity, App Attest) needs a server to verify and is deferred to Pass 8.

### 17.5 Secrets and privacy

- `.env*`, keystores, certificates, and owner keys are gitignored; CI secrets live in GitHub Actions secrets; secret scanning (e.g., gitleaks) runs in CI.
- The game collects no personal data and has no accounts in 1.0. Callsigns are shared only with room peers. Diagnostics are opt-in and anonymous.
- Peer-to-peer play exposes IP addresses to the other players; the privacy policy says so and offers Relay-only mode.
- Stores require a privacy policy even when nothing is collected; ship `docs/PRIVACY.md` and host it.

---

## 18. Performance Budgets & Quality Tiers

### 18.1 Device tiers

| Tier | Typical hardware |
| --- | --- |
| Low | Mid-range Android phones from about 2020 with 3–4 GB RAM |
| Mid | Mid-range Android from 2022 on; iPhone 11–12 class; older iPads |
| High | Recent flagships, iPhone 13 class and newer, desktops |

### 18.2 Tier selection

At first boot, pick a tier from heuristics (device memory, CPU cores, GPU renderer string, `MAX_TEXTURE_SIZE`) and a 2-second stress render behind the title fade. At runtime (O6), drop a tier when p95 frame time stays above 20 ms for 3 s; raise one when p95 stays below 12 ms for 10 s and 30 s have passed since the last change. A manual preset disables automatic changes. Tier changes apply at scene boundaries and are logged in the debug overlay.

### 18.3 Frame budget at 60 fps (16.7 ms)

| Item | Budget (p95, Mid tier) |
| --- | --- |
| Simulation | ≤ 2.0 ms with 4 players, 60 active enemies, 200 projectiles, 300 pickups |
| Render CPU | ≤ 7 ms |
| Long tasks during gameplay | None over 4 ms (watched with the Long Tasks API in dev) |
| Draw calls | ≤ 150 per frame on mobile |

### 18.4 Memory

| Item | Low | Mid | High |
| --- | --- | --- | --- |
| GPU textures | ≤ 160 MB | ≤ 256 MB | ≤ 384 MB |
| Decoded audio | ≤ 24 MB | ≤ 48 MB | ≤ 48 MB |
| JS heap (steady state) | ≤ 120 MB | ≤ 150 MB | ≤ 200 MB |

No growth after 50 match restarts (M8, O5).

### 18.5 Load and size

Cold start to title ≤ 4 s (Mid); planet load ≤ 3 s; menu transitions ≤ 1 s; initial JavaScript ≤ 900 KB gzipped (Phaser included); install size ≤ 150 MB.

### 18.6 Battery and heat

Record a 30-minute session on a Mid device (battery drop, throttling). The Battery preset caps rendering at 30 fps, disables filters, uses 3 parallax layers, and sets render scale to 75%.

### 18.7 Profiling

In-game performance overlay (FPS, p95, simulation ms, render ms, draw calls, texture MB, entity and pool counts, network RTT and loss); `npm run perf:bench` (headless simulation benchmark in Node with budget assertions, compared against a committed baseline with 10% tolerance); on-device traces with Chrome DevTools or Safari Web Inspector on dev builds.

---

## 19. Error Handling, Logging & Telemetry

### 19.1 Handling

- Global `error` and `unhandledrejection` handlers feed a bounded ring buffer (200 entries) of structured logs `{ t, level, area, msg, data }`.
- An error boundary wraps the Preact root; scene updates are wrapped so an exception turns into a recoverable state (exit to the hub with a message) rather than a frozen screen.
- Never swallow errors silently. Release builds keep `warn` and `error` logs only.

### 19.2 Recovery and Safe Mode

A "boot in progress" flag is set at startup and cleared once the title screen appears. After two consecutive failed boots, the game starts in **Safe Mode** (Low tier, filters off, audio off, minimal particles) and shows the recovery screen: Retry, Restart, Reset Settings, Copy diagnostics. Diagnostics contain the build ID, capability matrix, settings, and the last 50 log lines, never save contents.

### 19.3 Telemetry

Off by default. **Playtest mode** (owner token or dev build) records local metrics (level times, deaths per checkpoint, shard income and spending, settings used) and exports them as JSON for tuning. Remote telemetry is a Pass 8 feature that requires consent and an updated privacy policy.

---

## 20. Testing & Quality Gates

### 20.1 Scripts

| Script | Purpose |
| --- | --- |
| `dev`, `build`, `preview` | Vite |
| `typecheck` | `tsc --noEmit` |
| `lint`, `format:check` | ESLint, Prettier |
| `deps:check` | dependency-cruiser layer and cycle rules |
| `stub:scan` | Fails on `TODO`, `FIXME`, `XXX`, or `notImplemented` in `src/` unless listed in `tools/stub-scan/allowlist.json` with the milestone that resolves it |
| `test` | Vitest unit, property, and simulation tests |
| `test:golden` | Golden replays and level ghost runs |
| `test:e2e`, `test:visual`, `test:a11y` | Playwright (Chromium and WebKit) |
| `levels:lint` | LevelLint (§5.6) |
| `assets:build`, `audio:build`, `licenses:check` | Pipelines and provenance |
| `perf:bench` | Simulation benchmark against the baseline |
| **`verify`** | The full local gate: `format:check → lint → typecheck → deps:check → stub:scan → test → test:golden → levels:lint → build` |

### 20.2 Unit and property tests

Math and `DMath`; collision invariants with fast-check (no tunneling, no overlap after resolution, one-way crossing); input (§14.5); economy (formulas match §4.8, atomic purchases, idempotent reward ledger, never negative); save envelope (round trip, tamper and wrong-slot detection, truncated and garbled fuzzing, migrations with fixtures, newer-version refusal); codec (round-trip properties, fuzzed garbage rejected without throwing, CRC); cutscene skip equivalence; localization key coverage (every key used exists in `en.json`); CVD palette ΔE test; ECDSA sign-in-Node / verify-in-WebCrypto round trip.

### 20.3 Simulation and golden replays

A headless runner (`tools/replay-run`) takes a seed, initial state, and input script and prints the final state hash. Tests cover: same seed + inputs → same hash; different seeds change random outcomes; rendering on vs off gives the same hash; pause/resume never teleports; every level's ghost run reaches the exit; scripted boss fights reach each phase; `perf:bench` stays within budget.

### 20.4 End-to-end, visual, accessibility

- Boot → title → new game → first checkpoint of `kepler_01` with scripted touches (multi-touch via dispatched `TouchEvent`s).
- Settings persistence; save and continue; backup export and import.
- **Two-client multiplayer in CI:** two browser contexts and a local PeerServer → host, join, lobby, ready, match, movement visible on both, end, podium.
- axe checks on every DOM screen; screenshot tests with a fixed seed and animations disabled (`?test=1`), including the pseudo-locale.

### 20.5 Manual and device tests

Per-milestone checklists (§23), plus: input-to-display latency filmed with a 240 fps phone camera; touch tests on real devices; iOS silent switch; lifecycle interruptions (calls, lock screen, app switching); network conditions (Wi-Fi, 4G/5G, hotspot, induced packet loss).

### 20.6 Definition of Done (every milestone)

`npm run verify` passes; acceptance items are ✅ with evidence; no open P0/P1; `docs/PROGRESS.md`, `docs/HANDOFF.md`, and `docs/DECISIONS.md` are updated; new behavior has tests; `perf:bench` is within budget; `stub:scan` is clean.

### 20.7 CI (GitHub Actions)

On every pull request and push to `main`: set up Node from `.nvmrc` → `npm ci` → `npm run verify` → `test:e2e` (Chromium and WebKit) → upload the build, reports, and screenshot diffs. Branch protection requires CI to pass before merging. A tag-triggered `release.yml` builds the web bundle and uploads the signed Android `.apk` (and an `.aab` only when publishing to Google Play) using the keystore from secrets, so the Android SDK is only needed in CI or on the owner's PC; native iOS builds run on a macOS runner with Xcode 26 only when the owner opts in.

---

## 21. Build, CI/CD & Release

### 21.1 Environments

`dev` (Vite dev server, Dev Menu, Asset Gallery), `test` (`?test=1`: fixed seeds, animations off, deterministic timing), `staging` (release build with the performance overlay available), `production`.

### 21.2 Build identity

`buildId = <semver>+<git short sha>`. `BuildInfo.ts` is generated at build time with the build ID, content hash, and config hash; all three appear in Settings → About and in diagnostics.

### 21.3 Versioning

Semantic versioning. Android `versionCode = major × 10000 + minor × 100 + patch`; the iOS build number (optional native iOS only) increments with every upload.

### 21.4 PWA (Pass 7)

`vite-plugin-pwa` with `generateSW`: precache the app shell and global assets; cache planet scopes at runtime with versioned cache names. Updates show "Update available — restart to apply" and never apply mid-match.

### 21.5 Capacitor (Pass 7)

```bash
npm install @capacitor/core @capacitor/android @capacitor/app @capacitor/haptics \
  @capacitor/screen-orientation @capacitor/filesystem @capacitor/preferences \
  @capacitor/share @capacitor/splash-screen
npm install -D @capacitor/cli
npx cap init "Cosmic Drift" "com.akmal.cosmicdrift" --web-dir=dist
npx cap add android
# Optional, paid route only (macOS + Xcode 26 + Apple Developer account):
# npm install @capacitor/ios && npx cap add ios
npm run build && npx cap sync
```

The app ID can never change after the first store upload; confirm `com.akmal.cosmicdrift` before Pass 7.

```ts
// capacitor.config.ts (baseline; confirm option names against the pinned Capacitor 8 docs)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akmal.cosmicdrift',
  appName: 'Cosmic Drift',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchAutoHide: false },   // hidden by BootScene when ready
  },
};

export default config;
```

At startup in the native shell: lock orientation to landscape (`@capacitor/screen-orientation`), hide system bars for immersive play using Capacitor 8's SystemBars API (or `@capacitor/status-bar` if needed), hide the splash screen once `BootScene` finishes, and register `appStateChange`, `backButton`, and `appUrlOpen` (deep links) listeners. Wrap every plugin call in `try/catch` with a web fallback.

**Viewport and CSS (N14):** `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`; on the game container `touch-action: none; overscroll-behavior: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;` and safe-area padding with `env(safe-area-inset-*)`. Pull-to-refresh, pinch-zoom, and bounce must never interrupt play.

### 21.6 Distribution

| Channel | Requirements |
| --- | --- |
| **Friends, Android (sideload)** | Build a signed release APK (`./gradlew assembleRelease` with your release keystore). Friends enable "Install unknown apps". Every update must be signed with the same keystore: back it up. |
| **Friends, iPhone/iPad (free)** | The installable PWA: open the HTTPS link in Safari → Share → Add to Home Screen. No fee, no expiry, updates through the service worker (§21.4). Free sideloading with a free Apple ID expires every 7 days; do not use it for friends. |
| **Friends, iOS native (optional, paid)** | TestFlight needs an Apple Developer Program membership (US$99/year). Not part of the free route. |
| **Friends, any device** | The web build on any HTTPS static host (for example GitHub Pages, Cloudflare Pages, or Netlify) with the CSP headers from §17.4. |
| **Google Play** | App Bundle, target API level per the current Play rule (API 36 since 31 Aug 2026), Play App Signing, data safety form, IARC content rating, privacy policy URL, phone and tablet screenshots, feature graphic. |
| **App Store** | Built with Xcode 26 and the iOS 26 SDK (required since 28 Apr 2026), privacy labels (no data collected), age rating questionnaire, screenshots per device class, TestFlight beta first. |

### 21.7 Optional services (Pass 8)

Accounts, cloud saves, leaderboards, public matchmaking, server-authoritative competitive rooms, platform attestation, signed remote config, and consented crash reporting. Suggested stack (from v2): Node.js + TypeScript + Fastify, PostgreSQL, Redis only if presence or queues need it, HTTPS/WSS only, secrets server-side, and every client request validated for authentication, ownership, schema, size, rate, and replay.

---

# PART III — PRODUCTION

## 22. Sequential Build Protocol

**Purpose:** prevent a huge codebase that looks complete but does not run. A small, polished, playable foundation beats twenty unfinished systems.

### 22.1 The cycle (every milestone)

1. **Audit** — read the repository, `docs/PROGRESS.md`, and `docs/HANDOFF.md`; run `npm run verify` for a baseline; list what works, what is broken, and what is missing.
2. **Plan** — one milestone only. State its scope, files to create or modify, dependencies (with justification), tests to add, and acceptance criteria. Anything outside the scope is out of bounds.
3. **Implement** — real, wired, working code for this milestone only. No stubs for acceptance-critical behavior. No code for later milestones "just in case".
4. **Test** — `npm run verify` plus the milestone's e2e and manual checks; add tests for every new rule.
5. **Review** — architecture (layers, single source of truth), bugs, performance (frame time, allocations), leaks, readability, and feel against §9 and O7.
6. **Fix & Polish** — repeat 3–5 until every gate passes and every P0/P1 finding is resolved; log P2 items.
7. **Handoff** — the §24.1 report, updated docs, a pushed branch with an open pull request, then **STOP** for explicit approval.

### 22.2 Approval gate

- Proceed only when every acceptance item passes **and** the user has explicitly approved.
- "Continue" approves exactly one next milestone, never a whole pass.
- If the user asks for something out of order, say so, explain the risk in one or two sentences, and offer the in-order alternative before doing anything.

### 22.3 Stop-the-line rules

- **Failing gate = stop.** Fix it before anything else; never stack work on a red build.
- **Three strikes.** If the same failure survives three distinct fix attempts, stop and report the exact output, what was tried, and a hypothesis. Never hack around it (`any`, `@ts-ignore`, disabled tests, loosened `tsconfig` or lint rules).
- **No hidden scope growth.** Anything beyond the plan is reported and justified, or removed.
- **No invented success.** If a command or device test could not run, say so and give the exact command or steps for the user.
- **No half-finished files.** Every file touched in a milestone is complete for that milestone's scope when it is handed off.

### 22.4 Back-and-forth polish loop

- **Reopen rule:** a defect found in an earlier milestone is fixed in that milestone's files with a regression test that fails before the fix and passes after; re-run every gate; report it under "Reopened".
- **Severity:** **P0** crash, data loss, softlock, stuck input, desync, security hole; **P1** wrong gameplay rule, leak, visible glitch, frame spike over budget, accessibility blocker; **P2** cosmetic or tuning. P0 and P1 block handoff.
- **Polish budget:** every milestone ends with review and polish of what it built (feel, timing, readability, consistency), not new systems.

### 22.5 Milestone size

- One concern per milestone; roughly 8 or fewer new source files. Larger plans split into lettered or numbered sub-milestones.
- Every milestone leaves the project **runnable, buildable, and tested**.

### 22.6 Order of work

Pass 0 → 1A → 1B → 1C → 1D → 1E → 1F → 2A … 2F → 3A … 3E → 4A … 4F → 5A … 5E → 6A … 6D → 7A … 7E → (8, optional). Features from §25 are tagged with the milestone where they are introduced; **never implement a tagged feature earlier than its tag.**

---

## 23. Pass Plan & Milestones

Each row lists the scope (only this), the sections to read, and the acceptance criteria. Every milestone also meets the Definition of Done (§20.6).

### Pass 0 — Bootstrap

| Milestone | Scope | Read | Done when |
| --- | --- | --- | --- |
| **0** | Private GitHub repository; Node pin; Vite 8 + strict TypeScript 6 + Phaser 4; ESLint, Prettier, dependency-cruiser layer rules; Vitest; Playwright skeleton; GitHub Actions CI; Git LFS rules; `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/` files; `stub:scan`; first tests (deadzone math, fixed-loop timing, seeded PRNG) | §0, §11, §12, §13.1, §20, §22–§24 | Clean `npm ci`; `npm run verify` passes locally and in CI; a responsive Phaser canvas with a fallback background shows at 16:9, 19.5:9, and 4:3 |

### Pass 1 — Playable vertical slice (mandatory before Pass 2)

| Milestone | Scope | Read | Done when |
| --- | --- | --- | --- |
| **1A — Boot & canvas** | `BootScene`, `ThemePalette`, hand-written minimal manifest + `AssetRegistry` (timeout, procedural fallback, statuses), capability matrix, viewport CSS guards, WebGL-required screen, debug badge (FPS, EMA frame time) | §9.2, §9.6, §12.3, §13.6, §21.5 (viewport), M3, M7, N14, O3 | Boots at phone and desktop ratios; zero required-asset 404s; a stalled asset falls back within the timeout; the no-WebGL screen works |
| **1B — Headless simulation** | `GameConfig`, `FixedLoop`, `Random`, `DMath`, `InputFrame`, `WorldSimulation` skeleton, `StateHash`, replay recorder, `tools/replay-run`, dt clamp, entity generations, NaN/Infinity assertion | §4.1, §13.2–§13.4, M1, M7, N4, N9, N11, O2 | Same seed + inputs ⇒ same hash; dt-spike and pause tests pass; `deps:check` proves `core` has no Phaser or DOM imports |
| **1C — Movement & collision** | Player state machine; axis-separated resolution; solid, one-way, drop-through; coyote, buffer, jump cut with minimum hold; wall slide and jump; jetpack; dash; corner correction; ledge forgiveness; hazard respawn; one moving platform; minimal ASCII level parser and a test arena | §4.1, §4.3, §5.1–§5.2, §13.5, M5, N1–N3 | Scripted headless tests cover every rule; the derived-reach table in §4.1 is reproduced within ±2 u; property tests show no tunneling at maximum speeds |
| **1D — Keyboard & multi-touch** | `TouchControls`, keyboard/mouse adapter, `InputRouter` with latching, `TouchControlView`, floating stick, Classic layout, cleanup triggers | §8.8–§8.9, §14, M6 | Every §14.5 test passes; 2–3 simultaneous touches verified on a real phone; no stuck input after blur, cancel, or scene change |
| **1E — Gameplay loop, art, audio, feel** | Crawler enemy; Pulse Blaster with swept projectiles and heat; shards, checkpoint, exit; HUD (HP, shield, shards, fuel); pause and restart; procedural Neo-Celestial art (slabs, parallax, contact shadows); `SoundEngine` with buses, limiter, polyphony caps, synth SFX; event-driven juice; render-only hit-stop; reduced-motion basics. Parry and slam only if the loop is stable; otherwise listed as deferred to 3A | §4.2–§4.4, §8.7, §9.3, §10.4, §13.7–§13.8, M4, N12, N13, O7 | The arena plays start to finish and restarts cleanly; audio never clips; reduced motion is respected |
| **1F — Hardening & acceptance** | Replay export/import (dev), 50-restart leak test, error handlers and Safe Mode, memory counters, basic adaptive quality, state-hash tooling, device record | M1, M8, O1, O4–O6, §19 | Every Pass 1 checklist item below passes |

**Pass 1 acceptance checklist — every item must pass:**

- [ ] `npm ci` completes; `npm run verify` passes (strict TypeScript, no `any` in `core`).
- [ ] Tests cover the fixed loop, collision, input, and deterministic simulation.
- [ ] The game boots into a responsive canvas in a current desktop browser and a mobile browser.
- [ ] The arena loads with no required-asset 404s; missing optional art uses a logged fallback.
- [ ] Physics runs at 60 fixed ticks per second regardless of display refresh rate; interpolation never changes outcomes.
- [ ] Backgrounding and resuming pauses safely: no teleporting, timer bursts, or duplicated input.
- [ ] Multi-touch works: move + jump, move + shoot, move + jump + shoot.
- [ ] Releasing or cancelling one finger never releases another finger's action; sliding across controls never steals ownership.
- [ ] Deadzone, saturation, diagonal normalization, and no-drift behavior pass automated and real-device checks.
- [ ] Keyboard produces the same gameplay through the same `InputFrame`.
- [ ] The player can move, jump, land, drop through, wall-jump, jetpack, dash, take hazard damage, collect shards, reach a checkpoint, and finish or restart the arena.
- [ ] Same seed + inputs ⇒ same final state hash; rendering and audio on or off do not change it.
- [ ] No uncaught errors, unhandled rejections, or unexplained requests during the acceptance run.
- [ ] The handoff records actual devices and browsers, average and p95 frame time, memory observations, and known limitations.

### Pass 2 — Game framework

| Milestone | Scope | Read | Done when |
| --- | --- | --- | --- |
| **2A — UI foundation** | Preact DOM layer, `tokens.css`, components, motion system, UI router synced with scenes, Title and Pause screens, fade and iris transitions, photosensitivity notice, dev-only UI gallery page | §8.1–§8.5, §8.12 | axe passes on every screen; transitions show no long tasks on a Mid device; every animation has a reduced-motion variant |
| **2B — Settings & accessibility** | Full Settings (§8.6) with live apply and persistence; layout editor and presets; text size; colorblind palettes with the CVD test; captions; i18n with `en` and the pseudo-locale | §8.6, §8.8, §8.10–§8.12, §9.2, §15.3 | Every setting persists and applies; pseudo-locale screenshots show no overflow; edited layouts survive restarts |
| **2C — Saves & autosave** | `SaveStore`, AES-GCM envelope, A/B atomic writes, migrations framework, autosave triggers, resume point, backup export/import, reward ledger and economy actions, Save Slots screen | §4.8 (rules), §15, §17.2, N11, O8 | Tamper, truncation, and migration tests pass; closing the tab mid-write loses nothing; Continue resumes at the checkpoint |
| **2D — Hub & scene flow** | `HubScene` (*Lantern* diorama), station sheets with the "Find them first" state, Star Map (Kepler playable), Mission Briefing, Loading with scopes, Results | §3.3, §8.1, §8.5 | Title → Hub → Star Map → Level → Results → Hub works with saves at every step |
| **2E — Cinematics & dialogue** | `CutscenePlayer`, timeline schema, `DialogueController` and box, portraits (fallback art allowed), voice blips, barks, captions, backlog; `cs_01` and `cs_02` | §2.6, §7, §13.9 | Skip-equivalence test passes; backgrounding pauses timelines; every line is a localization key |
| **2F — Level pipeline & tutorial** | Full level schema, parser, autotiling, slab extrusion, decor layers, objects for Kepler, LevelLint with reachability, ghost-run recorder, `assets:build` and `audio:build`, `kepler_01` complete with tutorial prompts | §3.2, §5, §8.10, §9.5–§9.7, §10.5 | LevelLint and the ghost run pass; pipelines are deterministic; `kepler_01` is playable end to end at the quality bar |

### Pass 3 — Chapter 1 complete (Kepler-186f)

| Milestone | Scope | Done when |
| --- | --- | --- |
| **3A** | Crawler and Hover Seeker full AI with telegraphs and drops; parry (with perfect window) and slam complete; combat feedback | Headless AI tests; every telegraph ≥ 300 ms; grayscale readability review passes |
| **3B** | `kepler_02`, `kepler_03` (moving platforms, collapsing plates, Bram rescue scene), Echo and Star Vault mechanics | LevelLint and ghost runs pass; three playtesters finish both levels |
| **3C** | Boss framework (phases, boss bar, phase checkpoints, co-op scaling hooks); Hive Warden; `cs_03`, `cs_04` | Scripted fight reaches every phase; no softlocks; first-clear rewards are granted exactly once |
| **3D** | Workshop (6 upgrades, respec), Wardrobe (Kepler cosmetics), Contracts, achievements framework | Economy tests match §4.8; purchase and respec animations meet §8.4 |
| **3E** | Chapter 1 polish: integrate available custom or AI art, Kepler music and SFX, haptics, device-matrix performance, accessibility pass, playtest with at least 3 people, fix every P0/P1 | **Shareable Chapter 1 build:** a deployed private web build and a signed debug APK the user can send to a friend |

### Pass 4 — Multiplayer

| Milestone | Scope | Done when |
| --- | --- | --- |
| **4A** | PeerJS transport and the channel verification in §16.2; local PeerServer; ICE/TURN configuration; connection state machine; room codes (M9); handshake with version and hash checks | Two browser tabs connect, exchange handshakes, and reject a mismatched build |
| **4B** | Relay screen, hangar lobby with the loose formation, lobby UI, ready/countdown/launch, invite links, share | The lobby looks and behaves as §6.2 specifies with 4 clients |
| **4C** | `input:frames`, snapshots, clock sync, prediction and reconciliation, interpolation, M2 smoothing on `arena_kepler` | Movement looks correct for all players at 100 ms RTT and 2% loss (simulated) |
| **4D** | Reliable events (projectiles, hits, pickups), interest management, Shard Rush and King of the Beacon rules in `core/modes`, podium scene | Full matches complete on two devices; packet fuzz tests pass |
| **4E** | Orbital Co-op on Kepler missions and the Hive Warden (scaling, rescue pods, guest progression rules), Boss Rush with available bosses, spectator cam, quick-chat and pings | A 2-player co-op run of `kepler_01`–`kepler_boss` completes |
| **4F** | Network hardening: latency/loss/duplication simulation, reconnect grace, host loss, TURN relay on cellular, Android ↔ iOS ↔ web cross-play | Join in under 30 s (P4); a 10-minute 4-player match with no desync, crash, or visible rubber-banding at 100 ms RTT and 2% loss |

### Pass 5 — Chapters 2–5 and post-game

Each chapter splits into four milestones: **(1)** new enemies and mechanics, **(2)** three levels with rescues and set pieces, **(3)** the boss and its cutscenes, **(4)** new hub features plus chapter polish and playtest. Each meets: LevelLint and ghost runs pass, scripted boss phases pass, cutscene skip-equivalence passes, performance holds on the device matrix, and playtest notes are triaged.

| Milestone | Chapter content |
| --- | --- |
| **5A** Vulcanis | Armored Trooper, Turret, geysers, collapsing bridges, grapple; `vulcanis_01`–`03` (Pike rescue, Grapple Hook, lava chase); Solar Leviathan; `cs_05`–`cs_07`; Armory (weapons T2–T3, Holo-Decoy, Gravity Mine, Vanguard) |
| **5B** Cryos-9 | Cryo Bomber, ice physics, doors and switches, fog; `cryos_01`–`03` (Halloran rescue); Cryos Overlord; `cs_08`–`cs_10`; Codex; mutators; Phantom; weapon T4 |
| **5C** Aether-V | Phase Blinker, wind zones, dash rings, light beacons; `aether_01`–`03`; Aether Archon; `cs_11`–`cs_13`; Echo Gallery; weapon T5; Phase Blink |
| **5D** Obsidian Core | Elite modifiers, polarity zones, zero-G chambers; `obsidian_01`–`03` (Reyes rescue, Rusk's turn); the Hollow Crown and Starfall; `cs_14`–`cs_18`; Drift+; full Boss Rush; Theater |
| **5E** Post-game & completeness | Drift+ tuning, full Contract pool, 30 achievements, par times, co-op for every chapter, all five multiplayer arenas |

### Pass 6 — Polish, accessibility, localization

| Milestone | Scope |
| --- | --- |
| **6A — Art & audio lock** | Replace remaining fallbacks per asset policy; provenance ledger complete; music and mix pass to loudness targets; VFX standards audit |
| **6B — Feel & UX polish** | Playtest-driven tuning of movement, combat, camera, difficulty, Assist, and economy (from local metrics); UI motion and onboarding polish |
| **6C — Accessibility & input** | Gamepad support (§14.4); full rebinding UI; complete §8.12 audit; caption coverage; photosensitivity review |
| **6D — Performance** | Device-matrix profiling; adaptive-quality tuning (O6); memory, load-time, and battery budgets; pseudo-locale clean |

### Pass 7 — Platform, security, release

| Milestone | Scope |
| --- | --- |
| **7A** | PWA, web hosting, CSP headers, update flow |
| **7B** | Android: Capacitor (8.x, or 9.x by ADR), plugins, lifecycle, back button, deep links, haptics, filesystem saves, orientation and system bars, release signing, sideload APK, device tests |
| **7C** | iPhone/iPad via PWA (free route): Add-to-Home-Screen install, safe areas, standalone display, audio and silent switch, service-worker update flow, lifecycle, device tests in Safari and installed mode. *Optional, paid:* native iOS on macOS with Xcode 26 and TestFlight |
| **7D** | Security hardening (§17.3–§17.5): owner keys and tokens, content signing, selective obfuscation, secret scanning, optional memory masking, release-bundle checks |
| **7E** | Release candidate: §26 checklists, store listings if publishing, privacy policy, rating questionnaires, final regression, tag `v1.0.0` |

### Pass 8 — Optional live services

Accounts, cloud saves, leaderboards, matchmaking, server authority, attestation, telemetry with consent (§21.7). Each needs its own plan and approval.

---

## 24. Handoff & Session Continuity

### 24.1 Handoff report (end of every milestone)

1. **Implemented:** files created and modified; exported types and functions; behaviors added.
2. **Dependencies:** packages added or removed, why, and exact install commands.
3. **Verification:** exact commands and results (`npm run verify`, e2e) with test counts.
4. **Acceptance:** every criterion ✅ or ❌ with evidence.
5. **Manual tests:** devices, browsers, and input scenarios tested, and those **not** tested.
6. **Review & polish:** P0/P1 fixed, P2 logged, anything Reopened with its regression test.
7. **Traceability:** which §25 items landed; which remain pending.
8. **Known issues & deferred items.**
9. **Next milestone:** its scope and plan only.
10. **STOP:** end with "Awaiting your approval to proceed to <next milestone>."

### 24.2 `docs/PROGRESS.md`

A table of every milestone with status (`NOT STARTED`, `IN PROGRESS`, `IN REVIEW`, `APPROVED`, `REOPENED`), date, branch or tag, and notes; plus the §25 traceability list (item → milestone → status).

### 24.3 `docs/HANDOFF.md` (overwritten every session)

Current milestone and branch; last green commit; what is done; what is in progress (exact files and functions); failing tests with output; ordered next steps; pending decisions; the commands to run first.

### 24.4 `docs/DECISIONS.md`

Short ADR entries: date, decision, context, alternatives, consequences. Every new dependency and every deviation from this spec gets one.

### 24.5 Session protocol

- **Start:** read `AGENTS.md`, `PROGRESS.md`, `HANDOFF.md`; `npm ci`; `npm run verify`; report the baseline.
- **During:** one feature branch per milestone (`m/1C-movement`); small commits with clear messages (`feat(1C): coyote time and jump buffer`); never commit to `main` directly; never push a red build to `main`.
- **When the session or usage budget is running out:** stop starting new work; bring the branch back to green or revert the partial change; commit anything worth keeping with a `wip:` prefix; write `HANDOFF.md`; push. Never leave uncommitted work behind. The next session, or a different AI, resumes from the files, not from memory.

### 24.6 GitHub setup

- **Private** repository; branch protection on `main` (pull request + passing CI required).
- Git LFS for `assets_src/**` binaries (`*.psd`, `*.wav`, `*.blend`, `*.aseprite`, source `*.png`). Generated assets in `public/assets/` are committed (the pipelines are deterministic) so builds never need image or audio tools; CI rebuilds them when sources change and fails on a diff. Git LFS storage and bandwidth quotas apply on GitHub; check your plan.
- Tag every approved milestone (`m-1A`, `m-1B`, …) and releases (`v1.0.0`) so any state can be restored.
- One GitHub issue per milestone using its acceptance checklist; Dependabot or Renovate for updates.
- No secrets are needed until Pass 7 (Android keystore, Apple certificates); store them only in GitHub Actions secrets and offline backups.

---

## 25. Hardening Rules (tagged)

Each item is introduced at its tag and must not appear earlier. Constants live in `GameConfig` (N9).

### 25.1 M — Reliability and runtime

| # | Rule | Specification | Tag |
| --- | --- | --- | --- |
| M1 | Deterministic replay and seed log | Record the seed, config hash, and per-tick `InputFrame`s (run-length encoded). A replay reproduces the final state hash. Failed tests print their seed. | 1B (record), 1F (import/export) |
| M2 | Correction smoothing | Corrections become a visual offset decaying with ~100 ms half-life; teleport only above `SNAP_THRESHOLD` (160 u). | 4C |
| M3 | Asset timeout and fallback | Per-asset timeout 1500 ms plus a total boot budget; timeouts fall back to procedural with one warning; late arrivals swap only at scene boundaries. | 1A |
| M4 | Audio buses and ducking | `master → {music, sfx, ui, voice, ambience}`; ducking and a master limiter (§10.4); unlock on first gesture. | 1E |
| M5 | Hitbox forgiveness | Hurtbox smaller than the sprite, ledge forgiveness, enlarged pickup radius; all in `GameConfig` and tested. | 1C (values), 1E (tuning) |
| M6 | Input cleanup | On blur, hidden visibility, `touchcancel`, `pointercancel`, pause, panel open, and scene change: release every touch, clear held keys, reset edges, zero the stick. Unit-test each trigger. | 1D |
| M7 | Frame telemetry and spike guard | EMA and p95 counters for update, simulation, render, network; dt clamp at 100 ms; accumulator reset after interruptions; shown in the debug badge. | 1A (badge), 1B (clamp) |
| M8 | Clean teardown | Every scene shutdown returns pooled entities, cancels timers and tweens, removes listeners, releases GPU resources; dev leak test: 50 restarts return all counts to baseline. | 1F, then every new scene |
| M9 | Signaling and room codes | 4-character codes from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, uppercase and trimmed; retry on ID collision; typed state `idle | connecting | connected | reconnecting | failed`; readable ICE and STUN errors. | 4A |
| M10 | Strict build gate | Zero TypeScript errors and a green `verify` before any later pass; every handoff lists files, exports, and gate results. | 0, every handoff |

### 25.2 N — Simulation, networking, platform

| # | Rule | Specification | Tag |
| --- | --- | --- | --- |
| N1 | Collision order | Integrate and resolve X, then Y; stable IDs and order; corner clips never push into walls or cancel jumps. | 1C |
| N2 | One-way platforms | Drop-through on Down + Jump with a 150 ms re-land grace; crossing test with 6 u snap tolerance; tests for fall-through, catch-from-above, drop-then-re-land. | 1C |
| N3 | Swept motion | Projectiles are swept every tick; anything faster than 32 u/tick sub-steps. Supersedes the v2 "≤ 18 px/step clamp". | 1C (movement), 1E (projectiles) |
| N4 | Entity generations | Pooled IDs carry generation counters; stale references from packets, timers, or callbacks are discarded. | 1B (IDs), 4C (network) |
| N5 | Sequence handling | Per-sender highest tick or sequence with modular `Uint16` comparison; stale and duplicate packets dropped; tests across the wrap boundary. | 4A |
| N6 | Input redundancy | Implemented by the `0x11 input:frames` packet carrying 2 new + 2 redundant frames (§16.4); covered by protocol tests on both sides. | 4C |
| N7 | Host hit validation | Reach tolerances, cooldowns, and rate checks for friendly-play fairness; not anti-cheat. | 4D |
| N8 | Disconnect and host loss | 3.0 s grace, then deterministic removal; host loss returns everyone to the lobby; host migration deferred. | 4F |
| N9 | Single config source | `GameConfig` `as const`; config hash in replays and the handshake. | 1B |
| N10 | Strict indexing | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; guarded array, pool, and grid lookups. | 0 |
| N11 | Finite-number sanitizer | Every external number (packets, saves, manifests, pointer events) passes `Number.isFinite` and range clamps at the boundary; a dev assertion scans simulation state each tick. | 1B (assert), 2C (saves), 4A (packets) |
| N12 | Audio polyphony | Voice caps per bus, 40 ms minimum repeat interval, oldest/quietest stealing. | 1E |
| N13 | WebGL resource disposal | Dispose scene-scoped textures, filters, and listeners; handle context loss and restore. | 1E, 1F |
| N14 | Viewport lock and orientation | Viewport meta and CSS guards (§21.5); native orientation lock and system bars. | 1A (web), 7B/7C (native) |
| N15 | Handoff contract | Every handoff lists files, exports, and gate results; no cross-file symbol mismatches; no stubs. | Every handoff |

### 25.3 O — Additional quality systems

| # | System | Specification | Tag |
| --- | --- | --- | --- |
| O1 | Replay tooling and state hashes | Hash a canonical serialization every 60 ticks; replay import validates version, seed, length; a mismatch reports the first diverging tick. | 1F |
| O2 | Regression tests | Every fixed bug gets a reproducing test; golden replays guard movement, combat, levels, and bosses. | 1B onward |
| O3 | Asset validation | Manifest schema, dimensions, duplicate keys, extension allow-list, path traversal; corrupt assets fall back, logged once. | 1A |
| O4 | Crash recovery | Global handlers, bounded error buffer, recovery screen, Safe Mode after repeated boot failures (§19.2). | 1F |
| O5 | Leak detection | Dev counters for pools, listeners, timers, textures, audio nodes; baseline checks after restarts. | 1F |
| O6 | Adaptive quality | Tiers driven by rolling p95 with hysteresis and cooldowns (§18.2); manual override; reduced motion and Battery respected. | 1F (basic), 6D (tuning) |
| O7 | Animation and VFX standards | Shared timing and easing tokens (§8.4); per-effect and per-scene particle budgets; effects are event-driven and never touch the simulation; every enemy attack has a readable wind-up; reduced-motion variants. | 1E, then each content pass |
| O8 | Save corruption recovery | Envelope with authentication, A/B atomic writes, last-known-good, quarantine, migration and fuzz tests (§15). | 2C |

---

## 26. QA Matrix & Release Checklist

### 26.1 Device and environment matrix

| Category | Minimum coverage |
| --- | --- |
| Android | One Low-tier phone (about 2020 mid-range, 3–4 GB RAM), one Mid-tier, one recent flagship |
| iOS | One iPhone on the current iOS major version and one on the previous major; one iPad (4:3) |
| Desktop | Chrome, Firefox, Safari (macOS), Edge |
| Aspect ratios | 4:3, 16:9, 19.5:9, 21:9 |
| Networks | Home Wi-Fi, 4G/5G cellular, phone hotspot, induced 100 ms latency + 2% loss |

### 26.2 Regression checklist (every release candidate)

New game through `kepler_01`; continue from a checkpoint; backup export/import; every settings tab; touch layout editor; a boss fight per chapter; a cutscene skipped and one watched (same save result); a 4-player Shard Rush match across platforms; app backgrounded mid-level and mid-match; WebGL context loss (simulated); Safe Mode entry; pseudo-locale screens.

### 26.3 Release checklist — the definition of "production-ready"

- [ ] Passes 0–7 approved; `npm run verify` and e2e (Chromium and WebKit) green on the release commit.
- [ ] The device matrix in §26.1 passes the regression checklist; no open P0/P1; all P2 triaged.
- [ ] Performance budgets (§18) met on Mid tier, and on Low tier with the Battery preset.
- [ ] The campaign has been completed start to finish by human playtesters on Story, Standard, and Drift+.
- [ ] Every level ghost run and every scripted boss test passes; all 19 cutscenes play and skip equivalently.
- [ ] Saves survive kill-during-write tests on web, Android, and iOS; migrations from every shipped schema pass.
- [ ] Cross-play: 2–4 players across Android, iOS, and web for a 30-minute session with no desync or crash, including a relay (TURN) path.
- [ ] Accessibility checklist (§8.12) complete; localization keys complete; pseudo-locale clean.
- [ ] Provenance ledger, open-source licenses, and credits complete.
- [ ] Privacy policy published; store requirements met (if publishing); rating questionnaires done.
- [ ] Release keystore, Apple certificates, and owner keys backed up offline and restore-tested.
- [ ] Version tagged; the previous release build archived for rollback.

---

## Appendix A — Data Schemas (TypeScript, contract)

```ts
// ---------- Profile (encrypted in the save envelope, §15.2) ----------
export interface PlayerProfile {
  schemaVersion: 1;
  saveId: string;                     // random UUID
  callsign: string;
  createdAtMs: number; updatedAtMs: number; playTimeMs: number;
  difficulty: "story" | "standard" | "drift_plus";
  assists: { invulnerable: boolean; infiniteFuel: boolean; gameSpeed: 70 | 80 | 90 | 100;
             autoFire: boolean; bossPhaseCheckpoints: boolean; safeHazards: boolean };
  wallet: { starShards: number; nebulaCores: number };
  upgrades: Record<UpgradeId, number>;            // current level per track
  unlockedWeapons: WeaponId[]; equippedWeapon: WeaponId;
  grappleUnlocked: boolean;
  unlockedGadgets: GadgetId[]; equippedGadget: GadgetId | null;
  unlockedSuits: SuitId[]; selectedSuitClass: SuitId;
  unlockedMutators: MutatorId[]; equippedMutator: MutatorId | null;
  unlockedCosmetics: CosmeticId[];
  equippedSkin: { suit: CosmeticId; trail: CosmeticId; visor: CosmeticId };
  unlockedPlanets: PlanetId[];
  missions: Partial<Record<MissionId, { completed: boolean; bestTimeMs: number | null;
             shardsPct: number; echo: boolean; vault: boolean; parBeaten: boolean }>>;
  echoes: EchoId[];
  storyFlags: string[];
  cutscenesSeen: CutsceneId[];
  achievements: AchievementId[];
  activeBounties: { id: string; templateId: string; progress: number; target: number;
                    rewardCores: number; issuedForDate: string }[];
  rewardLedger: string[];             // granted rewardIds; never granted twice
  mpDaily: { date: string; coresEarned: number };
  resume: { missionId: MissionId; checkpointId: string; bankedShards: number;
            collectedIds: string[]; timestampMs: number } | null;
  stats: { highScoresByPlanet: Partial<Record<PlanetId, number>>; aliensDefeated: number;
           bossesDefeated: number; matchesPlayed: number; matchesWon: number;
           revivesGiven: number; parries: number; perfectParries: number; dashes: number;
           grapples: number; lifetimeShards: number; deaths: number };
}

// ---------- Level (content/levels/**, §5.2) ----------
export interface LevelData {
  schemaVersion: 1; id: MissionId | ArenaId; planet: PlanetId; nameKey: string;
  size: { w: number; h: number }; parTimeSec?: number; musicId: string;
  rows: string[];                     // h rows of length w, legend in §5.2
  objects: LevelObject[]; zones: LevelZone[]; decor: DecorPlacement[]; triggers: LevelTrigger[];
}
export type LevelObject = { id: string; x: number; y: number; requires?: AbilityId[] } & (
  | { type: "player_spawn" } | { type: "checkpoint" } | { type: "exit" }
  | { type: "shard" } | { type: "shard_line"; count: number; spacing: number; dir: "h" | "v" }
  | { type: "echo"; echoId: EchoId } | { type: "vault_entrance"; vaultRoomId: string }
  | { type: "enemy"; archetype: EnemyId; patrol?: [number, number]; elite?: EliteId; facing?: -1 | 1 }
  | { type: "turret"; normal: "up" | "down" | "left" | "right" }
  | { type: "power_up"; powerUp: PowerUpId }
  | { type: "moving_platform"; path: [number, number][]; speedUps: number; waitMs: number; oneWay: boolean }
  | { type: "geyser"; periodMs: number; offsetMs: number; heightTiles: number }
  | { type: "grapple_anchor" } | { type: "dash_ring" }
  | { type: "wind_zone"; w: number; h: number; dirDeg: number; strength: number }
  | { type: "polarity_zone"; w: number; h: number } | { type: "zerog_zone"; w: number; h: number }
  | { type: "door"; switchId: string } | { type: "switch"; switchId: string }
  | { type: "npc"; npcId: SpeakerId; sceneId: string } | { type: "boss_spawn"; boss: BossId }
  | { type: "cutscene_trigger"; cutsceneId: CutsceneId } | { type: "rising_hazard"; speedUps: number; delayMs: number }
  /* remaining types from §5.2 follow the same pattern */ );

// ---------- Cutscene timeline (content/cutscenes/**, §7.2) ----------
export interface CutsceneTimeline {
  schemaVersion: 1; id: CutsceneId; skippable: boolean; letterbox: boolean;
  tracks: TimelineTrack[];            // discriminated by `type`: camera | actor | dialogue | audio | vfx | screen | wait | event
}
export interface DialogueLine {
  id: string; speaker: SpeakerId;
  emotion: "neutral" | "happy" | "angry" | "worried" | "surprised";
  textKey: string; blipProfile?: string; autoAdvanceMs?: number;
}

// ---------- Asset manifest entry (public/assets/ASSET_MANIFEST.json, §9.7) ----------
export interface AssetManifestEntry {
  key: string; scope: string; kind: "image" | "atlasFrame" | "spritesheet" | "rig" | "audio" | "font";
  source: "custom" | "ai" | "procedural"; required: boolean;
  files: { path: string; sha256: string; density?: 1 | 2; codec?: "aac" | "opus" }[];
  frames?: { count: number; fps: number; loop: boolean };
  pivot?: { x: number; y: number }; loopPoints?: { startSec: number; endSec: number };
  bus?: "music" | "sfx" | "ui" | "voice" | "ambience"; minIntervalMs?: number;
}

// ---------- PartRig (content/rigs/**, §9.4) ----------
export interface RigData {
  schemaVersion: 1; id: string;
  bones: { id: string; parent: string | null; x: number; y: number; rotDeg: number; part: string | null; z: number }[];
  clips: Record<string, { durationMs: number; loop: boolean;
    tracks: { bone: string; prop: "rot" | "x" | "y" | "sx" | "sy" | "alpha" | "part";
              keys: { tMs: number; v: number | string; ease?: string }[] }[];
    events?: { tMs: number; name: string }[] }>;
}
```

ID string-literal unions (`MissionId`, `EnemyId`, and so on) are generated from Appendix B into `src/core/Ids.ts`; Zod schemas mirror these interfaces and generate `content/schemas/*.json` for editor validation.

## Appendix B — ID Registry (contract)

| Group | IDs |
| --- | --- |
| Planets | `kepler`, `vulcanis`, `cryos`, `aether`, `obsidian` |
| Missions (20) | `kepler_01`, `kepler_02`, `kepler_03`, `kepler_boss`, `vulcanis_01`, `vulcanis_02`, `vulcanis_03`, `vulcanis_boss`, `cryos_01`, `cryos_02`, `cryos_03`, `cryos_boss`, `aether_01`, `aether_02`, `aether_03`, `aether_boss`, `obsidian_01`, `obsidian_02`, `obsidian_03`, `obsidian_boss` |
| Arenas | `arena_kepler`, `arena_vulcanis`, `arena_cryos`, `arena_aether`, `arena_obsidian` |
| Modes | `orbital_coop`, `shard_rush`, `king_of_the_beacon`, `boss_rush` |
| Enemies | `crawler`, `hover_seeker`, `armored_trooper`, `turret`, `phase_blinker`, `cryo_bomber` |
| Elites | `shielded`, `volatile`, `swift` |
| Bosses | `hive_warden`, `solar_leviathan`, `cryos_overlord`, `aether_archon`, `hollow_crown` |
| Weapons | `pulse_blaster`, `spread_array`, `overclocked_repeater`, `rail_lance`, `nova_cannon` |
| Gadgets | `grapple_hook` (traversal), `holo_decoy`, `gravity_mine`, `phase_blink` |
| Suits | `striker`, `vanguard`, `phantom` |
| Mutators | `vampiric_rounds`, `low_gravity_anchor`, `glass_cannon`, `shard_siphon` |
| Power-ups | `overdrive_jetpack`, `plasma_spread`, `aegis_bubble`, `super_magnet`, `gravity_boots` |
| Upgrades | `jetpack_fuel`, `jetpack_recharge`, `dash_tuning`, `hull_shield`, `shard_magnet`, `blaster_overclock` |
| Abilities (for `requires`) | `jetpack_lv2`, `jetpack_lv4`, `grapple`, `phase_blink`, `slam`, `dash` |
| Cutscenes (19) | `cs_00_title_attract`, `cs_01_shardfall`, `cs_02_orrin_wakes`, `cs_03_warden_intro`, `cs_04_kepler_outro`, `cs_05_vulcanis_arrival`, `cs_06_leviathan_intro`, `cs_07_vulcanis_outro`, `cs_08_cryos_arrival`, `cs_09_overlord_intro`, `cs_10_cryos_outro`, `cs_11_aether_arrival`, `cs_12_archon_intro`, `cs_13_the_truth`, `cs_14_obsidian_arrival`, `cs_15_crown_intro`, `cs_16_finale`, `cs_17_credits`, `cs_18_true_ending` |
| Speakers | `kes`, `orrin`, `tavi`, `bram`, `pike`, `halloran`, `reyes`, `voss`, `rusk`, `archon` |
| Echoes (15) | `echo_<planet>_<1..3>` |
| Cosmetics — suits | `skin_courier` (default), `skin_garden`, `skin_forge`, `skin_archive`, `skin_choir`, `skin_heart`, `skin_meridian_defector`, `skin_drift_plus` |
| Cosmetics — trails | `trail_cyan` (default), `trail_kepler`, `trail_vulcanis`, `trail_cryos`, `trail_aether`, `trail_obsidian` (par sets), `trail_starfall`, `trail_relay` |
| Cosmetics — visors | `visor_standard` (default), `visor_amber`, `visor_frost`, `visor_prism`, `visor_void`, `visor_tavi`, `visor_pike`, `visor_orrin` (true ending) |
| Achievements (30) | `first_light`, `garden_saved`, `forge_cooled`, `archive_thawed`, `choir_heard`, `heart_restored`, `all_echoes`, `all_vaults`, `parry_100`, `perfect_parry_25`, `starfall_first_try`, `untouchable`, `par_master`, `drift_plus_clear`, `boss_rush_clear`, `boss_rush_flawless`, `shard_hoarder`, `fully_upgraded`, `armory_complete`, `gadgeteer`, `dressed_to_drift`, `relay_first_match`, `field_medic`, `shard_rush_win`, `beacon_keeper`, `coop_boss_down`, `slam_dunk`, `grapple_100`, `contractor_20`, `dash_1000` |
| Music (20) | `mus_title`, `mus_hub`, `mus_lobby`, `mus_<planet>_explore`, `mus_<planet>_combat`, `mus_<planet>_boss` (×5), `mus_finale`, `mus_credits` |
| Rule toggles | `friendlyBump`, `hazardSpeed`, `suddenDeath`, `lowGravityChaos`, `instagib`, `doubleShards` |

## Appendix C — `AGENTS.md` template

```markdown
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
```

`CLAUDE.md` contains a single line: `@AGENTS.md`.

## Appendix D — Changes from v2 to v3

| v2 | v3 |
| --- | --- |
| Sections 1–13 (vision) plus Addendum A–P with a conflict table | One consistent spec in three parts; conflicts resolved in place; the conflict table is no longer needed |
| Phaser 3.80+ "WebGL2" | Phaser 4.x (stable since April 2026), WebGL renderer, Filters instead of v3 FX pipelines |
| TypeScript, Vite, Capacitor versions unspecified | TypeScript 6.x, Vite 8.x, Capacitor 8.x, Vitest 5.x, Node 24/26 LTS (verified November 2026) |
| 3 bosses | 5 bosses (adds the Hive Warden tutorial boss and the Hollow Crown finale) |
| No story | Full story bible, cast, 19 cutscenes, dialogue system, true ending |
| Planets as arenas | 20-mission campaign with per-level beats, collectibles, par times |
| `0x01` 11-byte input packet; XOR "crc8" | `0x11` redundant `input:frames` packet; real CRC-8 |
| Snapshot positions `Int16` | `Uint16` (non-negative coordinates, 2× range) |
| Delta-compressed snapshots | Interest management first; delta compression only if measured |
| 45–120 ms jitter buffer | 75–150 ms interpolation delay (correct for 20 Hz snapshots) |
| "100% offline hotspot WebSocket fallback" | Removed (a browser cannot host a LAN server) |
| `localStorage` + FNV-1a checksum | IndexedDB / native filesystem; AES-GCM authenticated envelope; A/B atomic writes |
| Grapple Hook as a slot gadget | Traversal tool at anchors, so levels never depend on a slot choice |
| Jetpack, gravity, and jump physics unspecified | Full constants table with derived reach per planet and level-design rules |
| `appId` `com.akmal.spaceplatformer`, name "Space Platformer" | `com.akmal.cosmicdrift`, "Cosmic Drift" (confirm before the first store upload) |
| Passes 0–6 | Passes 0–8; Pass 4 stays Multiplayer; tag N14 moves to Pass 7 |
| "Encrypted, uncrackable" expectation | Honest threat model with owner-only signing keys and tokens (§17) |

### Changes in v3.1

| v3.0 | v3.1 |
| --- | --- |
| Native iOS (TestFlight) assumed for iPhone friends | Free route by default: Android sideload `.apk` plus iPhone/iPad PWA; native iOS is optional and paid |
| Android release built locally | `.apk` built in GitHub Actions (or on the owner's PC); the Android SDK is not required in the agent's sandbox |
| Vitest 4.1+ | Vitest 5.x; TypeScript stays on 6.x (6.0.3 verified), TS 7 only by ADR |

---

## Final Reminder — Sequential Build Protocol

**Do not build everything at once.** Audit → Plan → Implement → Test → Review → Fix & Polish → Handoff → **STOP for approval.** One milestone at a time, in order: Pass 0 → 1A → 1B → 1C → 1D → 1E → 1F → 2A → … Never start a pass with unresolved P0/P1 bugs from the previous one. Never stack new work on a failing build. Never leave a file half-finished. A polished, playable foundation is worth more than any number of unfinished systems.

