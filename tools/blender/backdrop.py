"""Megastructure skyline: 1024 x 512 px, transparent sky, seamless left-right, bottom anchored (ParallaxView)."""

import math
import os
import random

import bpy

import common as C

W, H = 1024, 512
SPAN = 32.0  # BU across the image (32 px per BU)


def bake(out_dir, tmp_dir):
    C.reset_scene()
    scene = bpy.context.scene
    scene.cycles.samples = 64
    rng = random.Random(7)
    hull = C.material('hull', C.ABYSSAL_NAVY, rough=0.6, metal=0.2)
    hull2 = C.material('hull2', C.SLATE_HULL, rough=0.5, metal=0.25)
    window_c = C.material('win_c', C.CYAN, emit=C.CYAN, emit_strength=3.0)
    window_g = C.material('win_g', C.GOLD, emit=C.GOLD, emit_strength=3.0)
    beacon = C.material('beacon', C.CRIMSON, emit=C.CRIMSON, emit_strength=6.0)
    half = SPAN / 2
    top = H / W * SPAN
    # Base deck and a girder: uniform along X and wider than the image, so the seam is invisible.
    C.cube('deck', (SPAN * 3, 4.0, 1.4), (0, 0, 0.7), hull, subdiv=0)
    C.cube('deck_lip', (SPAN * 3, 4.2, 0.12), (0, -0.05, 1.42), hull2, subdiv=0)
    C.cube('girder', (SPAN * 3, 0.6, 0.18), (0, 1.2, 6.2), hull2, subdiv=0)
    # Towers stay inside the image with a margin, so nothing is cut at the left and right edges.
    x = -half + 1.6
    while x < half - 2.5:
        w = rng.uniform(0.9, 2.4)
        h = rng.uniform(2.2, 8.5)
        depth = rng.uniform(1.0, 3.0)
        mat = hull if rng.random() < 0.6 else hull2
        C.cube('tower', (w, depth, h), (x + w / 2, rng.uniform(0.5, 2.5), 1.4 + h / 2), mat, subdiv=1, bevel=0.06)
        if rng.random() < 0.5:
            C.cube('cap', (w * 0.6, depth * 0.6, 0.6), (x + w / 2, 0.8, 1.4 + h + 0.3), hull2, subdiv=1, bevel=0.05)
        if rng.random() < 0.55:
            C.cylinder('spire', 0.05, 2.2, (x + w / 2, 0.6, 1.4 + h + 1.1), mat=hull2, verts=8)
            C.sphere('beacon', 0.09, (x + w / 2, 0.55, 1.4 + h + 2.25), mat=beacon)
        # Window rows facing the camera.
        rows = int(h / 0.6)
        for r in range(rows):
            if rng.random() < 0.45:
                continue
            wz = 1.4 + 0.5 + r * 0.6
            if wz > 1.4 + h - 0.4:
                break
            n = max(1, int(w / 0.35))
            for k in range(n):
                if rng.random() < 0.55:
                    continue
                wx = x + 0.2 + k * (w - 0.3) / n
                C.cube('win', (0.12, 0.05, 0.08), (wx, -depth / 2 + 0.6, wz), window_c if rng.random() < 0.75 else window_g,
                       subdiv=0)
        x += w + rng.uniform(0.15, 1.6)
    C.lights(key=0.8, rim=1.6, rim_color=C.VIOLET, fill=0.4)
    C.ortho_camera((0, 0, top / 2), SPAN, (W, H), fit='HORIZONTAL')
    path = os.path.join(out_dir, 'bg_megastructure.png')
    C.render_to(path)
    return {'bg_megastructure': [W, H]}
