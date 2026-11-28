"""Automatic QA for baked sprite sheets (the "technical" lens of the production workflow).

    python3 -I tools/blender/studio/qa.py SHEET.png --cell 128x208 [--frames 28] [--feet 3] [--grounded 0-15]
                                          [--max 2048]

Checks, each reported as pass/fail with numbers, as JSON:
- size: the sheet divides into whole cells and stays within the atlas budget (default 2048 px a side);
- frames: the expected number of non-empty cells, and no non-empty cell after the last frame;
- feet: in every grounded frame (`--grounded` ranges such as 0-15,24; default all) the lowest opaque row
  sits `--feet` px above the cell bottom (±1 px), so the character stands on the same line in every
  pose; airborne frames are exempt (skip entirely with --feet -1 for pickups and effects);
- fringe: semi-transparent edge pixels are not darker than the opaque interior (no dark halo from
  un-premultiplied edges);
- clipped: no frame touches the cell's top, left or right border (a part cut off by the camera);
- sha256: the file hash, so a second bake can prove determinism.
Exit code 1 if any check fails.
"""

import hashlib
import json
import sys

import numpy as np
from PIL import Image


def parse(argv):
    opts = {'cell': None, 'frames': None, 'feet': 3, 'max': 2048, 'grounded': None}
    path = None
    it = iter(argv)
    for a in it:
        if a == '--cell':
            w, h = next(it).lower().split('x')
            opts['cell'] = (int(w), int(h))
        elif a in ('--frames', '--feet', '--max'):
            opts[a[2:]] = int(next(it))
        elif a == '--grounded':
            idx = set()
            for part in next(it).split(','):
                lo, _, hi = part.partition('-')
                idx.update(range(int(lo), int(hi or lo) + 1))
            opts['grounded'] = idx
        else:
            path = a
    if not path or not opts['cell']:
        raise SystemExit(__doc__)
    return path, opts


def check(path, cell, frames=None, feet=3, max_side=2048, grounded=None):
    img = np.asarray(Image.open(path).convert('RGBA'), dtype=np.float32) / 255.0
    H, W = img.shape[:2]
    cw, ch = cell
    out = {'file': path, 'size_px': [W, H], 'checks': {}}
    c = out['checks']
    c['size'] = {'pass': W % cw == 0 and H % ch == 0 and max(W, H) <= max_side,
                 'detail': f'{W}x{H}, cell {cw}x{ch}, budget {max_side}'}
    cols, rows = W // cw, H // ch
    alpha = img[..., 3]
    nonempty, feet_rows, clipped = [], [], []
    for r in range(rows):
        for k in range(cols):
            a = alpha[r * ch:(r + 1) * ch, k * cw:(k + 1) * cw]
            opaque = a > 0.5
            if not opaque.any():
                nonempty.append(False)
                continue
            nonempty.append(True)
            ys = np.nonzero(opaque.any(axis=1))[0]
            xs = np.nonzero(opaque.any(axis=0))[0]
            feet_rows.append(int(ch - 1 - ys.max()))
            if ys.min() == 0 or xs.min() == 0 or xs.max() == cw - 1:
                clipped.append(r * cols + k)
    count = sum(nonempty)
    last = max((i for i, v in enumerate(nonempty) if v), default=-1)
    c['frames'] = {'pass': (frames is None or count == frames) and last == count - 1,
                   'detail': f'{count} non-empty cells, last at {last}' + (f', expected {frames}' if frames else '')}
    if feet >= 0:
        bad = [i for i, f in enumerate(feet_rows) if (grounded is None or i in grounded) and abs(f - feet) > 1]
        c['feet'] = {'pass': not bad, 'detail': f'feet gap per frame {feet_rows}; off by >1 px: {bad}'}
    c['clipped'] = {'pass': not clipped, 'detail': f'frames touching the cell border: {clipped}'}
    rgb = img[..., :3]
    luma = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    edge = (alpha > 0.05) & (alpha < 0.6)
    inner = alpha > 0.95
    if edge.any() and inner.any():
        e, i = float(luma[edge].mean()), float(luma[inner].mean())
        c['fringe'] = {'pass': e >= i * 0.55, 'detail': f'edge luma {e:.3f} vs interior {i:.3f}'}
    with open(path, 'rb') as fh:
        out['sha256'] = hashlib.sha256(fh.read()).hexdigest()
    out['pass'] = all(v['pass'] for v in c.values())
    return out


def main(argv):
    path, o = parse(argv)
    result = check(path, o['cell'], o['frames'], o['feet'], o['max'], o['grounded'])
    print(json.dumps(result, indent=2))
    return 0 if result['pass'] else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
