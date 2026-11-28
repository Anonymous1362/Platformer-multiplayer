"""Deterministic modelling helpers. Every random choice comes from a seeded `random.Random`, and every
noise sample from `mathutils.noise` at seed-offset positions, so a re-bake gives the same mesh."""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

from . import stage


def obj_from_bmesh(name, bm, mat=None, layer=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat is not None:
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for m in mats:
            obj.data.materials.append(m)
    if layer:
        stage.link(obj, layer)
    return obj


def fbm(p, seed=0.0, octaves=5, scale=1.0):
    """Fractal noise in about [-1, 1] at point `p` (metres) / `scale`."""
    q = Vector(p) / scale + Vector((seed * 17.31, seed * 7.77, seed * 3.13))
    return noise.fractal(q, 0.55, 2.0, octaves, noise_basis='PERLIN_ORIGINAL')


def add_crystal(bm, rng, base, height, radius, sides=6, tip=0.32, lean=(0.0, 0.0), irregular=0.18,
                mat_index=0):
    """Appends one faceted crystal (a prism with a pointed tip) to `bm`, standing on `base`."""
    yaw = rng.uniform(0, math.tau)
    rot = (Matrix.Rotation(lean[0], 4, 'X') @ Matrix.Rotation(lean[1], 4, 'Y')
           @ Matrix.Rotation(yaw, 4, 'Z'))
    radii = [radius * (1.0 + rng.uniform(-irregular, irregular)) for _ in range(sides)]
    shoulder = height * (1.0 - tip)
    rings = []
    for z, shrink in ((-radius * 0.6, 0.78), (shoulder, 1.0)):
        ring = []
        for k in range(sides):
            a = math.tau * k / sides
            r = radii[k] * shrink
            ring.append(bm.verts.new(Vector(base) + rot @ Vector((r * math.cos(a), r * math.sin(a), z))))
        rings.append(ring)
    off = Vector((rng.uniform(-0.12, 0.12) * radius, rng.uniform(-0.12, 0.12) * radius, height))
    apex = bm.verts.new(Vector(base) + rot @ off)
    bottom, top = rings
    faces = []
    for k in range(sides):
        n = (k + 1) % sides
        faces.append(bm.faces.new((bottom[k], bottom[n], top[n], top[k])))
        faces.append(bm.faces.new((top[k], top[n], apex)))
    faces.append(bm.faces.new(list(reversed(bottom))))
    for f in faces:
        f.material_index = mat_index
    return apex


def crystal_cluster(name, rng, base, count, height, radius, spread, lean_max, mat, layer, outward=1.0,
                    down=False, tip=0.32):
    """A cluster of crystals leaning away from the centre (or hanging down when `down`)."""
    bm = bmesh.new()
    for i in range(count):
        a = rng.uniform(0, math.tau)
        d = rng.uniform(0, spread) * (0.25 if i == 0 else 1.0)
        b = Vector(base) + Vector((math.cos(a) * d, math.sin(a) * d, 0.0))
        h = height * (1.0 if i == 0 else rng.uniform(0.35, 0.85))
        r = radius * (h / height) ** 0.6 * rng.uniform(0.8, 1.15)
        lean = lean_max * (0.3 if i == 0 else rng.uniform(0.5, 1.0)) * outward
        lx, ly = -math.sin(a) * lean, math.cos(a) * lean
        if down:
            lx, ly = lx + math.pi, ly
        add_crystal(bm, rng, b, h, r, lean=(lx, ly), tip=tip * rng.uniform(0.8, 1.3))
    return obj_from_bmesh(name, bm, mat, layer)


def rock(name, rng, loc, size, mat, layer, roughness=0.32, subdiv=4, top=None, bottom_stretch=1.0,
         seed=0.0, scale=None):
    """A displaced icosphere. `top` flattens everything above that height (relative, -1..1) into a
    walkable plane; `bottom_stretch` > 1 pulls the underside into a hanging point (floating islands)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    sc = scale or 0.9
    for v in bm.verts:
        p = v.co.copy()
        n = fbm(p, seed, 5, sc)
        p *= 1.0 + roughness * n
        if top is not None and p.z > top:
            p.z = top + (p.z - top) * 0.04
        if p.z < 0:
            p.z *= bottom_stretch
        v.co = Vector((p.x * size[0], p.y * size[1], p.z * size[2])) + Vector(loc)
    return obj_from_bmesh(name, bm, mat, layer)


def sweep(name, profile, x0, x1, nx, mat, layer, displace=None, end_jitter=None, smooth=False):
    """Extrudes a (y, z) polyline along x into a sheet mesh (nx segments). `displace(x, y, z, j)`
    returns an offset Vector for profile point j; `end_jitter(z)` offsets the last column's x."""
    bm = bmesh.new()
    cols = []
    for i in range(nx + 1):
        x = x0 + (x1 - x0) * i / nx
        col = []
        for j, (y, z) in enumerate(profile):
            xx = x
            if end_jitter and i == nx:
                xx += end_jitter(z)
            p = Vector((xx, y, z))
            if displace:
                p += displace(xx, y, z, j)
            col.append(bm.verts.new(p))
        cols.append(col)
    for i in range(nx):
        for j in range(len(profile) - 1):
            bm.faces.new((cols[i][j], cols[i + 1][j], cols[i + 1][j + 1], cols[i][j + 1]))
    return obj_from_bmesh(name, bm, mat, layer, smooth)


def loft(name, sections, mat, layer, smooth=True, cap=True):
    """Lofts closed cross-sections (lists of Vectors, same count) into a tube, capped at both ends."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in sec] for sec in sections]
    n = len(sections[0])
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            m = (k + 1) % n
            bm.faces.new((a[k], a[m], b[m], b[k]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return obj_from_bmesh(name, bm, mat, layer, smooth)


def _finish(obj, name, mat, layer, parent, bevel=0.0, subdiv=0, smooth=True):
    obj.name = name
    if bevel > 0:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = 'ANGLE'
    if subdiv > 0:
        mod = obj.modifiers.new('subd', 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = smooth
    if mat is not None:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if parent is not None:
        set_parent(obj, parent)
    if layer:
        stage.link(obj, layer)
    return obj


def box(name, size, loc, mat=None, layer=None, parent=None, bevel=0.0, subdiv=0, rot=(0, 0, 0), smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, name, mat, layer, parent, bevel, subdiv, smooth)


def ellipsoid(name, radii, loc, mat=None, layer=None, parent=None, rot=(0, 0, 0), segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=loc, rotation=rot, segments=segments,
                                         ring_count=max(8, segments // 2))
    obj = bpy.context.active_object
    obj.scale = radii
    bpy.ops.object.transform_apply(scale=True)
    return _finish(obj, name, mat, layer, parent)


def cone(name, r1, r2, depth, loc, mat=None, layer=None, parent=None, rot=(0, 0, 0), verts=24, bevel=0.0,
         subdiv=0, smooth=True):
    """A truncated cone; r1 at -Z (bottom), r2 at +Z (top) before rotation."""
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc,
                                    rotation=rot)
    obj = bpy.context.active_object
    return _finish(obj, name, mat, layer, parent, bevel, subdiv, smooth)


def limb(name, a, b, r_a, r_b, mat=None, layer=None, parent=None, verts=20, subdiv=1):
    """A tapered rounded rod from point `a` (radius r_a) to point `b` (radius r_b)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r_a, radius2=r_b, depth=d.length,
                                    location=(a + b) / 2)
    obj = bpy.context.active_object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('Z', 'Y')
    return _finish(obj, name, mat, layer, parent, bevel=min(r_a, r_b) * 0.7, subdiv=subdiv)


def torus(name, major, minor, loc, mat=None, layer=None, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=48, minor_segments=10)
    obj = bpy.context.active_object
    return _finish(obj, name, mat, layer, parent)


def empty(name, loc=(0, 0, 0), parent=None, layer=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    if parent is not None:
        set_parent(obj, parent)
    if layer:
        stage.link(obj, layer)
    return obj


def set_parent(obj, parent):
    """Parents keeping the world transform (both objects at rest pose)."""
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def bend(obj, degrees, axis='Z'):
    """Curves a plate (SimpleDeform bend), so armour reads as shaped, not boxy."""
    mod = obj.modifiers.new('bend', 'SIMPLE_DEFORM')
    mod.deform_method = 'BEND'
    mod.angle = math.radians(degrees)
    mod.deform_axis = axis
    return obj
