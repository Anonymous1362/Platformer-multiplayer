"""Shared Blender (bpy) helpers for Cosmic Drift bakes: scene, palette materials, lights, rendering.

Run the bakes with `npm run art:bake` (python3 -I tools/blender/bake.py). Everything is deterministic:
no random calls without a fixed seed, so a re-bake gives the same pixels.
"""

import math
import os

import bpy
from mathutils import Vector

# Palette (spec 9.2), linearised in `rgb()`.
DEEP_COSMOS = '#080B1A'
ABYSSAL_NAVY = '#0F172A'
SLATE_HULL = '#1E293B'
GUNMETAL = '#334155'
COOL_STEEL = '#64748B'
CYAN = '#00F5D4'
GOLD = '#FFB703'
VIOLET = '#A855F7'
CRIMSON = '#FF2A85'
AMBER = '#FB923C'
CERAMIC = '#DCE3EC'  # suit plates: a cool off-white that sits between Cool Steel and starlight


def rgb(hex_color, alpha=1.0):
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], alpha)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = rgb(ABYSSAL_NAVY)
    bg.inputs[1].default_value = 0.35
    return scene


def material(name, color, rough=0.4, metal=0.0, emit=None, emit_strength=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = rgb(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = rgb(emit)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    return mat


def holdout_material():
    mat = bpy.data.materials.new('holdout')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    hold = nodes.new('ShaderNodeHoldout')
    mat.node_tree.links.new(hold.outputs[0], out.inputs['Surface'])
    return mat


def smooth(obj, subdiv=2, bevel=0.0):
    if bevel > 0:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = 'ANGLE'
    if subdiv > 0:
        mod = obj.modifiers.new('subd', 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def cube(name, size, loc=(0, 0, 0), mat=None, parent=None, subdiv=2, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    smooth(obj, subdiv, bevel)
    if mat:
        assign(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj


def sphere(name, radius, loc=(0, 0, 0), scale=(1, 1, 1), mat=None, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=40, ring_count=20)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if mat:
        assign(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj


def capsule(name, radius, length, loc=(0, 0, 0), mat=None, parent=None, axis='Z'):
    """A rounded limb from `loc` downward (axis -Z) of `length`."""
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, vertices=24,
                                        location=(loc[0], loc[1], loc[2] - length / 2))
    obj = bpy.context.active_object
    obj.name = name
    smooth(obj, 2, bevel=radius * 0.6)
    if mat:
        assign(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj


def cylinder(name, radius, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, parent=None, verts=32, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    smooth(obj, 1, bevel)
    if mat:
        assign(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj


def torus(name, major, minor, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=12)
    obj = bpy.context.active_object
    obj.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if mat:
        assign(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj


def empty(name, loc=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    if parent:
        obj.parent = parent
    return obj


def set_parent(obj, parent):
    """Parents keeping the world transform (both objects are at their rest pose)."""
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def joint(name, world_loc, parent=None):
    """An empty at a world location, parented without changing it."""
    obj = empty(name)
    obj.location = world_loc
    if parent:
        set_parent(obj, parent)
    return obj


def lights(key=1.0, rim_color=CYAN, rim=1.0, fill=1.0):
    """Key from the upper left (spec 9.1), cool fill, coloured rim from behind."""
    def add(name, kind, loc, rot, energy, color, size=1.0):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = rgb(color)[:3]
        if kind == 'AREA':
            data.size = size
        if kind == 'SUN':
            data.angle = math.radians(8)
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = [math.radians(a) for a in rot]
        return obj

    add('key', 'SUN', (-4, -6, 8), (40, 0, -30), 3.2 * key, '#FFF4E0')
    add('fill', 'AREA', (6, -6, 1), (90, 0, 45), 140 * fill, '#93C5FD', size=6)
    add('rim', 'AREA', (3, 6, 3), (-70, 0, 160), 260 * rim, rim_color, size=3)


def ortho_camera(center, ortho_scale, res, fit='VERTICAL', look_dir=(0, 1, 0)):
    """An orthographic camera looking along `look_dir` (default +Y) at `center`."""
    data = bpy.data.cameras.new('cam')
    data.type = 'ORTHO'
    data.ortho_scale = ortho_scale
    data.sensor_fit = fit
    cam = bpy.data.objects.new('cam', data)
    bpy.context.scene.collection.objects.link(cam)
    d = Vector(look_dir).normalized()
    cam.location = Vector(center) - d * 30
    cam.rotation_euler = d.to_track_quat('-Z', 'Z').to_euler()
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = res
    data.clip_end = 100
    return cam


def render_to(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def pack_grid(frame_paths, cols, out_path):
    """Packs equally sized frames row-major into one sheet (frame i -> col i % cols, row i // cols)."""
    from PIL import Image
    frames = [Image.open(p).convert('RGBA') for p in frame_paths]
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
    for i, img in enumerate(frames):
        sheet.paste(img, ((i % cols) * w, (i // cols) * h))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sheet.save(out_path, optimize=True)
    return sheet.size


def limb(name, a, b, radius, mat=None, parent=None):
    """A rounded rod from point `a` to point `b`."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=d.length, vertices=16, location=(a + b) / 2)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('Z', 'Y')
    smooth(obj, 1, bevel=radius * 0.5)
    if mat:
        assign(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj
