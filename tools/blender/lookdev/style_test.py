"""Art & UI B style test: one Kepler-186f gameplay moment in each candidate look.

    npm run art:lookdev                 # all looks, full quality -> docs/art/style-test/
    python3 -I tools/blender/lookdev/style_test.py --quick A   # half size, few samples, one look

Every frame is assembled from the same layer types the game draws (spec 9.3): a painted sky, three
fogged scenery layers, the gameplay layer, sprites (hero, Crawler mirrored with flipX, a Star Shard),
contact shadows, additive light shafts and motes, a blurred foreground, then the post chain (bloom,
grade, vignette, grain) and the HUD. So a frame is a target the engine can actually hit.

Outputs per look: the frame, a grayscale copy (readability review), and value-contrast numbers; then
one board comparing all looks with close-ups of Kes and the Crawler.
"""

import json
import math
import os
import random
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import bpy  # noqa: E402,F401  (bpy 5.3: bmesh and mathutils import only after bpy)
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from studio import comp as K, mats, shapes as S, stage  # noqa: E402
from studio.looks import LOOKS  # noqa: E402

import custodian  # noqa: E402
import kepler  # noqa: E402
import kes  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(ROOT, 'docs', 'art', 'style-test')
TILT = 10.0  # gameplay camera pitch: shows platform tops (extruded depth, spec 9.1)
CAM_Z = 3.98  # puts the ledge top (z = 0) at y = 770 px on a 1080 px frame
BG_DIST = 34.0
HERO_X, CRAWLER_X, SHARD = -4.0, 13.0, (5.5, 0.0, 3.4)


def build_shard(look, layer):
    color, k = look['shard']
    body = mats.crystal('shard_body', color, color, k, '#FFF4D6', rough=0.15)
    core = mats.emissive('shard_core', '#FFF4D6', k * 2.5)
    bm = bmesh.new()
    rng = random.Random(3)
    S.add_crystal(bm, rng, (0, 0, -0.22), 0.5, 0.13, sides=6, tip=0.45, irregular=0.12)
    obj = S.obj_from_bmesh('shard', bm, body, layer)
    obj.rotation_euler = (math.radians(8), math.radians(-14), math.radians(20))
    S.ellipsoid('shard_core', (0.04, 0.04, 0.09), (0, 0, 0.02), core, layer, obj, segments=12)
    return obj


def sprite_cam(name, center, res, density):
    h_m = res[1] * math.cos(math.radians(TILT)) / (stage.U_PER_M * density)
    return stage.ortho_camera(name, center, h_m, res, TILT)


