"""2D compositing in display (sRGB) space with premultiplied alpha: the same maths the game uses to
stack its layers, so a lookdev frame is a promise the engine can keep. Also builds QA images (grayscale
readability, contact sheets, boards).

Images are float32 arrays (H, W, 4), premultiplied, 0..1. Nothing here is random without a seed.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def hexrgb(color):
    h = color.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def load(path):
    a = np.asarray(Image.open(path).convert('RGBA'), dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def blank(h, w):
    return np.zeros((h, w, 4), np.float32)


def solid(h, w, rgb, alpha=1.0):
    img = np.empty((h, w, 4), np.float32)
    img[..., :3] = np.asarray(rgb, np.float32) * alpha
    img[..., 3] = alpha
    return img


def save(img, path, background=None, quality=92):
    """Writes PNG or JPEG. JPEG (and `background`) flattens onto an opaque colour."""
    out = img.copy()
    if background is not None or path.lower().endswith(('.jpg', '.jpeg')):
        bg = hexrgb(background or '#000000')
        out[..., :3] = out[..., :3] + bg * (1.0 - out[..., 3:4])
        out[..., 3] = 1.0
    a = np.clip(out[..., 3:4], 1e-6, 1.0)
    rgb = np.where(out[..., 3:4] > 1e-6, out[..., :3] / a, 0.0)
    data = np.concatenate([rgb, out[..., 3:4]], axis=-1)
    data = (np.clip(data, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    if path.lower().endswith(('.jpg', '.jpeg')):
        Image.fromarray(data[..., :3], 'RGB').save(path, quality=quality, subsampling=0, optimize=True)
    else:
        Image.fromarray(data, 'RGBA').save(path, optimize=True)
    return path


def over(dst, src, x=0, y=0, opacity=1.0):
    """Alpha-composites premultiplied `src` onto `dst` with its top-left at (x, y); clipped."""
    x, y = int(round(x)), int(round(y))
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x0 >= x1 or y0 >= y1:
        return dst
    s = src[y0 - y:y1 - y, x0 - x:x1 - x] * opacity
    d = dst[y0:y1, x0:x1]
    dst[y0:y1, x0:x1] = s + d * (1.0 - s[..., 3:4])
    return dst


def add(dst, rgb, amount=1.0):
    """Additive light (light shafts, glows): adds an (H, W, 3) map, the game's ADD blend mode."""
    dst[..., :3] += rgb * amount
    dst[..., 3] = np.maximum(dst[..., 3], np.clip(rgb.max(axis=-1) * amount, 0.0, 1.0))
    return dst


def fog(layer, color, amount):
    """Fades a layer toward `color` (hex, or an (H, W, 3) map such as the blurred sky behind it: aerial
    perspective) by `amount` (a scalar or an (H, W) map)."""
    f = np.asarray(amount, np.float32)
    if f.ndim == 2:
        f = f[..., None]
    col = hexrgb(color) if isinstance(color, str) else color
    layer[..., :3] = layer[..., :3] * (1.0 - f) + col * layer[..., 3:4] * f
    return layer


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def vmap(h, w):
    """Normalised (y, x) coordinate grids, 0..1."""
    ys = (np.arange(h, dtype=np.float32) + 0.5) / h
    xs = (np.arange(w, dtype=np.float32) + 0.5) / w
    return np.meshgrid(ys, xs, indexing='ij')


def vgrad(h, w, stops):
    """Vertical gradient from (position 0..1, hex) stops, top to bottom. Returns (H, W, 3)."""
    ys = (np.arange(h, dtype=np.float32) + 0.5) / h
    pos = np.array([p for p, _ in stops], np.float32)
    cols = np.stack([hexrgb(c) for _, c in stops])
    rgb = np.stack([np.interp(ys, pos, cols[:, i]) for i in range(3)], axis=-1)
    return np.broadcast_to(rgb[:, None, :], (h, w, 3)).copy()


def _box1d(a, r, axis):
    if r < 1:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    p = np.pad(a, pad, mode='edge')
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(img, sigma):
    """Gaussian blur (three box passes) for any (H, W, ...) array."""
    if sigma <= 0.3:
        return img.copy()
    r = max(1, int(round(math.sqrt(12 * sigma * sigma / 3 + 1) / 2)))
    out = img
    for _ in range(3):
        out = _box1d(_box1d(out, r, 0), r, 1)
    return out


def resize(img, scale):
    """Resizes each channel with Lanczos (premultiplied, so edges stay clean)."""
    h, w = img.shape[:2]
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    chans = [np.asarray(Image.fromarray(img[..., c], 'F').resize((nw, nh), Image.LANCZOS)) for c in
             range(img.shape[2])]
    return np.clip(np.stack(chans, axis=-1), 0.0, None).astype(np.float32)


