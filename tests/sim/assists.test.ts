import { describe, expect, it } from 'vitest';
import { GameConfig } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import { ReplayRecorder, runReplay, validateReplay } from '../../src/core/Replay';
import { NO_ASSISTS, type Assists } from '../../src/core/SimulationTypes';
import { hashWorld } from '../../src/core/StateHash';
import { createWorld, setupFor } from '../../src/core/WorldSimulation';
import { flatLevel, Harness, input, makeLevel } from '../fixtures/levels';

/** Spec 3.4: assists that change the simulation travel in the setup, so replays stay deterministic. */

const SPIKE_ROOM = makeLevel(
  [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '########^^^#########',
    '####################',
  ],
  { spawn: [2, 8] },
);

const H = GameConfig.health;
const JUMP = input({ held: Button.Jump });
const with_ = (a: Partial<Assists>): Assists => ({ ...NO_ASSISTS, ...a });

function spikeHit(assists?: Assists): Harness {
  const h = new Harness(SPIKE_ROOM, 1, 1, 'normal', assists);
  h.run(120);
  h.until((s) => s.player.mode === 'hazardRespawn', input({ moveX: 1 }));
  return h;
}

describe('assists (spec 3.4)', () => {
  it('without assists, spikes deal hazard damage', () => {
    const h = spikeHit();
    expect(h.player.shield).toBe(H.baseShield - GameConfig.hazard.damage);
  });

  it('"hazard respawn without damage" still respawns, but deals no damage', () => {
    const h = spikeHit(with_({ hazardNoDamage: true }));
    expect(h.player.mode).toBe('hazardRespawn');
    expect(h.player.shield).toBe(H.baseShield);
    expect(h.player.hp).toBe(H.baseHp);
    const hit = h.events.find((e) => e.type === 'hazardHit');
    expect(hit && 'damage' in hit ? hit.damage : -1).toBe(0);
  });

  it('invulnerability blocks hazard damage too', () => {
    const h = spikeHit(with_({ invulnerable: true }));
    expect(h.player.shield).toBe(H.baseShield);
  });

  it('infinite fuel: the jetpack never drains', () => {
    const h = new Harness(flatLevel(), 1, 1, 'normal', with_({ infiniteFuel: true }));
    h.step(JUMP);
    let thrust = 0;
    for (let i = 0; i < 200 && !h.player.grounded; i += 1) {
      h.step(JUMP);
      if (h.player.jetpacking) thrust += 1;
    }
    expect(thrust).toBeGreaterThan(60); // longer than a full tank (60 ticks)
    expect(h.player.fuelS).toBe(GameConfig.player.jetpack.baseFuelS);
  });

  it('no assists hashes exactly like a setup without the field (older replays keep their hashes)', () => {
    const level = flatLevel();
    const plain = createWorld(setupFor(level, { seed: 3, difficulty: 'normal', playerCount: 1 }), level);
    const none = createWorld(
      setupFor(level, { seed: 3, difficulty: 'normal', playerCount: 1, assists: NO_ASSISTS }),
      level,
    );
    const on = createWorld(
      setupFor(level, {
        seed: 3,
        difficulty: 'normal',
        playerCount: 1,
        assists: with_({ infiniteFuel: true }),
      }),
      level,
    );
    expect(hashWorld(none)).toBe(hashWorld(plain));
    expect(hashWorld(on)).not.toBe(hashWorld(plain));
  });

  it('replays carry assists and re-simulate to the same hash', () => {
    const level = flatLevel();
    const setup = setupFor(level, {
      seed: 5,
      difficulty: 'normal',
      playerCount: 1,
      assists: with_({ infiniteFuel: true }),
    });
    const h = new Harness(level, 1, 5, 'normal', with_({ infiniteFuel: true }));
    const recorder = new ReplayRecorder(setup);
    for (let i = 0; i < 180; i += 1) {
      const frame = i < 150 ? JUMP : input();
      recorder.record([frame]);
      h.step(frame);
      recorder.afterStep(h.world);
    }
    const replay = recorder.finish(hashWorld(h.world));
    const parsed = validateReplay(JSON.parse(JSON.stringify(replay)) as unknown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.replay.setup.assists).toEqual(with_({ infiniteFuel: true }));
    expect(runReplay(parsed.replay, level).finalHash).toBe(replay.finalHash);
  });

  it('a malformed assists block is refused', () => {
    const level = flatLevel();
    const setup = setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 });
    const recorder = new ReplayRecorder(setup);
    const h = new Harness(level);
    recorder.record([input()]);
    h.step();
    recorder.afterStep(h.world);
    const replay = JSON.parse(JSON.stringify(recorder.finish(hashWorld(h.world)))) as {
      setup: Record<string, unknown>;
    };
    replay.setup['assists'] = { invulnerable: 'yes' };
    expect(validateReplay(replay).ok).toBe(false);
  });
});