def render_look(lid, tmp, scale, samples, closeups=True):
    look = LOOKS[lid]
    stage.new_scene(look, samples)
    m = kepler.materials(look)
    kepler.play_layer(m, 'play')
    kepler.scenery(m)
    kepler.foreground(m)
    joints = kes.build(look, 'hero')
    kes.pose(joints, 'aim')
    crawler = custodian.build(look, 'crawler')
    custodian.pose(crawler, 'alert')
    build_shard(look, 'shard')

    W, H = int(stage.FRAME_W * scale), int(stage.FRAME_H * scale)
    view_h = stage.VIEW_H_U / stage.U_PER_M
    play_cam = stage.ortho_camera('play_cam', (0, 0, CAM_Z), view_h * math.cos(math.radians(TILT)), (W, H), TILT)
    fov = math.degrees(2 * math.atan(view_h / 2 / BG_DIST))
    bg_cam = stage.perspective_camera('bg_cam', (0, -BG_DIST, CAM_Z), fov, (W, H), tilt_deg=2.0)
    d = 2 * scale
    hero_cam = sprite_cam('hero_cam', (0, 0, 0.98), (int(240 * d / 2), int(300 * d / 2)), d)
    crawler_cam = sprite_cam('crawler_cam', (0.05, 0, 0.5), (int(260 * d / 2), int(170 * d / 2)), d)
    shard_cam = sprite_cam('shard_cam', (0, 0, 0.0), (int(96 * d / 2), int(96 * d / 2)), d)

    paths = {}
    for layer, cam, rig in (('far', bg_cam, 'rig_world'), ('mid', bg_cam, 'rig_world'),
                            ('near', bg_cam, 'rig_world'), ('play', play_cam, 'rig_world'),
                            ('fore', bg_cam, 'rig_world'), ('hero', hero_cam, 'rig_sprite'),
                            ('crawler', crawler_cam, 'rig_sprite'), ('shard', shard_cam, 'rig_sprite')):
        paths[layer] = stage.render_layer(layer, cam, os.path.join(tmp, f'{lid}_{layer}.png'), rig)

    anchors = {
        'hero': stage.to_px(play_cam, (HERO_X, 0, 0)),
        'crawler': stage.to_px(play_cam, (CRAWLER_X, 0, kepler.ISLAND_TOP)),
        'shard': stage.to_px(play_cam, SHARD),
        'hero_feet': stage.to_px(hero_cam, (0, 0, 0)),
        'crawler_feet': stage.to_px(crawler_cam, (0, 0, 0)),
        'shard_center': stage.to_px(shard_cam, (0, 0, 0)),
    }
    if closeups:
        big = sprite_cam('hero_big', (0, 0, 0.95), (560, 720), 6)
        paths['hero_big'] = stage.render_layer('hero', big, os.path.join(tmp, f'{lid}_hero_big.png'), 'rig_sprite')
        cbig = sprite_cam('crawler_big', (0.05, 0, 0.48), (640, 400), 4.2)
        paths['crawler_big'] = stage.render_layer('crawler', cbig, os.path.join(tmp, f'{lid}_crawler_big.png'),
                                                  'rig_sprite')
    return paths, anchors


# Compositing ---------------------------------------------------------------------------------------

def sky(look, H, W, rng):
    img = K.solid(H, W, (0, 0, 0))
    img[..., :3] = K.vgrad(H, W, look['sky'])
    st = look['stars']
    if st['density'] > 0:
        n = int(W * H * st['density'])
        pts = np.zeros((H, W), np.float32)
        ys = rng.integers(0, int(H * 0.62), n)
        xs = rng.integers(0, W, n)
        pts[ys, xs] = rng.uniform(0.2, 1.0, n) ** 3
        pts = K.blur(pts, 0.6) * 3.0 * st['brightness']
        img[..., :3] += pts[..., None]
    s = look['star']
    sx, sy = s['pos'][0] * W, s['pos'][1] * H
    sc = W / 1920.0
    r = K.radial(H, W, sx, sy, s['glow_radius'] * sc)
    glow = np.exp(-r * 3.2) * 0.8 + np.exp(-r * 9.0) * 0.6
    img[..., :3] += glow[..., None] * K.hexrgb(s['glow']) * s['glow_strength']
    ang = np.arctan2(*np.meshgrid(np.arange(H) - sy, np.arange(W) - sx, indexing='ij'))
    rays = (np.abs(np.cos(ang * 7.0)) ** 30 + np.abs(np.cos(ang * 11.0 + 0.6)) ** 40) * np.exp(-r * 2.2)
    img[..., :3] += (rays * s['rays'])[..., None] * K.hexrgb(s['glow'])
    core_r = s['radius'] * sc
    core = K.smoothstep(1.0, 0.82, K.radial(H, W, sx, sy, core_r))
    cracks = K.line_mask(H, W, [((sx - core_r, sy - core_r * 0.3), (sx + core_r * 0.6, sy + core_r)),
                                ((sx - core_r * 0.2, sy - core_r), (sx + core_r * 0.3, sy + core_r * 0.2)),
                                ((sx + core_r, sy - core_r * 0.5), (sx - core_r * 0.1, sy + core_r * 0.1))],
                         max(1.0, 2.2 * sc))
    core = core * (1.0 - 0.8 * K.blur(cracks, 0.8))
    for k, (dx, dy, rr) in enumerate(((1.7, -0.9, 0.22), (-1.5, 1.3, 0.16), (2.4, 0.8, 0.12))):
        core = np.maximum(core, K.smoothstep(1.0, 0.6, K.radial(H, W, sx + dx * core_r, sy + dy * core_r,
                                                                 rr * core_r)) * 0.9)
    core *= 1.0 - s['haze']
    img[..., :3] = img[..., :3] * (1 - core[..., None]) + K.hexrgb(s['core']) * core[..., None]
    sr = look['shard_rain']
    segs = []
    for _ in range(sr['count']):
        a = math.radians(rng.uniform(52, 72))
        d0 = rng.uniform(core_r * 2.5, W * 0.45)
        x0 = sx + math.cos(a) * d0 + rng.uniform(-60, 60) * sc
        y0 = sy + math.sin(a) * d0 * 0.5
        ln = rng.uniform(18, 55) * sc
        segs.append(((x0, y0), (x0 + math.cos(a) * ln, y0 + math.sin(a) * ln)))
    if segs:
        streak = K.blur(K.line_mask(H, W, segs, 1.1 * sc), 0.7)
        img[..., :3] += (K.blur(streak, 3 * sc) * 1.5 + streak)[..., None] * K.hexrgb(sr['color']) * sr['brightness']
    return img


