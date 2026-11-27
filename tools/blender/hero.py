"""Hero astronaut (Kes) as a frame sheet: body pass + slot-accent mask pass.

Layout must match `HERO_ANIMS` in src/render/world/SpriteSheets.ts (8 columns, frames row-major).
Frames are 128 x 208 px (2x texture density for a 64 x 104 u sprite), feet on the bottom row.
"""

import math
import os

import bpy

import common as C

FRAME_W, FRAME_H = 128, 208
COLS = 8
HIP_Z = 1.12
# Vertical ortho size: 2.9 BU of character ~ 184 px of the 208 px frame.
ORTHO = 3.28
BOTTOM_MARGIN = 3 / FRAME_H * ORTHO
YAW = -22  # degrees: turn the chest a little toward the camera for the 2.5D read


def build():
    m = {
        'ceramic': C.material('ceramic', C.CERAMIC, rough=0.32, coat=0.4),
        'gunmetal': C.material('gunmetal', C.GUNMETAL, rough=0.42, metal=0.25, coat=0.3),
        'steel': C.material('steel', C.COOL_STEEL, rough=0.38, metal=0.35),
        'gold': C.material('gold', C.GOLD, rough=0.3, metal=0.7, emit=C.GOLD, emit_strength=0.15),
        'visor': C.material('visor', '#0B3B46', rough=0.05, coat=1.0, emit=C.CYAN, emit_strength=0.55),
        'glow': C.material('glow', C.CYAN, rough=0.3, emit=C.CYAN, emit_strength=6.0),
        'accent': C.material('accent', '#9AA3AE', rough=0.35, coat=0.3),
        'glint': C.material('glint', '#FFFFFF', emit='#FFFFFF', emit_strength=4.0),
    }
    J = {}
    root = C.joint('root', (0, 0, HIP_Z))
    J['root'] = root
    C.cube('pelvis', (0.46, 0.44, 0.3), (0, 0, HIP_Z + 0.04), m['gunmetal'], root, bevel=0.06)
    C.cube('belt', (0.5, 0.48, 0.08), (0, 0, HIP_Z + 0.16), m['gold'], root, subdiv=1, bevel=0.03)

    waist = C.joint('waist', (0, 0, HIP_Z + 0.18), root)
    J['waist'] = waist
    C.cube('torso', (0.6, 0.56, 0.66), (0.02, 0, HIP_Z + 0.52), m['ceramic'], waist, bevel=0.12)
    C.cube('chest_band', (0.62, 0.58, 0.1), (0.02, 0, HIP_Z + 0.62), m['accent'], waist, subdiv=1, bevel=0.04)
    C.cube('chest_unit', (0.12, 0.3, 0.22), (0.31, -0.02, HIP_Z + 0.42), m['gunmetal'], waist, subdiv=1, bevel=0.03)
    C.cube('chest_light', (0.04, 0.2, 0.05), (0.38, -0.02, HIP_Z + 0.46), m['glow'], waist, subdiv=0)
    C.cube('chest_light2', (0.04, 0.06, 0.05), (0.38, 0.06, HIP_Z + 0.38), m['gold'], waist, subdiv=0)
    C.cube('side_panel', (0.4, 0.04, 0.4), (0.0, -0.29, HIP_Z + 0.5), m['steel'], waist, subdiv=1, bevel=0.015)
    C.torus('neck_ring', 0.2, 0.05, (0.02, 0, HIP_Z + 0.88), mat=m['gold'], parent=waist)
    # Jetpack
    C.cube('pack', (0.3, 0.5, 0.6), (-0.42, 0, HIP_Z + 0.56), m['gunmetal'], waist, bevel=0.08)
    C.cube('pack_trim', (0.04, 0.52, 0.42), (-0.58, 0, HIP_Z + 0.58), m['gold'], waist, subdiv=1, bevel=0.015)
    C.cube('pack_glow', (0.03, 0.08, 0.3), (-0.6, -0.14, HIP_Z + 0.6), m['glow'], waist, subdiv=0)
    for y in (-0.13, 0.13):
        C.cylinder('nozzle', 0.08, 0.14, (-0.44, y, HIP_Z + 0.22), mat=m['steel'], parent=waist, bevel=0.02)

    head = C.joint('head', (0.02, 0, HIP_Z + 0.9), waist)
    J['head'] = head
    C.sphere('helmet', 0.43, (0.03, 0, HIP_Z + 1.28), (1.0, 0.96, 0.97), m['ceramic'], head)
    C.sphere('visor', 0.34, (0.27, 0, HIP_Z + 1.25), (0.62, 0.84, 0.66), m['visor'], head)
    C.torus('visor_rim', 0.3, 0.035, (0.36, 0, HIP_Z + 1.25), rot=(0, math.radians(90), 0),
            mat=m['gold'], parent=head)
    C.sphere('visor_glint', 0.05, (0.46, -0.12, HIP_Z + 1.36), mat=m['glint'], parent=head)
    C.torus('helmet_band', 0.41, 0.035, (0.03, 0, HIP_Z + 1.3), rot=(math.radians(90), 0, 0),
            mat=m['accent'], parent=head)
    C.cylinder('ear', 0.12, 0.08, (0.0, -0.42, HIP_Z + 1.24), rot=(math.radians(90), 0, 0),
               mat=m['gold'], parent=head, bevel=0.02)
    C.cylinder('antenna', 0.018, 0.3, (-0.22, 0.1, HIP_Z + 1.72), rot=(0, math.radians(-15), 0),
               mat=m['steel'], parent=head)
    C.sphere('antenna_tip', 0.04, (-0.26, 0.1, HIP_Z + 1.86), mat=m['glow'], parent=head)

    for side, y in (('r', -0.4), ('l', 0.4)):
        sh = C.joint('sh_' + side, (0.02, y, HIP_Z + 0.78), waist)
        J['sh_' + side] = sh
        C.sphere('pad_' + side, 0.17, (0.02, y, HIP_Z + 0.8), (1.1, 1, 0.9), m['accent'], sh)
        C.capsule('upper_arm_' + side, 0.1, 0.4, (0.02, y, HIP_Z + 0.74), m['ceramic'], sh)
        el = C.joint('el_' + side, (0.02, y, HIP_Z + 0.36), sh)
        J['el_' + side] = el
        C.capsule('fore_arm_' + side, 0.095, 0.34, (0.02, y, HIP_Z + 0.38), m['ceramic'], el)
        C.torus('cuff_' + side, 0.1, 0.03, (0.02, y, HIP_Z + 0.12), mat=m['gold'], parent=el)
        C.sphere('glove_' + side, 0.1, (0.03, y, HIP_Z + 0.02), (1, 0.9, 1.1), m['gunmetal'], el)

        hip = C.joint('hip_' + side, (0, y * 0.4, HIP_Z), root)
        J['hip_' + side] = hip
        C.capsule('thigh_' + side, 0.14, 0.48, (0, y * 0.4, HIP_Z + 0.02), m['ceramic'], hip)
        kn = C.joint('kn_' + side, (0, y * 0.4, HIP_Z - 0.46), hip)
        J['kn_' + side] = kn
        C.sphere('knee_' + side, 0.13, (0.05, y * 0.4, HIP_Z - 0.46), (0.9, 1, 1), m['accent'], kn)
        C.capsule('shin_' + side, 0.125, 0.42, (0, y * 0.4, HIP_Z - 0.46), m['ceramic'], kn)
        an = C.joint('an_' + side, (0, y * 0.4, HIP_Z - 0.9), kn)
        J['an_' + side] = an
        C.cube('boot_' + side, (0.36, 0.22, 0.2), (0.06, y * 0.4, HIP_Z - 1.0), m['gunmetal'], an, bevel=0.06)
        C.cube('sole_' + side, (0.38, 0.23, 0.04), (0.06, y * 0.4, HIP_Z - 1.09), m['gold'], an,
               subdiv=1, bevel=0.015)
    root.rotation_euler = (0, 0, math.radians(YAW))
    return J, m


