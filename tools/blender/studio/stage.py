"""Stage: one Cycles scene setup, the light rigs, cameras, scale rules, and per-layer renders.

Units: 1 Blender unit = 1 m. The game draws `U_PER_M` units per metre (the 1.8 m hero is 104 u tall),
and a 1080p screen shows `VIEW_H_U` units of height, so at 1080p one unit is one pixel. Sprite textures
are rendered at `SPRITE_DENSITY` pixels per unit (spec 9.5).

Two light rigs share one ambient:
- `world`: the dramatic environment rig (key from the star, upper left). Environments are never flipped.
- `sprite`: the flip-safe rig for characters and pickups. The key is high and frontal and the rim is
  straight behind, so a sprite mirrored with flipX still matches the scene's light.
"""

import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

U_PER_M = 104 / 1.8
SPRITE_DENSITY = 2
VIEW_H_U = 1080
FRAME_W, FRAME_H = 1920, 1080


def lin(hex_color):
    """sRGB hex to linear RGB (Blender colour inputs are linear)."""
    h = hex_color.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def new_scene(look, samples=64):
    """A clean, deterministic Cycles scene with the look's ambient light."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    cyc = scene.cycles
    cyc.device = 'CPU'
    cyc.samples = samples
    cyc.use_denoising = True
    cyc.seed = 0
    cyc.max_bounces = 6
    cyc.diffuse_bounces = 3
    cyc.glossy_bounces = 3
    cyc.transmission_bounces = 6
    cyc.transparent_max_bounces = 8
    scene.render.film_transparent = True
    settings = scene.render.image_settings
    settings.file_format = 'PNG'
    settings.color_mode = 'RGBA'
    settings.color_depth = '8'
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Base Contrast'
    except TypeError:
        scene.view_settings.look = 'None'
    world = bpy.data.worlds.new('World')
    scene.world = world
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*lin(look['ambient']), 1.0)
    bg.inputs['Strength'].default_value = look['ambient_strength']
    for name in ('rig_world', 'rig_sprite'):
        coll = bpy.data.collections.new(name)
        scene.collection.children.link(coll)
    build_rig('rig_world', look['rig_world'])
    build_rig('rig_sprite', look['rig_sprite'])
    return scene


def collection(name):
    """A top-level collection (one render layer), created on first use."""
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def link(obj, coll_name):
    """Moves `obj` (and its children) into the named layer collection."""
    coll = collection(coll_name)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    for child in obj.children:
        link(child, coll_name)
    return obj


def sun(name, travel, color, energy, angle_deg, coll_name):
    """A sun travelling along `travel` (x right, y away from the camera, z up)."""
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = lin(color)
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.new(name, data)
    collection(coll_name).objects.link(obj)
    obj.rotation_euler = Vector(travel).normalized().to_track_quat('-Z', 'Y').to_euler()
    return obj


def build_rig(coll_name, rig):
    for i, light in enumerate(rig):
        sun(f'{coll_name}_{i}_{light["name"]}', light['travel'], light['color'], light['energy'],
            light.get('angle', 6.0), coll_name)


def ortho_camera(name, center, height_m, res, tilt_deg=0.0):
    """Orthographic camera looking along +Y, pitched down by `tilt_deg`, framing `height_m` vertically."""
    data = bpy.data.cameras.new(name)
    data.type = 'ORTHO'
    data.sensor_fit = 'VERTICAL'
    data.ortho_scale = height_m
    data.clip_start = 0.1
    data.clip_end = 400
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    t = math.radians(tilt_deg)
    d = Vector((0.0, math.cos(t), -math.sin(t)))
    cam.location = Vector(center) - d * 120
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam['res'] = res
    return cam


def perspective_camera(name, location, fov_v_deg, res, tilt_deg=0.0, clip_end=3000):
    """Perspective camera looking along +Y, pitched up by `tilt_deg`, with a vertical field of view."""
    data = bpy.data.cameras.new(name)
    data.sensor_fit = 'VERTICAL'
    data.angle_y = math.radians(fov_v_deg)
    data.clip_start = 0.5
    data.clip_end = clip_end
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    t = math.radians(tilt_deg)
    d = Vector((0.0, math.cos(t), math.sin(t)))
    cam.location = location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam['res'] = res
    return cam


def to_px(cam, point):
    """Pixel position (x right, y down) of a world point in `cam`'s render."""
    scene = bpy.context.scene
    w, h = cam['res']
    scene.render.resolution_x, scene.render.resolution_y = w, h
    co = world_to_camera_view(scene, cam, Vector(point))
    return co.x * w, (1.0 - co.y) * h


def render_layer(layer, cam, path, rig='rig_world', samples=None):
    """Renders one layer collection alone (with one rig) to a transparent PNG."""
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = cam['res']
    for coll in scene.collection.children:
        coll.hide_render = coll.name not in (layer, rig)
    if samples:
        scene.cycles.samples = samples
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
