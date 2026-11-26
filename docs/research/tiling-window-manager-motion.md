# Tiling window manager motion

Research for [#111](https://github.com/shrujancheruku/shrujancheruku.github.io/issues/111) (map: [#110](https://github.com/shrujancheruku/shrujancheruku.github.io/issues/110)).

**Question.** What do real tiling window managers animate when a window opens, closes or moves, and when the workspace changes? Covers Hyprland, niri and rift.

**Method.** Read from primary sources only: each project's source code, shipped default config and official wiki, at the commits below (26 November 2026). Line numbers refer to these commits. Numbers marked *derived* are computed here from the cited formula and constants; they are not stated by the source.

| Project | Repo | Commit |
| --- | --- | --- |
| Hyprland (`VERSION` 0.57.0) | [hyprwm/Hyprland](https://github.com/hyprwm/Hyprland/tree/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe) | `e537b2f` |
| Hyprland wiki | [hyprwm/hyprland-wiki](https://github.com/hyprwm/hyprland-wiki/tree/bd104c02d476c726d665e4ee14e861b97c21b67d) | `bd104c0` |
| hyprutils (Hyprland's animation library) | [hyprwm/hyprutils](https://github.com/hyprwm/hyprutils/tree/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8) | `1bcbf83` |
| niri | [YaLTeR/niri](https://github.com/YaLTeR/niri/tree/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e) | `6072f67` |
| rift | [acsandmann/rift](https://github.com/acsandmann/rift/tree/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f) | `660f0ef` |

Link prefixes used below:

- `HL` = `https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe`
- `HW` = `https://github.com/hyprwm/hyprland-wiki/blob/bd104c02d476c726d665e4ee14e861b97c21b67d`
- `HU` = `https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8`
- `NI` = `https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e`
- `RI` = `https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f`

## Summary

| | Hyprland (shipped example config) | niri (defaults) | rift (defaults) |
| --- | --- | --- | --- |
| Open | Pop in from 87% size about the window's centre, fading 0 to 1 | Scale from 50% to 100% about the centre, fading 0 to 1 | No open animation of its own; the window's frame is moved to its tile |
| Open timing | Geometry: spring (mass 1, stiffness 238.1191, damping 24.2128). Fade: 173 ms | 150 ms, ease-out-expo | 300 ms if `animate` is on; it is **off** by default |
| Close | A snapshot shrinks to 87% and fades to 0 | A snapshot shrinks to 80% and fades to 0 | No close animation of its own |
| Close timing | Geometry 149 ms linear; fade 146 ms | 150 ms, ease-out-quad | n/a |
| Neighbours | Move and resize to their new tiles with the same spring | Slide to their new places with a critically damped spring (stiffness 800, about 326 ms *derived*) | Frames interpolate over the one shared 300 ms animation |
| Simultaneous? | Yes, as one batch; a closing window's fade is held until the neighbours' resize batch is ready (50 ms cap) | Yes; the close animation waits for the neighbours' resize transaction (300 ms cap) | Yes; one animation holds every window |
| Workspace change | Crossfade: in 121 ms, out 194 ms. A whole-workspace slide is the built-in fallback and an option | The whole column of workspaces slides vertically on a critically damped spring (stiffness 1000, about 291 ms *derived*) | Instant |
| Mid-animation change | Retargets from the current value; a spring keeps its velocity, a bezier restarts its clock | Restarts from the current visual position with zero velocity | Restarts the shared clock from each window's current frame |

## Hyprland

### Where the defaults live

Hyprland has two layers of defaults, and they differ.

1. **Built in.** The animation tree's root is `global`: enabled, speed 8, curve `default`, no style; every other leaf inherits it unless set ([`HL/src/config/shared/animation/AnimationTree.cpp#L61-L66`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/config/shared/animation/AnimationTree.cpp#L61-L66)). The `default` bezier is `(0, 0.75), (0.15, 1)`, i.e. `cubic-bezier(0, 0.75, 0.15, 1)` ([`HU/src/animation/AnimationManager.cpp#L13`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/src/animation/AnimationManager.cpp#L13)).
2. **Shipped example config**, which is what the config comment itself calls the "Default curves and animations" ([`HL/example/hyprland.lua#L135-L161`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/example/hyprland.lua#L135-L161)).

`speed` is a duration in deciseconds: "`speed = 1` = 100ms" ([`HW/content/configuring/core/animations.md#L16`](https://github.com/hyprwm/hyprland-wiki/blob/bd104c02d476c726d665e4ee14e861b97c21b67d/content/configuring/core/animations.md#L16); implemented at [`HU/src/animation/AnimatedVariable.cpp#L74-L81`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/src/animation/AnimatedVariable.cpp#L74-L81)).

The example config's values, from `hyprland.lua` lines 136-161:

| Leaf | Duration | Curve | Style |
| --- | --- | --- | --- |
| `windows` (also used for `windowsMove`, which inherits it) | speed 4.79 | spring `easy` | |
| `windowsIn` | speed 4.1 | spring `easy` | `popin 87%` |
| `windowsOut` | 149 ms | `linear` | `popin 87%` |
| `fadeIn` | 173 ms | `almostLinear` | |
| `fadeOut` | 146 ms | `almostLinear` | |
| `workspaces` | 194 ms | `almostLinear` | `fade` |
| `workspacesIn` | 121 ms | `almostLinear` | `fade` |
| `workspacesOut` | 194 ms | `almostLinear` | `fade` |

Curves defined there:

- `easeOutQuint` = `cubic-bezier(0.23, 1, 0.32, 1)`
- `easeInOutCubic` = `cubic-bezier(0.65, 0.05, 0.36, 1)`
- `linear` = `cubic-bezier(0, 0, 1, 1)`
- `almostLinear` = `cubic-bezier(0.5, 0.5, 0.75, 1)`
- `quick` = `cubic-bezier(0.15, 0, 0.1, 1)`
- spring `easy` = mass 1, stiffness 238.1191, damping 24.21279333

**A spring ignores `speed`.** The spring branch of the curve step advances by elapsed time and finishes when value and velocity are within epsilon (0.001 each); it never reads the configured speed ([`HU/src/animation/AnimatedVariable.cpp#L101-L138`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/src/animation/AnimatedVariable.cpp#L101-L138), epsilons at [`HU/include/hyprutils/animation/AnimationManager.hpp#L16-L22`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/include/hyprutils/animation/AnimationManager.hpp#L16-L22)). So the 4.79 and 4.1 above do not set a duration. The wiki does not say this; it is read from the code.

*Derived* shape of spring `easy`, from the closed-form solution at [`HU/src/animation/Spring.cpp#L9-L56`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/src/animation/Spring.cpp#L9-L56): damping ratio about 0.78 (slightly underdamped); 52% of the way at 100 ms, 92% at 200 ms, first reaches the target at about 250 ms, peaks at about 328 ms with roughly 1.9% overshoot, and is visually settled by about 500 ms.

### Window opens

- Position, size and fade alpha are set to a "from" state and then animated to the goal, all started in the same call ([`HL/src/desktop/view/animationControllers/WindowAnimationController.cpp#L156-L170`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/desktop/view/animationControllers/WindowAnimationController.cpp#L156-L170) and `#L189-L197`). Alpha always goes 0 to 1.
- `popin N%`: the window starts at N% of its goal size, centred on the goal's centre, and grows to 100% (`applyPopin`, same file `#L37-L50`). With no percentage it starts from a 5 x 5 px box (the clamp at `#L40`), which is the built-in fallback because the root style is empty.
- Other styles: `slide` brings the window in from the nearest monitor edge, or a forced side (`#L67-L122`); `gnomed` grows it vertically from a zero-height line at its middle (`#L52-L65`). Style list also at [`HW/.../animations.md#L33-L38`](https://github.com/hyprwm/hyprland-wiki/blob/bd104c02d476c726d665e4ee14e861b97c21b67d/content/configuring/core/animations.md#L33-L38).
- Geometry uses `windowsIn`, alpha uses `fadeIn` ([`HL/src/desktop/view/window/Window.cpp#L1577-L1580`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/desktop/view/window/Window.cpp#L1577-L1580)). When the open animation ends the window switches to the `windowsMove` config (`#L1582-L1583`, `#L1132-L1138`).

### Window closes

- The live window is replaced by a snapshot (a framebuffer copy) that animates out: position and size on `windowsOut`, alpha on `fadeOut` to 0 ([`HL/src/desktop/state/WindowFadeout.cpp#L90-L99`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/desktop/state/WindowFadeout.cpp#L90-L99) and `#L114-L122`).
- The style is applied in reverse: with `popin 87%` the snapshot shrinks from full size to 87% about its centre ([`WindowAnimationController.cpp#L43-L49`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/desktop/view/animationControllers/WindowAnimationController.cpp#L43-L49), `#L172-L187`).

### Neighbours

- Neighbours get new tile geometry from the layout and animate position and size toward it with the `windowsMove` config ([`HL/src/desktop/view/window/WindowPresentation.cpp#L548-L551`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/desktop/view/window/WindowPresentation.cpp#L548-L551); set by the tiling algorithms, e.g. [`DwindleAlgorithm.cpp#L590`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/layout/algorithm/tiled/dwindle/DwindleAlgorithm.cpp#L590)). In the example config that is the same `easy` spring as the opening window.
- The changes happen together, not in sequence. Geometry changes for a monitor are queued in a per-monitor transaction and applied as one batch once the resized clients have committed buffers of the new size, or after `misc:transaction_timeout`, default 50 ms ([`HL/src/output/MonitorWindowTransaction.cpp#L222-L243`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/output/MonitorWindowTransaction.cpp#L222-L243), `#L295-L340`; default at [`HL/src/config/values/ConfigValues.cpp#L625-L626`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/config/values/ConfigValues.cpp#L625-L626)).
- On close, the closing snapshot's fade-out is held and only started when that batch is applied, so the neighbours start growing as the closed window starts fading ([`WindowFadeout.cpp#L106-L109`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/desktop/state/WindowFadeout.cpp#L106-L109); [`MonitorWindowTransaction.cpp#L43-L50`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/output/MonitorWindowTransaction.cpp#L43-L50), `#L163-L171`).
- Not answered by the sources read: no source states an intended stagger or delay between the opening window and its neighbours. The code gives none beyond the transaction wait.

### Workspace change

- A workspace has two animated values, a render offset and an alpha ([`HL/src/workspace/HLWorkspace.cpp#L77-L81`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/workspace/HLWorkspace.cpp#L77-L81)). The renderer translates each of the workspace's windows by that one offset, so the workspace travels as a unit; windows do not travel singly ([`HL/src/render/Renderer.cpp#L290-L291`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/render/Renderer.cpp#L290-L291), `#L3111-L3112`).
- The old workspace's "out" and the new workspace's "in" are started back to back in the same call, so they overlap fully ([`HL/src/output/Monitor.cpp#L1367-L1374`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/output/Monitor.cpp#L1367-L1374)).
- Styles are `slide`, `slidevert`, `fade`, `slidefade`, `slidefadevert` ([`HW/.../animations.md#L60`](https://github.com/hyprwm/hyprland-wiki/blob/bd104c02d476c726d665e4ee14e861b97c21b67d/content/configuring/core/animations.md#L60)).
  - **`fade`** (the example config): no movement; the new workspace's alpha goes 0 to 1 and the old one's 1 to 0 ([`HL/src/animation/WorkspaceAnimationController.cpp#L108-L117`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/animation/WorkspaceAnimationController.cpp#L108-L117)).
  - **Slide** (the built-in fallback, since an empty style reaches the final branch): the offset distance is the full monitor width plus `general:gaps_workspaces`, times an optional percentage (`#L127-L136`). `slidevert` does the same on the y axis (`#L118-L126`). `slidefade N%` moves only N% of the screen while fading (`#L81-L107`; wiki `#L150-L155`).
- Direction: `ANIMTOLEFT` is true when the new workspace's ID is higher than the old one's ([`Monitor.cpp#L1370`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/output/Monitor.cpp#L1370)). With it true, the incoming workspace starts at `+XDISTANCE` (off the right edge) and the outgoing one ends at `-XDISTANCE` (off the left edge). Going to a higher-numbered workspace therefore moves everything left; a lower-numbered one moves everything right. With `slidevert`, a higher number comes up from the bottom. `animations:workspace_wraparound` (default false) flips the direction between the first and last workspace ([`ConfigValues.cpp#L358`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/config/values/ConfigValues.cpp#L358)).

### Several changes at once, and interruption

- Every animated value is independent and all active values are stepped on the same tick ([`HL/src/animation/AnimationManager.cpp#L276-L301`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/animation/AnimationManager.cpp#L276-L301)), so several windows changing in one go animate in parallel.
- Assigning a new goal mid-animation retargets: the start becomes the current value, the goal becomes the new value, and the animation begins again ([`HU/include/hyprutils/animation/AnimatedVariable.hpp#L225-L250`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/include/hyprutils/animation/AnimatedVariable.hpp#L225-L250)). There is no jump and no queue.
  - Bezier: the clock restarts, so the full duration and curve are replayed over the remaining distance ([`AnimatedVariable.cpp#L192-L205`](https://github.com/hyprwm/hyprutils/blob/1bcbf83d34e4679f534ed4fac5ac4d7a683df3d8/src/animation/AnimatedVariable.cpp#L192-L205)).
  - Spring: the current velocity is kept (rescaled for scalar values) rather than reset (`AnimatedVariable.hpp#L229-L247`; `AnimatedVariable.cpp#L211-L219`).
- A workspace switch issued mid-switch calls `startAnimation` again, which warps the offset and alpha to fresh start values before animating ([`WorkspaceAnimationController.cpp#L109-L135`](https://github.com/hyprwm/Hyprland/blob/e537b2fce29e4bac191e73fd3c77ec3de80b7ffe/src/animation/WorkspaceAnimationController.cpp#L109-L135), the `setValueAndWarp` calls). So workspace animations restart from their start state instead of continuing from the current position.

## niri

### Defaults

Defaults are stated in the wiki ([`NI/docs/wiki/Configuration:-Animations.md#L8-L66`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/docs/wiki/Configuration:-Animations.md#L8-L66)) and match the code ([`NI/niri-config/src/animations.rs#L146-L308`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/niri-config/src/animations.rs#L146-L308)):

| Animation | Default |
| --- | --- |
| `window-open` | 150 ms, `ease-out-expo` |
| `window-close` | 150 ms, `ease-out-quad` |
| `window-movement` | spring, damping ratio 1.0, stiffness 800, epsilon 0.0001 |
| `window-resize` | spring, damping ratio 1.0, stiffness 800, epsilon 0.0001 |
| `horizontal-view-movement` | spring, damping ratio 1.0, stiffness 800, epsilon 0.0001 |
| `workspace-switch` | spring, damping ratio 1.0, stiffness 1000, epsilon 0.0001 |

- `ease-out-expo` is `1 - 2^(-10x)` ([`NI/src/animation/mod.rs#L341-L350`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/animation/mod.rs#L341-L350)). Available curves are `ease-out-quad`, `ease-out-cubic`, `ease-out-expo`, `linear` and `cubic-bezier` (wiki `#L91-L108`).
- Spring mass is fixed at 1; damping ratio 1.0 is critically damped, "comes to rest in minimum possible time without oscillations" (wiki `#L130-L149`). A spring's duration cannot be set directly (wiki `#L116-L117`).
- *Derived* spring durations, from `duration = -ln(epsilon) / sqrt(stiffness)` for a critically damped spring ([`NI/src/animation/spring.rs#L48-L72`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/animation/spring.rs#L48-L72)): stiffness 800 gives about 326 ms (77% of the way at 100 ms, 92% at 150 ms, 98% at 200 ms); stiffness 1000 gives about 291 ms (82% at 100 ms, 95% at 150 ms).
- `slowdown` scales all animations (wiki `#L14-L15`).

### Window opens

Without a custom shader, the window is drawn scaled about its centre by `progress / 2 + 0.5` (so 50% to 100%) with alpha equal to progress (0 to 1) ([`NI/src/layout/opening_window.rs#L125-L132`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/opening_window.rs#L125-L132)). Progress runs 0 to 1 on the `window-open` config ([`NI/src/layout/tile.rs#L579-L587`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/tile.rs#L579-L587)).

### Window closes

A snapshot of the window is drawn scaled about its centre by `(1 - progress) / 5 + 0.8` (100% down to 80%) with alpha `1 - progress` ([`NI/src/layout/closing_window.rs#L273-L289`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/closing_window.rs#L273-L289)), on the `window-close` config ([`NI/src/layout/scrolling.rs#L1546-L1553`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/scrolling.rs#L1546-L1553)).

### Neighbours

- `window-movement` covers "Moving windows out of the way upon window opening and closing" (wiki `#L298-L311`).
- On open, the columns to one side get a move animation in the same call that inserts the new column ([`scrolling.rs#L1030-L1041`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/scrolling.rs#L1030-L1041)), and the open animation is started right after the window is added ([`NI/src/handlers/compositor.rs#L237`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/handlers/compositor.rs#L237)). So the neighbours slide and the new window scales in at the same time, with different timings (326 ms spring against 150 ms ease).
- On close, the columns beside the gap, or the tiles below it in a column, are given move animations in the removal call ([`scrolling.rs#L1196-L1208`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/scrolling.rs#L1196-L1208), `#L1097-L1103`).
- The close animation is tied to the neighbours' resize: it sits in a `Waiting` state, drawing the snapshot unchanged, until the transaction that resizes the remaining windows completes, then starts from 0 ([`closing_window.rs#L70-L91`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/closing_window.rs#L70-L91), `#L158-L168`). The transaction times out after 300 ms ([`NI/src/utils/transaction.rs#L15-L18`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/utils/transaction.rs#L15-L18)).
- Only manual resizes get the resize animation, and "very small resizes (up to 10 pixels) are not animated" (wiki `#L321-L328`).
- When two animations must play together, niri drives both with the same config, e.g. windows moved by a resize use `window-resize`; the three stiffness-800 springs are identical by default for that reason (wiki `#L457-L474`).

### Workspace change

- "Each monitor contains an independent set of workspaces arranged vertically" ([`NI/docs/wiki/Workspaces.md#L5`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/docs/wiki/Workspaces.md#L5)).
- The switch animates a single fractional "render index" from its current value to the target index ([`NI/src/layout/monitor.rs#L498-L504`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/monitor.rs#L498-L504)). Every workspace's y position is `-render_idx * (workspace height + gap) + idx * (workspace height + gap)` (`monitor.rs#L1489-L1508`). The whole strip of workspaces therefore slides vertically as one; going to a higher index moves the strip up and the new workspace arrives from below. There is no fade.
- Input goes to the destination at once: "An animated workspace switch makes your input go to the final workspace and window instantly, without waiting for the animation" ([`NI/docs/wiki/Development:-Design-Principles.md#L28`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/docs/wiki/Development:-Design-Principles.md#L28)).

### Several changes at once, and interruption

- Each tile and column owns its move animations, so several windows animate in parallel.
- A new move issued mid-move starts from the tile's current visual offset and restarts the animation with zero velocity ([`tile.rs#L609-L627`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/tile.rs#L609-L627): `from: from + current_offset`, `anim.restarted(1., 0., 0.)`). No jump.
- A workspace switch issued mid-switch starts from the current render index, again with zero velocity; the code carries the note "FIXME: also compute and use current velocity" ([`monitor.rs#L466-L467`](https://github.com/YaLTeR/niri/blob/6072f67d9fe0f1c1182f72cc5d4f2ca5f047bf9e/src/layout/monitor.rs#L466-L467), `#L498-L504`).
- Not answered by the sources read: what happens to an open animation if the window closes before it finishes was not traced.

## rift

rift manages other apps' windows on macOS by setting their frames; it does not composite them. That bounds what it can animate.

### Defaults

- Animation is **off** by default: `animate = false` in the shipped config ([`RI/rift.default.toml#L5-L13`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/rift.default.toml#L5-L13)) and the field defaults to false in code ([`RI/src/common/config/types.rs#L482-L490`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/common/config/types.rs#L482-L490)).
- `animation_duration = 0.3` seconds; the config comment gives "typical 0.15-0.35" (`rift.default.toml#L7`, `#L11`; code default at `types.rs#L1882`).
- `animation_easing = "ease_in_out"`, described as "Rift's original circular curve" (`rift.default.toml#L9`, `#L13`). In code it is ease-in-out-circ: for `t < 0.5`, `(1 - sqrt(1 - (2t)^2)) / 2`; otherwise the mirror image ([`RI/src/actor/reactor/animation.rs#L1684-L1709`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/actor/reactor/animation.rs#L1684-L1709)). Linear and the sine, quad, cubic, quart, quint, expo and circ families are also offered ([`RI/crates/rift-protocol/src/commands.rs#L307`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/crates/rift-protocol/src/commands.rs#L307)).
- `animation_fps = 0.0` follows the display (`rift.default.toml#L8`, `#L12`).
- Animation is skipped in macOS Low Power Mode unless the layout sets its own animate flag (`animation.rs#L1089-L1092`).

### What it animates

- One thing: a window's frame going from where it is to where the layout wants it. A layout change builds a single animation holding every affected visible window, each with a `from` and `to` rectangle ([`animation.rs#L1109-L1161`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/actor/reactor/animation.rs#L1109-L1161)). All windows share one clock, one duration and one easing, so the moved window and its neighbours move simultaneously (`#L1533-L1544`, `#L1618-L1628`).
- Position is interpolated every frame, but size is not: it switches from the old size to the new one in a single step when progress reaches 0.5 (`#L292-L302`; the comment at `#L1655-L1659` says "Size switches in one step while the origin eases").
- **Open and close:** the code read contains no open or close animation (no scale, fade or pop-in). A newly managed window is simply included in the layout animation, so its frame travels from wherever it appeared to its tile; a closed window just disappears and the survivors animate to their new frames. Whatever fade or zoom is seen on open or close would come from macOS or the app; rift's sources do not address it.
- The roadmap lists "more animations (ie window minimize/maximize, workspace switch, etc)" struck through ([`RI/roadmap.md#L13`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/roadmap.md#L13)). The README claims only "performant animations" ([`RI/README.md#L42`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/README.md#L42)).

### Workspace change

- Not animated. A layout pass belonging to a workspace switch is applied through the instant path, and an animated presentation is downgraded to instant while a switch is active ([`animation.rs#L1066-L1077`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/actor/reactor/animation.rs#L1066-L1077); [`RI/src/actor/reactor/managers.rs#L342-L346`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/actor/reactor/managers.rs#L342-L346)). Windows not on the active workspace are never animated; their frames are set directly (`animation.rs#L1159-L1176`).
- Inactive-workspace windows are parked just off a bottom corner of the screen with 1 px left showing ([`RI/src/model/hidden_window_placement.rs#L81-L94`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/model/hidden_window_placement.rs#L81-L94)).
- Not examined: the README mentions switching workspaces "with trackpad gestures (just like native macOS)" (`README.md#L43`). Whether that gesture shows motion while the fingers are down was not traced.

### Several changes at once, and interruption

A new layout animation replaces the running one. Windows in both continue from their last displayed frame toward the new target; windows only in the old one are carried over toward their old target; and the shared clock restarts at zero for all of them ([`animation.rs#L1503-L1531`](https://github.com/acsandmann/rift/blob/660f0ef0c5039b84f5d00ea9c38b67f79f88c77f/src/actor/reactor/animation.rs#L1503-L1531); test `replacement_uses_last_animated_frame_for_continuing_windows` at `#L2759`). No jump, but no carried velocity either.

## What this suggests for the desktop

The site's two motions map most directly onto Hyprland (pop-in, crossfade or slide) and niri (whole-workspace slide). rift contributes the plainest model: one shared clock for every window.

**Windows opening, closing and moving inside a workspace**

- **Open:** scale up about the window's centre while fading 0 to 1. Candidate start scale: 0.87 (Hyprland's `popin 87%`), the subtler choice; 0.5 (niri) is more dramatic. Both fade in over the same span.
- **Close:** scale down about the centre while fading to 0. Candidate end scale: 0.87 (Hyprland) or 0.8 (niri).
- **Neighbours:** move and resize to their new tiles at the same time as the open or close. All three managers do this; none staggers.
- **Close is shorter than open, and neighbours take longest.** Candidate durations:
  - open about 150-250 ms (niri 150 ms; Hyprland's spring first reaches its target at about 250 ms)
  - close about 150 ms (niri 150 ms; Hyprland 149 ms geometry, 146 ms fade)
  - neighbours about 300-350 ms (niri about 326 ms; rift 300 ms)
- **Curves:** all decelerating; nothing eases in except rift's symmetric default.
  - open: `1 - 2^(-10x)` (niri's ease-out-expo), which CSS `cubic-bezier(0.16, 1, 0.3, 1)` matches to within 0.01 (*derived*); or Hyprland's `easeOutQuint`, `cubic-bezier(0.23, 1, 0.32, 1)`
  - close: ease-out-quad (niri) or linear (Hyprland)
  - neighbours: a critically damped spring, stiffness 800, mass 1 (niri); or Hyprland's slightly underdamped `easy` spring (mass 1, stiffness 238.1191, damping 24.2128) for about 2% overshoot. If a bezier is preferred, Hyprland's built-in `default`, `cubic-bezier(0, 0.75, 0.15, 1)`, is its own non-spring stand-in.
- **If the site cannot interpolate size smoothly** (reflowing content), rift's fallback is precedent: ease the position and switch the size once at the halfway point.

**Workspace change**

- **Slide the whole workspace as one unit**, outgoing and incoming together with no gap in time; windows never travel singly (Hyprland slide, niri).
- **Direction follows index:** a higher-numbered workspace enters from the right and pushes the old one off the left (Hyprland `slide`), or enters from below (niri, Hyprland `slidevert`). Pick the axis that matches how the site lays its workspaces out, and reverse it for a lower number.
- **Distance:** one full screen plus the gap between workspaces. Hyprland's `slidefade 20%` (move a fifth of the screen while crossfading) is the lighter alternative.
- **Duration and curve:** about 300 ms on a critically damped spring, stiffness 1000 (niri). Hyprland's shipped config instead crossfades with no movement: in 121 ms, out 194 ms, `cubic-bezier(0.5, 0.5, 0.75, 1)`.

**Budget and interruption**

- Every default here finishes within about 350 ms (Hyprland's spring is settled by about 500 ms), so a step fits in one second with room to spare, even if a workspace slide and window motion run back to back.
- When a new step arrives mid-animation, retarget from the current on-screen position; never jump to the end state first. Restarting the clock with zero velocity is what niri and rift do; Hyprland's springs also keep the velocity.
