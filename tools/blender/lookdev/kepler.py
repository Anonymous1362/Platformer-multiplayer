"""Kepler-186f ("The Garden") lookdev environment: the crash-site cliffs above a fog-filled crystal
forest, the Lantern wreck in the valley, floating crystal islands, the broken Heartstar in the sky.

Layers (each its own collection, rendered alone, stacked by comp like the game's parallax):
- `play`  (gameplay plane, orthographic): the cliff ledge, the one-way survey catwalk, the floating
          island, decor crystals behind the walk line, a Meridian survey beacon.
- `near`, `mid`, `far` (perspective): scenery at roughly 60-80 m, 100-200 m and 250-900 m.
- `fore`  (perspective, 8-14 m from the camera): dark, out-of-focus framing shapes.

Readability rules built in: walkable tops are flat and lit; one-way platforms are thin grates (a
different material and silhouette from solid rock); decor sits behind the walk line, never in front.
"""

import math
import random

from mathutils import Vector

from studio import mats, shapes as S

LEDGE_X = (-17.5, 1.6)
CATWALK = {'x': (3.4, 7.6), 'z': 2.3}
ISLAND_TOP = -0.9


def materials(look):
    a, b, top = look['rock']
    c = look['crystal']
    hull_light, hk = look['hull_light']
    return {
        'rock': mats.rock('rock', a, b, top),
        'rock_far': mats.rock('rock_far', a, b, top, top_amount=0.5, scale=0.06, bump=0.2),
        'crystal': mats.crystal('crystal', c['base'], c['glow'], c['emit'], c['edge']),
        'crystal_hang': mats.crystal('crystal_hang', c['base'], c['glow'], c['emit'], c['edge'], invert=True),
        'crystal_big': mats.crystal('crystal_big', c['base'], c['glow'], c['emit'] * 0.4, c['edge']),
        'hull': mats.surface('hull', look['hull'], rough=0.5, metal=0.4, variation=0.12, scale=0.4),
        'hull_dark': mats.surface('hull_dark', look['metal'], rough=0.6, metal=0.3, variation=0.1, scale=0.5),
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
                      down=True)


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


def play_layer(m, layer, seed=11):
    rng = random.Random(seed)
    ledge(m, layer)
    pebbles(m, layer, rng, -16.5, 1.2, 0.0, 26)
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


def lantern_wreck(m, layer, loc, length=46.0, yaw=16.0):
    """The Lantern, broken in two: nose buried, stern raised, emergency lamps still lit. Parts are built
    in ship space and parented while the halves are untransformed, then the halves are placed."""
    stations = [(0.0, 0.25, 0.25), (0.05, 0.05, 0.04), (0.16, 0.1, 0.07), (0.36, 0.13, 0.087),
                (0.48, 0.133, 0.09), (0.52, 0.133, 0.091), (0.66, 0.126, 0.091), (0.82, 0.109, 0.08),
                (0.94, 0.091, 0.067), (1.0, 0.078, 0.059)]
    stations = [(u, ry * length, rz * length) if u > 0 else (u, 0.3, 0.3) for u, ry, rz in stations]

    def section(u, ry, rz, n=18):
        x = (u - 0.5) * length
        pts = []
        for k in range(n):
            a = math.tau * k / n
            yy, zz = math.cos(a) * ry, math.sin(a) * rz
            if zz < 0:
                zz *= 0.7
            pts.append(Vector((x, yy, zz)))
        return pts

    front = S.loft('wreck_front', [section(*st) for st in stations if st[0] <= 0.48], m['hull'], layer)
    rear = S.loft('wreck_rear', [section(*st) for st in stations if st[0] >= 0.52], m['hull'], layer)
    k = length / 70.0
    for i, u in enumerate((0.62, 0.72, 0.82, 0.92)):
        S.torus(f'wreck_rib{i}', (4.4 - 0.5 * i) * k, 0.35 * k, ((u - 0.5) * length, 0, 0), m['hull_dark'], layer,
                rear, rot=(0, math.radians(90), 0))
    for i, y in enumerate((-6.6 * k, 6.6 * k)):
        S.cone(f'wreck_engine{i}', 2.2 * k, 1.8 * k, 14 * k, (31.0 * k, y, -0.5 * k), m['hull_dark'], layer, rear,
               rot=(0, math.radians(90), 0))
    S.box('wreck_fin', (11 * k, 0.7 * k, 7.5 * k), (27 * k, 0, 6.5 * k), m['hull_dark'], layer, rear, bevel=0.3 * k,
          rot=(0, math.radians(-12), 0))
    for i, (x, y, z) in enumerate(((-14, -4.2, 2.6), (-6, -5.6, 1.8), (2, -5.8, 2.2), (16, -5.6, 2.0),
                                   (24, -5.0, 1.2), (8, -5.7, -1.2))):
        S.ellipsoid(f'wreck_lamp{i}', (0.5 * k, 0.5 * k, 0.5 * k), (x * k, y * k, z * k), m['lamp'], layer,
                    rear if x > 0 else front, segments=10)
    for piece, pitch, offset in ((front, -18, (0, 0, 0)), (rear, -10, (6.0 * k, 2.5 * k, 2.0 * k))):
        piece.rotation_euler = (math.radians(2), math.radians(pitch), math.radians(yaw))
        piece.location = Vector(loc) + Vector(offset)
    return front, rear


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
    S.rock('wreck_mound', rng, (30, 152, -25), (34, 22, 7), m['rock_far'], 'mid', roughness=0.3, subdiv=4, top=0.6,
           seed=12.0, scale=0.7)
    lantern_wreck(m, 'mid', (30, 150, -17))
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


def foreground(m, seed=31):
    """Dark framing shapes close to the camera (blurred and darkened in comp)."""
    rng = random.Random(seed)
    S.rock('fg_rock', rng, (-5.6, -22.5, 0.2), (2.6, 1.3, 1.9), m['rock'], 'fore', roughness=0.35, seed=41.0)
    S.crystal_cluster('fg_cr', rng, (-4.6, -22.2, 1.6), 4, 2.4, 0.3, 0.6, 0.5, m['crystal'], 'fore')
    S.crystal_cluster('fg_hang', rng, (6.2, -21.5, 8.6), 4, 2.6, 0.32, 0.6, 0.35, m['crystal_hang'], 'fore',
                      down=True)
    S.rock('fg_hang_rock', rng, (6.6, -21.5, 9.3), (2.0, 1.2, 1.0), m['rock'], 'fore', roughness=0.35, seed=43.0)
