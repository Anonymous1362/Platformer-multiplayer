"""Builds game SFX from the fetched CC0 packs (spec 10.5). Usage: python3 -I tools/audio-build/build.py

Reads assets_src/third_party/<pack>/ (run `npm run assets:fetch` first), trims, normalizes loudness
(mean about -20 dB with peaks at or below -1 dBFS), encodes mono AAC .m4a and Opus .webm into
public/assets/audio/, and rewrites the `audio` entries of public/assets/ASSET_MANIFEST.json and the
SFX rows of public/assets/LICENSES.csv. Several sources for one key are variations picked at random.
"""

import csv
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PACKS = os.path.join(ROOT, 'assets_src', 'third_party')
OUT = os.path.join(ROOT, 'public', 'assets', 'audio')
MANIFEST = os.path.join(ROOT, 'public', 'assets', 'ASSET_MANIFEST.json')
LEDGER = os.path.join(ROOT, 'public', 'assets', 'LICENSES.csv')

D, I, IF, UI = 'kenney-digital-audio', 'kenney-impact-sounds', 'kenney-interface-sounds', 'kenney-ui-audio'
PACK_TITLES = {
    D: 'Digital Audio (Kenney)',
    I: 'Impact Sounds (Kenney)',
    IF: 'Interface Sounds (Kenney)',
    UI: 'UI Audio (Kenney)',
}

# key: (bus, trim seconds or None, extra dB, [(pack, file stem), ...])
SFX = {
    'sfx_jump': ('sfx', 0.32, -4, [(D, 'phaseJump1'), (D, 'phaseJump3'), (D, 'phaseJump5')]),
    'sfx_land': ('sfx', 0.3, -3, [(I, 'impactPlate_medium_000'), (I, 'impactPlate_medium_001'),
                                  (I, 'impactPlate_medium_002')]),
    'sfx_footstep': ('sfx', 0.25, -9, [(I, f'footstep_concrete_00{i}') for i in range(5)]),
    'sfx_dash': ('sfx', 0.3, -3, [(D, 'phaserUp4'), (D, 'phaserUp6')]),
    'sfx_shoot_pulse_blaster': ('sfx', 0.3, -6, [(D, 'laser4'), (D, 'laser5'), (D, 'laser6')]),
    'sfx_impact_metal': ('sfx', 0.35, -4, [(I, 'impactMetal_light_000'), (I, 'impactMetal_light_001'),
                                           (I, 'impactMetal_light_002')]),
    'sfx_crawler_alert': ('sfx', None, -4, [(D, 'twoTone1')]),
    'sfx_crawler_windup': ('sfx', 0.45, -4, [(D, 'phaserUp1')]),
    'sfx_crawler_hurt': ('sfx', 0.35, -2, [(I, 'impactMetal_medium_000'), (I, 'impactMetal_medium_001')]),
    'sfx_crawler_death': ('sfx', 0.9, -2, [(D, 'spaceTrash1'), (D, 'spaceTrash3')]),
    'sfx_hurt': ('sfx', 0.4, -1, [(I, 'impactPunch_heavy_000'), (I, 'impactPunch_heavy_001')]),
    'sfx_death': ('sfx', None, -2, [(D, 'zapThreeToneDown')]),
    'sfx_revive': ('sfx', None, -3, [(D, 'zapThreeToneUp')]),
    'sfx_shard_pickup': ('sfx', 0.3, -5, [(D, 'pepSound3')]),
    'sfx_checkpoint': ('sfx', None, -2, [(D, 'powerUp7')]),
    'sfx_level_complete': ('sfx', None, -1, [(D, 'powerUp3')]),
    'sfx_ui_tap': ('ui', None, -4, [(IF, 'select_001')]),
    'sfx_ui_back': ('ui', None, -4, [(IF, 'back_001')]),
}

TARGET_MEAN_DB = -20.0
MAX_PEAK_DB = -1.0


def find(pack, stem):
    hits = glob.glob(os.path.join(PACKS, pack, '**', stem + '.ogg'), recursive=True)
    if not hits:
        sys.exit(f'missing {pack}/{stem}.ogg: run npm run assets:fetch')
    return hits[0]


def levels(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    mean = float(re.search(r'mean_volume: (-?[\d.]+) dB', out).group(1))
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', out).group(1))
    return mean, peak


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, '*')):
        os.remove(old)
    entries, rows = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for key, (bus, trim, extra_db, sources) in SFX.items():
            files = []
            for n, (pack, stem) in enumerate(sources):
                src = find(pack, stem)
                wav = os.path.join(tmp, f'{key}_{n}.wav')
                chain = ['silenceremove=start_periods=1:start_threshold=-50dB']
                if trim:
                    chain += [f'atrim=0:{trim}', f'afade=t=out:st={max(0.0, trim - 0.08):.3f}:d=0.08']
                ff('-i', src, '-ac', '1', '-ar', '48000', '-af', ','.join(chain), wav)
                mean, peak = levels(wav)
                gain = min(TARGET_MEAN_DB - mean, MAX_PEAK_DB - peak) + extra_db
                gain = min(gain, MAX_PEAK_DB - peak)
                norm = os.path.join(tmp, f'{key}_{n}_n.wav')
                ff('-i', wav, '-af', f'volume={gain:.2f}dB', norm)
                base = f'{key}_{n}'
                m4a = os.path.join(OUT, base + '.m4a')
                webm = os.path.join(OUT, base + '.webm')
                ff('-i', norm, '-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart', m4a)
                ff('-i', norm, '-c:a', 'libopus', '-b:a', '64k', webm)
                files.append({'path': f'audio/{base}.webm', 'sha256': sha(webm), 'codec': 'opus'})
                files.append({'path': f'audio/{base}.m4a', 'sha256': sha(m4a), 'codec': 'aac'})
                rows.append([key, f'{PACK_TITLES[pack]} / {stem}.ogg', 'Kenney Vleugels (kenney.nl)', 'CC0-1.0',
                             '2026-11-27', '', f'trimmed {trim}s, normalized, mono' if trim else 'normalized, mono'])
            entries.append({'key': key, 'scope': 'global', 'kind': 'audio', 'source': 'custom', 'required': False,
                            'files': files, 'bus': bus})
    with open(MANIFEST) as f:
        manifest = json.load(f)
    manifest['entries'] = [e for e in manifest['entries'] if e.get('kind') != 'audio'] + entries
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    keep = []
    if os.path.exists(LEDGER):
        with open(LEDGER, newline='') as f:
            keep = [r for r in csv.reader(f) if r and not r[0].startswith('sfx_')]
    header = ['key', 'source', 'author_or_tool', 'license', 'date', 'prompt_or_seed', 'notes']
    keep = [r for r in keep if r != header]
    with open(LEDGER, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(keep + rows)
    print(f'{len(entries)} sounds, {len(rows)} files')


if __name__ == '__main__':
    main()