def ground_fog(H, W, top, strength):
    ys, _ = K.vmap(H, W)
    return K.smoothstep(top, 1.0, ys) * strength


def shafts(look, H, W, rng):
    s, st = look['shafts'], look['star']
    sx, sy = st['pos'][0] * W, st['pos'][1] * H
    h4, w4 = H // 4, W // 4
    acc = np.zeros((h4, w4), np.float32)
    base = math.atan2(H * 0.9 - sy, W * 0.75 - sx)
    for _ in range(s['count']):
        a = base + rng.uniform(-0.42, 0.3)
        half = rng.uniform(0.02, 0.06)
        far = 2.5 * W
        pts = [(sx / 4, sy / 4), ((sx + math.cos(a - half) * far) / 4, (sy + math.sin(a - half) * far) / 4),
               ((sx + math.cos(a + half) * far) / 4, (sy + math.sin(a + half) * far) / 4)]
        acc += K.polygon_mask(h4, w4, pts) * rng.uniform(0.4, 1.0)
    acc = K.blur(acc, 6.0)
    r = K.radial(h4, w4, sx / 4, sy / 4, W / 4)
    acc *= np.exp(-r * 1.6) * np.clip(r * 4, 0, 1)
    acc = K.resize(acc[..., None], 4.0)[:H, :W, 0]
    if acc.shape != (H, W):
        acc = np.pad(acc, ((0, H - acc.shape[0]), (0, W - acc.shape[1])), mode='edge')
    return acc[..., None] * K.hexrgb(s['color']) * s['intensity']


def motes(look, H, W, rng, count, size, sigma):
    m = look['motes']
    acc = np.zeros((H, W), np.float32)
    xs = rng.uniform(0, W, count)
    ys = rng.uniform(0, H, count)
    br = rng.uniform(0.3, 1.0, count)
    for x, y, b in zip(xs, ys, br):
        xi, yi = int(x), int(y)
        r = max(1, int(size))
        acc[max(0, yi - r):yi + r + 1, max(0, xi - r):xi + r + 1] += b
    return K.blur(acc, sigma)[..., None] * K.hexrgb(m['color']) * m['alpha']


def rain(look, H, W, rng):
    r = look['rain']
    sc = W / 1920.0
    a = math.radians(90 + r['angle'])
    segs = []
    for _ in range(int(r['count'] * sc)):
        x, y = rng.uniform(-100, W + 100), rng.uniform(-50, H)
        ln = r['length'] * sc * rng.uniform(0.6, 1.3)
        segs.append(((x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)))
    mask = K.line_mask(H, W, segs, 1.0 * sc)
    return mask[..., None] * K.hexrgb(r['color']) * r['alpha']


