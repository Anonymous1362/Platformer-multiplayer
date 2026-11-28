"""Character close-up sheet for fast model iteration and the board's model sheet.

    python3 -I tools/blender/lookdev/char_sheet.py [look] [out.png]

Renders Kes (aim pose, three-quarter; idle, front three-quarter; idle, back three-quarter) and the
Crawler under the look's flip-safe sprite rig on a neutral backdrop.
"""

import math
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import bpy  # noqa: E402,F401
from studio import comp as K, stage  # noqa: E402
from studio.looks import LOOKS  # noqa: E402

import custodian  # noqa: E402
import kes  # noqa: E402


def cam(name, center, res, density, tilt=10.0):
    h_m = res[1] * math.cos(math.radians(tilt)) / (stage.U_PER_M * density)
    return stage.ortho_camera(name, center, h_m, res, tilt)


def main(argv):
    lid = argv[0] if argv and argv[0] in LOOKS else 'B'
    out = argv[1] if len(argv) > 1 else os.path.join(tempfile.gettempdir(), f'cd-chars-{lid}.png')
    look = LOOKS[lid]
    stage.new_scene(look, 48)
    J = kes.build(look, 'hero')
    rig = custodian.build(look, 'crawler')
    custodian.pose(rig, 'alert')
    tiles = []
    with tempfile.TemporaryDirectory() as tmp:
        for k, (pose, yaw) in enumerate((('aim', None), ('idle', -60), ('idle', 150))):
            kes.pose(J, pose, yaw)
            c = cam(f'h{k}', (0, 0, 0.95), (420, 620), 5.4)
            tiles.append(K.load(stage.render_layer('hero', c, os.path.join(tmp, f'h{k}.png'), 'rig_sprite')))
        c = cam('c', (0.05, 0, 0.42), (620, 380), 3.8)
        crawler = K.load(stage.render_layer('crawler', c, os.path.join(tmp, 'c.png'), 'rig_sprite'))
    W = sum(t.shape[1] for t in tiles) + crawler.shape[1]
    sheet = K.solid(620, W, K.hexrgb('#3A3F44'))
    x = 0
    for t in tiles:
        K.over(sheet, t, x, 0)
        x += t.shape[1]
    K.over(sheet, crawler, x, 240)
    K.save(sheet, out)
    print(out)


if __name__ == '__main__':
    main(sys.argv[1:])
