# EZ-Tree Lab — initial local experiment

Fork: https://github.com/ketchupkungen/ez-tree  
Upstream: https://github.com/dgreenheck/ez-tree  
Base commit: `dcf309bd86bd521083d9c70f01f2de45fdc7c457`  
Local branch: `experiment/organism-modes`

## Run

Double-click **Start-Lab.cmd**, then visit http://127.0.0.1:5178. The launcher starts a hidden local preview server and opens your default browser. Node.js and npm must be installed. Dependencies and the initial production build are already present in this checkout; the launcher installs/builds when missing.

The server binds to loopback. Stop it with `powershell -NoProfile -File scripts/Stop-Lab.ps1` from this folder. The launcher reuses an existing Lab server and does not terminate other apps.

For development, stop the preview server, then run `npm run dev`. Changes reload automatically. To update the production preview after editing source, run `npm run build`, then refresh the browser. `npm run preview` serves the built app in a foreground terminal.

## Modes

| Mode | Initial implementation |
| --- | --- |
| Tree / bush | Original EZ-Tree generator, 15 tree/bush presets, seed, height, crown width, leaf size/density and two tints. |
| Plant | Meadow bloom, Fern and Broadleaf presets; seeded curved stems, surface-meshed leaves and optional flowers. Adjust height, stems, leaves, size, petals and bend. |
| Creature | Mossback, Dune crawler and Little grazer presets; seeded symmetric creatures with body, head, jointed legs, tail, eyes, ears and back horns. Adjust proportions and limb count. |

Drag to orbit, scroll to zoom, right-drag to pan. Fit view reframes the current model. Auto rotate and wireframe aid inspection. Changes regenerate immediately. Each mode retains its parameters while switching; the current specimen persists across reloads in browser local storage.

Save/load recipes as small versioned JSON files to reproduce models. GLB export includes only the specimen, with materials and local tree textures embedded. PNG saves the 3D viewport. The scene floor, grid and UI are excluded from GLB. Exports are static meshes, without wind, skeletons, animation, UV authoring tools or a unified creature skin. Creature parts overlap and are separate meshes, suitable for early shape exploration. Plant presets are stylized approximations rather than botanical simulations.

The original full tree editor is available at http://127.0.0.1:5178/original.html, including its existing detailed tree controls. Lab recipes use their own format and are not interchangeable with original-editor JSON files. Upstream tree library source is unchanged. The fork retains upstream's MIT license, author credit and texture licenses. Upstream analytics were removed from the local editor.

## Build and checks

```powershell
npm ci
npm run build
npm test
npm run test:browser
```

Browser checks use installed Google Chrome via Playwright's `chrome` channel. Install Chrome or change the channel in `playwright.config.js` for another environment.

Verified on Windows with Node 24.15.0: library/app production builds, five generator/recipe tests, and two browser scenarios covering all 21 presets, parameter maxima, seed changes, JSON roundtrip/rejection, GLB header/scene/mesh checks, PNG signature, reload persistence, mobile layout and original editor startup. Desktop screenshots of all three modes were visually inspected. This does not establish Blender/Unreal import compatibility; exports were checked as GLB containers with mesh data in the browser workflow.

The upstream development toolchain still reports 14 npm audit findings (8 moderate, 6 high) after compatible fixes. These are development dependencies; no audit-clean claim is made. A separate toolchain upgrade is sensible before hosting publicly. Known build warnings: the upstream declaration generator bundles an older TypeScript engine, and the shared Three.js chunk exceeds Vite's size advisory. Both builds complete successfully.

## Future contributions

`origin` is your fork; `upstream` is Dan Greenheck's repository. Experimental changes are kept locally on `experiment/organism-modes`; no pull request or npm package has been published. Keep future upstream bug fixes on focused branches based on `upstream/main`, separate from the Lab modes. The new generators are isolated under `src/app/lab/` to make that easier.

The built web app is in `dist/`. This is a local browser application, not a Windows executable. Open it through the server, since module loading and asset URLs require HTTP.
