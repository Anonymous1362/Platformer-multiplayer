"""Crawler (beetle drone) walk cycle: 8 frames of 144 x 104 px (72 x 52 u at 2x), facing right, feet on the bottom row."""

import math
import os

import bpy

import common as C

FRAME_W, FRAME_H = 144, 104
FRAMES = 8
ORTHO = 2.5  # horizontal fit: 2.5 BU across 144 px
BODY_Z = 0.62


def build():
    shell = C.material('shell', '#5B21B6', rough=0.28, metal=0.15, coat=1.0)
    plate = C.material('plate', C.SLATE_HULL, rough=0.45, metal=0.2)
    steel = C.material('steel', C.COOL_STEEL, rough=0.35, metal=0.5)
    gold = C.material('gold', C.GOLD, rough=0.3, metal=0.7, emit=C.GOLD, emit_strength=0.15)
    eye = C.material('eye', C.CRIMSON, emit=C.CRIMSON, emit_strength=3.0)
    seam = C.material('seam', C.CRIMSON, emit=C.CRIMSON, emit_strength=3.0)

    root = C.joint('root', (0, 0, BODY_Z))
    C.sphere('dome', 0.62, (-0.08, 0, BODY_Z + 0.06), (1.25, 0.95, 0.74), shell, root)
    C.sphere('belly', 0.56, (-0.06, 0, BODY_Z - 0.06), (1.2, 0.9, 0.36), plate, root)
    C.torus('seam_ring', 0.66, 0.018, (-0.08, 0, BODY_Z + 0.02), rot=(0, 0, 0), mat=seam, parent=root)
    bpy.context.active_object.scale = (1.18, 0.9, 1)
    C.cube('ridge', (1.0, 0.06, 0.05), (-0.12, 0, BODY_Z + 0.5), gold, root, subdiv=1, bevel=0.02)
    for k, x in enumerate((-0.5, -0.1, 0.28)):
        C.sphere(f'spot{k}', 0.07, (x, -0.5 + 0.06 * abs(x), BODY_Z + 0.22), (1, 0.5, 1), seam, root)
    head = C.joint('head', (0.62, 0, BODY_Z), root)
    C.sphere('head', 0.27, (0.7, 0, BODY_Z + 0.02), (1.0, 1.05, 0.85), plate, head)
    C.sphere('eye', 0.11, (0.92, -0.08, BODY_Z + 0.06), mat=eye, parent=head)
    C.sphere('eye2', 0.06, (0.9, 0.1, BODY_Z + 0.1), mat=eye, parent=head)
    for y in (-0.12, 0.12):
        m = C.cylinder('mandible', 0.03, 0.26, (0.98, y, BODY_Z - 0.1), rot=(0, math.radians(70), 0),
                       mat=steel, parent=head)
    C.cylinder('antenna', 0.015, 0.36, (0.66, 0.08, BODY_Z + 0.36), rot=(0, math.radians(30), 0),
               mat=steel, parent=head)
    C.sphere('antenna_tip', 0.035, (0.75, 0.08, BODY_Z + 0.52), mat=eye, parent=head)

    legs = []
    for i, (x, reach) in enumerate(((0.42, 0.34), (-0.05, 0.0), (-0.52, -0.34))):
        for side, y in (('r', -0.38), ('l', 0.38)):
            hip_loc = (x, y, BODY_Z - 0.06)
            knee_loc = (x + reach * 0.5, y * 1.55, BODY_Z + 0.24)
            foot_loc = (x + reach, y * 1.8, 0.02)
            hip = C.joint(f'hip_{i}{side}', hip_loc, root)
            C.sphere('hip_ball', 0.075, hip_loc, mat=gold, parent=hip)
            C.limb('upper', hip_loc, knee_loc, 0.05, steel, hip)
            C.sphere('knee_ball', 0.06, knee_loc, mat=plate, parent=hip)
            C.limb('lower', knee_loc, foot_loc, 0.04, steel, hip)
            C.sphere('foot', 0.05, foot_loc, mat=plate, parent=hip)
            legs.append((hip, i, side))
    return root, head, legs


def bake(out_dir, tmp_dir):
    C.reset_scene()
    scene = bpy.context.scene
    root, head, legs = build()
    C.lights(key=1.0, rim=1.2, rim_color=C.VIOLET)
    C.ortho_camera((0, 0, (FRAME_H / FRAME_W) * ORTHO / 2 - 0.03), ORTHO, (FRAME_W, FRAME_H), fit='HORIZONTAL')
    root.rotation_euler = (0, 0, math.radians(-18))
    paths = []
    for f in range(FRAMES):
        ph = 2 * math.pi * f / FRAMES
        root.location = (0, 0, BODY_Z + 0.025 * math.cos(2 * ph))
        head.rotation_euler = (0, math.radians(3 * math.sin(ph)), 0)
        for hip, i, side in legs:
            # Tripod gait: front-right, middle-left, back-right move together.
            group = (i + (0 if side == 'r' else 1)) % 2
            a = ph + (math.pi if group else 0)
            swing = 22 * math.sin(a)
            raise_ = 14 * max(0.0, math.cos(a))
            hip.rotation_euler = (math.radians(raise_ if side == 'l' else -raise_), 0, math.radians(swing))
        path = os.path.join(tmp_dir, f'crawler_{f:02d}.png')
        C.render_to(path)
        paths.append(path)
    size = C.pack_grid(paths, FRAMES, os.path.join(out_dir, 'enemy_crawler.png'))
    return {'enemy_crawler': size}
