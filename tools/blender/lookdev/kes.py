"""Kes Arden, lookdev model v3: realistic proportions (1.80 m, about 7 heads), a courier's armoured
flight suit, a narrow wrap-around visor with ORRIN's glow line, a compact twin-pod jetpack, hand blaster.

Built with studio.figure: one continuous skin body (no gaps at joints) driven by FK joints, with fitted
armour plates shrink-wrapped onto it. Poses only rotate joints, so every frame stays on-model.

Design sheet (fixed across looks; only light and grade change per look):
- under-suit: graphite fabric; plates: weathered bone ceramic; boots, gloves, belt, pack: dark composite;
- one accent (shoulder stripes, chest stripe, helmet flash) is the player slot colour (masked in B2);
- silhouette: rounded helmet with jaw guard and short antenna, pack pods behind the shoulders, blaster.

Facing +X, feet at z = 0.
"""

import math

import bpy

from studio import figure as F, mats, shapes as S

SUIT = '#2A2E33'
PLATE = '#B7B2A6'
PLATE_WEAR = '#D9D4C7'
DARK = '#2C3035'
METAL = '#6B7078'
ACCENT = '#B8612E'
GLASS = '#0A0E10'


def materials(look):
    visor, visor_k = look['visor']
    return {
        'suit': mats.surface('kes_suit', SUIT, rough=0.74, variation=0.07, ao=0.35, sheen=0.3, scale=16),
        'plate': mats.surface('kes_plate', PLATE, rough=0.36, coat=0.3, variation=0.06, wear=PLATE_WEAR, ao=0.5,
                              scale=9),
        'dark': mats.surface('kes_dark', DARK, rough=0.5, metal=0.25, variation=0.08, wear='#4A5058', ao=0.45,
                             scale=10),
        'metal': mats.surface('kes_metal', METAL, rough=0.3, metal=0.85, variation=0.06, scale=12),
        'accent': mats.surface('kes_accent', ACCENT, rough=0.42, coat=0.25, variation=0.05, ao=0.3, scale=9),
        'glass': mats.glass('kes_visor', GLASS),
        'glow': mats.emissive('kes_glow', visor, visor_k),
        'port': mats.emissive('kes_port', visor, visor_k * 0.45),
    }


def skeleton():
    """Skin nodes (position, (front-back, side) radii, joint) and edges, at rest."""
    n = [
        ((0, 0, 0.97), (0.11, 0.155), 'root'),        # 0 pelvis (root)
        ((0, 0, 1.08), (0.095, 0.13), 'spine'),       # 1 waist
        ((0.01, 0, 1.22), (0.12, 0.165), 'spine'),   # 2 lower chest
        ((0.015, 0, 1.34), (0.132, 0.188), 'chest'),   # 3 chest
        ((0.0, 0, 1.43), (0.112, 0.162), 'chest'),    # 4 upper chest
        ((0.005, 0, 1.5), (0.06, 0.064), 'chest'),   # 5 neck base
        ((0.01, 0, 1.575), (0.056, 0.058), 'neck'),    # 6 neck top
    ]
    e = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)]
    for side, s in (('r', -1), ('l', 1)):
        y = s * 0.19
        base = len(n)
        n += [
            ((0, s * 0.18, 1.43), (0.066, 0.068), 'sh_' + side),
            ((0, y, 1.3), (0.055, 0.057), 'sh_' + side),
            ((0, y, 1.16), (0.047, 0.048), 'el_' + side),
            ((0, y, 1.05), (0.046, 0.048), 'el_' + side),
            ((0, y, 0.92), (0.033, 0.036), 'wr_' + side),
            ((0.01, y, 0.85), (0.03, 0.034), 'wr_' + side),
        ]
        e += [(4, base), (base, base + 1), (base + 1, base + 2), (base + 2, base + 3), (base + 3, base + 4),
              (base + 4, base + 5)]
    for side, s in (('r', -1), ('l', 1)):
        y = s * 0.095
        base = len(n)
        n += [
            ((0, y, 0.93), (0.09, 0.088), 'hip_' + side),
            ((0.008, y, 0.75), (0.082, 0.078), 'hip_' + side),
            ((0.012, y, 0.52), (0.058, 0.058), 'kn_' + side),
            ((0.004, y, 0.33), (0.06, 0.053), 'kn_' + side),
            ((0, y, 0.1), (0.04, 0.04), 'an_' + side),
            ((0.15, y, 0.045), (0.034, 0.044), 'an_' + side),
        ]
        e += [(0, base), (base, base + 1), (base + 1, base + 2), (base + 2, base + 3), (base + 3, base + 4),
              (base + 4, base + 5)]
    return n, e


