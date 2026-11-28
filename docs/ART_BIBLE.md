# Cosmic Drift Art Bible (v1 · look B "Ember Dark")

**Status: locked by the owner on 2026-11-28** (style test, look B). It replaces spec §9.1 (art bible) and §9.2 (palette tokens) by an ADR in docs/DECISIONS.md. Spec §9.3–§9.9 still apply, with the changes in §10 below.

**Target frame:** `docs/art/look-lock/look-B-v2.png`. Every asset is checked against it. The board next to it shows the colour keys and models.

**References, for feel only:** Metroid Dread (readable armour, hard light, dark zones), Inside (fog, silhouettes, restraint), Little Nightmares 2 (dusk, depth, scale). No shapes, characters, designs, palettes or compositions are taken from them.

## 1. Pillars

1. **Dark, lonely, real.** A lived-in sci-fi world at night, with realistic materials and colours. Never neon.
2. **Light tells the story.** Three kinds of light: one warm star key, cool teal crystal light, and small warm human lamps. Darkness has shape.
3. **Readable first.** On a 6-inch phone the player sees Kes, threats, pickups and walkable tops at a glance.
4. **Alive at the edges.** Small, irregular, never-synchronized life (flicker, mites, smoke, a distant giant), always off the walk line.
5. **A warm heart in a cold world.** The world is cool; Kes, her ship's lamps and the Star Shards are warm.

## 2. Palette

| Role | Colours | Use |
| --- | --- | --- |
| Sky | `#04070B` zenith · `#0A131A` · `#13303A` horizon band · `#1C4048` glow band · `#091317` low | Painted sky behind everything |
| Fog | `#0F2229` fog · `#18363F` ground fog | Aerial perspective, low fog |
| Rock | `#14181B` dark · `#21272B` mid · `#4D5653` lit top · `#1E3330` lichen | Ground, cliffs, islands |
| Crystal | `#0C2F31` body · `#3FE0C8` glow · `#2A7A73` edge | Kepler's crystals (cool light) |
| Metal | `#383D42` hull · `#2F3439` dark metal · `#3C4248` grate | Ships, Meridian structures, catwalks |
| Human light | `#FF9E3D` lamps · `#FF9A4A` fire | Lamps, beacons, the wreck's fire (sparse) |
| Star | `#FFF7E4` core · `#FFC877` glow · `#FFD9A0` key light | The Heartstar and its light |
| Friendly tech | `#4FF0D8` | ORRIN, Kes's visor line, UI accent |
| **Danger** | `#FF3B2E` | **Threats only:** enemy eyes and seams, hazard edges, enemy shots. Nothing else may be red. |
| Star Shards | `#FFC24A` | The soft currency (gold, spinning, glowing) |
| Nebula Cores | `#A855F7` (kept from the spec; B1b re-checks it in the dark world) | The rare currency |
| HUD | `#EAF2F2` text · `#4FF0D8` accent · `#FF3B2E` danger | Thin, quiet HUD |

**Colour-blind modes:** B1b re-derives the per-mode alternates for accent, danger, shard and core under the existing CVD test (Machado 2009, ΔE2000 ≥ 20). Shape cues stay primary.

**Kes's suit (colour keys on the board; the owner picks):**

| Key | Suit | Armour | Note |
| --- | --- | --- | --- |
| **Rust** (recommended) | `#9A5430` | `#454A50` graphite, scuffed `#7C838B` | Warm on cool: reads instantly against teal, matches the star's light. |
| Mustard | `#A2842F` | `#3E4146` | Brightest; strongest contrast. |
| B0 colours | `#2A2E33` | `#B7B2A6` bone | The style-test colours, kept for comparison. |

In every key, the dark parts (boots, gloves, belt, pack) are about `#23262A`. The shoulder and chest stripes are the **player slot colour**. Slot colours move to look B in B1b: four colours, all different from the danger red and from each other.

## 3. Light

