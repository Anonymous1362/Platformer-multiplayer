"""Figures: one continuous sculpted body grown from a skeleton (Skin modifier), driven by the FK joints
through Hook modifiers, with armour plates shrink-wrapped onto it (real thickness, rounded edges).

Why: characters assembled from separate primitives read as toys (gaps at joints, no mass). A skin body
bends cleanly at every joint in every pose, and plates that hug it read as fitted armour. Poses only
rotate the joints, so every animation frame reuses the same model (stays on-model, spec 9.4).

Skin radii: for a vertical chain (rx, ry) is (front-back, side-side); for a chain along x it is
(side-side, up-down).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import stage
from .shapes import set_parent


def skin_body(name, nodes, edges, joints, mat, layer, subdiv=2):
    """`nodes`: [(position, (rx, ry), joint_name)]; vertex 0 is the root. Returns the body object."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([n[0] for n in nodes], edges, [])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new('skin', 'SKIN')
    data = mesh.skin_vertices[0].data
    for i, (_, radius, _) in enumerate(nodes):
        data[i].radius = radius
    data[0].use_root = True
    bpy.context.view_layer.update()
    groups = {}
    for i, (_, _, jname) in enumerate(nodes):
        groups.setdefault(jname, []).append(i)
    for k, (jname, idx) in enumerate(groups.items()):
        hook = obj.modifiers.new(f'hook_{jname}', 'HOOK')
        hook.object = joints[jname]
        hook.vertex_indices_set(idx)
        hook.matrix_inverse = joints[jname].matrix_world.inverted()
        obj.modifiers.move(obj.modifiers.find(hook.name), k)
    sub = obj.modifiers.new('subd', 'SUBSURF')
    sub.levels = subdiv
    sub.render_levels = subdiv
    obj.modifiers.new('smooth', 'SMOOTH').factor = 0.4
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj['smooth_shading'] = True
    stage.link(obj, layer)
    return obj


def _shade_smooth_modifier(obj):
    """Smooth shading for generated geometry (skin, solidify): an auto-smooth-free approach."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def _freeze(obj):
    """Fits the plate now (body at rest) and keeps the result as a rigid mesh. Armour is rigid; a live
    shrink-wrap would grab whatever limb passes in front of it in a pose (an aimed arm over the chest)."""
    bpy.context.view_layer.update()
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = bpy.data.meshes.new_from_object(ev)
    obj.modifiers.clear()
    old = obj.data
    obj.data = mesh
    bpy.data.meshes.remove(old)
    _shade_smooth_modifier(obj)


def frame(normal, tangent=None):
    """Rotation (as a 4x4 matrix) whose local Z is `normal` and local X follows `tangent` (default:
    horizontal across a side-facing patch, side-to-side across an up-facing one)."""
    n = Vector(normal).normalized()
    if tangent is None:
        tangent = (0, 1, 0) if abs(n.z) > 0.7 else Vector((0, 0, 1)).cross(n)
    t = Vector(tangent)
    x = (t - n * t.dot(n)).normalized()
    y = n.cross(x)
    m = Matrix((x, y, n)).transposed().to_4x4()
    return m


def plate(name, body, center, normal, size, mat, layer, joint, roundness=3.0, thickness=0.014, offset=0.006,
          res=10, tangent=None, cut=None):
    """A fitted armour plate: a superellipse patch (`size` along its local x, y) placed at `center`
    facing `normal`, shrink-wrapped onto `body`, given thickness (outward) and rounded edges.
    `cut(u, v)` can remove cells (u, v in -1..1) for notches. Parented to `joint` to follow the pose."""
    bm = bmesh.new()
    a, b = size[0] / 2, size[1] / 2
    verts = {}
    for i in range(res + 1):
        for j in range(res + 1):
            u, v = -1 + 2 * i / res, -1 + 2 * j / res
            verts[i, j] = bm.verts.new((u * a, v * b, 0.0))
    for i in range(res):
        for j in range(res):
            cu, cv = -1 + 2 * (i + 0.5) / res, -1 + 2 * (j + 0.5) / res
            if abs(cu) ** roundness + abs(cv) ** roundness > 1.0:
                continue
            if cut and cut(cu, cv):
                continue
            bm.faces.new((verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]))
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    n = Vector(normal).normalized()
    obj.matrix_world = Matrix.Translation(Vector(center) + n * 0.05) @ frame(n, tangent)
    sw = obj.modifiers.new('wrap', 'SHRINKWRAP')
    sw.target = body
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.wrap_mode = 'OUTSIDE_SURFACE'
    sw.offset = offset
    so = obj.modifiers.new('thick', 'SOLIDIFY')
    so.thickness = thickness
    so.offset = 1.0
    so.use_even_offset = True
    sub = obj.modifiers.new('round', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    obj.data.materials.append(mat)
    _freeze(obj)
    if joint is not None:
        set_parent(obj, joint)
    stage.link(obj, layer)
    return obj


def ring(name, body, center, axis, radius, height, mat, layer, joint, thickness=0.012, offset=0.004, segs=24):
    """A band (belt, cuff, collar) shrink-wrapped around a limb or the waist."""
    bm = bmesh.new()
    rows = []
    for zz in (-height / 2, height / 2):
        rows.append([bm.verts.new((math.cos(math.tau * k / segs) * radius,
                                   math.sin(math.tau * k / segs) * radius, zz)) for k in range(segs)])
    for k in range(segs):
        m = (k + 1) % segs
        bm.faces.new((rows[0][k], rows[0][m], rows[1][m], rows[1][k]))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector(axis).normalized().to_track_quat('Z', 'Y')
    obj.location = center
    sw = obj.modifiers.new('wrap', 'SHRINKWRAP')
    sw.target = body
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.wrap_mode = 'OUTSIDE_SURFACE'
    sw.offset = offset
    so = obj.modifiers.new('thick', 'SOLIDIFY')
    so.thickness = thickness
    so.offset = 1.0
    sub = obj.modifiers.new('round', 'SUBSURF')
    sub.levels = 2
    sub.render_levels = 2
    obj.data.materials.append(mat)
    _freeze(obj)
    if joint is not None:
        set_parent(obj, joint)
    stage.link(obj, layer)
    return obj