def contact_shadow(img, cx, cy, w, h, alpha):
    H, W = img.shape[:2]
    ys = (np.arange(H, dtype=np.float32)[:, None] - cy) / h
    xs = (np.arange(W, dtype=np.float32)[None, :] - cx) / w
    m = np.exp(-(xs ** 2 + ys ** 2) * 2.2) * alpha
    img[..., :3] *= 1.0 - m[..., None]


def place(frame, sprite, anchor, feet, scale, flip=False):
    s = K.resize(sprite, scale)
    fx, fy = feet[0] * scale, feet[1] * scale
    if flip:
        s = K.flip_x(s)
        fx = s.shape[1] - fx
    K.over(frame, s, anchor[0] - fx, anchor[1] - fy)
    return (anchor[0] - fx, anchor[1] - fy, s.shape[1], s.shape[0])


def hud(img, look, sc):
    h = look['hud']
    x, y = 48 * sc, 44 * sc
    for i in range(5):
        K.rect(img, x + i * 40 * sc, y, 34 * sc, 6 * sc, h['color'], 0.92 if i < 4 else 0.22, radius=1)
    K.rect(img, x, y + 16 * sc, 194 * sc, 3 * sc, h['color'], 0.18)
    K.rect(img, x, y + 16 * sc, 194 * sc * 0.7, 3 * sc, h['accent'], 0.85)
    K.rect(img, x, y + 25 * sc, 194 * sc, 3 * sc, h['color'], 0.18)
    K.rect(img, x, y + 25 * sc, 194 * sc * 0.86, 3 * sc, h['color'], 0.6)
    W = img.shape[1]
    cx, cy = W - 120 * sc, y + 10 * sc
    pts = [(cx, cy - 11 * sc), (cx + 7 * sc, cy), (cx, cy + 11 * sc), (cx - 7 * sc, cy)]
    m = K.polygon_mask(img.shape[0], W, pts, 4)[..., None]
    K.over(img, np.concatenate([K.hexrgb('#F1C66A') * m, m], axis=-1))
    K.text(img, (cx + 18 * sc, cy), '128', size=int(26 * sc), color=h['color'], weight=600, tracking=1 * sc,
           anchor='lm')
    return img


def value_contrast(frame, box):
    """Mean luma inside a sprite box vs a ring around it (readability metric)."""
    x, y, w, h = [int(v) for v in box]
    H, W = frame.shape[:2]
    Y = K.luma(frame[..., :3])
    inner = Y[max(0, y):y + h, max(0, x):x + w]
    pad = int(max(w, h) * 0.6)
    outer = Y[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad]
    return float(inner.mean()), float(outer.mean())