def build(look, layer):
    """Builds Kes at rest; returns the joint dict."""
    m = materials(look)
    J = {}

    def joint(name, loc, parent):
        J[name] = S.empty(name, loc, parent, layer)
        return J[name]

    root = joint('root', (0, 0, 0.98), None)
    spine = joint('spine', (0, 0, 1.06), root)
    chest = joint('chest', (0, 0, 1.24), spine)
    neck = joint('neck', (0.005, 0, 1.5), chest)
    for side, s in (('r', -1), ('l', 1)):
        y = s * 0.19
        sh = joint('sh_' + side, (0, s * 0.175, 1.43), chest)
        el = joint('el_' + side, (0, y, 1.16), sh)
        joint('wr_' + side, (0, y, 0.9), el)
        hy = s * 0.095
        hip = joint('hip_' + side, (0, hy, 0.94), root)
        kn = joint('kn_' + side, (0.012, hy, 0.52), hip)
        joint('an_' + side, (0, hy, 0.095), kn)
    bpy.context.view_layer.update()

    nodes, edges = skeleton()
    body = F.skin_body('kes_body', nodes, edges, J, m['suit'], layer)
    P = m['plate']

    # Torso armour
    F.plate('chest_plate', body, (0.14, 0, 1.36), (1, 0, 0.18), (0.4, 0.27), P, layer, chest, roundness=2.6,
            thickness=0.026, offset=0.008)
    F.plate('chest_stripe', body, (0.15, 0, 1.43), (1, 0, 0.3), (0.28, 0.03), m['accent'], layer, chest,
            roundness=6, thickness=0.005, offset=0.035, res=14)
    for k, (z, w) in enumerate(((1.175, 0.25), (1.095, 0.22))):
        F.plate(f'abs{k}', body, (0.11, 0, z), (1, 0, 0), (w + 0.04, 0.07), P, layer, J['spine'], roundness=4,
                thickness=0.02)
    F.plate('back_plate', body, (-0.12, 0, 1.33), (-1, 0, 0.1), (0.3, 0.26), m['dark'], layer, chest, roundness=3)
    F.ring('belt', body, (0, 0, 1.025), (0, 0, 1), 0.2, 0.06, m['dark'], layer, root, thickness=0.024)
    F.ring('collar', body, (0.005, 0, 1.51), (0, 0, 1), 0.11, 0.06, P, layer, chest, thickness=0.032, offset=0.01)
    S.box('belt_pouch', (0.075, 0.05, 0.08), (0.02, -0.19, 0.985), m['dark'], layer, root, bevel=0.015, subdiv=1)
    S.box('buckle', (0.025, 0.07, 0.045), (0.12, 0, 1.025), m['metal'], layer, root, bevel=0.008, subdiv=1)
    S.box('chest_light', (0.01, 0.035, 0.014), (0.155, -0.09, 1.3), m['glow'], layer, chest)

    # Helmet
    shell = S.ellipsoid('helmet', (0.126, 0.112, 0.13), (0.0, 0, 1.665), P, layer, neck)
    S.ellipsoid('helmet_lower', (0.104, 0.118, 0.07), (-0.01, 0, 1.6), m['dark'], layer, neck)
    F.plate('visor', shell, (0.118, 0, 1.648), (1, 0, -0.05), (0.21, 0.092), m['glass'], layer, neck, roundness=3.4,
            thickness=0.01, offset=0.002, res=16)
    F.plate('visor_line', shell, (0.122, 0, 1.655), (1, 0, -0.05), (0.155, 0.011), m['glow'], layer, neck,
            roundness=8, thickness=0.002, offset=0.0125, res=16)
    F.plate('helmet_crest', shell, (0.0, 0, 1.79), (0, 0, 1), (0.05, 0.2), m['dark'], layer, neck, roundness=4,
            thickness=0.012, offset=0.002, tangent=(0, 1, 0))
    S.cone('ear_module', 0.044, 0.038, 0.032, (-0.01, -0.118, 1.655), m['dark'], layer, neck,
           rot=(math.radians(90), 0, 0), bevel=0.008)
    S.ellipsoid('ear_lamp', (0.011, 0.011, 0.011), (0.02, -0.134, 1.685), m['glow'], layer, neck, segments=12)
    S.ellipsoid('neck_guard', (0.08, 0.11, 0.06), (-0.085, 0, 1.575), m['dark'], layer, neck)
    S.limb('antenna', (-0.08, 0.07, 1.74), (-0.14, 0.078, 1.86), 0.007, 0.004, m['metal'], layer, neck, verts=8,
           subdiv=0)

    # Arms
    for side, s in (('r', -1), ('l', 1)):
        sh, el, wr = J['sh_' + side], J['el_' + side], J['wr_' + side]
        F.plate('pauldron_' + side, body, (0, s * 0.22, 1.49), (0, s * 0.6, 1), (0.21, 0.2), P, layer, sh,
                roundness=2.2, thickness=0.028, offset=0.008)
        F.plate('pauldron_band_' + side, body, (0, s * 0.27, 1.45), (0, s * 1, 0.35), (0.14, 0.032), m['accent'],
                layer, sh, roundness=6, thickness=0.006, offset=0.04, res=14)
        F.plate('upper_arm_' + side, body, (0.01, s * 0.25, 1.29), (0.2, s * 1, 0), (0.11, 0.16), P, layer, sh,
                thickness=0.02)
        F.plate('bracer_' + side, body, (0.01, s * 0.24, 1.04), (0.35, s * 1, 0), (0.13, 0.2), P, layer, el,
                roundness=2.8, thickness=0.024)
        S.ellipsoid('glove_' + side, (0.05, 0.042, 0.068), (0.01, s * 0.19, 0.855), m['dark'], layer, wr)
        F.ring('cuff_' + side, body, (0, s * 0.19, 0.93), (0, 0, 1), 0.045, 0.03, m['dark'], layer, wr,
               thickness=0.01)

    # Blaster in the near hand, along the forearm (down at rest, forward when raised)
    wr, yb = J['wr_r'], -0.19
    S.box('blaster', (0.052, 0.044, 0.21), (0.024, yb, 0.785), m['dark'], layer, wr, bevel=0.012, subdiv=1)
    S.box('blaster_top', (0.032, 0.046, 0.13), (0.052, yb, 0.805), m['metal'], layer, wr, bevel=0.008, subdiv=1)
    S.cone('muzzle', 0.016, 0.014, 0.06, (0.024, yb, 0.655), m['metal'], layer, wr, verts=12)
    S.box('blaster_cell', (0.012, 0.048, 0.05), (0.0, yb, 0.82), m['port'], layer, wr)

    # Legs
    for side, s in (('r', -1), ('l', 1)):
        hip, kn, an = J['hip_' + side], J['kn_' + side], J['an_' + side]
        y = s * 0.095
        F.plate('thigh_' + side, body, (0.07, s * 0.15, 0.77), (0.75, s * 0.65, 0), (0.18, 0.27), P, layer, hip,
                roundness=2.6, thickness=0.024)
        F.plate('knee_' + side, body, (0.085, y, 0.53), (1, 0, 0.1), (0.12, 0.12), P, layer, kn, roundness=2.0,
                thickness=0.028)
        F.plate('shin_' + side, body, (0.07, y, 0.31), (1, 0, 0), (0.13, 0.32), P, layer, kn, roundness=3.2,
                thickness=0.024)
        S.box('boot_' + side, (0.27, 0.118, 0.13), (0.05, y, 0.068), m['dark'], layer, an, bevel=0.035, subdiv=2)
        S.box('toe_' + side, (0.09, 0.112, 0.07), (0.15, y, 0.074), P, layer, an, bevel=0.025, subdiv=2)
        S.box('sole_' + side, (0.29, 0.122, 0.028), (0.05, y, 0.014), m['suit'], layer, an, bevel=0.008)

    # Jetpack
    S.box('pack', (0.12, 0.27, 0.34), (-0.2, 0, 1.3), m['dark'], layer, chest, bevel=0.035, subdiv=2)
    S.box('pack_cover', (0.03, 0.22, 0.25), (-0.265, 0, 1.33), P, layer, chest, bevel=0.012, subdiv=2)
    for k, yy in enumerate((-0.14, 0.14)):
        S.cone(f'pod{k}', 0.054, 0.05, 0.24, (-0.22, yy, 1.17), m['metal'], layer, chest, bevel=0.01,
               rot=(math.radians(-8 if yy < 0 else 8), 0, 0))
        S.cone(f'nozzle{k}', 0.046, 0.034, 0.06, (-0.22, yy * 1.08, 1.03), m['dark'], layer, chest, verts=16)
        S.box(f'port{k}', (0.008, 0.04, 0.05), (-0.283, yy * 0.6, 1.43), m['port'], layer, chest)
    return J


