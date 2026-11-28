"""Bakes Blender art into public/assets/global/. Usage: python3 -I tools/blender/bake.py [hero crawler shard ...]

Needs the `bpy` wheel (pip install bpy). Prints a JSON summary with each sheet's pixel size.
"""

import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'assets', 'global')


def main(argv):
    import importlib
    import bpy  # noqa: F401 -- since bpy 5.3, `bmesh` and `mathutils` only import after bpy
    names = argv or ['hero', 'crawler', 'shard', 'terrain', 'backdrop']
    summary = {}
    for name in names:
        module = importlib.import_module(name)
        with tempfile.TemporaryDirectory() as tmp:
            summary[name] = module.bake(OUT, tmp)
    refresh_manifest()
    print(json.dumps(summary))


BAKED = ['char_hero', 'char_hero_accent', 'enemy_crawler', 'pickup_shard', 'terrain_front', 'bg_megastructure']


def refresh_manifest():
    """Updates sha256 and pixel size of every baked file in the asset manifest."""
    import hashlib
    from PIL import Image
    path = os.path.join(ROOT, 'public', 'assets', 'ASSET_MANIFEST.json')
    with open(path) as f:
        manifest = json.load(f)
    for entry in manifest['entries']:
        if entry['key'] not in BAKED:
            continue
        png = os.path.join(OUT, entry['key'] + '.png')
        with Image.open(png) as im:
            w, h = im.size
        with open(png, 'rb') as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        entry['files'] = [{'path': f"global/{entry['key']}.png", 'sha256': digest, 'width': w, 'height': h}]
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main(sys.argv[1:])