def compose(lid, paths, anchors, scale):
    look = LOOKS[lid]
    rng = np.random.default_rng(5)
    sc = scale
    H, W = int(stage.FRAME_H * sc), int(stage.FRAME_W * sc)
    f = look['fog']
    frame = sky(look, H, W, rng)
    gf = ground_fog(H, W, f['ground_top'], f['ground'])
    # Aerial perspective: distant layers fade toward the sky behind them, tinted by the fog colour.
    air = K.blur(frame[..., :3], 40 * sc)
    for name, amount, ground, tint in (('far', f['far'], 1.0, 0.25), ('mid', f['mid'], 0.9, 0.45),
                                       ('near', f['near'], 0.65, 0.6)):
        layer = K.load(paths[name])
        color = air * (1 - tint) + K.hexrgb(f['color']) * tint
        K.fog(layer, color, np.clip(amount + (1 - amount) * gf * ground, 0, 1))
        K.over(frame, layer)
        if name == 'mid':
            sheet = K.solid(H, W, K.hexrgb(f['ground_color']))
            sheet *= (gf * 0.55)[..., None]
            K.over(frame, sheet)
    K.add(frame, shafts(look, H, W, random.Random(9)))
    K.add(frame, motes(look, H, W, np.random.default_rng(3), look['motes']['count'], 1, 0.8 * sc))
    low = K.solid(H, W, K.hexrgb(f['ground_color']))
    low *= (K.smoothstep(0.78, 1.0, K.vmap(H, W)[0]) * f['ground'] * 0.6)[..., None]
    K.over(frame, low)
    play = K.load(paths['play'])
    K.fog(play, f['color'], f['play'])
    K.over(frame, play)
    hx, hy = anchors['hero']
    cx, cy = anchors['crawler']
    contact_shadow(frame, hx, hy + 2 * sc, 42 * sc, 7 * sc, 0.55)
    contact_shadow(frame, cx, cy + 2 * sc, 52 * sc, 7 * sc, 0.5)
    shard = K.blank(H, W)
    place(shard, K.load(paths['shard']), anchors['shard'], anchors['shard_center'], 0.5)
    K.add(frame, K.blur(shard[..., :3], 9 * sc) * 1.6)
    K.over(frame, shard)
    rim = look['rig_sprite'][1]['color']
    crawler = K.rim_light(K.load(paths['crawler']), rim, 0.45, 3 * sc * 2)
    hero = K.rim_light(K.load(paths['hero']), rim, 0.55, 3 * sc * 2)
    crawler_box = place(frame, crawler, anchors['crawler'], anchors['crawler_feet'], 0.5, flip=True)
    hero_box = place(frame, hero, anchors['hero'], anchors['hero_feet'], 0.5)
    fore = K.load(paths['fore'])
    K.fog(fore, look['foreground']['color'], 0.93)
    K.over(frame, K.blur(fore, look['foreground']['blur'] * sc))
    K.add(frame, motes(look, H, W, np.random.default_rng(4), 14, 3 * sc, 4 * sc) * 1.6)
    if look['rain']:
        K.over(frame, np.concatenate([rain(look, H, W, random.Random(2)),
                                      np.zeros((H, W, 1), np.float32)], axis=-1))
    g = look['grade']
    frame[..., 3] = 1.0
    frame = K.bloom(frame, g['bloom_at'], 14 * sc, g['bloom'])
    frame = K.grade(frame, g['exposure'], g['contrast'], 0.42, g['saturation'], g['lift'], g['gain'])
    frame = K.vignette(frame, g['vignette'])
    frame = K.grain(frame, g['grain'], seed=11)
    frame = np.clip(frame, 0, 1)
    metrics = {
        'hero': value_contrast(frame, hero_box),
        'crawler': value_contrast(frame, crawler_box),
    }
    clean = frame.copy()
    hud(frame, look, sc)
    return frame, clean, metrics


# Board ---------------------------------------------------------------------------------------------

def label_block(W, h, title, lines, look, sc=1.0):
    img = K.solid(h, W, K.hexrgb('#0B0D0F'))
    K.text(img, (56 * sc, 44 * sc), title, size=int(40 * sc), color='#F2F2EE', weight=600, tracking=0.5 * sc)
    for i, line in enumerate(lines):
        K.text(img, (56 * sc, (100 + i * 34) * sc), line, size=int(24 * sc), color='#B9BDBA', weight=400)
    sw = 0
    swatches = [look['sky'][1][1], look['fog']['color'], look['rock'][1], look['crystal']['glow'], look['visor'][0],
                look['danger'][0], look['shard'][0], look['hull_light'][0]]
    for col in swatches:
        K.rect(img, W - (56 + 8 * 52) * sc + sw, 44 * sc, 44 * sc, 44 * sc, col, 1.0, radius=6)
        sw += 52 * sc
    return img


def wrap(text, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + ' ' + w).strip()
    lines.append(cur)
    return lines


