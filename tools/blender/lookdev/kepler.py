"""Kepler-186f ("The Garden") lookdev environment: the crash-site cliffs above a fog-filled crystal
forest, the Lantern wreck in the valley, floating crystal islands, the broken Heartstar in the sky.

Layers (each its own collection, rendered alone, stacked by comp like the game's parallax):
- `play`  (gameplay plane, orthographic): the cliff ledge, the one-way survey catwalk, the floating
          island, decor crystals behind the walk line, a Meridian survey beacon.
- `near`, `mid`, `far` (perspective): scenery at roughly 60-80 m, 100-200 m and 250-900 m.
- `fore`  (perspective, 8-14 m from the camera): dark, out-of-focus framing shapes.
- `giant` (perspective, about 700 m): the colossus in the haze, its own layer so it takes less fog
          than the mesas behind it and reads as a faint silhouette against the Heartstar's glow.

Readability rules built in: walkable tops are flat and lit; one-way platforms are thin grates (a
different material and silhouette from solid rock); decor sits behind the walk line, never in front.
Ambient life (mites, the distant giant) stays off walkable tops, is small or far, and never uses the
danger colour, so nothing alive-looking is mistaken for a threat or a pickup.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

from studio import mats, shapes as S, stage

LEDGE_X = (-17.5, 1.6)
CATWALK = {'x': (3.4, 7.6), 'z': 2.3}
ISLAND_TOP = -0.9
WRECK = (33, 126, -12.0)
WRECK_BREAK = (36.0, 127.0, -12.5)  # where the smoke rises and the fire glows (between the halves)
WATCHER = (-95, 700, -60)  # far left of centre: a dark shape in the haze around the Heartstar
FLARE = 2.4  # the catwalk crystal is caught mid-flare in the still (engine: rare, random, ambient)


def materials(look):
    a, b, top = look['rock']
    c = look['crystal']
    hull_light, hk = look['hull_light']
    return {
        'rock': mats.rock('rock', a, b, top, crack=True, lichen=look.get('lichen')),
        'rock_far': mats.rock('rock_far', a, b, top, top_amount=0.5, scale=0.06, bump=0.2),
        'crystal': mats.crystal('crystal', c['base'], c['glow'], c['emit'], c['edge'], per_object=True),
        'crystal_hang': mats.crystal('crystal_hang', c['base'], c['glow'], c['emit'], c['edge'], invert=True,
                                     per_object=True),
        'crystal_big': mats.crystal('crystal_big', c['base'], c['glow'], c['emit'] * 0.4, c['edge'],
                                    per_object=True),
        'hull': mats.hull('hull', look['hull'], scorch='#0E0D0C'),
        'hull_dark': mats.hull('hull_dark', look['metal'], rough=0.6, metal=0.3, plate_var=0.15),
        'canopy': mats.glass('canopy', '#0B0F12', glow=look['hull_light'][0], glow_strength=0.25),
        'giant': mats.surface('giant', '#1B1F22', rough=0.7, variation=0.12, scale=0.05),
        'mite': mats.surface('mite', '#17191B', rough=0.25, coat=0.8, variation=0.1, scale=40),
        'mite_glow': mats.emissive('mite_glow', c['glow'], 3.2),
        'root': mats.surface('root', '#211E1A', rough=0.8, variation=0.15, scale=20),
        'lamp': mats.emissive('lamp', hull_light, hk),
        'grate': mats.surface('grate', look['grate'], rough=0.4, metal=0.75, variation=0.1, wear='#8A8F92',
                              scale=8),
        'metal': mats.surface('metal', look['metal'], rough=0.45, metal=0.7, variation=0.1, scale=8),
        'beacon': mats.emissive('beacon', hull_light, hk * 0.8),
    }


# Gameplay plane -----------------------------------------------------------------------------------

def ledge(m, layer, seed=1):
    """The cliff ledge: a swept profile with a flat walkable top, rounded lip, and a stratified face."""
    profile = [(1.7 - k * 0.3, 0.0) for k in range(11)]  # top, back to front
    profile += [(-1.5, -0.04), (-1.6, -0.14), (-1.66, -0.32)]
    profile += [(-1.7 - 0.03 * k, -0.5 - 0.3 * k) for k in range(32)]

    def displace(x, y, z, j):
        if z >= -0.001:
            edge = max(0.0, (-1.1 - y) / 0.4)
            return Vector((0, 0, 0.012 * S.fbm((x, y, 0), seed, 3, 0.8) - edge * 0.09 * abs(S.fbm((x * 1.7, 0, 0),
                                                                                               seed + 5, 3, 1.0))))
        big = 0.7 * S.fbm((x * 0.11, z * 0.16, 0), seed + 1, 4, 1.0)
        phase = z * 2.6 + 1.8 * S.fbm((x * 0.07, z * 0.2, 0), seed + 2, 2, 1.0)
        strata = 0.16 * (phase - math.floor(phase)) ** 2
        chip = 0.15 * S.fbm((x * 0.9, z * 1.4, 0), seed + 3, 4, 1.0)
        lip = 1.0 if z > -0.6 else 0.0
        return Vector((0, -(big + strata + chip) * (1.0 - 0.7 * lip) - 0.05 * lip, 0.0))

    def end(z):
        corner = -0.35 * (1.0 - min(1.0, -z / 0.6)) ** 2
        return (-0.22 * max(0.0, -z) ** 0.8 + 0.55 * S.fbm((0, 0, z * 1.3), seed + 4, 4, 1.0)
                + 0.2 * S.fbm((0, 0, z * 4.0), seed + 6, 2, 1.0) + corner)

    return S.sweep('ledge', profile, LEDGE_X[0], LEDGE_X[1], 190, m['rock'], layer, displace, end, smooth=True)


def island(m, layer, rng):
    """The floating island on the right (solid): flat lit top, hanging crystal roots."""
    S.rock('island', rng, (15.6, 0.0, ISLAND_TOP - 1.15), (6.4, 1.9, 1.45), m['rock'], layer, roughness=0.3,
           subdiv=5, top=0.79, bottom_stretch=2.3, seed=5.0, scale=0.8)
    for k, (x, h) in enumerate(((11.2, 1.6), (13.6, 2.6), (16.4, 2.0), (19.0, 1.4))):
        S.crystal_cluster(f'island_hang{k}', rng, (x, 0.2, ISLAND_TOP - 1.6 - 0.25 * h), 4, h, 0.18 * h, 0.5,
                          0.35, m['crystal_hang'], layer, down=True)


def catwalk(m, layer, rng):
    """One-way platform: a Meridian survey catwalk floating on an anti-gravity crystal."""
    x0, x1 = CATWALK['x']
    z = CATWALK['z']
    xc, w = (x0 + x1) / 2, x1 - x0
    for y in (-1.2, 1.2):
        S.box('cw_rail', (w, 0.07, 0.1), (xc, y, z - 0.05), m['grate'], layer, bevel=0.01)
    n = 22
    for i in range(n):
        x = x0 + 0.1 + (w - 0.2) * i / (n - 1)
        S.box('cw_slat', (0.05, 2.4, 0.05), (x, 0, z - 0.03), m['grate'], layer)
    for x in (x0 + 0.05, x1 - 0.05):
        S.box('cw_end', (0.1, 2.5, 0.12), (x, 0, z - 0.06), m['metal'], layer, bevel=0.015)
    for i in range(5):
        x = x0 + 0.3 + (w - 0.6) * i / 4
        S.box('cw_post', (0.05, 0.05, 0.55), (x, 1.2, z + 0.27), m['metal'], layer)
    S.box('cw_toprail', (w - 0.4, 0.05, 0.05), (xc, 1.2, z + 0.55), m['metal'], layer)
    S.torus('cw_clamp', 0.42, 0.06, (xc, 0, z - 0.75), m['metal'], layer, rot=(0, 0, 0))
    for sx in (-1, 1):
        S.limb('cw_strut', (xc + sx * 1.2, 0, z - 0.1), (xc + sx * 0.38, 0, z - 0.72), 0.04, 0.035, m['metal'],
               layer, verts=8)
    S.crystal_cluster('cw_crystal', rng, (xc, 0, z - 0.55), 3, 1.6, 0.34, 0.15, 0.2, m['crystal_hang'], layer,
                      down=True, glow=FLARE)


def beacon(m, layer, x=-11.6):
    """A Meridian survey beacon (environmental storytelling, spec 2.7) for scale."""
    top = 2.3
    for a in (0, 2.1, 4.2):
        S.limb('bc_leg', (x + 0.5 * math.cos(a), 0.6 + 0.5 * math.sin(a), 0.0), (x, 0.6, 1.0), 0.03, 0.025,
               m['metal'], layer, verts=8)
    S.limb('bc_pole', (x, 0.6, 0.9), (x, 0.6, top), 0.035, 0.03, m['metal'], layer, verts=10)
    S.box('bc_head', (0.22, 0.16, 0.3), (x, 0.6, top + 0.1), m['grate'], layer, bevel=0.02, subdiv=1)
    S.ellipsoid('bc_light', (0.05, 0.05, 0.05), (x + 0.12, 0.52, top + 0.2), m['beacon'], layer, segments=12)
    S.box('bc_tag', (0.02, 0.18, 0.12), (x + 0.12, 0.6, top - 0.15), m['beacon'], layer)


def pebbles(m, layer, rng, x0, x1, z, count):
    for k in range(count):
        x = rng.uniform(x0, x1)
        r = rng.uniform(0.06, 0.22)
        S.rock(f'pebble{k}', rng, (x, rng.uniform(0.2, 1.5), z + r * 0.3), (r * 1.4, r, r * 0.7), m['rock'], layer,
               roughness=0.3, subdiv=2, seed=rng.random() * 90)


def gravel(m, layer, rng, x0, x1, y0, y1, count, size=(0.012, 0.055)):
    """Fine grit on a walkable top: one mesh of many small flattened stones (cheap to render, reads as
    texture at gameplay scale)."""
    bm = bmesh.new()
    for _ in range(count):
        r = rng.uniform(*size)
        t = Matrix.Translation((rng.uniform(x0, x1), rng.uniform(y0, y1), r * 0.25))
        rot = Matrix.Rotation(rng.uniform(0, math.tau), 4, 'Z') @ Matrix.Rotation(rng.uniform(-0.4, 0.4), 4, 'X')
        sc = Matrix.Diagonal((rng.uniform(1.0, 1.8), rng.uniform(0.8, 1.3), rng.uniform(0.45, 0.8), 1.0))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=t @ rot @ sc)
    return S.obj_from_bmesh('gravel', bm, m['rock'], layer)


def rubble(m, layer, rng):
    """A crumbling corner where the ledge breaks off, and loose stones along the lip."""
    for k, (x, y, z, r) in enumerate(((1.25, -1.2, -0.12, 0.38), (1.55, -0.3, -0.2, 0.3), (0.85, -1.45, -0.05, 0.22),
                                      (1.4, 0.7, -0.1, 0.26))):
        S.rock(f'rubble{k}', rng, (x, y, z), (r * 1.3, r, r * 0.8), m['rock'], layer, roughness=0.4, subdiv=3,
               seed=80.0 + k, scale=0.5)
    for k in range(10):
        x = rng.uniform(-16.5, 0.5)
        r = rng.uniform(0.05, 0.12)
        S.rock(f'lip_stone{k}', rng, (x, rng.uniform(-1.45, -1.2), r * 0.3), (r * 1.4, r, r * 0.7), m['rock'], layer,
               roughness=0.35, subdiv=2, seed=rng.random() * 90)


def roots(m, layer, rng, count=9):
    """Thin dark roots hanging from under the ledge lip (life at the edges, never on the walk line)."""
    for k in range(count):
        x = rng.uniform(-16.0, 0.8)
        p = Vector((x, -1.62, -0.42))
        r = 0.024
        length = rng.uniform(0.5, 1.5)
        curl = rng.uniform(-0.25, 0.25)
        for seg in range(5):
            q = p + Vector((curl * 0.2 * (seg + 1) * rng.uniform(0.6, 1.2), -0.03, -length / 5))
            S.limb(f'root{k}_{seg}', p, q, r, r * 0.75, m['root'], layer, verts=6, subdiv=0)
            p, r = q, r * 0.75


def mite(name, m, layer, at, normal, heading, size=0.2):
    """A crystal mite: a small dark beetle with two dim glow spots, flat on a surface (`normal`). Ambient
    only (no collision, no damage); in the engine it crawls in short, irregular bursts."""
    n = Vector(normal).normalized()
    side = n.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(n).normalized()
    fwd = (side * math.cos(heading) + up * math.sin(heading)).normalized()
    lat = n.cross(fwd).normalized()
    root = S.empty(name, Vector(at) + n * size * 0.12, None, layer)
    root.matrix_world = Matrix.Translation(Vector(at) + n * size * 0.12) @ Matrix(
        (fwd, lat, n)).transposed().to_4x4()
    S.ellipsoid(name + '_body', (size * 0.5, size * 0.3, size * 0.16), (0, 0, 0), m['mite'], layer, segments=16)
    body = bpy.data.objects[name + '_body']
    body.parent = root
    S.ellipsoid(name + '_head', (size * 0.16, size * 0.18, size * 0.11), (size * 0.5, 0, -size * 0.02), m['mite'],
                layer, segments=12)
    bpy.data.objects[name + '_head'].parent = root
    for k, sx in enumerate((-0.15, 0.12)):
        S.ellipsoid(f'{name}_spot{k}', (size * 0.045,) * 3, (size * sx, 0, size * 0.15), m['mite_glow'], layer,
                    segments=8)
        bpy.data.objects[f'{name}_spot{k}'].parent = root
    for k, fx in enumerate((0.25, 0.0, -0.25)):
        for sy in (-1, 1):
            a = Vector((size * fx, sy * size * 0.25, 0))
            b = Vector((size * (fx + 0.12), sy * size * 0.55, -size * 0.12))
            leg = S.limb(f'{name}_leg{k}{sy}', a, b, size * 0.025, size * 0.012, m['mite'], layer, verts=6, subdiv=0)
            leg.parent = root
    return root


def mites_on(m, layer, rng, target, spots):
    """Places mites on `target`'s surface by casting rays from the camera side (x, z) onto it."""
    bpy.context.view_layer.update()
    for k, (x, z) in enumerate(spots):
        hit, loc, normal, _ = target.ray_cast(Vector((x, -12.0, z)), Vector((0, 1, 0)))
        if hit:
            mite(f'mite{k}', m, layer, loc, normal, rng.uniform(0, math.tau), rng.uniform(0.22, 0.3))


