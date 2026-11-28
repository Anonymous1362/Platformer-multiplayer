export const meta = {
  name: 'art-ui-b-production',
  description:
    'Art & UI B production batch: build assets with the studio kit, QA through three review lenses, fix, integrate once, verify adversarially',
  whenToUse:
    'After B1b (engine proof) is approved. One batch per run: args { batch: "B2a" | "B2b" | "B2c" | "B2d" | "B2e" } (look B is locked). See docs/ART_UI_B_PLAN.md.',
  phases: [
    { title: 'Build', detail: 'one agent per asset job; disjoint files' },
    { title: 'QA', detail: 'bible, readability, and technical lenses per asset' },
    { title: 'Fix', detail: 'at most two rounds per asset' },
    { title: 'Integrate', detail: 'single writer for shared files; npm run verify' },
    { title: 'Verify', detail: 'engine match, regression, performance, consistency' },
  ],
};

// Look B is locked (docs/ART_BIBLE.md). Job specs follow the Art Bible and docs/ART_UI_B_PLAN.md §4 and §9;
// finalize slot colours and shared style tokens in B1b before running B2.

const RULES = [
  'You are on the Cosmic Drift production crew (Art & UI B). Read docs/ART_UI_B_PLAN.md and docs/ART_BIBLE.md first.',
  'Build only with the studio kit in tools/blender/studio (stage, figure, shapes, mats, comp, looks); never add a new pipeline.',
  'Match the locked lookdev frame docs/art/look-lock/look-<LOOK>-v2.png and the templates in tools/blender/lookdev (kes.py, custodian.py, kepler.py, look_lock.py).',
  'Write ONLY the files listed under "owns". Never edit shared files (public/assets/ASSET_MANIFEST.json, src/render/world/SpriteSheets.ts, src/render/world/TextureKeys.ts, src/theme/ThemePalette.ts, docs/CREDITS.md); describe the changes they need in "integration" instead.',
  'Everything deterministic: seeded randomness only; a second bake must give identical pixels.',
  'Render with python3 -I; quick mode while iterating, full quality for the final output.',
  'Always write a contact sheet and a grayscale copy next to your outputs and list them.',
  'Never claim a result you did not produce by running the command. Do not commit or push.',
].join('\n');