def rim_light(sprite, color, amount=0.6, width=2.0):
    """Rim-light layer (spec 9.3): brightens a sprite's upper and side edges, flip-safe (symmetric). The
    engine equivalent is a small edge shader on the character layer."""
    a = sprite[..., 3]
    r = max(1, int(round(width)))
    shifted = np.zeros_like(a)
    shifted[r:, :] = a[:-r, :]
    left = np.zeros_like(a)
    left[:, r:] = a[:, :-r]
    right = np.zeros_like(a)
    right[:, :-r] = a[:, r:]
    edge = np.clip(a - np.minimum(np.minimum(shifted, left), right), 0.0, 1.0)
    edge = blur(edge, width * 0.4) * a
    out = sprite.copy()
    out[..., :3] += edge[..., None] * hexrgb(color) * amount
    return out


def shift(a, dx, dy):
    """Shifts a 2D array by whole pixels (dx right, dy down), filling with zeros."""
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    if xs0 < xs1 and ys0 < ys1:
        out[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx] = a[ys0:ys1, xs0:xs1]
    return out


def rim_light_dir(sprite, toward_light, color, amount=0.5, width=2.0):
    """Directional rim (replaces the all-round outline): brightens only the inner edge on the side that
    faces the light. `toward_light` is a screen direction (x right, y down) from the sprite to the light.
    The engine does the same with one extra alpha tap per pixel, so it stays correct when a sprite is
    mirrored with flipX (the direction is in screen space, not baked)."""
    a = sprite[..., 3]
    d = np.asarray(toward_light, np.float32)
    d = d / max(1e-6, float(np.hypot(*d)))
    dx, dy = int(round(d[0] * width)), int(round(d[1] * width))
    # A pixel is lit when its neighbour toward the light is empty: that edge faces the light.
    toward = shift(a, -dx, -dy)
    edge = np.clip(a - toward, 0.0, 1.0)
    edge = blur(edge, max(0.6, width * 0.35)) * a
    out = sprite.copy()
    out[..., :3] += edge[..., None] * hexrgb(color) * amount
    return out