def play_layer(m, layer, seed=11):
    rng = random.Random(seed)
    ledge_obj = ledge(m, layer)
    pebbles(m, layer, rng, -16.5, 1.2, 0.0, 26)
    gravel(m, layer, random.Random(seed + 1), -17.0, 1.3, -1.2, 1.6, 520)
    rubble(m, layer, random.Random(seed + 2))
    roots(m, layer, random.Random(seed + 3))
    mites_on(m, layer, random.Random(seed + 4), ledge_obj,
             ((-6.6, -0.95), (-2.3, -1.7), (-10.1, -1.35), (-0.6, -2.4), (-13.2, -0.8)))
    island(m, layer, rng)
    catwalk(m, layer, rng)
    beacon(m, layer)
    for k, (x, y, h) in enumerate(((-14.6, 1.15, 2.4), (-9.2, 1.35, 1.4), (0.6, 1.3, 2.2), (17.6, 0.9, 2.0))):
        z = 0.0 if x < 5 else ISLAND_TOP
        S.crystal_cluster(f'ledge_cr{k}', rng, (x, y, z), 7, h, 0.12 * h, 0.5, 0.42, m['crystal'], layer, tip=0.22)
    for k, (x, z, w, h) in enumerate(((-14.2, -2.9, 1.5, 2.2), (-7.6, -4.4, 1.9, 2.4), (-2.6, -2.4, 1.2, 1.6))):
        S.rock(f'buttress{k}', rng, (x, -2.05, z), (w, 0.9, h), m['rock'], layer, roughness=0.35, subdiv=4,
               seed=60.0 + k, scale=0.6)
    for k, (x, z, h) in enumerate(((-6.2, -2.7, 0.9), (0.4, -1.4, 0.7), (-12.8, -3.6, 1.1))):
        S.crystal_cluster(f'face_cr{k}', rng, (x, -1.7, z), 3, h, 0.2 * h, 0.2, 0.3, m['crystal'], layer,
                          outward=1.0)