const BATCHES = {
  B2a: [
    {
      id: 'kes',
      owns: ['tools/blender/assets/kes.py', 'public/assets/global/char_kes*.png'],
      spec: 'Kes body sheet and slot-accent mask from the lookdev v3 model: idle 8, run 8, jump rise 2, apex 2, fall 2, land 3, wall slide 2, wall jump 3, jetpack 2, dash 3, hurt 2, death 8, revive 6. Cells 2x density, feet on the bottom row, flip-safe sprite rig.',
    },
    {
      id: 'crawler',
      owns: ['tools/blender/assets/crawler.py', 'public/assets/global/enemy_crawler*.png'],
      spec: 'Custodian Crawler sheet from the lookdev v3 model: walk 8, alert 4, telegraph 4 (must read in under 300 ms), charge 6, hurt 2, death 8. Facing right, feet on the bottom row.',
    },
    {
      id: 'pickups',
      owns: [
        'tools/blender/assets/pickups.py',
        'public/assets/global/pickup_*.png',
        'public/assets/global/prop_checkpoint*.png',
        'public/assets/global/prop_exit*.png',
      ],
      spec: 'Star Shard spinner (24 frames, 32 u, played at 12 fps: one turn every 2 s), checkpoint beacon (idle 8, activate 8), exit gate (idle 8).',
    },
  ],
  B2b: [
    {
      id: 'tiles',
      owns: ['tools/blender/assets/kepler_tiles.py', 'public/assets/kepler/tiles_*.png'],
      spec: 'Kepler solid-slab tiles (64 u: top, face, edges, corners, extruded side faces per spec 9.3) and the one-way grate set (left, mid, right) with a clearly different silhouette and material.',
    },
    {
      id: 'setpieces',
      owns: ['tools/blender/assets/kepler_props.py', 'public/assets/kepler/prop_*.png'],
      spec: 'Floating islands (3), crystal decor (5), survey beacon, ground detail (cracks, lichen, grit, loose stones, crumbling edge, rubble, hanging roots). Decor sits behind the walk line.',
    },
    {
      id: 'ambient',
      owns: [
        'tools/blender/assets/kepler_life.py',
        'public/assets/kepler/life_*.png',
        'src/render/world/Ambient*.ts',
        'tests/render/ambient*.test.ts',
      ],
      spec: 'Ambient life per Art Bible 8: crystal mites (crawl sheet, short irregular bursts on faces and undersides, scatter near Kes, no collision), the Lantern wreck in the mid layer (smoke stream, irregular fire glow, stuttering lamps), the giant in the far haze (rare, silent, never an entity). Reduced motion: still or absent.',
    },
    {
      id: 'parallax',
      owns: ['tools/blender/assets/kepler_parallax.py', 'public/assets/kepler/bg_*.png'],
      spec: 'Sky with the Heartstar per act colour (spec 2.7), far, mid and near layers tiling horizontally at the 9.3 depth factors, foreground props, fog sheets, mote sprites.',
    },
  ],
  B2c: [
    {
      id: 'post',
      owns: ['src/render/fx/Post*.ts', 'tests/render/post*.test.ts'],
      spec: 'Post chain per quality tier (bloom, grade, vignette, grain) as Phaser 4 filters, off on Battery; reduced-motion safe.',
    },
    {
      id: 'atmosphere',
      owns: ['src/render/world/Atmosphere*.ts', 'tests/render/atmosphere*.test.ts'],
      spec: 'Fog sheets between parallax layers, additive light shafts, motes, contact shadows; visual only, no simulation reads.',
    },
    {
      id: 'crystals',
      owns: ['src/render/world/Crystal*.ts', 'tests/render/crystal*.test.ts'],
      spec: 'Crystal system per Art Bible 8: per-crystal flicker on its own noise (3-9 s, never in step), rare random flares (x2.4, 1.5 s decay, 6-12 sparks; also when Kes lands nearby; one flare on screen at most), reduced-motion variant.',
    },
    {
      id: 'shardflight',
      owns: ['src/render/fx/ShardFlight*.ts', 'tests/render/shardflight*.test.ts'],
      spec: 'Shard pickup: burst, a light streak flies to the HUD shard counter (0.45 s ease-in), the counter pops; render-only, reduced-motion variant (instant count with a soft flash).',
    },
    {
      id: 'combatfx',
      owns: ['src/render/fx/Combat*.ts', 'tests/render/combatfx*.test.ts'],
      spec: 'Rim-light filter for characters, thruster ribbon, dash streak, muzzle flash, hit sparks, shard burst; photosensitivity limits and reduced-motion variants.',
    },
  ],
  B2d: [
    {
      id: 'title',
      owns: ['tools/blender/assets/title.py', 'public/assets/ui/title_*.png', 'src/ui/screens/Title*.tsx'],
      spec: 'Title screen: Blender-rendered backdrop and logo in the locked look; slow parallax; reduced-motion variant.',
    },
    {
      id: 'hud',
      owns: ['src/hud/**'],
      spec: 'HUD as in the lookdev frame: thin segmented health, shield and fuel lines, shard counter; captions and high-contrast mode kept.',
    },
    {
      id: 'menus',
      owns: ['src/ui/tokens.css', 'src/ui/components/**', 'public/assets/ui/icons/**'],
      spec: 'Menu skin, button feedback, icon set (SVG), UI sounds hooks; axe stays clean; motion tokens kept.',
    },
  ],
  B2e: [
    {
      id: 'ambience',
      owns: ['src/audio/Ambience*.ts', 'tests/audio/ambience*.test.ts', 'public/assets/audio/amb_*'],
      spec: 'Ambience bed per level mood (wind, distant hum, cave room tone) with a reverb send for echo; mite clicks, drips, crystal chime and flare; CC0 sources with LICENSES.csv rows, normalized to -16 LUFS.',
    },
    {
      id: 'sfx',
      owns: [
        'public/assets/audio/sfx_jetpack_loop_*',
        'public/assets/audio/sfx_footstep_*',
        'public/assets/audio/sfx_shard_*',
      ],
      spec: 'Recorded jetpack loop (only synthesized today), footsteps per surface (gravel, metal grate), shard pickup chain with rising pitch; keep existing keys and the synth fallback.',
    },
  ],
};

const BUILD = {
  type: 'object',
  properties: {
    job: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    outputs: { type: 'array', items: { type: 'string' } },
    contactSheet: { type: 'string' },
    commands: { type: 'array', items: { type: 'string' }, description: 'commands run, with results' },
    integration: { type: 'string', description: 'changes the integrator must make to shared files' },
    notes: { type: 'string' },
  },
  required: ['job', 'files', 'outputs', 'commands', 'integration'],
};

const REVIEW = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          what: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'what', 'fix'],
      },
    },
    evidence: { type: 'string', description: 'files viewed and commands run' },
  },
  required: ['pass', 'issues', 'evidence'],
};

const LENSES = [
  {
    key: 'bible',
    ask: 'Compare the contact sheet and outputs with docs/ART_BIBLE.md and the locked lookdev frame: palette, light rig, material language, shape language, detail density. Flag anything off-style.',
  },
  {
    key: 'readability',
    ask: 'Review at gameplay scale (1x) and in grayscale: silhouette, value separation from the backgrounds in the lookdev frame, facing at a glance, telegraphs visible, danger colour only on threats.',
  },
  {
    key: 'technical',
    ask: "Run the QA script on the outputs and check sizes, frame counts, feet line, alpha fringe, loop seams, determinism (re-bake hash), texture budget, and the engine's import rules.",
  },
];