def fwd(deg):
    """Swing forward (+X) around the joint's Y axis."""
    return -math.radians(deg)


def tilt(deg):
    """Lean an upward-pointing part (torso, head) forward."""
    return math.radians(deg)


def back(deg):
    return math.radians(deg)


def ankle_level(thigh, knee, tilt=-4.0):
    """Ankle swing that keeps the boot near level for a thigh swing and knee bend (degrees)."""
    return knee - thigh + tilt


def leg(p, side, thigh, knee, ankle=None):
    p['hip_' + side] = fwd(thigh)
    p['kn_' + side] = back(knee)
    p['an_' + side] = fwd(ankle if ankle is not None else ankle_level(thigh, knee))


def arm(p, side, swing, elbow):
    p['sh_' + side] = fwd(swing)
    p['el_' + side] = fwd(elbow)


def pose_for(name, i):
    p = {}
    lift = 0.0
    lean = 0.0
    grounded = name in ('idle', 'run')
    if name == 'idle':
        b = math.sin(2 * math.pi * i / 8)
        p['waist'] = tilt(2 + 1.4 * b)
        p['head'] = tilt(-1.5 * b)
        arm(p, 'r', 6 + 2.5 * b, 16)
        arm(p, 'l', -6 - 2.5 * b, 12)
        leg(p, 'r', 5, 8 + 2 * b)
        leg(p, 'l', -7, 10 + 2 * b)
    elif name == 'run':
        ph = 2 * math.pi * i / 8
        s, c = math.sin(ph), math.cos(ph)
        leg(p, 'r', 40 * s, 14 + 70 * max(0.0, c))
        leg(p, 'l', -40 * s, 14 + 70 * max(0.0, -c))
        arm(p, 'r', -38 * s, 60)
        arm(p, 'l', 38 * s, 60)
        p['waist'] = tilt(11)
        p['head'] = tilt(-7)
    elif name == 'rise':
        k = i
        leg(p, 'r', 42 - 8 * k, 72 - 10 * k)
        leg(p, 'l', -18 + 4 * k, 36 - 4 * k)
        arm(p, 'r', 130 + 10 * k, 30)
        arm(p, 'l', -30 - 6 * k, 22)
        p['waist'] = tilt(6)
        p['head'] = tilt(-8)
    elif name == 'fall':
        k = 1 if i else -1
        leg(p, 'r', 16, 28)
        leg(p, 'l', -12, 44)
        arm(p, 'r', 100 + 8 * k, 22)
        arm(p, 'l', 70 - 8 * k, 26)
        p['waist'] = tilt(-3)
        p['head'] = tilt(4)
    elif name == 'dash':
        leg(p, 'r', -34 - 4 * i, 18)
        leg(p, 'l', 48 + 3 * i, 86)
        arm(p, 'r', -58 - 5 * i, 24)
        arm(p, 'l', -74 + 4 * i, 18)
        p['waist'] = tilt(12)
        p['head'] = tilt(-26)
        lean = 26
        lift = 0.1
    elif name == 'wall':
        leg(p, 'r', 52, 84)
        leg(p, 'l', 12, 52)
        arm(p, 'r', 96, 10)
        arm(p, 'l', 58, 30)
        p['waist'] = tilt(-6)
        p['head'] = tilt(6)
    elif name == 'hurt':
        leg(p, 'r', 26, 32)
        leg(p, 'l', -12, 24)
        arm(p, 'r', 64 + 8 * i, 52)
        arm(p, 'l', 42 + 6 * i, 40)
        p['waist'] = tilt(-16 - 6 * i)
        p['head'] = tilt(-14)
        lift = 0.04
    elif name == 'jet':
        leg(p, 'r', 10 + 4 * i, 26)
        leg(p, 'l', 0 + 4 * i, 32)
        arm(p, 'r', -18, 22)
        arm(p, 'l', -26, 16)
        p['waist'] = tilt(8)
        p['head'] = tilt(-4)
    return p, lift, lean, grounded


