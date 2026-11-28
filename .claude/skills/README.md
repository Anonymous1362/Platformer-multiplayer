# Project skills

Loaded on demand by Claude Code in this repo. Third-party skills were reviewed before adding (no scripts that fetch or run remote code).

| Prefix | Source | License | Notes |
| --- | --- | --- | --- |
| `phaser-*` | Phaser's official agent skills, copied from `node_modules/phaser/skills` (Phaser 4.2.1) | MIT | Re-copy when Phaser is upgraded. |
| `gd-*` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 (see LICENSE/NOTICE files here) | Engine-neutral discipline skills plus `gd-phaser-core` (Phaser 4 aware). Unity/Godot/Unreal skills were left out. |
| `blender-*` | [arjun988/blender-skills](https://github.com/arjun988/blender-skills) | MIT | For 3D bakes (spinners, props). Uses `bpy` (installed by the environment setup script). |
| `scenario-blender-*` (11) | [scenario-labs/skills](https://github.com/scenario-labs/skills) v0.63.0 (commit 3c4d18c), `skills/dcc/blender/` | MIT (`LICENSE-scenario-skills.txt`) | Expert Blender 5.x craft: `expert` (required background for the others), `hard-surface`, `texturing-shading`, `sculpting`, `grease-pencil` (ink line art, the hand-drawn finish), `rigging`, `animation`, `blockout` (modular kits), `uv-baking` (normal maps), `lighting-rendering`, `geometry-nodes` (scatter). Reviewed 2026-11-28: scripts make no network calls and run no downloaded code; the only process launch is `bx_rig.cycle_check`, which reopens a local temp .blend in Blender to list dependency cycles. Mentions of a "Scenario MCP" are optional; the skills work without it. |
| `blender-image-to-3d` | [majidmanzarpour/blender-game-skills](https://github.com/majidmanzarpour/blender-game-skills) (commit f0ef293) | MIT (`LICENSE-blender-game-skills.txt`) | Builds an asset from an owner reference image (sketch, photo) through gated phases with silhouette checks. Reviewed 2026-11-28: no network calls. Its scripts expect a `blender` binary; with the `bpy` module, run their functions from Python instead. |
| `cosmic-drift-art` | This project | — | Look rules (docs/ART_BIBLE.md), palette, and the asset pipeline. Wins over every third-party skill on look and style. |

Not added: `Donchitos/Claude-Code-Game-Studios`. Its skills depend on its own hooks, folder layout, and studio workflow, which would conflict with this repo's spec-driven build protocol.

Not added: the "kiln / loom / vex / chirp" suite mentioned by Gemini (no repository name to review).