const batch = (args && args.batch) || 'B2a';
const look = (args && args.look) || 'B';
const jobs = BATCHES[batch];
if (!jobs) throw new Error(`Unknown batch ${batch}`);
log(`Batch ${batch}, look ${look}: ${jobs.length} jobs`);

const buildPrompt = (job) =>
  `${RULES.replace('<LOOK>', look)}\n\nJOB ${job.id} (${batch}, look ${look})\nowns: ${job.owns.join(', ')}\nspec: ${job.spec}`;

const reviewPrompt = (job, built, lens) =>
  `${RULES.replace('<LOOK>', look)}\n\nREVIEW (${lens.key}) of job ${job.id}. You only read and run checks; you change nothing.\n${lens.ask}\nBuild report: ${JSON.stringify(built)}\nDefault to pass=false when a required output or check is missing.`;

const fixPrompt = (job, built, issues) =>
  `${buildPrompt(job)}\n\nFIX ROUND. Previous report: ${JSON.stringify(built)}\nResolve every P0/P1 issue below, re-run the bake and the checks, and report again.\n${JSON.stringify(issues)}`;

const results = await pipeline(
  jobs,
  (job) => agent(buildPrompt(job), { label: `build:${job.id}`, phase: 'Build', schema: BUILD }),
  async (built, job) => {
    if (!built) return { job: job.id, failed: 'build' };
    let current = built;
    for (let round = 0; round <= 2; round += 1) {
      const reviews = (
        await parallel(
          LENSES.map(
            (lens) => () =>
              agent(reviewPrompt(job, current, lens), {
                label: `review:${job.id}:${lens.key}`,
                phase: 'QA',
                schema: REVIEW,
              }),
          ),
        )
      ).filter(Boolean);
      // A failing lens hands over all its issues; a passing lens only its P0/P1 ones.
      const blocking = reviews.flatMap((r) =>
        r.pass ? r.issues.filter((i) => i.severity !== 'P2') : r.issues,
      );
      if (reviews.length < LENSES.length) {
        blocking.push({ severity: 'P1', what: 'A review lens returned nothing.', fix: 'Re-run the checks.' });
      }
      if (blocking.length === 0) return { job: job.id, built: current, reviews, rounds: round };
      if (round === 2) return { job: job.id, built: current, reviews, rounds: round, unresolved: blocking };
      const fixed = await agent(fixPrompt(job, current, blocking), {
        label: `fix:${job.id}:${round + 1}`,
        phase: 'Fix',
        schema: BUILD,
      });
      if (!fixed) return { job: job.id, built: current, reviews, failed: 'fix' };
      current = fixed;
    }
    return { job: job.id, built: current };
  },
);

const ready = results.filter((r) => r && r.built && !r.unresolved && !r.failed);
const held = results.filter((r) => !r || !r.built || r.unresolved || r.failed);
if (held.length) log(`Held back from integration: ${held.map((r) => (r ? r.job : 'unknown')).join(', ')}`);

phase('Integrate');
const integration = await agent(
  `${RULES.replace('<LOOK>', look)}\n\nINTEGRATOR for ${batch}. You are the only writer of shared files. Apply each job's "integration" notes (manifest entries with sha256 and sizes, sprite-sheet layouts, texture keys, palette tokens, credits and provenance), then run npm run verify and fix what your integration broke. Do not commit.\nJobs: ${JSON.stringify(ready.map((r) => r.built))}`,
  { phase: 'Integrate', schema: BUILD, label: 'integrate' },
);

phase('Verify');
const CHECKS = [
  [
    'engine-match',
    'Run the game, screenshot the test arena at 1920x1080 (Playwright), and compare it with the locked lookdev frame. List every visible difference with its cause.',
  ],
  [
    'regression',
    'Run npm run verify and npm run test:e2e. Golden replays must be unchanged: art never changes the simulation.',
  ],
  [
    'performance',
    'Measure texture memory and atlas sizes against the budget, and frame time in the stress scene; report numbers.',
  ],
  [
    'consistency',
    'Put every output of this batch on one board next to the lookdev frame; flag anything that does not belong to the same game.',
  ],
];
const verdicts = (
  await parallel(
    CHECKS.map(
      ([key, ask]) =>
        () =>
          agent(
            `${RULES.replace('<LOOK>', look)}\n\nVERIFY (${key}) for ${batch} after integration. Try to find what is wrong; default to pass=false if a check cannot run.\n${ask}\nIntegration report: ${JSON.stringify(integration)}`,
            { phase: 'Verify', schema: REVIEW, label: `verify:${key}` },
          ),
    ),
  )
).filter(Boolean);

return { batch, look, results, held: held.map((r) => (r ? r.job : null)), integration, verdicts };
