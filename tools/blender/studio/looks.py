"""Art-direction looks: the style anchor every asset reads (palette, light rigs, fog, grade, HUD).

LOCKED (owner, 2026-11-28): look B "Ember Dark" is the game's look (docs/ART_BIBLE.md). A and C stay as
level-mood variants (C's rain and dusk, A's heavy fog), not as competing directions.

Three candidate looks for the Art & UI B style test. All three keep the game's rules:
- dark, realistic, atmospheric sci-fi; no neon cyberpunk palette;
- one cool key light, a rim light that separates characters, contact shadows;
- gameplay readability first: the hero and threats always separate from the background by value,
  hazards and weak points use the one danger colour, platform tops are lit;
- the same scene, models and layout; only light, atmosphere, material tones and grade change.

Mood references are for feel only (light, fog, scale); no shapes, characters or designs are borrowed.

Directions (travel vectors): x right, y away from the camera, z up. `rig_world` lights environments
(never mirrored); `rig_sprite` lights characters and pickups and is flip-safe (high frontal key, rim
straight behind), so a sprite mirrored with flipX still matches the scene.
"""

LOOKS = {
    'A': {
        'name': 'Hush',
        'pitch': 'Quiet and fog-bound. Near-monochrome grey-green world, soft cold light, dark ground against '
                 'bright mist; figures read by silhouette and rim light. Loneliness and scale first; colour '
                 'only where it matters.',
        'mood_refs': 'Inside (fog, value silhouettes, restraint)',
        'sky': [(0.0, '#3A4446'), (0.42, '#6F7E7D'), (0.6, '#A3B0AC'), (0.75, '#B3BEBA'), (1.0, '#9BA7A3')],
        'star': {'pos': (0.21, 0.22), 'radius': 22, 'core': '#F3F2EA', 'glow': '#E5E7DD', 'glow_strength': 0.5,
                 'glow_radius': 420, 'haze': 0.55, 'rays': 0.0},
        'stars': {'density': 0.0, 'brightness': 0.0},
        'shard_rain': {'count': 5, 'color': '#F2EFE2', 'brightness': 0.25},
        'fog': {'color': '#A3B0AC', 'far': 0.84, 'mid': 0.64, 'near': 0.4, 'play': 0.05,
                'ground_color': '#B8C3BF', 'ground': 0.62, 'ground_top': 0.62},
        'shafts': {'color': '#EEF2EC', 'intensity': 0.1, 'count': 5},
        'rain': None,
        'ambient': '#7F8C89', 'ambient_strength': 0.5,
        'rig_world': [
            {'name': 'key', 'travel': (0.8, 0.18, -0.58), 'color': '#E6EAE6', 'energy': 2.6, 'angle': 14},
            {'name': 'fill', 'travel': (-0.5, 0.6, -0.3), 'color': '#9FB0AE', 'energy': 0.35, 'angle': 30},
            {'name': 'rim', 'travel': (-0.3, -0.75, -0.55), 'color': '#DCE3E0', 'energy': 1.3, 'angle': 8},
            {'name': 'bounce', 'travel': (0.1, 0.2, 0.97), 'color': '#7D8A86', 'energy': 0.15, 'angle': 40},
        ],
        'rig_sprite': [
            {'name': 'key', 'travel': (0.18, 0.55, -0.82), 'color': '#E6EAE6', 'energy': 2.0, 'angle': 14},
            {'name': 'rim', 'travel': (0.0, -0.62, -0.78), 'color': '#EEF3F0', 'energy': 2.6, 'angle': 8},
            {'name': 'fill', 'travel': (-0.4, 0.8, -0.1), 'color': '#8E9C9A', 'energy': 0.3, 'angle': 30},
        ],
        'rock': ('#2A2C2B', '#383A37', '#6E736D'),
        'crystal': {'base': '#4E5B57', 'glow': '#D3EBE3', 'emit': 0.8, 'edge': '#93A7A1'},
        'hull': '#45494A', 'hull_light': ('#E6A65C', 5.0), 'metal': '#3B3F40', 'grate': '#4A4E4F',
        'danger': ('#D94A2E', 7.0), 'visor': ('#86E3D3', 3.0), 'shard': ('#F1C66A', 2.0),
        'foreground': {'color': '#0C0F10', 'blur': 7},
        'motes': {'color': '#EEF2EE', 'count': 55, 'alpha': 0.32},
        'grade': {'exposure': 0.0, 'contrast': 1.06, 'saturation': 0.42, 'lift': (0.02, 0.025, 0.025),
                  'gain': (0.98, 1.0, 1.0), 'vignette': 0.42, 'grain': 0.035, 'bloom': 0.22, 'bloom_at': 0.84},
        'hud': {'color': '#E9ECE8', 'accent': '#D3EBE3', 'danger': '#D94A2E'},
    },
    'B': {
        'name': 'Ember Dark',
        'pitch': 'Cinematic and high-contrast. Deep blue-black world, warm white-gold starlight cutting '
                 'through teal crystal glow, crisp rim light on every figure. Action-forward and premium.',
        'mood_refs': 'Metroid Dread (hard light, readable armour, dark zones)',
        'sky': [(0.0, '#04070B'), (0.38, '#0A131A'), (0.56, '#13303A'), (0.64, '#1C4048'), (0.72, '#132A31'),
                (1.0, '#091317')],
        'star': {'pos': (0.2, 0.2), 'radius': 28, 'core': '#FFF7E4', 'glow': '#FFC877', 'glow_strength': 1.05,
                 'glow_radius': 560, 'haze': 0.1, 'rays': 0.06},
        'stars': {'density': 0.0009, 'brightness': 0.55},
        'shard_rain': {'count': 7, 'color': '#FFD58A', 'brightness': 0.7},
        'fog': {'color': '#0F2229', 'far': 0.72, 'mid': 0.5, 'near': 0.27, 'play': 0.03,
                'ground_color': '#18363F', 'ground': 0.62, 'ground_top': 0.6},
        'shafts': {'color': '#FFC97A', 'intensity': 0.2, 'count': 6},
        'rain': None,
        'ambient': '#163038', 'ambient_strength': 0.38,
        'rig_world': [
            {'name': 'key', 'travel': (0.55, 0.12, -0.83), 'color': '#FFD9A0', 'energy': 3.8, 'angle': 3},
            {'name': 'fill', 'travel': (-0.5, 0.6, -0.3), 'color': '#3B6D80', 'energy': 0.3, 'angle': 30},
            {'name': 'rim', 'travel': (-0.3, -0.75, -0.55), 'color': '#7FD4F0', 'energy': 2.1, 'angle': 6},
            {'name': 'bounce', 'travel': (0.1, 0.2, 0.97), 'color': '#123038', 'energy': 0.12, 'angle': 40},
        ],
        # B1a: strictly flip-safe (no x component); the blue all-round rim that read as an outline is gone.
        # Direction comes from the engine's screen-space rim toward the star (`rim_engine`).
        'rig_sprite': [
            {'name': 'key', 'travel': (0.0, 0.5, -0.87), 'color': '#FFDDA8', 'energy': 3.4, 'angle': 3},
            {'name': 'rim', 'travel': (0.0, -0.62, -0.78), 'color': '#A9BEC4', 'energy': 1.1, 'angle': 6},
            {'name': 'bounce', 'travel': (0.0, 0.45, 0.89), 'color': '#2E7A73', 'energy': 0.35, 'angle': 30},
        ],
        'rim_engine': {'color': '#FFD9A0', 'amount': 0.5, 'width': 2.0},
        'lichen': '#1E3330',
        'rock': ('#14181B', '#21272B', '#4D5653'),
        'crystal': {'base': '#0C2F31', 'glow': '#3FE0C8', 'emit': 1.8, 'edge': '#2A7A73'},
        'hull': '#383D42', 'hull_light': ('#FF9E3D', 12.0), 'metal': '#2F3439', 'grate': '#3C4248',
        'danger': ('#FF3B2E', 10.0), 'visor': ('#4FF0D8', 6.0), 'shard': ('#FFC24A', 4.0),
        'foreground': {'color': '#030506', 'blur': 7},
        'motes': {'color': '#FFE3B0', 'count': 70, 'alpha': 0.5},
        'grade': {'exposure': 0.0, 'contrast': 1.12, 'saturation': 0.85, 'lift': (0.0, 0.01, 0.015),
                  'gain': (1.02, 1.0, 0.98), 'vignette': 0.5, 'grain': 0.012, 'bloom': 0.55, 'bloom_at': 0.7},
        'hud': {'color': '#EAF2F2', 'accent': '#4FF0D8', 'danger': '#FF3B2E'},
    },
    'C': {
        'name': 'Verdigris Dusk',
        'pitch': 'Moody, rain-damp dusk. The broken star sits low on the horizon in warm haze; the world is '
                 'deep blue-green with living crystal light. Atmospheric and painterly, but realistic.',
        'mood_refs': 'Little Nightmares 2 (dusk, rain, depth haze)',
        'sky': [(0.0, '#0E1220'), (0.33, '#1B2838'), (0.5, '#33505A'), (0.58, '#5E7370'), (0.63, '#A98C62'),
                (0.67, '#7A6E58'), (0.74, '#3E5556'), (1.0, '#18242A')],
        'star': {'pos': (0.3, 0.5), 'radius': 30, 'core': '#FFF1D4', 'glow': '#E9A35F', 'glow_strength': 1.0,
                 'glow_radius': 600, 'haze': 0.3, 'rays': 0.04},
        'stars': {'density': 0.0004, 'brightness': 0.35},
        'shard_rain': {'count': 5, 'color': '#FFD9A6', 'brightness': 0.5},
        'fog': {'color': '#2A4447', 'far': 0.7, 'mid': 0.5, 'near': 0.3, 'play': 0.04,
                'ground_color': '#35514F', 'ground': 0.55, 'ground_top': 0.6},
        'shafts': {'color': '#F2B677', 'intensity': 0.13, 'count': 4},
        'rain': {'count': 900, 'color': '#B9C9C9', 'alpha': 0.1, 'angle': 12, 'length': 26},
        'ambient': '#2C4448', 'ambient_strength': 0.48,
        'rig_world': [
            {'name': 'key', 'travel': (0.9, 0.18, -0.36), 'color': '#FFC385', 'energy': 3.0, 'angle': 4},
            {'name': 'fill', 'travel': (-0.5, 0.6, -0.3), 'color': '#4F7C82', 'energy': 0.4, 'angle': 30},
            {'name': 'rim', 'travel': (-0.4, -0.7, -0.5), 'color': '#9FC9C8', 'energy': 1.3, 'angle': 8},
            {'name': 'bounce', 'travel': (0.1, 0.2, 0.97), 'color': '#203436', 'energy': 0.15, 'angle': 40},
        ],
        'rig_sprite': [
            {'name': 'key', 'travel': (0.25, 0.55, -0.8), 'color': '#FFCB95', 'energy': 2.3, 'angle': 4},
            {'name': 'rim', 'travel': (0.0, -0.62, -0.78), 'color': '#A7D3D0', 'energy': 2.8, 'angle': 8},
            {'name': 'fill', 'travel': (-0.4, 0.8, -0.1), 'color': '#3F6A70', 'energy': 0.35, 'angle': 30},
        ],
        'rock': ('#1A2022', '#273032', '#56665F'),
        'crystal': {'base': '#133C3A', 'glow': '#59D9C0', 'emit': 1.4, 'edge': '#357D73'},
        'hull': '#3E443E', 'hull_light': ('#FFB15C', 10.0), 'metal': '#343A38', 'grate': '#444B48',
        'danger': ('#F0402F', 9.0), 'visor': ('#6FF0DA', 5.0), 'shard': ('#FFC965', 3.0),
        'foreground': {'color': '#06090A', 'blur': 7},
        'motes': {'color': '#D8EDE6', 'count': 40, 'alpha': 0.3},
        'grade': {'exposure': 0.0, 'contrast': 1.08, 'saturation': 0.72, 'lift': (0.01, 0.02, 0.03),
                  'gain': (1.03, 1.0, 0.96), 'vignette': 0.48, 'grain': 0.04, 'bloom': 0.4, 'bloom_at': 0.74},
        'hud': {'color': '#E6EEEA', 'accent': '#6FF0DA', 'danger': '#F0402F'},
    },
}

LOCKED = 'B'
