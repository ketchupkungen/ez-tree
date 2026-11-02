# EZ-Tree Lab — source editor with generator modes

Fork: https://github.com/ketchupkungen/ez-tree  
Upstream: https://github.com/dgreenheck/ez-tree  
Base commit: `dcf309bd86bd521083d9c70f01f2de45fdc7c457`  
Branch: `experiment/organism-modes`

## Run

Double-click **Start-Lab.cmd**, then visit http://127.0.0.1:5178. The launcher starts a hidden local production preview server and opens your browser. Node.js/npm are required. Dependencies and the built app are already present in this checkout. The launcher installs/builds only when missing.

The `/` and `/original.html` URLs now open the same editor: the original EZ-Tree scene, glass panel, controls, tabs and environment, extended with a three-position **Generator mode** slider above the Tree/Export tabs. The earlier custom studio layout has been removed.

Stop the server with `powershell -NoProfile -File scripts/Stop-Lab.ps1`. For development, stop preview and run `npm run dev`. Rebuild with `npm run build` and refresh to update production preview. The server binds to `127.0.0.1`.

## Modes

- **Tree:** original preset list, seed, bark, branches, leaves, trellis, camera, environment, stats, LOD preview and LOD ZIP export. Bushes remain in the original preset dropdown.
- **Plant:** Meadow bloom, Fern and Broadleaf; original-style sliders for stems, leaves, petals, size and bend, plus colors and Fit View.
- **Creature:** Mossback, Dune crawler and Little grazer; original-style sliders for body, head, legs, tail and horns, plus colors and Fit View. Static overlapping meshes; no rigging or locomotion yet.

Drag the mode slider or click its Tree / Plant / Creature labels. Each mode keeps its settings and camera while switching during the session. Refresh starts at the original Ash Medium tree. Camera, environment and Export remain in the existing panel. LOD controls appear only in Tree mode.

Use the existing **Save Preset / Load Preset**, **Export GLB (Full Detail)** and **Export PNG** buttons. Tree JSON retains the upstream options format. Plant and creature JSON use versioned recipes. GLB exports the active specimen only; PNG exports it against transparency. The plant/creature models are scaled to fit the original scene. Tree presets from the former custom studio used a different recipe format; use original editor tree JSON here.

## Build and verification

```powershell
npm ci
npm run build
npm test
npm run test:browser
```

Browser tests use installed Google Chrome via Playwright's `chrome` channel. Change that channel for another environment.

Verified: app build, five generator/recipe tests and two browser scenarios. Browser checks cover mode slider and label switching, per-mode state, all plant/creature presets, original tree seed preservation, LOD preview, active-model GLB/PNG/JSON export, tree and organism preset reload, mobile panel visibility and both entry URLs. Desktop screenshots of the restored panel in Tree and Creature modes were inspected. Exports were checked as GLB containers with expected scene nodes, not imported into a game engine.

The upstream toolchain still has 14 npm audit findings (8 moderate, 6 high), all in development dependencies after compatible fixes. The shared Three.js bundle produces Vite's size advisory. No audit-clean or game-engine compatibility claim is made.

## Contributions

`origin` is your fork; `upstream` is the original repository. Experimental changes are saved on `experiment/organism-modes`. No upstream pull request or npm package is published. The upstream tree library remains unchanged. The mode controller is `src/app/modes.js`; new shape generators and recipes remain under `src/app/lab/`. MIT and texture licenses and author credits are retained. The upstream analytics snippet is excluded locally.
