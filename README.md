# Soda Flow Prototype

A mobile-first clickable meta-flow prototype for a Candy Crush Soda-style match-3 game. This is a flow prototype only: the board is decorative and the win/lose states are triggered through debug controls.

## Run locally

Open `index.html` directly in your browser.

This version keeps the low-friction static setup. The saga map uses a small in-project WebGL renderer in `home3d.js`, including real 3D hex islands and a cel-shaded cartoon soda-water surface, plus a distance-mist effect that softens islands as they recede toward the top of the screen. There is no npm install, bundler, CDN dependency, or Three.js download required. If a browser blocks WebGL, the home map now falls back to a styled CSS map instead of showing an unavailable message.

A simple local-server option is also available if your browser blocks local files:

```bash
cd soda-flow-prototype
python3 -m http.server 8000
```

Then open the local address shown in your terminal.

## Files

```text
soda-flow-prototype/
  index.html   # Phone frame, home screen, board screen, modal layer
  styles.css   # Soda/candy styling, fixed HUD/nav, board, modals
  home3d.js    # WebGL saga-map renderer: 3D islands, cartoon water, distance mist
  app.js       # Flow state, modal state, interactions, debug win/lose controls
  assets/      # Home HUD, main button, settings, and bottom navigation artwork
  README.md    # This file
```

## Implemented flow

```text
Home / 3D saga map -- Level button --> Pre-game popup -- Play --> Match-3 board

Match-3 board -- Debug: Win level --> Level complete popup -- Continue --> Home / 3D saga map
Match-3 board -- Debug: Lose level --> Out-of-moves dialog

Out-of-moves dialog -- Buy +10 moves --> Match-3 board with +10 moves toast
Out-of-moves dialog -- Exit / close --> Retry dialog

Retry dialog -- Retry --> Match-3 board
Retry dialog -- Exit / close --> Home / 3D saga map
```

## Home screen notes

- The top HUD, side widgets, smaller asset-backed green level button with subtle glow/sparkle animation, and asset-backed bottom nav stay fixed.
- The map layer behind them is rendered as a WebGL 3D scene.
- The purple soda sea is part of the same WebGL camera world as the islands.
- The water is a cel-shaded cartoon surface: a rolling sine swell plus layered simplex turbulence for the height field, hard-banded toon diffuse lighting, a fresnel rim, a hard specular glint, and white foam caps on the highest crests, over a purple soda palette (deep indigo troughs to lavender crests). Surface normals are derived from the height field so the cartoon shading reads even though the physical wave displacement is kept small so crests stay below the island bases. It shares the islands' camera, depth buffer, and lighting. The look is tunable via `waterSettings` in `home3d.js`. A simplified shader fallback plus a visual CSS fallback cover WebGL-blocked environments.
- Distance mist / blur: islands receding toward the top of the screen dissolve into a soft haze, so the saga feels like it disappears into the distance. This is three cooperating layers: (1) in-shader fog on the islands that fades them toward a mist colour using the same horizon model as the water (tunable via `mistColor` / `fogStart` / `fogStrength` in `home3d.js`); (2) a masked `backdrop-filter` blur band (`.map-mist` in `styles.css`) that softens the far 3D scene; and (3) per-label blur and fade in `updateLabelsProjection` so the distant level numbers recede too. All three are driven by screen distance, so they update live as you scroll.
- The islands are actual hexagonal prism meshes with depth, lit side faces, contact shadows, edge-connected tile placement, a subtle current-level glow/sparkle treatment, and a more zoomed-out tilted camera.
- Drag or mouse-wheel over the map area to move through the saga path.
- The map contains 80 levels, starts on Level 9, and shows completed/current/future progression.
- Future levels remain colorful but are subtly darkened and are not clickable.
- Only the large green `Level X` button opens the pre-level popup.
- Side widgets, settings, and non-Home bottom nav items show a `Coming soon` toast.

## Board / modal notes

- Boosters are interactive placeholders. Selected boosters carry into the board HUD area, but they have no gameplay effect.
- Booster selection resets each time the pre-level popup opens.
- The board has no match-3 logic. Use the tucked-away `Debug controls` panel to trigger win and loss flows.
- Winning the current level unlocks the next level on the saga map.

## Pre-level screen (redesigned)

The pre-level popup is mapped to the `previewPrelevel.png` reference: a mint/teal card with a teal header (`Level X`), a Goal card with a teal gummy-bear icon and "Find the bears.", a row of five booster selectors, and a green Play button.