def fwd(deg):
    return -math.radians(deg)


POSES = {
    # Ready stance, blaster raised: the style-test pose.
    'aim': {
        'yaw': -26, 'spine': (0, 6), 'chest': (0, 4), 'neck': (0, -8),
        'sh_r': (0, 84), 'el_r': (0, 6), 'wr_r': (0, -4),
        'sh_l': (-26, 64), 'el_l': (0, 50), 'wr_l': (0, 0),
        'hip_r': (0, 18), 'kn_r': (0, -26), 'an_r': (0, 8),
        'hip_l': (0, -12), 'kn_l': (0, -18), 'an_l': (0, -6),
    },
    'idle': {
        'yaw': -26, 'spine': (0, 3), 'chest': (0, 1), 'neck': (0, -2),
        'sh_r': (4, 8), 'el_r': (0, 18), 'sh_l': (-4, -6), 'el_l': (0, 14),
        'hip_r': (0, 6), 'kn_r': (0, -8), 'an_r': (0, 2), 'hip_l': (0, -6), 'kn_l': (0, -6), 'an_l': (0, 0),
    },
}

UPRIGHT = ('spine', 'chest', 'neck')


def pose(J, name, yaw=None):
    """Applies a pose and grounds the soles. Per joint: (lateral X degrees, forward degrees); limbs swing
    forward, upright joints (spine, chest, neck) lean forward, for positive values."""
    p = POSES[name]
    for jname, obj in J.items():
        if jname == 'root':
            continue
        lat, swing = p.get(jname, (0, 0))
        y_rot = math.radians(swing) if jname in UPRIGHT else fwd(swing)
        obj.rotation_euler = (math.radians(lat), y_rot, 0.0)
    J['root'].rotation_euler = (0.0, 0.0, math.radians(p['yaw'] if yaw is None else yaw))
    J['root'].location = (0, 0, 0.98)
    bpy.context.view_layer.update()
    low = min((o.matrix_world @ v.co).z for o in bpy.data.objects
              if o.name.startswith('sole_') for v in o.data.vertices)
    J['root'].location = (0, 0, 0.98 - low)
    bpy.context.view_layer.update()
