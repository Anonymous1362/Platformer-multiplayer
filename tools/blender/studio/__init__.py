"""Cosmic Drift studio kit: the one shared pipeline for every Blender asset (Art & UI B onward).

- stage:  scene setup, the light rigs, cameras, scale rules, and per-layer renders.
- shapes: deterministic modelling helpers (crystals, rocks, swept profiles, rounded boxes).
- mats:   the material library; every colour comes from the active look.
- comp:   2D compositing in display space, the way the game blends its layers, plus QA images.
- looks:  the art-direction looks (palette, light, fog, grade) that every asset reads.
- qa:     automatic checks for baked sprite sheets (size, frames, feet line, clipping, fringe, hash).

Run lookdev with `npm run art:lookdev`. See docs/ART_UI_B_PLAN.md.
"""