def board(results, path):
    W = 1920
    blocks = []
    head = K.solid(220, W, K.hexrgb('#0B0D0F'))
    K.text(head, (56, 70), 'COSMIC DRIFT  ·  ART & UI B  ·  STYLE TEST', size=44, color='#F2F2EE', weight=600,
           tracking=3)
    K.text(head, (56, 132), 'One Kepler-186f moment in three looks. Same models, layout and camera; only light, '
                            'atmosphere, material tone and grade change.', size=24, color='#B9BDBA', weight=400)
    K.text(head, (56, 170), 'Built from the game\'s own layer types, so the engine can reach it. Pick one; mixing is '
                            'allowed (say which parts).', size=24, color='#B9BDBA', weight=400)
    blocks.append(head)
    for lid, res in results.items():
        look = LOOKS[lid]
        hm, cm = res['metrics']['hero'], res['metrics']['crawler']
        lines = wrap(look['pitch'], 120) + [
            f'Mood reference (feel only): {look["mood_refs"]}.   Readability (brightness): hero {hm[0]:.2f} vs '
            f'background {hm[1]:.2f}; Crawler {cm[0]:.2f} vs {cm[1]:.2f}.']
        blocks.append(label_block(W, 150 + 34 * len(lines), f'{lid}  ·  {look["name"].upper()}', lines, look))
        blocks.append(res['frame'])
        strip = K.solid(400, W, K.hexrgb('#0B0D0F'))
        gray = K.resize(K.gray(res['clean']), 400 / res['clean'].shape[0])
        K.over(strip, gray, 0, 0)
        hb = K.resize(res['hero_big'], 380 / res['hero_big'].shape[0])
        x = gray.shape[1] + 40
        K.rect(strip, x, 0, hb.shape[1] + 40, 400, '#16191C', 1.0)
        K.over(strip, hb, x + 20, 10)
        x += hb.shape[1] + 80
        cb = K.resize(res['crawler_big'], min(1.0, (W - x - 40) / res['crawler_big'].shape[1]))
        K.rect(strip, x, 0, W - x, 400, '#16191C', 1.0)
        K.over(strip, cb, x + (W - x - cb.shape[1]) / 2, (400 - cb.shape[0]) / 2)
        K.text(strip, (12, 386), 'grayscale (readability)', size=18, color='#FFFFFF', alpha=0.8, anchor='ls')
        blocks.append(strip)
        blocks.append(K.solid(40, W, K.hexrgb('#0B0D0F')))
    K.save(K.stack_vertical(blocks), path, quality=88)


def main(argv):
    quick = '--quick' in argv
    ids = [a for a in argv if a in LOOKS] or list(LOOKS)
    scale, samples = (0.5, 16) if quick else (1.0, 40)
    out = OUT if not quick else os.path.join(tempfile.gettempdir(), 'cd-style-quick')
    os.makedirs(out, exist_ok=True)
    results = {}
    report = {}
    with tempfile.TemporaryDirectory() as tmp:
        for lid in ids:
            paths, anchors = render_look(lid, tmp, scale, samples)
            if quick:
                import shutil
                for name, p in paths.items():
                    shutil.copy(p, os.path.join(out, f'layer-{lid}-{name}.png'))
            frame, clean, metrics = compose(lid, paths, anchors, scale)
            slug = f'look-{lid}-{LOOKS[lid]["name"].lower().replace(" ", "-")}'
            K.save(frame, os.path.join(out, slug + '.jpg'), quality=90)
            K.save(K.gray(clean), os.path.join(out, slug + '-gray.jpg'), quality=85)
            results[lid] = {'frame': frame if not quick else K.resize(frame, 2.0), 'clean': clean,
                            'metrics': metrics, 'hero_big': K.load(paths['hero_big']),
                            'crawler_big': K.load(paths['crawler_big'])}
            report[lid] = {'name': LOOKS[lid]['name'], 'hero_luma_vs_surround': metrics['hero'],
                           'crawler_luma_vs_surround': metrics['crawler']}
        if len(results) > 1 or not quick:
            board(results, os.path.join(out, 'board.jpg'))
    with open(os.path.join(out, 'metrics.json'), 'w') as fh:
        json.dump(report, fh, indent=2)
    print(json.dumps({'out': out, 'looks': report}))


if __name__ == '__main__':
    main(sys.argv[1:])
