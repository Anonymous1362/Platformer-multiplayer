"""Slab front face tile: 128 x 128 px (one 64 u tile at 2x), seamless on all sides; drawn by TerrainView as a tileSprite."""

import math
import os

import bpy

import common as C

SIZE = 128


def bake(out_dir, tmp_dir):
    C.reset_scene()
    scene = bpy.context.scene
    scene.render.film_transparent = False
    scene.cycles.samples = 96
    base = C.material('base', C.SLATE_HULL, rough=0.55, metal=0.2)
    panel = C.material('panel', C.GUNMETAL, rough=0.42, metal=0.3, coat=0.4)
    steel = C.material('steel', C.COOL_STEEL, rough=0.35, metal=0.5)
    seam = C.material('seam', C.DEEP_COSMOS, rough=0.8)
    light = C.material('light', C.CYAN, emit=C.CYAN, emit_strength=2.5)
    # The tile spans x, z in [-1, 1]; the camera looks along +Y at its front (-Y) face.
    # Neighbouring copies are modelled too so bevel shading at the edges matches across seams.
    for dx in (-2, 0, 2):
        for dz in (-2, 0, 2):
            C.cube('slab', (2.0, 0.4, 2.0), (dx, 0.2, dz), base, subdiv=0)
            C.cube('plate', (1.78, 0.12, 0.84), (dx, -0.02, dz + 0.47), panel, subdiv=1, bevel=0.05)
            C.cube('plate', (0.86, 0.12, 0.84), (dx - 0.46, -0.02, dz - 0.47), panel, subdiv=1, bevel=0.05)
            C.cube('plate', (0.86, 0.12, 0.84), (dx + 0.46, -0.02, dz - 0.47), panel, subdiv=1, bevel=0.05)
            C.cube('groove', (1.4, 0.02, 0.035), (dx, -0.085, dz + 0.47), seam, subdiv=0)
            for bx, bz in ((-0.8, 0.82), (0.8, 0.82), (-0.8, 0.12), (0.8, 0.12)):
                C.cylinder('bolt', 0.045, 0.06, (dx + bx, -0.09, dz + bz), rot=(math.radians(90), 0, 0),
                           mat=steel, verts=12)
            C.cube('vent', (0.5, 0.04, 0.06), (dx + 0.46, -0.09, dz - 0.3), seam, subdiv=0)
            C.cube('vent', (0.5, 0.04, 0.06), (dx + 0.46, -0.09, dz - 0.42), seam, subdiv=0)
            C.cube('vent', (0.5, 0.04, 0.06), (dx + 0.46, -0.09, dz - 0.54), seam, subdiv=0)
            C.cube('lamp', (0.16, 0.04, 0.05), (dx - 0.66, -0.09, dz - 0.72), light, subdiv=0)
    C.lights(key=1.0, rim=0.0, fill=0.5)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    C.ortho_camera((0, 0, 0), 2.0, (SIZE, SIZE))
    path = os.path.join(out_dir, 'terrain_front.png')
    C.render_to(path)
    return {'terrain_front': [SIZE, SIZE]}
