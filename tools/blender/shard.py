"""Starlight shard spinner: 24 frames of 64 x 64 px (32 u at 2x) in one strip; a faceted gold crystal."""

import math
import os

import bmesh
import bpy

import common as C

SIZE = 64
FRAMES = 24


def crystal(mat, inner):
    mesh = bpy.data.meshes.new('crystal')
    bm = bmesh.new()
    sides = 6
    top = bm.verts.new((0, 0, 0.62))
    bottom = bm.verts.new((0, 0, -0.5))
    upper, lower = [], []
    for k in range(sides):
        a = 2 * math.pi * k / sides
        r = 0.3 if k % 2 == 0 else 0.26
        upper.append(bm.verts.new((r * math.cos(a), r * math.sin(a), 0.14)))
        lower.append(bm.verts.new((r * 0.92 * math.cos(a + 0.15), r * 0.92 * math.sin(a + 0.15), -0.06)))
    for k in range(sides):
        n = (k + 1) % sides
        bm.faces.new((upper[k], upper[n], top))
        bm.faces.new((lower[n], lower[k], bottom))
        bm.faces.new((upper[k], lower[k], lower[n], upper[n]))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('crystal', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    core = C.sphere('core', 0.12, (0, 0, 0.06), (1, 1, 1.6), inner)
    core.parent = obj
    return obj


def bake(out_dir, tmp_dir):
    C.reset_scene()
    scene = bpy.context.scene
    scene.cycles.samples = 64
    gold = C.material('shard', C.GOLD, rough=0.18, metal=0.55, coat=1.0, emit=C.GOLD, emit_strength=1.1)
    inner = C.material('inner', '#FFF3C4', emit='#FFE08A', emit_strength=8.0)
    obj = crystal(gold, inner)
    obj.rotation_euler = (math.radians(14), math.radians(-10), 0)
    C.lights(key=1.2, rim=1.0, rim_color=C.GOLD)
    C.ortho_camera((0, 0, 0.05), 1.24, (SIZE, SIZE), fit='VERTICAL')
    paths = []
    for f in range(FRAMES):
        # Six-fold symmetry: a 60 degree turn loops seamlessly.
        obj.rotation_euler = (math.radians(14), math.radians(-10), math.radians(60 * f / FRAMES))
        path = os.path.join(tmp_dir, f'shard_{f:02d}.png')
        C.render_to(path)
        paths.append(path)
    size = C.pack_grid(paths, FRAMES, os.path.join(out_dir, 'pickup_shard.png'))
    return {'pickup_shard': size}
