# ORION 360 · RAMKY ONE ORION BUYER DIGITAL TWIN

A browser-based post-purchase client portal for **Ramky One Orion** (Pocharam–Uppal · 8.8 acres · 6 towers · G+16 · 1,144 units · RERA P02200005803). One link takes a buyer through:
master plan → construction layers → tower → floor → apartment → room plan/3D twin → 360° room → interior estimate.

Stack: **Next.js 16 · React 19 · TypeScript · Tailwind · React Three Fiber + drei + postprocessing · MapLibre + Turf · Photo Sphere Viewer · Zustand · Supabase Realtime · Framer Motion**

## Run it

```bash
npm install
cp .env.example .env.local   # add NEXT_PUBLIC_MAPBOX_TOKEN (map) and Supabase keys (optional)
npm run dev                  # http://localhost:3000 (or choose another free port)
```

Without env vars the app runs entirely from `data/project.json`. It includes demo inventory, six procedural towers, interactive construction states, four Orion apartment-size plans, a procedural 3D apartment twin, a local panorama placeholder and a live cost model. Add `?instant=1` to skip camera animations for QA. Builder CAD/BIM and 8K panoramas are still required for an exact production twin.

## Modules → reel timeline

| Reel | Module | Where |
| --- | --- | --- |
| Master Plan 3D | Six Orion tower clusters, podium/landscape, satellite context, compass, orbit/zoom, bird-eye/elevation presets and click-to-drill down. Construction controls expose foundation, pillars, slabs, facade and complete states. A production GLB can replace the procedural model. | `components/modules/MasterPlanCanvas.tsx` |
| 0:08 Location | **Token-free 3D map**: MapLibre with ESRI satellite, terrain (AWS Terrarium DEM + hillshade), **extruded real buildings** from OpenFreeMap vector tiles, road + place overlays, blue site pad, 500 m / 1 km / 2 km dashed green rings (Turf), category checkboxes, pink pins with pop, blue animated route + `1.2 km \| 8 mins` label (OSRM public router, straight-line fallback; Mapbox tiles + Directions used automatically if `NEXT_PUBLIC_MAPBOX_TOKEN` is set), POI card, distance chips | `components/modules/LocationMap.tsx`, `PoiCard.tsx` |
| 0:22 Amenities | Chip list + grid, fullscreen navigable 360 with floor hotspot arrows, thumbnail strip, auto-rotate, fullscreen | `components/modules/AmenityViewer.tsx` |
| 0:27 Inventory | Wing tabs P1–P4, `Floors G–32 · Units 128 · Status`, virtual-scroll floors, flat rows `Flat 01 · 3BHK · 1450 sqft · ● Available`, search + BHK + status filters, **floor cut-away**: every tower is sliced at the chosen floor, the floors above become a glass outline, and the opened floor shows a plan plate (corridor, lift lobbies, 10 units with live status colour, selected unit in blue) with clickable unit pills 01–10, OutlinePass on the chosen flat, N/E/W/S billboards, CLOSE FLOOR button | `components/modules/InventoryPanel.tsx`, `MasterPlanCanvas.tsx` |
| Apartment Twin | Room Select / Floor Plan / 3D Twin modes. Room polygons and 3D room slabs are clickable and open the selected 360° room. Plans cover 1265, 1415, 1585 and 1825 SFT. | `FloorPlanViewer.tsx`, `ApartmentTwin3D.tsx` |
| Virtual Tour | Photo Sphere Viewer with drag, wheel zoom, room pills, navigation hotspots, minimap, fullscreen and ESC exit. The included SVG is a functional placeholder; replace it with tiled 8K equirectangular images. | `VirtualTour.tsx`, `usePhotoSphere.ts` |
| Interior Cost | Essential / Signature / Luxury material tiers, formula-based base rate, transparent cost breakdown and room allocations. | `CostEngine.tsx`, `lib/pricing.ts` |

## Data

`data/project.json` is the single mock source (regenerate with `node scripts/gen-data.mjs`; site facts from ramkyonegenext.com, tower positions measured from satellite tiles). Shape:

```jsonc
{ "project": { "name": "ELARA", "center": [78.34, 17.44], "floorHeight": 3 },
  "towers": [{ "id": "A", "floors": 32, "flatsPerFloor": 4, "position": [-14,0,0] }],
  "flats":  [{ "id": "A-1201", "tower": "A", "floor": 12, "flatNo": "01", "bhk": 3, "sqft": 1450, "facing": "East", "status": "available", "price": "₹1.20 Cr", "planSvg": "/plans/type-3bhk.svg", "panos": { "living": "...", "bedroom": "..." } }],
  "pois":   [{ "id": "edu1", "name": "…", "category": "Schools", "lat": 17.44, "lng": 78.34, "image": "…", "distance": 0.8, "travelMins": 6 }],
  "amenities": [{ "id": "gym", "name": "Gym", "pano": "…", "thumb": "…" }] }
```

### Realtime inventory (Supabase)
1. Run `supabase/schema.sql` in the SQL editor.
2. `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-supabase.mjs`
3. Add the URL + anon key to `.env.local`. The top bar switches from **Demo inventory** to **Live inventory**.
4. `update flats set status='sold' where id='A-1201'` → the dot turns red in every open browser instantly.

Leads POST to `/api/lead`, are stored in `leads`, and forwarded to `LEAD_WEBHOOK_URL` (CRM) if set. Each lead carries per-module engagement seconds.

## Swapping in real assets
- **3D**: export from Blender as glTF with one mesh per flat named `D_F15_02`, then `npm run optimize:glb` → `public/models/towers.glb`. The app detects the file and replaces the procedural towers.
- **Panos**: 8K equirectangular JPGs in `public/panos/` (or CDN via `NEXT_PUBLIC_ASSET_CDN`), referenced in `project.json`.
- **Plans**: SVG with `polygon.flat#flat-01…04`, groups `#furniture #dimensions #vastu` (see `scripts/gen-plans.mjs`).
- **Copy / POIs**: edit `scripts/gen-data.mjs`.

## Deploy
- **Vercel**: import repo, set env vars, deploy. `vercel.json` adds 1-year immutable caching for models/panos/plans.
- **AWS**: `next build` + S3/CloudFront for `/public`, Lambda@Edge or Amplify for the app. Point `NEXT_PUBLIC_ASSET_CDN` at CloudFront.
- Analytics: `lib/analytics.ts` calls `window.mixpanel.track` when present; add the Mixpanel snippet to `app/layout.tsx`.
