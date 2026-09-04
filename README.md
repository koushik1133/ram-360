# NAVIGO Web clone · RAMKY ONE GENEXT (Habsiguda, Hyderabad)

A browser-based, no-hardware 3D real-estate sales OS, built around the real **Ramky One Genext** site (Genpact Road, Habsiguda · 5.7 acres · 4 towers · B+G+14 · 596 units · RERA P02200004880). One link answers every buyer question:
master plan → location → amenities → tower/floor/flat inventory → floor plan → virtual tour → schedule a visit.

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind · React Three Fiber + drei + postprocessing · Mapbox GL + Turf · Photo Sphere Viewer · Zustand · Supabase Realtime · Framer Motion · react-virtuoso · react-zoom-pan-pinch**

## Run it

```bash
npm install
cp .env.example .env.local   # add NEXT_PUBLIC_MAPBOX_TOKEN (map) and Supabase keys (optional)
npm run dev                  # http://localhost:3000
```

Without any env vars the whole app runs on `data/project.json`: the Ramky One Genext block on real satellite imagery with real OSM neighbours, token-free 3D map + routing, demo inventory, local 8K panoramas. Add `?instant=1` to the URL to skip camera animations (QA), and drive state from the console via `window.__navigo.getState()`. No Mapbox token is required; adding one upgrades map tiles and routing to Mapbox.

## Modules → reel timeline

| Reel | Module | Where |
| --- | --- | --- |
| 0:00 Master Plan 3D | Four stepped rectangular towers (Tower 1–4) placed from satellite imagery of the site, per-floor facade with UPVC windows, balcony slabs and MS railings, roof pergola + lift machine room; podium with lawns, tennis/basketball court, pool, clubhouse, driveway with cars, boundary wall, trees; **true-scale satellite ground** (ESRI World Imagery z14 + z17 + z19, ~0.3 m/px) so the actual construction site sits under the model; **real neighbourhood** extruded from OpenStreetMap footprints (Overpass with mirror fallbacks, cached); daylight sky + sun shadows; NE compass synced to camera; Bird Eye View / Elevation presets; Send Brochure; tower labels with live availability; glTF+Draco loader replaces the procedural block when `/models/towers.glb` exists (mesh names `T1_F12_01`) | `components/modules/MasterPlanCanvas.tsx` |
| 0:08 Location | **Token-free 3D map**: MapLibre with ESRI satellite, terrain (AWS Terrarium DEM + hillshade), **extruded real buildings** from OpenFreeMap vector tiles, road + place overlays, blue site pad, 500 m / 1 km / 2 km dashed green rings (Turf), category checkboxes, pink pins with pop, blue animated route + `1.2 km \| 8 mins` label (OSRM public router, straight-line fallback; Mapbox tiles + Directions used automatically if `NEXT_PUBLIC_MAPBOX_TOKEN` is set), POI card, distance chips | `components/modules/LocationMap.tsx`, `PoiCard.tsx` |
| 0:22 Amenities | Chip list + grid, fullscreen navigable 360 with floor hotspot arrows, thumbnail strip, auto-rotate, fullscreen | `components/modules/AmenityViewer.tsx` |
| 0:27 Inventory | Wing tabs P1–P4, `Floors G–32 · Units 128 · Status`, virtual-scroll floors, flat rows `Flat 01 · 3BHK · 1450 sqft · ● Available`, search + BHK + status filters, **floor cut-away**: every tower is sliced at the chosen floor, the floors above become a glass outline, and the opened floor shows a plan plate (corridor, lift lobbies, 10 units with live status colour, selected unit in blue) with clickable unit pills 01–10, OutlinePass on the chosen flat, N/E/W/S billboards, CLOSE FLOOR button | `components/modules/InventoryPanel.tsx`, `MasterPlanCanvas.tsx` |
| 0:33 Floor Plan | SVG plan from `/public/plans`, pan-zoom, blue hatch on your unit, furniture / dimension / Vastu layers, north arrow, specs (area, BHK, facing, Vastu, light, price), STEP INSIDE, PDF export | `components/modules/FloorPlanViewer.tsx`, `FlatSpecs.tsx` |
| 0:38 Virtual Tour | Photo Sphere Viewer with **true equirectangular 8K panoramas served from `/public/panos`** (CC0 Poly Haven interiors as stand-ins, see `public/panos/CREDITS.md`), room pills LIVING/DINING/BEDROOM/KITCHEN/BALCONY, room hotspots, top-right minimap with yaw-synced blue dot, loading bar, SCHEDULE VISIT / REQUEST QUOTE → lead form, engagement timer | `components/modules/VirtualTour.tsx`, `components/shell/LeadForm.tsx` |
| Shell | `#0A0A0A` theme, NAVIGO by Qubit top bar, live/demo inventory indicator, session clock, fullscreen, bottom pill nav (white active pill), left filter drawer, right detail panel, spring slide animations, haptics | `components/shell/*` |

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
- **3D**: export from Blender as glTF with one mesh per flat named `T1_F12_01`, then `npm run optimize:glb` → `public/models/towers.glb`. The app detects the file and replaces the procedural towers.
- **Panos**: 8K equirectangular JPGs in `public/panos/` (or CDN via `NEXT_PUBLIC_ASSET_CDN`), referenced in `project.json`.
- **Plans**: SVG with `polygon.flat#flat-01…04`, groups `#furniture #dimensions #vastu` (see `scripts/gen-plans.mjs`).
- **Copy / POIs**: edit `scripts/gen-data.mjs`.

## Deploy
- **Vercel**: import repo, set env vars, deploy. `vercel.json` adds 1-year immutable caching for models/panos/plans.
- **AWS**: `next build` + S3/CloudFront for `/public`, Lambda@Edge or Amplify for the app. Point `NEXT_PUBLIC_ASSET_CDN` at CloudFront.
- Analytics: `lib/analytics.ts` calls `window.mixpanel.track` when present; add the Mixpanel snippet to `app/layout.tsx`.