- **World rig (environments):** the Heartstar is a warm, hard key from the upper left. A cool teal rim comes from behind, plus a dim fill and a faint bounce. Environments are never mirrored, so their light can be directional.
- **Sprite rig (characters, pickups):** flip-safe, with no left or right component. A warm key comes from above and in front, a soft neutral rim from behind, and a teal bounce from below. Side light comes from the engine instead: a screen-space rim on the edge that faces the star (`rim_engine`), so a sprite mirrored with `flipX` is still lit correctly.
- **No all-round outlines or glows on characters, ever.** (This was the white/blue outline in the style test.)
- **Contact:** everything grounded has a contact shadow. Characters get a soft pool plus a tight dark core under each foot, and their feet sink 1 px into the grit.
- **Emitters are limited to five:** crystals (teal), human lamps (amber), ORRIN and the visor (teal), shards (gold), and threats (red).

## 4. Atmosphere

- **Layer order, back to front, with fog amounts:**
  - sky and star;
  - far (0.72, plus ground fog);
  - giant (0.88: a ghost in the haze, never a focal point);
  - mid (0.50);
  - near (0.27);
  - play plane (0.03);
  - sprites (play + 0.04);
  - foreground (darkened, blurred).
- **Aerial perspective:** distant layers fade toward the sky colour behind them, not toward a flat grey.
- **Ground fog** rises from the bottom 40% of the screen. **Light shafts:** up to 6, additive and soft, from the star. **Motes:** about 70 far and 14 near, warm.
- **Post:**
  - Bloom on emitters only.
  - Vignette 0.5.
  - Grain very fine (0.012) or off. Dithering inside fog gradients prevents banding.
  - The game draws sharp: the grain in the style test was a film effect plus phone zoom and JPEG compression.
- **Level moods** are variants under the same rules: rain and a low warm dusk (from look C), and heavy fog (from look A) for chosen levels and moments.

## 5. Materials (one roughness language)

| Material | Rules |
| --- | --- |
| Rock | Two-tone with strata on faces. Walkable tops are lighter (lit). Cracks at two scales, sparse dark lichen on tops, grit and loose stones on tops. Edges crumble. Roughness 0.88. |
| Crystal | Dark glassy body, fresnel edge, glow toward the tips, veins. Each crystal cluster has its own glow level; no two neighbours match. |
| Hull, metal | Patchy panel tones (plates about 2 m), dirt, scorch near damage. Roughness 0.3–0.6. |
| Suit | Matte fabric (roughness about 0.78) and worn armour (about 0.4) with lighter scuffed edges and darker crevices. |
| Glass | Visors and canopies: dark, glossy (roughness 0.05), and a faint inner light at most. |

## 6. Shapes and silhouettes

