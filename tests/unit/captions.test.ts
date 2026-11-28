import { describe, expect, it } from 'vitest';
import {
  CAPTION_KEYS,
  CAPTION_MS,
  CaptionQueue,
  captionDirection,
  MAX_CAPTIONS,
} from '../../src/audio/Captions';
import { recipeFor, type SfxKey } from '../../src/audio/SynthRecipes';
import en from '../../content/locale/en.json';

describe('sound captions (spec 7.5)', () => {
  it('every captioned sound exists and every caption has a string', () => {
    for (const [sfx, key] of Object.entries(CAPTION_KEYS)) {
      expect(recipeFor(sfx as SfxKey), sfx).toBeDefined();
      expect(Object.keys(en), key).toContain(key);
    }
  });

  it('arrows only when the source is off screen', () => {
    expect(captionDirection(500, 500, 1000)).toBeNull();
    expect(captionDirection(-1, 500, 1000)).toBe('left');
    expect(captionDirection(1001, 500, 1000)).toBe('right');
    expect(captionDirection(undefined, 500, 1000)).toBeNull();
  });

  it('a repeated sound refreshes its line; at most three lines; lines expire', () => {
    const q = new CaptionQueue();
    q.add('a', null, 0);
    q.add('a', 'left', 1000);
    expect(q.visible(1000)).toHaveLength(1);
    expect(q.visible(1000)[0]?.direction).toBe('left');
    q.add('b', null, 1000);
    q.add('c', null, 1000);
    q.add('d', null, 1000);
    expect(q.visible(1000).map((l) => l.key)).toEqual(['b', 'c', 'd']);
    expect(q.visible(1000)).toHaveLength(MAX_CAPTIONS);
    expect(q.visible(1000 + CAPTION_MS)).toHaveLength(0);
  });
});
