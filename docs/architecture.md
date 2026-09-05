# Orion 360 architecture and research notes

## Product boundary

Orion 360 is a post-purchase buyer portal, not a survey-grade BIM viewer and not a substitute for approved sale drawings. The product owns the navigation state, flat metadata, room links, estimates and documents. The builder owns authoritative CAD/BIM, unit inventory, construction status, panorama renders and price books.

Primary flow: master plan → construction phase → tower → floor → flat → apartment plan/3D twin → room panorama → interior estimate.

## What the references establish

- Ramky Estates confirms Ramky One Orion as 8.8 acres, six towers, G+16, 1,144 apartments and 1,265–1,825 SFT: https://www.ramkyestates.com/projects/ramky-one-orion/
- Photo Sphere Viewer supports linked panorama nodes and markers; its tiled adapter progressively loads very large equirectangular panoramas: https://photo-sphere-viewer.js.org/plugins/virtual-tour and https://photo-sphere-viewer.js.org/guide/adapters/equirectangular-tiles.html
- Three.js GLTFLoader supports Draco geometry and KTX2 texture loaders: https://threejs.org/docs/pages/GLTFLoader.html
- three-mesh-bvh accelerates raycasting/spatial queries for large meshes: https://github.com/gkjohnson/three-mesh-bvh
- Shapespark documents a browser/WebGL architectural walkthrough pipeline and import paths from Revit, SketchUp, 3ds Max, FBX, COLLADA and OBJ: https://www.shapespark.com/
- Vinode publicly describes a different architecture: scenes rendered remotely and streamed as video. That trades server/GPU cost and interaction latency for consistent low-end-device visuals: https://vinode.io/real-estate-visualization
- Navigo's public material evidences master-plan exploration, unit search, live inventory and panorama/cubemap tours, but does not publicly establish its private engine or data contracts: https://navigo-india.com/
- Realsee documents a Three.js/WebGL viewer with lazy image tiles and explicit Panorama/Floorplan/Modeling transitions: https://developer.realsee.ai/docs/five-sdk
- Matterport's Showcase is a hosted WebGL iframe controlled through an SDK; it is better suited to captured existing spaces than unbuilt configurable projects: https://matterport.github.io/showcase-sdk/sdk_home.html
- The supplied `Apartment-Viewer.html` is a procedural R3F building configurator, not a room panorama. Its useful concepts are phase-based visibility, floor filtering, mesh selection and orbit controls; its bundled single-file runtime should not be reused.
- The referenced CGTrader building is an exterior shell with no interior walls, 16,672 polygons, 18,998 vertices, diffuse textures and uniquely named objects. Its native material setup is 3ds Max-specific and the page warns that exchange exports may not match the preview: https://www.cgtrader.com/free-3d-models/exterior/house/apartment-building-01-fc9ca7eb-f970-45e1-927c-1fe1b47c337a
- TurboSquid's catalog exposes the useful procurement filters: glTF/FBX/OBJ/USD, low-poly, PBR, real-time certification and explicit license classes. Those are selection criteria, not evidence that a marketplace model is web-ready: https://www.turbosquid.com/Search/3D-Models/apartment
- Free3D similarly mixes Blender/FBX/OBJ/MAX assets and labels low-poly models, but visible catalog polygon counts vary widely and every individual license still requires review: https://free3d.com/3d-models/building
- 3DBrute is primarily a 3ds Max/FBX/OBJ and V-Ray/Corona asset catalog. Many entries are complete render scenes rather than optimized real-time assets, so they would require cleanup, retopology, texture conversion and license verification before use: https://3dbrute.com/category/architecture/building/page/2/

Claims about a competitor's private database, exact rendering engine or source-code architecture are not verifiable from a reel or public marketing page. Similar UI does not prove similar implementation.

No referenced marketplace file was downloaded or copied into this project. The CGTrader example is also a poor functional fit because it has no interior walls and its displayed license includes a no-AI restriction. Marketplace previews can inform proportion, facade modularity and packaging checks, but Orion geometry must come from builder-approved CAD/BIM or be authored originally.

## Chosen runtime architecture

The current MVP uses Next.js 16 and React 19 for the portal, Zustand as the single interaction state, React Three Fiber/Three.js for local WebGL, Photo Sphere Viewer for room panoramas, and optional Supabase Realtime for inventory.