- **Kes:** an upright human about 7 heads tall. Helmet with a crest and a narrow visor carrying ORRIN's light line, twin pack pods, a blaster. Her pose is always planted or in motion; never floating.
- **Custodians:** low, segmented, plated shells with one horizontal sensor slit. Danger light leaks from the seams. Always lower and wider than Kes.
- **Meridian tech:** hard and angular: grates, struts, amber lamps.
- **Aurai and crystal:** faceted clusters and hanging crystal roots.
- **The Lantern (Kes's ship):** a boxy courier hull with a cockpit canopy, a dorsal spine with the amber "lantern" beacon it is named for, a swept wing, twin engine pods and a tail fin.
- **Platforms:** solid rock reads heavy (thick, lit top, dark face). One-way platforms read thin: grates and catwalks with rails that light passes through.

## 7. Readability rules (checked by the readability review)

1. Kes reads by hue (warm on cool) and by value at 1× on a phone.
2. Only threats use the danger red, and every enemy shows it (eye or seams).
3. Pickups are gold, spinning, glowing and bobbing. Nothing else is gold.
4. Walkable tops are lighter than faces. One-way platforms look different from solid ground.
5. Decor never sits in front of the walk line. Ambient life never goes on walkable tops or near the player's path.
6. Telegraphs change shape and value, not just colour, and last at least 300 ms.
7. Every frame still reads in grayscale (the board has the grayscale copy).

## 8. Ambient life ("alive at the edges")

| Detail | Behaviour | Reduced motion |
| --- | --- | --- |
| Crystal flicker | Each crystal follows its own slow brightness noise: 3–9 s, random phase, ±25% around its base level. Neighbours are never in step. | Steady |
| Crystal flare | Rare: each crystal flares at random every 40–120 s, and may also flare when Kes lands on a nearby platform (ambient, never a reward). Brightness ×2.4 over 0.25 s, then a 1.5 s decay, 6–12 sparks drifting up and a faint glassy chime. At most one flare on screen. | Glow only, no sparks |
| Crystal mites | 15–25 cm dark beetles with two dim teal spots, on cliff faces and undersides only. They crawl in short irregular bursts, freeze, turn, and scatter when Kes comes close. Faint clicks with a cave echo; no collision. | Still |
| Roots | Hang under lips and sway slightly in the wind. | Still |
| Lantern wreck | Slow smoke stream, an irregular fire glow, emergency lamps that sometimes stutter. | Smoke still |
| The giant | A colossal Custodian far off in the haze, seen against the star's glow. It drifts across the far layer rarely (at most once every few minutes, chosen levels only). Silent, never an entity, never lit, never red. | Absent |
| Ambience | A sparse bed (wind, a distant low hum, cave room tone), echoing details (mite clicks, drips) and crisp foreground sound effects. | n/a |

## 9. Animation targets (B2a)

- **Kes:**
  - Frame counts: idle 16, run 16, jump rise 4, apex 4, fall 4, land 6, wall slide 4, wall jump 6, jetpack 6, dash 6, hurt 4, death 12, revive 12.
  - Cycles play at 24–30 fps. The game moves sprites between simulation ticks at the display rate (60/90/120 Hz), so motion stays smooth.
  - Procedural layers on top: squash and stretch, lean, recoil, visor aim. PartRig (spec §9.4) comes later.
- **Crawler:** walk 12, alert 6, telegraph 6 (at least 300 ms), charge 8, hurt 4, death 12.
- **Star Shard:**
  - A 24-frame 3D spin at 12 fps (one turn every 2 s), bobbing ±3 u, with a soft glow pulse.
  - On pickup: a small burst, then a light streak flies to the HUD counter (0.45 s ease-in) and the counter pops.
  - The pickup sound rises in pitch through a chain.

## 10. Technical rules (engine-faithful)

- **Scale:** 1.8 m = 104 u, so 1080p shows 1080 u. Sprites render at 2× density, and the play plane is supersampled ×2.
- **Engine-faithful lookdev:** a lookdev frame may only use what the game draws:
  - a painted sky;
  - fogged parallax layers;
  - the play plane;
  - `flipX` sprites;
  - contact shadows;
  - additive shafts, motes and flares;
  - smoke particles;
  - the blurred foreground;
  - the post chain;
  - the HUD.
- **Engine pieces (built in B1b):**
  - the screen-space rim toward the light;
  - fog sheets between layers;
  - shafts, motes, per-foot contact shadows;
  - the post chain per quality tier (bloom, grade, vignette, fine grain or dither);
  - the crystal flicker and flare system, ambient mites, smoke, the giant.
  - Each piece is off or simplified on the Battery tier, and safe under reduced motion.
- **Budgets:** spec §9.5 still applies (atlases ≤ 2048 px a side, effect caps 300/600/1200).
- **Tools:** the studio kit `tools/blender/studio/` and `qa.py` for checks. Lookdev is `npm run art:lookdev`.

## 11. Never

- Neon magenta or cyan palettes, or flat neon anywhere.
- All-round outlines or glows on characters.
- Blinking or flicker in sync.
- Pure-black crush on gameplay surfaces.
- Red on anything that isn't a threat.
- Life on walkable tops.
- AI-generated images.
- Detail that fights the silhouette.

## 12. Change log

- **v1 (2026-11-28, B1a):** locked from the style test (look B), with the owner's feedback:
  - warm suit and no outline;
  - planted feet;
  - cracked ground and a crumbling edge;
  - a recognisable Lantern wreck;
  - crystal flicker and flares, mites, the giant;
  - finer grain.