# Scenery ------------------------------------------------------------------------------------------

def crystal_tree(name, rng, base, height, m, layer):
    S.crystal_cluster(name, rng, base, rng.randint(6, 11), height, height * 0.05, height * 0.12, 0.42,
                      m['crystal_big'], layer, tip=0.2)
    S.rock(name + '_root', rng, (base[0], base[1], base[2] - height * 0.04), (height * 0.16, height * 0.12,
                                                                             height * 0.08),
           m['rock_far'], layer, roughness=0.4, subdiv=3, seed=rng.random() * 50)


def floating_island(name, rng, loc, size, m, layer):
    S.rock(name, rng, loc, size, m['rock_far'], layer, roughness=0.36, subdiv=3, top=0.65, bottom_stretch=2.6,
           seed=rng.random() * 50, scale=0.8)
    top_z = loc[2] + 0.65 * size[2]
    for k in range(3):
        x = loc[0] + rng.uniform(-0.6, 0.6) * size[0]
        S.crystal_cluster(f'{name}_cr{k}', rng, (x, loc[1], top_z), 4, size[2] * rng.uniform(1.2, 2.2),
                          size[2] * 0.18, size[0] * 0.2, 0.4, m['crystal_big'], layer)
    S.crystal_cluster(f'{name}_hang', rng, (loc[0], loc[1], loc[2] - size[2] * 1.9), 4, size[2] * 1.6,
                      size[2] * 0.2, size[0] * 0.25, 0.3, m['crystal_hang'], layer, down=True)


