"""Art & UI B, B1a look lock: look B "Ember Dark" v2, with the owner's feedback on the style test.

    npm run art:lookdev                                         # full quality -> docs/art/look-lock/
    python3 -I tools/blender/lookdev/look_lock.py --quick       # half size, few samples (iteration)
    python3 -I tools/blender/lookdev/look_lock.py --cache DIR   # also keep the rendered layers in DIR
    python3 -I tools/blender/lookdev/look_lock.py --compose DIR # re-compose from DIR (seconds; for fog,
                                                                # grade or placement tweaks, no Blender render)

What changed from the B0 style test (owner feedback, 2026-11-28):
- Kes wears a warm, human colour that stands apart from the teal world (scheme 'rust'; 'mustard' and the
  B0 colours are shown as colour keys). No all-round outline: the sprite rig is strictly flip-safe and the
  only rim is a screen-space one on the side facing the star (the engine does the same per frame).
- Planted feet: both soles flat on the ground, per-foot contact shadows, sprites take the same
  atmosphere as the play plane, so they sit in the scene instead of on top of it.
- Cracked ground with lichen and grit, rubble where the ledge breaks off, roots under the lip, mites.
- The Lantern wreck rebuilt to read as a ship, with smoke rising from the break.
- Every crystal glows at its own level; the catwalk crystal is caught mid-flare with sparks.
- A giant walks in the far fog: a silent detail, never an entity.
- Finer grain, the play layer supersampled 2x (sharper), a lossless PNG master.

Every element stays engine-faithful (the same layer types the game draws; see docs/ART_UI_B_PLAN.md).
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

import bpy  # noqa: E402  (bpy 5.3: bmesh and mathutils import only after bpy)
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

from studio import comp as K, stage  # noqa: E402
from studio.looks import LOOKS  # noqa: E402

import custodian  # noqa: E402
import kepler  # noqa: E402
import kes  # noqa: E402
import style_test as ST  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(ROOT, 'docs', 'art', 'look-lock')
LOOK = 'B'
SCHEMES = ('rust', 'mustard', 'bone')
FLARE_AT = (5.5, 0.0, 1.0)
GIANT_FOG = 0.88  # the giant is a ghost in the haze: found by players who look, never a focal point


def hide_except(collection, prefix):
    """Hides every object in `collection` from renders except those whose name starts with `prefix`;
    returns a function that restores the previous state."""
    coll = bpy.data.collections[collection]
    before = {o.name: o.hide_render for o in coll.all_objects}
    for o in coll.all_objects:
        o.hide_render = not o.name.startswith(prefix)

    def restore():
        for name, hidden in before.items():
            bpy.data.objects[name].hide_render = hidden
    return restore


def render(tmp, scale, samples):
    look = LOOKS[LOOK]
    stage.new_scene(look, samples)
    m = kepler.materials(look)
    kepler.play_layer(m, 'play')
    kepler.scenery(m)
    kepler.foreground(m)
    J = kes.build(look, 'hero', 'rust')
    kes.pose(J, 'ready')
    crawler = custodian.build(look, 'crawler')
    custodian.pose(crawler, 'alert')
    ST.build_shard(look, 'shard')

    W, H = int(stage.FRAME_W * scale), int(stage.FRAME_H * scale)
    view_h = stage.VIEW_H_U / stage.U_PER_M
    ortho_h = view_h * math.cos(math.radians(ST.TILT))
    play_cam = stage.ortho_camera('play_cam', (0, 0, ST.CAM_Z), ortho_h, (W, H), ST.TILT)
    play_cam2 = stage.ortho_camera('play_cam2', (0, 0, ST.CAM_Z), ortho_h, (2 * W, 2 * H), ST.TILT)
    fov = math.degrees(2 * math.atan(view_h / 2 / ST.BG_DIST))
    bg_cam = stage.perspective_camera('bg_cam', (0, -ST.BG_DIST, ST.CAM_Z), fov, (W, H), tilt_deg=2.0)
    d = 2 * scale
    hero_cam = ST.sprite_cam('hero_cam', (0, 0, 0.98), (int(240 * d / 2), int(300 * d / 2)), d)
    crawler_cam = ST.sprite_cam('crawler_cam', (0.05, 0, 0.5), (int(260 * d / 2), int(170 * d / 2)), d)
    shard_cam = ST.sprite_cam('shard_cam', (0, 0, 0.0), (int(96 * d / 2), int(96 * d / 2)), d)

    paths = {}
    for layer, cam, rig in (('far', bg_cam, 'rig_world'), ('giant', bg_cam, 'rig_world'), ('mid', bg_cam, 'rig_world'),
                            ('near', bg_cam, 'rig_world'), ('play', play_cam2, 'rig_world'),
                            ('fore', bg_cam, 'rig_world'), ('crawler', crawler_cam, 'rig_sprite'),
                            ('shard', shard_cam, 'rig_sprite')):
        paths[layer] = stage.render_layer(layer, cam, os.path.join(tmp, f'{layer}.png'), rig)
    for scheme in SCHEMES:
        kes.recolor(look, scheme)
        paths['hero_' + scheme] = stage.render_layer('hero', hero_cam, os.path.join(tmp, f'hero_{scheme}.png'),
                                                     'rig_sprite')
    anchors = {
        'hero': stage.to_px(play_cam, (ST.HERO_X, 0, 0)),
        'crawler': stage.to_px(play_cam, (ST.CRAWLER_X, 0, kepler.ISLAND_TOP)),
        'shard': stage.to_px(play_cam, ST.SHARD),
        'flare': stage.to_px(play_cam, FLARE_AT),
        'smoke': stage.to_px(bg_cam, kepler.WRECK_BREAK),
        'hero_feet': stage.to_px(hero_cam, (0, 0, 0)),
        'hero_soles': [stage.to_px(hero_cam, c) for c in kes.sole_centres(J)],
        'crawler_feet': stage.to_px(crawler_cam, (0, 0, 0)),
        'shard_center': stage.to_px(shard_cam, (0, 0, 0)),
    }

    # Close-ups for the board (recommended scheme): Kes front and back three-quarter, the Crawler,
    # and the Lantern wreck from closer in.
    kes.recolor(look, 'rust')
    k = 1.0 if scale >= 1 else 0.6
    big = ST.sprite_cam('hero_big', (0, 0, 0.95), (int(560 * k), int(720 * k)), 6 * k)
    paths['hero_front'] = stage.render_layer('hero', big, os.path.join(tmp, 'hero_front.png'), 'rig_sprite')
    kes.pose(J, 'idle', 150)
    paths['hero_back'] = stage.render_layer('hero', big, os.path.join(tmp, 'hero_back.png'), 'rig_sprite')
    cbig = ST.sprite_cam('crawler_big', (0.05, 0, 0.48), (int(640 * k), int(400 * k)), 4.2 * k)
    paths['crawler_big'] = stage.render_layer('crawler', cbig, os.path.join(tmp, 'crawler_big.png'), 'rig_sprite')
    restore = hide_except('mid', 'wreck')
    wx, wy, wz = kepler.WRECK
    ship_cam = stage.perspective_camera('ship_cam', (wx - 6, wy - 78, wz + 10), 26, (int(1100 * k), int(520 * k)),
                                        tilt_deg=-7.0)
    paths['wreck_big'] = stage.render_layer('mid', ship_cam, os.path.join(tmp, 'wreck_big.png'))
    restore()
    return paths, anchors


# Compositing ---------------------------------------------------------------------------------------

def background(paths, anchors, scale):
    """Everything behind the sprites: sky, fogged scenery (with the wreck's smoke), shafts, motes, low
    fog, the supersampled play layer, and the crystal flare."""
    look = LOOKS[LOOK]
    sc = scale
    H, W = int(stage.FRAME_H * sc), int(stage.FRAME_W * sc)
    f = look['fog']
    frame = ST.sky(look, H, W, np.random.default_rng(5))
    gf = ST.ground_fog(H, W, f['ground_top'], f['ground'])
    air = K.blur(frame[..., :3], 40 * sc)
    for name, amount, ground, tint in (('far', f['far'], 1.0, 0.25), ('giant', GIANT_FOG, 1.0, 0.2),
                                       ('mid', f['mid'], 0.9, 0.45), ('near', f['near'], 0.65, 0.6)):
        layer = K.load(paths[name])
        color = air * (1 - tint) + K.hexrgb(f['color']) * tint
        fog = np.clip(amount + (1 - amount) * gf * ground, 0, 1)
        K.fog(layer, color, fog)
        K.over(frame, layer)
        if name == 'mid':
            sx, sy = anchors['smoke']
            plume = K.smoke_plume(H, W, sx, sy, 260 * sc, 30 * sc, '#8A9895', alpha=0.42)
            K.fog(plume, air, 0.3)
            K.over(frame, plume)
            sheet = K.solid(H, W, K.hexrgb(f['ground_color']))
            sheet *= (gf * 0.55)[..., None]
            K.over(frame, sheet)
    K.add(frame, ST.shafts(look, H, W, random.Random(9)))
    K.add(frame, ST.motes(look, H, W, np.random.default_rng(3), look['motes']['count'], 1, 0.8 * sc))
    low = K.solid(H, W, K.hexrgb(f['ground_color']))
    low *= (K.smoothstep(0.78, 1.0, K.vmap(H, W)[0]) * f['ground'] * 0.6)[..., None]
    K.over(frame, low)
    play = K.resize(K.load(paths['play']), 0.5)[:H, :W]
    K.fog(play, f['color'], f['play'])
    K.over(frame, play)
    flare(frame, anchors['flare'], look, sc)
    return frame


def flare(frame, at, look, sc):
    """The catwalk crystal mid-flare: a soft bloom and a few sparks drifting up (render-only; in the
    engine a flare is rare, random, and never in step with its neighbours)."""
    H, W = frame.shape[:2]
    glow = K.hexrgb(look['crystal']['glow'])
    x, y = at
    r = K.radial(H, W, x, y, 70 * sc)
    K.add(frame, np.exp(-r * r * 2.0)[..., None] * glow * 0.16)
    rng = np.random.default_rng(12)
    acc = np.zeros((H, W), np.float32)
    for _ in range(16):
        a = rng.uniform(-math.pi, 0)
        dist = rng.uniform(10, 70) * sc
        px, py = int(x + math.cos(a) * dist), int(y + math.sin(a) * dist * 1.3)
        if 0 <= px < W and 0 <= py < H:
            acc[py, px] += rng.uniform(0.5, 1.0)
    K.add(frame, (K.blur(acc, 0.9 * sc) * 6.0)[..., None] * glow * 0.6)


def sprite(frame, img, anchor, feet, look, toward, flip=False, scale=0.5):
    """Places a sprite like the engine: scaled, optionally mirrored, tinted by the play-plane atmosphere,
    then lit by the screen-space rim on the side facing the star. Returns its box."""
    s = K.resize(img, scale)
    fx, fy = feet[0] * scale, feet[1] * scale
    if flip:
        s = K.flip_x(s)
        fx = s.shape[1] - fx
    f = look['fog']
    K.fog(s, f['color'], f['play'] + 0.04)
    rim = look['rim_engine']
    s = K.rim_light_dir(s, toward, rim['color'], rim['amount'], rim['width'] * scale * 2)
    x, y = anchor[0] - fx, anchor[1] - fy
    K.over(frame, s, x, y)
    return (x, y, s.shape[1], s.shape[0])


def finish(base, paths, anchors, scale, scheme):
    """Adds shadows, sprites, foreground and the post chain to a copy of the background."""
    look = LOOKS[LOOK]
    sc = scale
    frame = base.copy()
    H, W = frame.shape[:2]
    star = (look['star']['pos'][0] * W, look['star']['pos'][1] * H)
    sink = 1.0 * sc  # feet sit 1 px into the grit
    hx, hy = anchors['hero']
    hy += sink
    hfx, hfy = anchors['hero_feet']
    # Contact shadows: a soft pool under the body and a tight dark core under each sole.
    ST.contact_shadow(frame, hx, hy + 1 * sc, 34 * sc, 6 * sc, 0.5)
    for (sx, sy) in anchors['hero_soles']:
        ST.contact_shadow(frame, hx + (sx - hfx) * 0.5, hy + 0.5 * sc, 9 * sc, 2.4 * sc, 0.75)
    cx, cy = anchors['crawler']
    ST.contact_shadow(frame, cx, cy + 2 * sc, 50 * sc, 6 * sc, 0.6)
    shard = K.blank(H, W)
    ST.place(shard, K.load(paths['shard']), anchors['shard'], anchors['shard_center'], 0.5)
    K.add(frame, K.blur(shard[..., :3], 9 * sc) * 1.6)
    K.over(frame, shard)
    toward_c = (star[0] - cx, star[1] - (cy - 25 * sc))
    crawler_box = sprite(frame, K.load(paths['crawler']), (cx, cy), anchors['crawler_feet'], look, toward_c,
                         flip=True)
    toward_h = (star[0] - hx, star[1] - (hy - 52 * sc))
    hero_box = sprite(frame, K.load(paths['hero_' + scheme]), (hx, hy), (hfx, hfy), look, toward_h)
    fore = K.load(paths['fore'])
    K.fog(fore, look['foreground']['color'], 0.93)
    K.over(frame, K.blur(fore, look['foreground']['blur'] * sc))
    K.add(frame, ST.motes(look, H, W, np.random.default_rng(4), 14, 3 * sc, 4 * sc) * 1.6)
    g = look['grade']
    frame[..., 3] = 1.0
    frame = K.bloom(frame, g['bloom_at'], 14 * sc, g['bloom'])
    frame = K.grade(frame, g['exposure'], g['contrast'], 0.42, g['saturation'], g['lift'], g['gain'])
    frame = K.vignette(frame, g['vignette'])
    frame = K.grain(frame, g['grain'], seed=11)
    frame = np.clip(frame, 0, 1)
    metrics = {'hero': ST.value_contrast(frame, hero_box), 'crawler': ST.value_contrast(frame, crawler_box)}
    return frame, metrics, hero_box


# Board ---------------------------------------------------------------------------------------------

CHANGES = [
    'Kes: a warm, human suit colour that stands apart from the teal world; no white or blue outline.',
    'Light: only the side facing the star gets a rim; feet planted flat with a shadow under each sole.',
    'Ground: cracks, lichen, grit, loose stones; the broken edge crumbles; roots and crystal mites below.',
    'The Lantern (Kes\'s crashed ship) rebuilt to read as a ship: cockpit, wing, engines, fin, fire, smoke.',
    'Crystals each glow at their own level; the catwalk crystal flares (rare and random in the game).',
    'A giant walks far away in the haze. Sharper ground, much finer grain (the game itself is sharp).',
]


def crop(img, cx, cy, w, h):
    H, W = img.shape[:2]
    x0 = int(min(max(0, cx - w / 2), W - w))
    y0 = int(min(max(0, cy - h / 2), H - h))
    return img[y0:y0 + h, x0:x0 + w].copy()


def panel(img, w, h, label, bg='#16191C', sub=None):
    out = K.solid(h, w, K.hexrgb(bg))
    s = min((w - 20) / img.shape[1], (h - 64) / img.shape[0], 1e9)
    im = K.resize(img, s) if abs(s - 1.0) > 1e-3 else img
    K.over(out, im, (w - im.shape[1]) / 2, 12 + (h - 64 - im.shape[0]) / 2)
    K.text(out, (14, h - 46), label, size=22, color='#F2F2EE', weight=600)
    if sub:
        K.text(out, (14, h - 10), sub, size=16, color='#9EA4A0', weight=400, anchor='ls')
    return out


def board(frame, gray, keys, metrics, paths, path):
    W = 1920
    look = LOOKS[LOOK]
    head = K.solid(150 + 34 * len(CHANGES), W, K.hexrgb('#0B0D0F'))
    K.text(head, (56, 64), 'COSMIC DRIFT  ·  ART & UI B  ·  B1a LOOK LOCK  ·  B "EMBER DARK" v2', size=40,
           color='#F2F2EE', weight=600, tracking=2)
    K.text(head, (56, 112), 'Your style-test feedback, applied. Still engine-faithful: only layer types the game '
                            'draws.', size=24, color='#B9BDBA', weight=400)
    for i, line in enumerate(CHANGES):
        K.text(head, (76, 158 + 34 * i), '·  ' + line, size=22, color='#D6D9D5', weight=400)
    hm, cm = metrics['hero'], metrics['crawler']
    blocks = [head, frame]
    row = K.solid(470, W, K.hexrgb('#0B0D0F'))
    labels = {'rust': 'Rust (recommended)', 'mustard': 'Mustard', 'bone': 'B0 colours, new lighting'}
    for i, scheme in enumerate(SCHEMES):
        K.over(row, panel(keys[scheme], 620, 450, labels[scheme], sub='in the scene, zoom ×3'), 20 + i * 633, 10)
    blocks.append(K.text(K.solid(60, W, K.hexrgb('#0B0D0F')), (56, 16), 'KES COLOUR KEYS  (pick one)', size=26,
                         color='#F2F2EE', weight=600, tracking=1.5))
    blocks.append(row)
    row2 = K.solid(470, W, K.hexrgb('#0B0D0F'))
    items = [(K.load(paths['hero_front']), 300, 'Kes · front ¾'), (K.load(paths['hero_back']), 300, 'Kes · back ¾'),
             (K.load(paths['crawler_big']), 520, 'Custodian Crawler'),
             (K.load(paths['wreck_big']), 720, 'The Lantern (wreck, closer)')]
    x = 20
    for img, w, label in items:
        bg = '#22262A' if 'wreck' not in label else '#0F1A1E'
        K.over(row2, panel(img, w, 450, label, bg=bg), x, 10)
        x += w + 13
    blocks.append(K.text(K.solid(60, W, K.hexrgb('#0B0D0F')), (56, 16), 'MODELS', size=26, color='#F2F2EE',
                         weight=600, tracking=1.5))
    blocks.append(row2)
    row3 = K.solid(450, W, K.hexrgb('#0B0D0F'))
    g = K.resize(gray, 760 / gray.shape[1])
    K.over(row3, g, 20, 10)
    K.text(row3, (32, 30), 'grayscale (readability)', size=18, color='#FFFFFF', alpha=0.85)
    note = [f'Readability (brightness): hero {hm[0]:.2f} vs background {hm[1]:.2f}; Crawler {cm[0]:.2f} vs {cm[1]:.2f}.',
            'Kes reads by colour (warm on cool) and by value; the Crawler by its red eye and seams.',
            'Look closely: mites on the cliff face, roots under the lip, a giant in the haze near the star.',
            'In the game: crystals flicker on their own random timers; the giant drifts by rarely; the',
            'shard spins slowly in 3D and flies to your counter when collected (B2).']
    for i, line in enumerate(note):
        K.text(row3, (810, 44 + 34 * i), line, size=22, color='#D6D9D5', weight=400)
    swatch = [look['sky'][1][1], look['fog']['color'], look['rock'][1], look['crystal']['glow'], look['visor'][0],
              look['danger'][0], look['shard'][0], kes.SCHEMES['rust']['suit'], kes.SCHEMES['rust']['plate']]
    for i, col in enumerate(swatch):
        K.rect(row3, 810 + i * 58, 250, 50, 50, col, 1.0, radius=6)
    blocks.append(row3)
    K.save(K.stack_vertical(blocks, gap=0, background='#0B0D0F'), path, quality=88)


def arg(argv, name):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else None


def main(argv):
    quick = '--quick' in argv
    scale, samples = (0.5, 16) if quick else (1.0, 48)
    out = OUT if not quick else os.path.join(tempfile.gettempdir(), 'cd-look-lock-quick')
    os.makedirs(out, exist_ok=True)
    cache, compose_from = arg(argv, '--cache'), arg(argv, '--compose')
    with tempfile.TemporaryDirectory() as tmp:
        if compose_from:
            with open(os.path.join(compose_from, 'anchors.json')) as fh:
                saved = json.load(fh)
            paths = {k: os.path.join(compose_from, v) for k, v in saved['paths'].items()}
            anchors, scale = saved['anchors'], saved['scale']
        else:
            work = cache or tmp
            os.makedirs(work, exist_ok=True)
            paths, anchors = render(work, scale, samples)
            if cache:
                with open(os.path.join(cache, 'anchors.json'), 'w') as fh:
                    json.dump({'paths': {k: os.path.basename(v) for k, v in paths.items()}, 'scale': scale,
                               'anchors': {k: [list(p) for p in v] if k == 'hero_soles' else list(v)
                                           for k, v in anchors.items()}}, fh, indent=1)
        base = background(paths, anchors, scale)
        keys, report = {}, {}
        for scheme in SCHEMES:
            frame, metrics, box = finish(base, paths, anchors, scale, scheme)
            report[scheme] = {'hero_luma_vs_surround': metrics['hero'],
                              'crawler_luma_vs_surround': metrics['crawler']}
            cx, cy = box[0] + box[2] / 2, box[1] + box[3] / 2
            keys[scheme] = K.resize(crop(frame, cx + 24 * scale, cy - 4 * scale, int(196 * scale), int(124 * scale)),
                                    3.0 / scale)
            if scheme == 'rust':
                main_frame, main_metrics = frame, metrics
        clean = main_frame.copy()
        ST.hud(main_frame, LOOKS[LOOK], scale)
        K.save(main_frame, os.path.join(out, 'look-B-v2.png'))
        K.save(main_frame, os.path.join(out, 'look-B-v2.jpg'), quality=92)
        gray = K.gray(clean)
        K.save(gray, os.path.join(out, 'look-B-v2-gray.jpg'), quality=85)
        board(main_frame if not quick else K.resize(main_frame, 2.0), gray, keys, main_metrics,
              {k: v for k, v in paths.items()}, os.path.join(out, 'board.jpg'))
        if quick:
            import shutil
            for name, p in paths.items():
                shutil.copy(p, os.path.join(out, f'layer-{name}.png'))
    with open(os.path.join(out, 'metrics.json'), 'w') as fh:
        json.dump(report, fh, indent=2)
    print(json.dumps({'out': out, 'metrics': report}))


if __name__ == '__main__':
    main(sys.argv[1:])