Only one WebGL renderer is mounted at a time. The master-plan canvas persists while moving between master-plan and tower modes, then unmounts before the floor plan, cost screen or panorama viewer opens so geometry, textures and contexts can be released.

The application state—not the Three.js scene—owns `tower`, `floor`, `flat`, `room`, `constructionPhase` and `finishTier`. 3D objects reflect that state. This keeps URLs, analytics, permissions, quotes and future APIs independent from mesh implementation.

The procedural scene is intentionally replaceable:

1. A placeholder tower model proves camera, picking, floor slicing and construction-state behavior.
2. A production `towers.glb` replaces it when present.
3. Stable mesh names (`D_F15_02`) bind BIM-derived geometry to domain records.
4. Apartment plans remain separate SVG assets, because room hit areas, dimensions and accessibility labels are easier to maintain there than inside a monolithic GLB.
5. Room tours are a graph of panorama nodes, not free movement through a heavy interior mesh.

## Production asset pipeline

1. Receive approved DWG/Revit/IFC, finish schedule, unit matrix and northing from the builder.
2. Clean and classify in Revit/Blender: site, landscape, tower shell, floor, flat and room.
3. Preserve stable IDs in object names and export glTF/GLB.
4. Generate near/mid/far LODs. Instance repeated windows, rails, pillars and trees.
5. Bake static lighting/AO where possible. Encode textures as KTX2 and geometry as Meshopt or Draco after measuring decode cost.
6. Target under 100 visible draw calls on mobile, cap DPR, and lazy-load only the selected tower/interior.
7. Convert approved unit plans to sanitized SVG with `data-room` polygons.
8. Render each panorama as 2:1 equirectangular output. For 8K+ delivery, provide a low-resolution base and ≤1024px tiles through the Photo Sphere Viewer tiled adapter.
9. Publish immutable versioned assets through object storage/CDN. Keep metadata and inventory APIs separately cacheable.

## Scale and quality decision

Local WebGL is the right default for this portal because tower/floor/flat picking, construction layers and cost configuration need immediate deterministic interaction with modest server cost. Unreal Pixel Streaming or pre-rendered video streaming is justified only when photorealism cannot fit mobile GPU and bandwidth budgets; it introduces GPU-session infrastructure, concurrency limits, ongoing cost and input latency.

Exact photorealism cannot be inferred or generated accurately from brochure screenshots. Production sign-off requires source CAD/BIM, facade materials, landscaping drawings, approved interior design, view photography and 8K panoramas. Until then, every generated asset must be labelled as a schematic placeholder.

## Data ownership and routes

- `Project`: builder-owned identity, RERA, site coordinates and directions.
- `Tower/Floor/Flat`: builder/CRM-owned inventory and construction state.
- `Plan/Room/Panorama`: design-team-owned approved assets.
- `Material/Quote`: interior-vendor-owned rate cards and calculations.
- `Buyer`: authenticated owner of a booked flat; production access should use phone OTP plus booking/flat verification.

The current demo is one route with client-side state so it can run without credentials. Production should split authenticated buyer, builder-admin and asset-publishing workflows, validate every write server-side and store versioned quote inputs with each generated quote.

## Acceptance budgets

- First meaningful shell: under 2 seconds on a mid-tier 4G device.
- Initial 3D payload: under 5 MB compressed; selected-tower detail loaded later.
- Stable interaction: 30 FPS minimum mobile, 60 FPS target desktop.
- Mobile scene budget: approximately 150 draw calls, 300k visible triangles and 128 MB active GPU assets.
- Desktop scene budget: approximately 300 draw calls, 1M visible triangles and 256 MB active GPU assets.
- Panorama base preview: under 500 KB; high-resolution tiles on demand.
- No click path may depend on unavailable external APIs; maps and realtime inventory degrade to local data.
- Builder assets must be versioned, attributable and replaceable without changing application code.

## Content and legal controls

Publicly visible plans, YouTube frames, Brain Trust panoramas and marketplace previews are references, not reusable production assets. Ramky's published terms describe plans and dimensions as indicative and prohibit unauthorized derivative use. Every production asset therefore needs a recorded owner, license/source, approval version and disclaimer. The portal must explicitly distinguish an artist impression, interactive 3D model, 360 panorama, linear video and live construction camera.