def _hull_section(u, ry, rz, zc, length, n=20, power=2.6):
    """A boxy superellipse cross-section (flatter belly) at station u (0 nose .. 1 tail)."""
    x = (u - 0.5) * length
    pts = []
    for k in range(n):
        a = math.tau * k / n
        c, s_ = math.cos(a), math.sin(a)
        yy = ry * math.copysign(abs(c) ** (2 / power), c)
        zz = rz * math.copysign(abs(s_) ** (2 / power), s_)
        if zz < 0:
            zz *= 0.72
        pts.append(Vector((x, yy, zz + zc)))
    return pts


def _prism(name, outline, thickness, axis, mat, layer, parent):
    """Extrudes a 2D outline (in the plane normal to `axis`: 'y' -> (x, z), 'z' -> (x, y)) into a slab."""
    bm = bmesh.new()
    lo, hi = [], []
    for a, b in outline:
        if axis == 'y':
            lo.append(bm.verts.new((a, -thickness / 2, b)))
            hi.append(bm.verts.new((a, thickness / 2, b)))
        else:
            lo.append(bm.verts.new((a, b, -thickness / 2)))
            hi.append(bm.verts.new((a, b, thickness / 2)))
    n = len(outline)
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((lo[k], lo[j], hi[j], hi[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = S.obj_from_bmesh(name, bm, mat, layer)
    mod = obj.modifiers.new('bevel', 'BEVEL')
    mod.width = thickness * 0.3
    mod.segments = 2
    if parent is not None:
        S.set_parent(obj, parent)
    return obj


def lantern_wreck(m, layer, loc, length=44.0, yaw=25.0, rng=None):
    """The Lantern, Kes's courier ship, broken in two in the crash (spec 2.4 prologue). Built to read as
    a ship from 150 m: a boxy hull with a cockpit canopy, a dorsal spine with the amber 'lantern' beacon
    it is named for, a swept wing, twin engine pods, a tail fin; torn plating and ribs at the break,
    hanging cables, the other wing lying in the debris. Parts are built in ship space (nose at -x) and
    parented while the halves are untransformed; then the halves are placed."""
    rng = rng or random.Random(7)
    L = length
    st = [(0.0, 0.25, 0.2, -0.2), (0.03, 0.9, 0.7, -0.15), (0.08, 1.9, 1.4, 0.0), (0.15, 2.8, 2.0, 0.15),
          (0.25, 3.5, 2.5, 0.3), (0.36, 3.9, 2.7, 0.35), (0.47, 4.1, 2.8, 0.35), (0.53, 4.1, 2.8, 0.35),
          (0.64, 4.0, 2.75, 0.35), (0.76, 3.7, 2.6, 0.3), (0.88, 3.2, 2.3, 0.25), (0.96, 2.8, 2.0, 0.2),
          (1.0, 2.5, 1.8, 0.2)]
    front = S.loft('wreck_front', [_hull_section(u, a, b, c, L) for u, a, b, c in st if u <= 0.47], m['hull'],
                   layer, cap=False)
    rear = S.loft('wreck_rear', [_hull_section(u, a, b, c, L) for u, a, b, c in st if u >= 0.53], m['hull'],
                  layer, cap=False)
    X = lambda u: (u - 0.5) * L  # noqa: E731
    # Nose cap and tail cap (the break ends stay open and torn).
    S.ellipsoid('wreck_nosecap', (0.6, 0.4, 0.35), (X(0.0) + 0.3, 0, -0.2), m['hull'], layer, front)
    S.box('wreck_tailcap', (0.4, 4.6, 3.2), (X(1.0) - 0.1, 0, 0.2), m['hull_dark'], layer, rear, bevel=0.3)
    # Canopy and cockpit glow.
    S.ellipsoid('wreck_canopy', (3.4, 1.5, 0.95), (X(0.15), 0, 0.15 + 1.75), m['canopy'], layer, front)
    # Dorsal spine and the lantern beacon.
    S.box('wreck_spine_f', (X(0.47) - X(0.28), 1.2, 0.8), ((X(0.28) + X(0.47)) / 2, 0, 0.35 + 2.75), m['hull_dark'],
          layer, front, bevel=0.15)
    S.box('wreck_spine_r', (X(0.95) - X(0.53), 1.2, 0.8), ((X(0.53) + X(0.95)) / 2, 0, 0.3 + 2.75), m['hull_dark'],
          layer, rear, bevel=0.15)
    S.cone('wreck_lantern_base', 0.8, 0.65, 1.0, (X(0.63), 0, 3.9), m['hull_dark'], layer, rear, bevel=0.08)
    S.ellipsoid('wreck_lantern', (0.6, 0.6, 0.45), (X(0.63), 0, 4.55), m['lamp'], layer, rear, segments=16)
    # Near wing (swept), engine pods, tail fin.
    _prism('wreck_wing', [(X(0.57), -3.9), (X(0.80), -3.9), (X(0.93), -11.5), (X(0.85), -11.8)], 0.45, 'z',
           m['hull'], layer, rear).location.z = -0.3
    for k, yy in enumerate((-4.7, 4.7)):
        S.cone(f'wreck_pod{k}', 1.35, 1.2, 9.0, (X(0.88), yy, -1.0), m['hull_dark'], layer, rear,
               rot=(0, math.radians(90), 0), bevel=0.1)
        S.cone(f'wreck_nozzle{k}', 1.05, 1.4, 1.6, (X(0.88) + 5.2, yy, -1.0), m['hull_dark'], layer, rear,
               rot=(0, math.radians(90), 0), verts=24)
    S.ellipsoid('wreck_ember', (0.12, 0.8, 0.8), (X(0.88) + 5.9, -4.7, -1.0), m['lamp'], layer, rear, segments=12)
    _prism('wreck_fin', [(X(0.84), 2.6), (X(0.97), 2.6), (X(1.02), 8.6), (X(0.95), 8.8)], 0.5, 'y', m['hull_dark'],
           layer, rear)
    # Torn plating and exposed ribs at the break, hanging cables.
    for piece, u, sign in ((front, 0.47, 1), (rear, 0.53, -1)):
        _, ry, rz, zc = [v for v in st if abs(v[0] - u) < 1e-6][0]
        angles = sorted(rng.uniform(0, math.tau) for _ in range(7))
        for k, a in enumerate(angles):
            p = Vector((X(u) + sign * rng.uniform(0.1, 1.6), math.cos(a) * ry * 0.98, zc + math.sin(a) * rz * 0.9))
            S.box(f'wreck_tear{u}_{k}', (rng.uniform(0.5, 2.4), 0.12, rng.uniform(0.6, 2.0)), p, m['hull'], layer,
                  piece, rot=(rng.uniform(-0.9, 0.9) + a, rng.uniform(-0.8, 0.8), rng.uniform(-0.7, 0.7)))
        for k, du in enumerate((0.01, 0.045)):
            rib = S.torus(f'wreck_rib{u}_{k}', 1.0, 0.25 / rz, (X(u) - sign * du * L, 0, zc), m['hull_dark'], layer,
                          None, rot=(0, math.radians(90), 0))
            rib.scale = (rz * 0.95, ry * 0.95, 1.0)
            S.set_parent(rib, piece)
        S.ellipsoid(f'wreck_bulkhead{u}', (0.2, ry * 0.9, rz * 0.85), (X(u) - sign * 3.5, 0, zc), m['hull_dark'],
                    layer, piece)
    for k, (yy, drop) in enumerate(((-2.6, 5.5), (-0.8, 7.0), (1.9, 4.2))):
        p = Vector((X(0.53) - 0.2, yy, -1.2))
        for seg in range(4):
            q = p + Vector((-0.9, 0.0, -drop / 4 + seg * 0.25))
            S.limb(f'wreck_cable{k}_{seg}', p, q, 0.14, 0.13, m['hull_dark'], layer, rear, verts=8, subdiv=0)
            p = q
    # Emergency lamps along the near side, still lit.
    for k, (u, z) in enumerate(((0.2, 0.9), (0.33, 1.2), (0.6, 1.0), (0.72, 1.3), (0.84, 0.6))):
        _, ry, rz, zc = min(st, key=lambda v: abs(v[0] - u))
        S.ellipsoid(f'wreck_lamp{k}', (0.32, 0.32, 0.32), (X(u), -ry * 0.98, zc + z), m['lamp'], layer,
                    front if u < 0.5 else rear, segments=10)
    # Place the halves: nose dug in, stern resting tilted with its tail raised.
    for piece, pitch, roll, offset in ((front, -18, -4, (0, 0, 0)), (rear, -11, 16, (5.0, 3.0, -0.6))):
        piece.rotation_euler = (math.radians(roll), math.radians(pitch), math.radians(yaw))
        piece.location = Vector(loc) + Vector(offset)
    # The torn-off far wing and hull fragments in the debris field.
    debris = random.Random(19)
    wing = _prism('wreck_wing_lost', [(0, 0), (5.5, 0), (8.0, -7.0), (6.2, -7.4)], 0.45, 'z', m['hull'], layer, None)
    wing.rotation_euler = (math.radians(8), math.radians(-14), math.radians(yaw + 140))
    wing.location = Vector(loc) + Vector((-16.0, 6.0, -2.6))
    for k in range(9):
        frag = S.box(f'wreck_frag{k}', (debris.uniform(0.8, 2.6), debris.uniform(0.6, 1.8), debris.uniform(0.15, 0.5)),
                     Vector(loc) + Vector((debris.uniform(-14, 16), debris.uniform(-4, 9), -3.0)), m['hull'], layer,
                     rot=(debris.uniform(-0.6, 0.6), debris.uniform(-0.6, 0.6), debris.uniform(0, math.tau)))
        frag.name = f'wreck_frag{k}'
    return front, rear


def watcher(m, layer, loc, s=1.0, stride=0.35):
    """The giant in the fog: a colossal Custodian walking far away (about 160 m tall). Never an entity,
    never lit, never in the danger colour; in the engine it drifts across the far layer once in a long
    while, silently. A detail for players who look."""
    x, y, z0 = loc
    bz = z0 + 118 * s
    rd = math.radians
    S.ellipsoid('watcher_body', (34 * s, 14 * s, 15 * s), (x, y, bz), m['giant'], layer, rot=(0, rd(-10), 0))
    for k, (dx, r) in enumerate(((-18, 11), (-4, 13), (10, 12), (22, 9))):
        S.ellipsoid(f'watcher_plate{k}', (r * 0.9 * s, 12 * s, r * 0.75 * s), (x + dx * s, y, bz + 9 * s - abs(dx) * 0.12 * s),
                    m['giant'], layer, rot=(0, rd(-10 + dx * 0.6), 0))
    S.limb('watcher_neck', (x - 26 * s, y, bz + 3 * s), (x - 44 * s, y, bz - 20 * s), 6 * s, 3 * s, m['giant'], layer)
    S.ellipsoid('watcher_head', (9 * s, 5 * s, 4.5 * s), (x - 48 * s, y, bz - 25 * s), m['giant'], layer,
                rot=(0, rd(30), 0))
    for k, (hx, hy, phase) in enumerate(((-18, -9, 0.0), (-16, 9, 1.0), (18, -9, 1.0), (20, 9, 0.0))):
        swing = stride * (1 if phase else -1)
        hip = Vector((x + hx * s, y + hy * s, bz - 4 * s))
        knee = Vector((x + (hx * 1.6 - 14 * swing) * s, y + hy * 1.4 * s, bz + 48 * s))
        foot = Vector((x + (hx * 1.8 - 30 * swing) * s, y + hy * 1.3 * s, z0))
        S.limb(f'watcher_thigh{k}', hip, knee, 4.2 * s, 3.2 * s, m['giant'], layer, verts=12)
        S.limb(f'watcher_shin{k}', knee, foot, 3.2 * s, 1.2 * s, m['giant'], layer, verts=12)


def scenery(m, seed=21):
    rng = random.Random(seed)
    # near: 60-80 m from the camera
    crystal_tree('near_tree0', rng, (-33, 32, -16), 26, m, 'near')
    crystal_tree('near_tree1', rng, (-17, 40, -22), 22, m, 'near')
    S.rock('near_pillar', rng, (31, 36, -16), (5.0, 5.0, 24), m['rock_far'], 'near', roughness=0.36, subdiv=5,
           seed=9.0, scale=0.35)
    S.rock('near_pillar_cap', rng, (30, 36, 6.5), (3.6, 3.4, 2.4), m['rock_far'], 'near', roughness=0.4, subdiv=4,
           seed=19.0, scale=0.4)
    S.crystal_cluster('near_pillar_cr', rng, (30.5, 35.5, 7.5), 7, 8, 0.45, 2.0, 0.45, m['crystal_big'], 'near',
                      tip=0.22)
    # mid: 100-200 m
    for k in range(60):
        x = rng.uniform(-150, 150)
        y = rng.uniform(70, 170)
        if 2 < x < 60 and y < 178:
            continue
        h = rng.uniform(7, 22) * (1.0 + y / 400)
        crystal_tree(f'mid_tree{k}', rng, (x, y, -30 + rng.uniform(-6, 6)), h, m, 'mid')
    for k in range(14):
        x = rng.uniform(-150, 150)
        y = rng.uniform(80, 180)
        if 2 < x < 60 and y < 178:
            continue
        h = rng.uniform(22, 48)
        r = h * rng.uniform(0.12, 0.2)
        S.rock(f'mid_spire{k}', rng, (x, y, -34 + h * 0.5), (r, r * 0.8, h * 0.55), m['rock_far'], 'mid',
               roughness=0.32, subdiv=4, seed=70.0 + k, scale=0.45)
        S.crystal_cluster(f'mid_spire_cr{k}', rng, (x, y - r * 0.3, -34 + h * 1.02), 5, h * 0.3, h * 0.025,
                          r * 0.6, 0.45, m['crystal_big'], 'mid', tip=0.22)
    S.rock('wreck_mound', rng, (WRECK[0] - 2, WRECK[1] + 1, -19.0), (30, 20, 7), m['rock_far'], 'mid', roughness=0.3,
           subdiv=4, top=0.6, seed=12.0, scale=0.7)
    lantern_wreck(m, 'mid', WRECK)
    fire = bpy.data.lights.new('wreck_fire', 'POINT')
    fire.energy = 9000
    fire.color = stage.lin('#FF9A4A')
    fire.shadow_soft_size = 1.5
    fire_obj = bpy.data.objects.new('wreck_fire', fire)
    stage.collection('mid').objects.link(fire_obj)
    fire_obj.location = Vector(WRECK_BREAK) + Vector((0, -3.0, 1.5))
    floating_island('mid_float0', rng, (-50, 150, 21), (10, 7, 3.6), m, 'mid')
    floating_island('mid_float1', rng, (88, 170, 52), (8, 6, 3.2), m, 'mid')
    # far: 250-900 m
    for k, (x, y, w, h) in enumerate(((-420, 760, 230, 160), (-170, 820, 160, 110), (260, 780, 260, 190),
                                      (520, 700, 160, 120), (40, 900, 200, 80))):
        S.rock(f'mesa{k}', rng, (x, y, -60 + h * 0.3), (w, 60, h), m['rock_far'], 'far', roughness=0.38,
               subdiv=5, top=0.62, seed=30.0 + k, scale=0.32)
    for k, (x, y, h) in enumerate(((-300, 560, 210), (-215, 600, 150), (175, 620, 190), (330, 520, 130))):
        S.crystal_cluster(f'spire{k}', rng, (x, y, -70), 6, h, h * 0.07, h * 0.12, 0.3, m['crystal_big'], 'far')
    for k, (x, y, z, s) in enumerate(((60, 520, 130, 18), (190, 470, 175, 14), (330, 640, 105, 22))):
        floating_island(f'far_float{k}', rng, (x, y, z), (s, s * 0.7, s * 0.4), m, 'far')
    watcher(m, 'giant', WATCHER, s=1.4)


def foreground(m, seed=31):
    """Dark framing shapes close to the camera (blurred and darkened in comp)."""
    rng = random.Random(seed)
    S.rock('fg_rock', rng, (-5.6, -22.5, 0.2), (2.6, 1.3, 1.9), m['rock'], 'fore', roughness=0.35, seed=41.0)
    S.crystal_cluster('fg_cr', rng, (-4.6, -22.2, 1.6), 4, 2.4, 0.3, 0.6, 0.5, m['crystal'], 'fore')
    S.crystal_cluster('fg_hang', rng, (6.2, -21.5, 8.6), 4, 2.6, 0.32, 0.6, 0.35, m['crystal_hang'], 'fore',
                      down=True)
    S.rock('fg_hang_rock', rng, (6.6, -21.5, 9.3), (2.0, 1.2, 1.0), m['rock'], 'fore', roughness=0.35, seed=43.0)