- Boosters use the artwork in `assets/boosters/` (candy, Wrapped, colorbomb, fish) plus `assets/Orange.png`, each sitting on `booster_selector_background.svg`. The fish carries an unlimited (infinity) badge and a `1h 55m` timer; the others show a count badge.
- Selecting a booster shows a clear indication: the selector lifts, gains a glowing teal/white ring, and a check badge appears (`aria-pressed` is also toggled).
- The main green button across the whole flow (home `Level` button and every modal primary button) uses `assets/btn_default.svg` as its background. Close buttons use `assets/btn_close.svg`.
- Fonts: `Bubblegum Bliss` (`assets/fonts/BubblegumBliss-Regular.otf`) is used for titles, modal headings and button labels; `Nunito` Bold (`assets/fonts/Nunito-Bold.ttf`) is the body face used everywhere else. Both are loaded via `@font-face` in `styles.css`.

## Unified modals (win + out-of-moves)

All popups now share one visual language with the pre-level screen: a teal header, a green `btn_default.svg` button, a `btn_close.svg` close button, the Bubblegum Bliss / Nunito font pairing, and the same rounded card shell (`.modal-card.themed`).

- **Win / level complete** (mapped to `WinScreenReferance.png`): mint body, teal `Level X` header, the green gummy bear from `assets/bear.png`, the line "Amazing! You crushed this level!", and a green **Next** button.
- **Out of moves** (mapped to `outofmovesReference.png`): a warm-cream body variant (`.theme-cream`) with the same teal frame, a red heart and "Play on to keep your life!", a tan inset card holding the `assets/moves.png` +10 icon, and a green **Play on** button showing a gold-bar cost (`icn_goldbar_default.png` + 10).
- The retry popup is themed to match (mint) for consistency.

Body fill is the only thing that differs between modals (mint for pre-level/win, cream for out-of-moves), matching each reference; everything else is shared.

## Saga direction & submerged future levels

The saga climbs **bottom to top**: level 1 is nearest at the bottom, later levels recede up into the distance. Completed and current levels sit **above the water**; **upcoming levels are real, solid islands sunk below the surface**, each one deeper than the last.

The submerged look is a proper underwater scene, not a flat overlay:

- Future islands keep their full hex geometry and are simply sunk; they are drawn as solid, opaque, fully-shaded 3D islands.
- The island shader applies an **underwater murk** keyed on depth below the waterline: fragments stay crisp right under the surface and get progressively **tinted toward the soda-depth purple and darkened** the deeper they sit. Because it is per-fragment, each island's base reads darker than its top, and far-future islands read darker than near ones.
- A **translucent water surface** is drawn over the submerged islands and the sea floor (foam crests stay nearer opaque), so you genuinely look *down through* the purple surface at the islands beneath.
- An opaque **deep-sea floor** sits far below so the translucent water always has solid soda-depths behind it (no sky bleed over the open sea).

Tuning lives in a few places in `home3d.js`: sink depth/spacing in `submersionFor()`; the murk tint/darkening curve and waterline in the island fragment shader (`u_waterY`, `u_deepColor`, the `sub` term); the surface translucency in the water fragment shader (`alpha`); and the floor depth/colour in `rebuildGeometry()`.

**Level numbers** show only on above-water levels (completed + current). Completed levels show just their number — the green checkmark is gone, since being above the water is now the "done" signal. Submerged levels show no number; the emerging islands themselves indicate what's ahead.


## Beveled islands & waffle texture

The islands are no longer sharp hex prisms. Each one is built as a **rounded-hex prism**: the six corners are softened into small arcs and the top edge has a **roundover bevel**, so they read soft and pillowy from the camera's top-down angle. Smooth normals on the corners and bevel let the light wrap around them, while the flat top face keeps its clean cartoon colour. The six-sided structure (and the shared-side skipping that links the trail) is preserved, with corner rounding kept moderate so neighbours still visibly touch.

The sides carry a **procedural waffle texture** — a warm golden "waffle-cone" tone with a flat light/dark square grid (no relief). It is generated in the fragment shader from per-vertex UVs that wrap around the wall, so it stays crisp at any zoom and needs no image asset. The waffle is keyed off the surface normal: vertical **walls** get the golden waffle, while the **top** stays the level's solid candy colour, and the rounded top edge fades smoothly between the two. Submerged islands get the waffle as well, with the underwater murk darkening and purpling it by depth.

Tuning knobs in `home3d.js`: corner roundness (`cornerSegs`, `t`) and the top roundover (`bevelH`, `insetScale`) in `addHexPrism`; the waffle tone, groove darkness and grid frequency via `u_waffleColor` / `u_waffleScale` and the pattern in the island fragment shader.


