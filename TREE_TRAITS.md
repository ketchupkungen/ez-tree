# Roots, chopping and breakable tree exports

The original EZ-Tree panel now has **Roots** and **Chop & Breakage** sections in Tree mode. These traits are off by default. Existing preset geometry is unchanged when off.

## Roots

Enable **Root System**. Main Roots, Root Reach, Root Width and Root Forks define a seeded root collar and tapered lateral roots. The roots use the current bark material. Three geometry levels support the existing hero and forest LODs; forest copies share one root geometry per level rather than allocating it per tree.

Choose **Root Ground** Flat / Slope / Rocky, then adjust **Ground Relief** and press **Inspect Roots**. The tree's local ground preview replaces flat grass/rock dressing so contacts can be inspected. This is a controlled height-field fixture, not imported Rune Map terrain.

The contact equation matches the game behavior inspected in Rune MAP003:

```
vertex.y += weight * (height(vertex.world.xz) - height(trunk.world.xz))
```

The root collar is pinned while outer root vertices receive increasing contact weight. In the game this is a material/world-position-offset operation using `RootField015` and `RootDomain015`. The generator evaluates it on the CPU against a supplied height sampler. It can wrap over sampled ground and rocks represented in that height field. It does not model root growth, soil forces, excavation support, caves or arbitrary overhang surfaces.

**Bake Ground off** is the default: GLB exports neutral rest roots and contact weights in `TEXCOORD_1.y`, ready for the game's own field. **Bake Ground on** exports the deformed preview root geometry. Avoid applying the contact offset a second time to a baked mesh. The `bakedTerrain` flag is stored in root extras and the game descriptor.

The visible collar/lateral roots are a lighter browser implementation of the same authored-root/contact approach. They are overlapping capped meshes around a collar, not the game's offline Blender voxel-unioned/stitched topology. The game authoring pipeline and its original assets have not been replaced.

## Chopping

Enable **Breakable**, set **Cut Position** (fraction along the main stem), **Fall Direction**, **Gravity** and **Snap Branches**, then press **Try Chopping**. The preview shows brief axe strikes, releases the upper tree and runs a deterministic gravity-driven rod/capsule simulation. The stump and roots stay anchored. Branches that contact the sampled ground are demolished as whole subtrees. **Reset Tree** restores the standing specimen; **Inspect Roots** can inspect the remaining base after a chop.

This is a physics proxy and baked demonstration. It is not a general rigid-body engine, Chaos simulation, structural fracture solver or a game damage system. Its collisions sample tapered woody segments against the height field, not leaf cards or arbitrary scene obstacles. Branch debris, resources, health, sound and gameplay reactions are left to the host.

## Model and data exports

With Breakable off, **Export GLB (Full Detail)** exports the intact tree, plus optional roots. With Breakable on it exports:

- `Stump` and `FallingTree` groups, standing at their original positions.
- Individual capped stem sections and branch parts, with attached leaves.
- Wood-colored growth-ring cross sections on cut boundaries.
- Named attachment hierarchy and extras with branch IDs and strength proxies.
- A `TryChop` clip containing the falling body transform and branch-demolition scales.

Stem sections supply snap locations above the base as well as at the selected cut. They are pre-authored boundaries, not arbitrary runtime knife-plane slicing. The selected cut inserts an additional exact section. A mid-stem cut keeps branches attached below the cut on the rooted portion.

**Export Tree Game Data** writes the matching `tree-breakable.json`: source seed, cut pivot/radius, part IDs/parents, tree-space centerlines and radii, approximate mass, root settings/profiles, and demo impact records. Consecutive centerline samples define collision capsules. Mass and strength values are geometric proxies, not measured species material properties. Units default to metres per generator unit; apply the same scale and coordinate conversion to JSON as to GLB.

A `branchImpact` record includes a part ID, time, location, speed proxy and `demolish-subtree` action. Descendants can be found from the parent graph. Process already-broken descendants idempotently; your game chooses what happens to detached material. In GLB, demolished subtrees shrink to a tiny scale because standard glTF has no animated visibility channel.

**Export LODs (ZIP)** remains an intact-tree LOD export and includes root LODs when enabled. Keep intact instanced/LOD trees for normal forest rendering; swap only interacted trees to the more expensive part hierarchy. Breakable preview/export supports up to 1,800 source branches.

## Rune Map 003 handoff

The build's `SOURCE_REVISION.txt` points to `H:/CodexSandboxes/rune-map-source`, commit `36cf280ce61fac91709bfdedbf13f6b155a6efa2`. The inspected wrapping material, root authoring and scenery source were unchanged at inspection; file hashes are in `integration/RuneMap003/source-reference.json`. The source checkout contains ongoing work for another build, which was left untouched.

`integration/RuneMap003/RootContact.ush` is a reference shader adapter. Bind the existing `RootField015`/`RootDomain015` texture/domain. Read contact weight from imported RootSystem UV channel 1 Y, or copy it into the game's native UV7 Y. Preserve UV1 rather than overwriting it with generated lightmap UVs. Keep the part hierarchy instead of combining all imported nodes into a single mesh. Feed the per-instance world origin, not the shared ISM/HISM actor origin. Apply the returned Z-up world offset after the desired wind transform. Root weights are dimensionless; native world positions and the field use Unreal centimetres.

The adapter has not been compiled or installed in Unreal. The generic root UV channel differs from the native tree wind/UV packing, so do not apply the complete native spruce wind material without adapting its other channels too.

The existing `AFWMapScenery002::StrikeResource026` final-harvest path removes an instance and returns its transform/ID/yield. That is a possible later swap point: spawn the breakable actor from the GLB parts, create parent constraints from the descriptor, detach the selected trunk joint, and let server-authoritative physics decide impacts and debris. Use either runtime physics or the reference clip to drive the body, rather than both simultaneously. Runtime terrain sampling, collisions, replication and debris are still game integration work.

## Verification

Both library and app builds pass. Sixteen Node tests and five browser scenarios pass, including:

- Geometry hashes for Ash Medium, Pine Medium, Oak Large and Bush 1 match pre-trait commit `41a939c` byte-for-byte.
- Complete acyclic branch/leaf ownership; deterministic graphs and roots; decreasing root LOD budgets.
- Weighted terrain wrapping, repeat conformation without accumulating deformation, valid parameters/normals.
- Capped base/middle cut partitions with exactly one owner for every leaf and valid parent links.
- Gravity settling, fixed stump, branch impact events, and branch demolition disabled when requested.
- Browser root terrain preview, base and middle chopping, reset, mode switching and exports.
- The example breakable GLB passes Khronos validation with zero errors and zero warnings.

All previous creature rigs/animated exports, original panel, plant modes and forest controls also pass. No native game build, import, network or Chaos validation is claimed. Known build warnings remain the existing TypeScript declaration-engine version advisory and large shared browser bundle.
