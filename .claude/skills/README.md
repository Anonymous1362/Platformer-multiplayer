# Project skills

Loaded on demand by Claude Code in this repo. Third-party skills were reviewed before adding (no scripts that fetch or run remote code).

| Prefix | Source | License | Notes |
| --- | --- | --- | --- |
| `phaser-*` | Phaser's official agent skills, copied from `node_modules/phaser/skills` (Phaser 4.2.1) | MIT | Re-copy when Phaser is upgraded. |
| `gd-*` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 (see LICENSE/NOTICE files here) | Engine-neutral discipline skills plus `gd-phaser-core` (Phaser 4 aware). Unity/Godot/Unreal skills were left out. |
| `blender-*` | [arjun988/blender-skills](https://github.com/arjun988/blender-skills) | MIT | For 3D bakes (spinners, props). Needs Blender or `bpy`, not installed yet. |
| `cosmic-drift-art` | This project | — | Palette, look rules, and the asset pipeline. |

Not added: `Donchitos/Claude-Code-Game-Studios`. Its skills depend on its own hooks, folder layout, and studio workflow, which would conflict with this repo's spec-driven build protocol.