## Island style: two-tier "cake" (reference replica)

Each island is now a single rounded-hex "cake" matching the supplied references, replacing the old rim+candy two-prism build. Top to bottom: a flat **top face**, a rounded top edge, a smooth **upper tier wall**, a thin **divider band**, and a **lower sponge tier** carrying a procedural oval "sponge-cake" speckle (scattered light ovals, gated to the lower tier, generated in the shader from per-vertex UVs — no image asset).

Palette by status (colours sampled from the references):
- **Completed (active):** each level's own colour on the top tier (face + upper wall), a maroon-rose divider (#8a3b46), and an orange sponge base (#f5901c) with bright speckles.
- **Current:** a distinct bright highlight top (#8af6ff) over the same divider + orange sponge, plus its existing glow.
- **Sunken (future):** the uniform purple reference ramp — top #7401e2, upper #4a0294, near-black divider #0b0023, dark-purple sponge base #34076e — with the depth-murk darkening it further the deeper it sits, so it blends into the soda depths.

The sponge speckle lightens whatever the base tier colour is, so it reads as bright ovals on the orange and as faint ovals on the dark-purple sunken islands automatically.

Tuning in `home3d.js`: tier proportions (`yTierDiv` / `yDivBot` in `addHexPrism`), the per-status palette in `rebuildGeometry`, and the sponge density/strength via `u_spongeScale` and the mix amount in the island fragment shader. `u_tierBottom` (the UV height where the sponge tier begins) must match the tier split if the proportions change.

> Note: the reference single-island art is a *flat-top* hexagon; the map currently keeps the *pointy-top* orientation so the connected trail (shared-side skipping and spacing) stays intact. Everything else — the tiers, divider, sponge, palette and bevel — matches. Flipping to flat-top is a follow-up that also needs the trail spacing re-tuned.


## Island arrangement: connected clusters with gaps

The uniform level-1-to-90 snake is replaced by a clustered layout (in `makeLevels`). Levels are grouped into up to **7 connected clusters** of **variable size**; within a cluster the tiles use the exact hex side-adjacency step so they touch and fuse into a chain, and at each cluster boundary the path steps sideways far enough to break adjacency, leaving a visible gap before the next cluster begins.

Constraints honoured:
- **Even vertical rhythm** — every level advances by a constant z step; only the side-to-side position varies. Cluster separations are created sideways, not by changing the vertical spacing.
- **No camera panning** — every island centre is clamped to a measured safe horizontal envelope (|x| ≤ 1.15, well inside the ~1.65 limit where an island would start leaving the screen at its nearest point), so the z-only scrolling camera always keeps them on screen.
- **Moderate, tidy wander** — roughly 1.5× the old corridor width, with run-based (not strictly alternating) zig-zag inside each cluster that reflects off the envelope walls.

The layout is **deterministic** (seeded RNG), so it is identical on every load. The connection logic is now distance-aware: a shared wall is only skipped when two consecutive tiles actually touch, so cluster gaps render as fully-closed, separate islands. Tuning: cluster count/size and the sideways jump in `makeLevels`; the touch threshold (1.5) in `getSharedSidesByLevel`; the seed to reshuffle the whole arrangement.


## Difficulty octopuses (floating warnings)

Hard levels are flagged in `makeLevels` with a seeded, spread-out difficulty map (`level.diff` = `hard` / `super` / `ultra`, kept >=3 apart so markers never bunch; this seed yields ~11 hard, 7 super, 2 ultra across 90 levels). Each flagged level gets a floating **octopus** marker — a simple procedural mesh (squashed-sphere head, two oversized white googly eyes with dark pupils, six tapered tentacles) coloured **blue = hard, yellow = super-hard, red = ultra-hard**.

Behaviour:
- The octopus hovers on the island's centre axis (x,z) but at a fixed height **above the water surface**, so it stays bright even when it floats over a deep, murky submerged island (it is above the waterline, so the underwater darkening never touches it).
- It shows **only on submerged (upcoming) levels** — a warning of what's ahead. When a level surfaces (becomes current/completed) its octopus disappears.
- It floats with a gentle vertical **bob + slight sway** (tentacles static), driven by the existing time uniform and per-octopus phase, and respects reduced-motion (markers stay, animation stops).

Implementation: the octopuses reuse the island lighting shader via a new `u_model` transform (identity for everything else), with three pre-built coloured base meshes drawn per-instance. Tuning: difficulty rates/seed in `makeLevels`; colours, size, eye/tentacle proportions in `buildOctopusColor`; float height/bob/sway in `drawOctopi`.


## Visible waterline (depth on active islands + octopuses)

Previously the active/finished islands and the octopuses floated entirely above the water plane (y = -0.80), so nothing crossed the surface and they read as geometry sitting in mid-air. Both now **straddle** the water plane, which makes the existing translucent water + depth-murk render a clean waterline for free (dry above, water-tinted and dimming below) — the same treatment that already sells the submerged islands, which are left exactly as they were.

- **Active / finished islands**: lowered by `this.activeDrop` (0.28) so the base dips ~0.10 below the surface while ~0.68 of the cake stays dry. The murk just below the line is very light (shallow), so the cream/divider/sponge styling stays intact with a crisp waterline at its base. The level-number labels drop with them, and the old painted contact-shadow ellipse is gone — the waterline grounds the island now.
- **Octopuses**: lowered so the waterline sits at the **base of the head** — head (and googly eyes) fully above the surface, all tentacles submerged and dimming into the murk as they hang down. Bob softened to +/-0.07 so it laps gently around the head base instead of dunking.

Tuning: `this.activeDrop` (how deep the island base sits); octopus `baseY` (-0.55) and `bob` amplitude in `drawOctopi`. Note: the single nearest upcoming octopus sits over a level that is itself right at the surface, so its tentacles drape onto that just-rising island (murky, underwater) — shorten the octopus tentacles or nudge `baseY` up if that perch reads oddly on-device.


## Water realism pass + depth, contact, tap-to-dive, difficulty colour

**Smoother water.** The water fragment shader drops the hard cel bands for a smooth wrap-lit gradient, swaps the hard specular step for a soft broad glint, and keeps a gentle fresnel rim. It stays purple (depth/surface tint unchanged) but reads glassy rather than toon. Tuning lives in `waterSettings` (`shininess`, `fresnelPower`, `colorMultiplier`, `depthColor`/`surfaceColor`).

**Depth darkening.** Water darkens with distance into the scene toward `deepWater` (`deepFade` controls strength). This raw-WebGL setup has no depth-texture pass, so distance stands in for water depth — and because the map literally sinks into the distance, it reads as "deeper = darker." Combined with the dark seabed and stronger underwater murk showing through the translucent surface, near water stays bright and the far deep reads dense. The near "perfect" submerged islands are unaffected; only the far/deep ones dim through the darker water.

**Obvious submersion contact.** In the island shader the underwater `sub` term now tints/darkens a bit harder, plus a dark "wet" band sits right under the waterline. A subtle moving **caustic shimmer** plays over the shallow submerged parts (active-island bases + octopus tentacles) — the feasible stand-in for a blur/refraction pass, which would need post-processing this build doesn't have.

**Waterline foam.** A soft, low-detail foam line is drawn exactly where the water meets geometry (active island bases + octopuses), with a gentle ripple so it shimmers like the surface. Kept off the flat tops. Tuning: `u_foamBand` (line width) and the `u_foamColor` constant.

**Tap an octopus to dive.** Tapping a floating octopus (a quick tap, distinct from a scroll-drag) makes it sink under for ~2.8s — quick down, a held beat in the murk, then an ease back to the surface — via a per-octopus `diveStart` in `drawOctopi` and a screen-space hit test in `handleOctopusTap`. The waterline foam sweeps over it as it crosses the surface. Works under reduced-motion too (it's an explicit action).

**Difficulty colour.** Every active hard/super/ultra island now wears its octopus colour on the top tier (top face + upper wall) over the maroon divider + orange sponge. The pre-level modal picks up a matching theme (`theme-hard/super/ultra`): full octopus colour in the header, a lighter version of it as the card background, harmonised text/goal-card — the **Play button is intentionally left unchanged**. `difficultyOf(levelId)` is exposed on the map API so app.js can theme the modal.

Note: the single nearest upcoming octopus sits over a level whose top is right at the surface, so at rest (and mid-dive) its tentacles overlap that murky just-rising island — hidden well by the depth murk, but shorten the tentacles or nudge the octopus `baseY` if it reads oddly on-device.

## In-game board (playable swap prototype)

The board screen now uses the real `assets/inGame` artwork and is lightly interactive.

**Board.** An 8×8 grid (candy size unchanged) on a blue checker board, filled at random with the seven gems (`candy1`–`candy7`). The fill is "clean" — it never starts with an accidental 3-in-a-row — since there's no match-clearing yet. A fresh board is generated each time you start or retry a level.

**Swapping.** Tap a candy to select it (white glow), then tap an adjacent candy to swap them (match-3 style). Tapping the same candy again deselects; tapping a non-adjacent candy moves the selection. The two candies slide past each other (a FLIP-style animation that settles with no jump). There is no match detection or clearing yet — a swap just exchanges positions.

**Moves loop.** Moves start at 32 and tick down one per swap. At 0 the out-of-moves modal appears. Buying +10 (as before) adds to the live counter and drops you straight back onto the same board, so you can keep going — an endless buy loop. Tapping the modal's close button (declining) takes you back to the home map.

**Top HUD.** A purple pill with "Moves / 32", a "Goal" inset showing the soda-jar (`goal.png`) + 70, and the gummy bear (`sitting_bear.png`) on the right. Goal/bear are decorative for now (no win-on-goal logic).

**Bottom dock.** A purple tray holding the six in-game boosters (`lolly`, `crossLolly`, `hand`, `shuffle`, `baloon`, `supersonic`) — each on a green pedestal with a red "1" badge — plus the blue settings gear (`new_settings.svg`) at the right end. Boosters and the gear are inert for now, as requested.

**Debug.** The Win / Lose debug controls are unchanged (Lose routes through the same out-of-moves modal).

Tuning knobs: `INITIAL_MOVES` (32) and `MOVES_PURCHASE_AMOUNT` (10) in app.js; `BOARD_COLS`/`BOARD_ROWS` (8×8) and `CANDY_TYPES` (7); swap animation duration in `animateSwap` (170ms); board/HUD/dock colours in styles.css (`.board-grid`, `.candy-cell.cell-a/.cell-b`, `.hud-pill`, `.booster-tray`).

## In-game layout pass (centering + HUD/bear)

- **Board centered.** The board now sits at the exact vertical centre of the screen on any size (a centred `.board-stage`), with the booster tray following directly below it at the same gap as before. There's intentionally more empty space above the board than below the tray.
- **Top HUD.** Pushed down so the pill clears the phone status bar, and pinned to the top.
- **Bear.** Now sits in a fixed-size circular badge (a round version of the Moves/Goal insets), with the head + ears poking out the top and the body masked into the disc. This fixes the bear's footprint so it no longer crowds the status indicators.
- **Debug.** Bumped above the modal layer so the expanded panel overlays everything (still bottom-anchored).

## UI unification pass

- **Debug controls** now appear only on the board screen with no modal open, and are always collapsed on entry (they no longer show over the win/lose modals).
- **Lose modal** uses the same light-green background as the pre-level modal (was cream).
- **Primary buttons** — the glossy green `btn_default.svg` pill is recreated in pure CSS (dark-green ring, bright top edge, top sheen, drop shadow) and applied to every modal primary button and the home Level button, so they all match. The home button keeps its sparkle/glow.
- **Bottom navigation** is recreated in pure CSS (purple light-to-dark gradient, beveled dividers, rounded top corners, lighter raised Home tab) so it scales cleanly on any width. Nav icons unchanged.
- **Modal theming unified** — on hard/super/ultra levels, the pre-level, win, and lose modals all pick up that octopus colour; on normal levels all three use the green theme.

## UI polish pass

- **Level button** text is now centered (label wrapped and grid-centered; removed the asymmetric bottom padding that pushed it up).
- **Pre-level headings** ("Goal", "Select boosters") now render in Nunito instead of Bubblegum.
- **Lose modal moves-inset** dropped its cream styling and now follows the modal theme (light green normally; lighter blue/gold/red on hard/super/ultra). Fixed a specificity bug so the **goal card** also recolors correctly per theme.
- **Level button pulse** — added a subtle, slow pill-shaped pulse (a faint ring expanding outward over a soft green halo), layered with the existing glow and sparkle particles, and disabled under reduced-motion.

## Button & theme polish

- **Level button** text is now reliably centered (label wrapped + grid centering; removed the asymmetric bottom padding).
- **Pre-level "Goal" / "Select boosters"** headings are in Nunito (the body font); the goal text was already Nunito.
- **moves-inset** (lose modal) and **goal-card-modal** now follow the modal theme — a lighter shade of the modal colour, including hard/super/ultra (fixed a specificity bug where the themed override was being beaten by the base rule, and removed the leftover cream).
- **Level button pulse** — a faint pill-shaped ring riding on a soft glow halo, both expanding outward and fading, kept subtle and slow, layered with the existing glow and sparkle particles. Disabled under prefers-reduced-motion.
