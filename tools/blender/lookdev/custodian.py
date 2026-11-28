"""Custodian Crawler, lookdev model v3 (spec 2.2: Aurai-built guardian constructs; 9.1: segmented
organic-mechanical curves). Low and wide (about 1.4 m long): a glowing core body under a stepped
carapace of thick stone-ceramic plates, one horizontal sensor slit, three pairs of bladed legs.

Built with studio.figure: a skin core (dim danger-coloured light leaks between the plates), fitted
carapace plates, and a separate skin for the legs. Readability: a low arched silhouette (never confused
with the upright hero); the only saturated colour is the danger colour (eye and seams); the eye leads
the body so facing reads at a glance. Facing +X, feet at z = 0.
"""

import math

import bpy

from studio import figure as F, mats, shapes as S

SHELL = '#36353C'
SHELL_WEAR = '#64616C'
LIMB = '#26262C'

LEGS = [(0.24, 0.13), (0.0, 0.0), (-0.26, -0.13)]  # hip x, knee/foot x offset


def materials(look):
    danger, k = look['danger']
    return {
        'shell': mats.surface('cus_shell', SHELL, rough=0.4, coat=0.35, variation=0.12, wear=SHELL_WEAR, ao=0.55,
                              scale=7),
        'limb': mats.surface('cus_limb', LIMB, rough=0.36, metal=0.4, variation=0.08, wear=SHELL_WEAR, scale=10),
        'core': mats.surface('cus_core', '#1A1A1E', rough=0.5, variation=0.06, ao=0.4),
        'seam': mats.emissive('cus_seam', danger, k * 0.35),
        'eye': mats.emissive('cus_eye', danger, k),
    }


def build(look, layer):
    m = materials(look)
    J = {'root': S.empty('cus_root', (0, 0, 0), None, layer)}
    J['body'] = S.empty('cus_body', (0, 0, 0.44), J['root'], layer)
    J['head'] = S.empty('cus_head', (0.45, 0, 0.44), J['body'], layer)
    bpy.context.view_layer.update()
    core_nodes = [
        ((-0.05, 0, 0.45), (0.27, 0.16), 'body'),
        ((0.22, 0, 0.46), (0.25, 0.15), 'body'),
        ((0.43, 0, 0.44), (0.13, 0.1), 'head'),
        ((0.6, 0, 0.42), (0.12, 0.09), 'head'),
        ((0.74, 0, 0.4), (0.05, 0.045), 'head'),
        ((-0.3, 0, 0.43), (0.23, 0.14), 'body'),
        ((-0.52, 0, 0.38), (0.13, 0.09), 'body'),
        ((-0.68, 0, 0.33), (0.045, 0.04), 'body'),
    ]
    core = F.skin_body('cus_core', core_nodes, [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7)], J,
                       m['core'], layer)
    for i, (x, z, pitch, w, ln) in enumerate(((0.34, 0.6, -24, 0.95, 0.3), (0.12, 0.64, -6, 1.0, 0.31),
                                              (-0.1, 0.63, 8, 0.98, 0.3), (-0.32, 0.58, 22, 0.86, 0.28),
                                              (-0.52, 0.5, 38, 0.62, 0.24))):
        nrm = (math.sin(math.radians(pitch)), 0, math.cos(math.radians(pitch)))
        F.plate(f'cus_plate{i}', core, (x, 0, z), nrm, (w, ln), m['shell'], layer, J['body'], roundness=2.4,
                thickness=0.05, offset=0.012 + 0.006 * (i % 2), res=14)
        if i < 4:
            S.cone(f'cus_spine{i}', 0.035, 0.0, 0.11, (x - 0.05, 0, z + 0.07 + 0.02 * (i == 1)), m['shell'], layer,
                   J['body'], rot=(0, math.radians(-40 + pitch), 0), verts=8)
    F.plate('cus_brow', core, (0.6, 0, 0.52), (0.35, 0, 1), (0.42, 0.3), m['shell'], layer, J['head'],
            roundness=2.2, thickness=0.04, offset=0.01)
    F.plate('cus_jaw', core, (0.6, 0, 0.33), (0.3, 0, -1), (0.34, 0.22), m['shell'], layer, J['head'],
            roundness=2.4, thickness=0.035, offset=0.008)
    for s in (-1, 1):
        F.plate(f'cus_seam{s}', core, (-0.05, s * 0.27, 0.43), (0, s, 0.15), (1.2, 0.022), m['seam'], layer,
                J['body'], roundness=6, thickness=0.004, offset=0.004, res=20)
    F.plate('cus_belly', core, (-0.04, 0, 0.3), (0, 0, -1), (0.55, 1.25), m['limb'], layer, J['body'],
            roundness=2.2, thickness=0.03, offset=0.004, res=14, tangent=(0, 1, 0))
    S.ellipsoid('cus_eye', (0.024, 0.1, 0.02), (0.755, 0, 0.445), m['eye'], layer, J['head'], segments=16)
    for k, y in enumerate((-0.07, 0.07)):
        S.limb(f'cus_mandible{k}', (0.7, y, 0.36), (0.82, y * 0.5, 0.22), 0.022, 0.004, m['limb'], layer,
               J['head'], verts=8)

    leg_nodes, leg_edges = [], []
    for i, (x, dx) in enumerate(LEGS):
        for side, s in (('r', -1), ('l', 1)):
            hname = f'cus_hip{i}{side}'
            J[hname] = S.empty(hname, (x, s * 0.2, 0.4), J['body'], layer)
            b = len(leg_nodes)
            leg_nodes += [((x, s * 0.22, 0.38), (0.06, 0.06), hname),
                          ((x + dx, s * 0.44, 0.58), (0.052, 0.05), hname),
                          ((x + 1.5 * dx, s * 0.52, 0.2), (0.034, 0.034), hname),
                          ((x + 1.8 * dx, s * 0.54, 0.0), (0.01, 0.01), hname)]
            leg_edges += [(b, b + 1), (b + 1, b + 2), (b + 2, b + 3)]
    bpy.context.view_layer.update()
    legs = F.skin_body('cus_legs', leg_nodes, leg_edges, J, m['limb'], layer, subdiv=2)
    data = legs.data.skin_vertices[0].data
    for k in range(0, len(leg_nodes), 4):
        data[k].use_root = True
    for i, (x, dx) in enumerate(LEGS):
        for s in (-1, 1):
            F.plate(f'cus_legplate{i}{s}', legs, (x + dx * 0.6, s * 0.36, 0.56), (0.2, s * 0.5, 1), (0.13, 0.26),
                    m['shell'], layer, J[f'cus_hip{i}{"r" if s < 0 else "l"}'], roundness=2.2, thickness=0.02,
                    offset=0.006, res=8)
    return J


def pose(J, name='alert', yaw=-14):
    """'alert': front raised, head up toward the target, legs braced."""
    J['root'].rotation_euler = (0, 0, math.radians(yaw))
    if name == 'alert':
        J['body'].rotation_euler = (0, math.radians(-5), 0)
        J['head'].rotation_euler = (0, math.radians(-8), 0)
    bpy.context.view_layer.update()