def smoke_plume(h, w, x, y, height, width, color, alpha=0.3, drift=0.35, seed=3):
    """A thin rising smoke column from (x, y) (pixels), widening and drifting right as it rises:
    turbulent noise shaped by a cone, premultiplied RGBA. In the engine this is a slow particle stream."""
    rng = np.random.default_rng(seed)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip((y - ys) / height, 0.0, 1.0)  # 0 at the source, 1 at the top
    centre = x + drift * height * t ** 1.6
    half = width * (0.15 + 0.85 * t)
    across = np.abs(xs - centre) / np.maximum(half, 1.0)
    noise = blur(rng.standard_normal((h // 4 + 1, w // 4 + 1)).astype(np.float32), 2.0)
    noise = np.asarray(Image.fromarray(noise, 'F').resize((w, h), Image.BICUBIC))
    noise = (noise - noise.min()) / max(1e-6, float(noise.max() - noise.min()))
    shape = np.clip(1.0 - across, 0.0, 1.0) ** 1.5 * (ys <= y) * (1.0 - t) ** 0.8 * smoothstep(0.0, 0.08, t + 0.02)
    m = np.clip(shape * (0.35 + 0.9 * noise), 0.0, 1.0) * alpha
    return np.concatenate([hexrgb(color) * m[..., None], m[..., None]], axis=-1)


def flip_x(img):
    return img[:, ::-1].copy()


def luma(img):
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722


def radial(h, w, cx, cy, radius):
    """Distance from (cx, cy) in pixels divided by `radius`."""
    ys = np.arange(h, dtype=np.float32)[:, None]
    xs = np.arange(w, dtype=np.float32)[None, :]
    return np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / radius


def polygon_mask(h, w, points, supersample=2):
    """Antialiased polygon coverage (H, W) in 0..1."""
    im = Image.new('L', (w * supersample, h * supersample), 0)
    ImageDraw.Draw(im).polygon([(x * supersample, y * supersample) for x, y in points], fill=255)
    im = im.resize((w, h), Image.BOX)
    return np.asarray(im, np.float32) / 255.0


def line_mask(h, w, segments, width, supersample=2):
    im = Image.new('L', (w * supersample, h * supersample), 0)
    d = ImageDraw.Draw(im)
    for (x0, y0), (x1, y1) in segments:
        d.line([(x0 * supersample, y0 * supersample), (x1 * supersample, y1 * supersample)], fill=255,
               width=max(1, int(round(width * supersample))))
    im = im.resize((w, h), Image.BOX)
    return np.asarray(im, np.float32) / 255.0


def grade(img, exposure=0.0, contrast=1.0, pivot=0.42, saturation=1.0, lift=(0, 0, 0), gain=(1, 1, 1),
          gamma=1.0):
    """Final colour grade on the opaque frame (display space)."""
    rgb = img[..., :3] * (2.0 ** exposure)
    rgb = (rgb - pivot) * contrast + pivot
    y = luma(rgb)[..., None]
    rgb = y + (rgb - y) * saturation
    rgb = rgb * np.asarray(gain, np.float32) + np.asarray(lift, np.float32) * (1.0 - rgb)
    rgb = np.clip(rgb, 0.0, None) ** (1.0 / gamma)
    out = img.copy()
    out[..., :3] = np.clip(rgb, 0.0, 1.0)
    return out


def bloom(img, threshold=0.75, sigma=18.0, amount=0.5, tint=None):
    """Adds a soft glow from the brightest parts (emissives, the star, sparks)."""
    y = luma(img[..., :3])
    mask = smoothstep(threshold, 1.0, y)[..., None]
    glow = blur(img[..., :3] * mask, sigma) + blur(img[..., :3] * mask, sigma * 3) * 0.5
    if tint is not None:
        glow = glow * hexrgb(tint)
    out = img.copy()
    out[..., :3] = out[..., :3] + glow * amount
    return out


def vignette(img, strength=0.35, softness=0.75, color='#000000'):
    h, w = img.shape[:2]
    ys, xs = vmap(h, w)
    d = np.sqrt(((xs - 0.5) * 1.15) ** 2 + (ys - 0.5) ** 2) / 0.72
    v = smoothstep(1.0 - softness, 1.15, d)[..., None] * strength
    out = img.copy()
    out[..., :3] = out[..., :3] * (1.0 - v) + hexrgb(color) * v
    return out


def grain(img, amount=0.03, seed=7, size=1.0):
    """Film grain, stronger in the mid-tones, fixed seed (also hides 8-bit banding in fog)."""
    h, w = img.shape[:2]
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((h, w)).astype(np.float32)
    if size > 1.0:
        n = blur(n, size * 0.5)
        n /= max(1e-6, float(n.std()))
    y = luma(img[..., :3])
    weight = 0.35 + 0.65 * (1.0 - np.abs(y - 0.45) * 1.6).clip(0, 1)
    out = img.copy()
    out[..., :3] = out[..., :3] + (n * weight * amount)[..., None]
    return out


def gray(img):
    """Grayscale copy (readability review, spec pillar P2)."""
    y = luma(img[..., :3])
    out = img.copy()
    out[..., 0] = out[..., 1] = out[..., 2] = y
    return out


def font(size, weight=500):
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(os.path.dirname(here)))
    path = os.path.join(root, 'node_modules', '@fontsource', 'inter', 'files', f'inter-latin-{weight}-normal.woff2')
    return ImageFont.truetype(path, size)


def text(img, xy, s, size=24, color='#FFFFFF', alpha=1.0, weight=500, tracking=0.0, anchor='la'):
    """Draws text onto `img` (premultiplied). `tracking` is extra letter spacing in pixels."""
    h, w = img.shape[:2]
    layer = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(layer)
    f = font(size, weight)
    x, y = xy
    if tracking:
        total = sum(d.textlength(ch, font=f) + tracking for ch in s) - tracking
        if anchor[0] == 'r':
            x -= total
        elif anchor[0] == 'm':
            x -= total / 2
        for ch in s:
            d.text((x, y), ch, font=f, fill=255, anchor='l' + anchor[1])
            x += d.textlength(ch, font=f) + tracking
    else:
        d.text((x, y), s, font=f, fill=255, anchor=anchor)
    m = np.asarray(layer, np.float32)[..., None] / 255.0 * alpha
    src = np.concatenate([hexrgb(color) * m, m], axis=-1)
    return over(img, src)


def rect(img, x, y, w, h, color, alpha=1.0, radius=0):
    H, W = img.shape[:2]
    layer = Image.new('L', (W * 2, H * 2), 0)
    ImageDraw.Draw(layer).rounded_rectangle([x * 2, y * 2, (x + w) * 2 - 1, (y + h) * 2 - 1], radius * 2, fill=255)
    m = np.asarray(layer.resize((W, H), Image.BOX), np.float32)[..., None] / 255.0 * alpha
    return over(img, np.concatenate([hexrgb(color) * m, m], axis=-1))


def stack_vertical(images, gap=0, background='#000000'):
    w = max(i.shape[1] for i in images)
    h = sum(i.shape[0] for i in images) + gap * (len(images) - 1)
    out = solid(h, w, hexrgb(background))
    y = 0
    for i in images:
        over(out, i, 0, y)
        y += i.shape[0] + gap
    return out