ANIMS = [('idle', 8), ('run', 8), ('rise', 2), ('fall', 2), ('dash', 3), ('wall', 1), ('hurt', 2), ('jet', 2)]


def apply(J, pose, lift, lean, grounded):
    for name, obj in J.items():
        if name == 'root':
            continue
        obj.rotation_euler = (0, pose.get(name, 0.0), 0)
    J['root'].rotation_euler = (0, tilt(lean), math.radians(YAW))
    J['root'].location = (0, 0, HIP_Z + lift)
    bpy.context.view_layer.update()
    if grounded:
        low = min(
            (obj.matrix_world @ v.co).z
            for obj in bpy.data.objects
            if obj.name.startswith('sole_')
            for v in obj.data.vertices
        )
        J['root'].location = (0, 0, HIP_Z + lift - low + 0.0)
        bpy.context.view_layer.update()


def set_pass(mats, accent_pass):
    """Accent pass: only accent parts, lit white; everything else holds out (occludes, transparent)."""
    hold = bpy.data.materials.get('holdout') or C.holdout_material()
    white = bpy.data.materials.get('accent_white') or C.material('accent_white', '#F4F6F8', rough=0.35, coat=0.3)
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        base = obj.get('base_mat')
        if base is None:
            obj['base_mat'] = obj.data.materials[0].name
            base = obj['base_mat']
        if accent_pass:
            mat = white if base == 'accent' else hold
        else:
            mat = bpy.data.materials[base]
        obj.data.materials[0] = mat


def bake(out_dir, tmp_dir):
    C.reset_scene()
    scene = bpy.context.scene
    J, mats = build()
    C.lights(key=1.0, rim=1.0)
    C.ortho_camera((0, 0, ORTHO / 2 - BOTTOM_MARGIN), ORTHO, (FRAME_W, FRAME_H))
    body, accent = [], []
    index = 0
    for name, count in ANIMS:
        for i in range(count):
            pose, lift, lean, grounded = pose_for(name, i)
            apply(J, pose, lift, lean, grounded)
            for accent_pass, bucket, tag in ((False, body, 'body'), (True, accent, 'accent')):
                set_pass(mats, accent_pass)
                path = os.path.join(tmp_dir, f'hero_{tag}_{index:02d}.png')
                scene.cycles.samples = 48 if not accent_pass else 24
                C.render_to(path)
                bucket.append(path)
            index += 1
    size = C.pack_grid(body, COLS, os.path.join(out_dir, 'char_hero.png'))
    C.pack_grid(accent, COLS, os.path.join(out_dir, 'char_hero_accent.png'))
    return {'char_hero': size, 'char_hero_accent': size, 'frames': index}
