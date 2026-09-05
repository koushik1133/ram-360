// Generates /data/project.json for RAMKY ONE ORION (Pocharam, Hyderabad).
// Official facts: 8.8 acres, 6 towers, G+16, 1,144 units, 3 BHK, 1,265–1,825 sqft.
import { writeFileSync } from 'node:fs';

// Approximate Pocharam site centre. Replace after the builder supplies a survey/GIS file.
const center = { lng: 78.6766, lat: 17.4399 };

// Silhouettes follow the printed Orion master layout: A/F linear bars, B–E crosses.
const towers = [
  { id: 'A', name: 'Tower A', floors: 16, flatsPerFloor: 10, units: 190, footprint: [22, 58], position: [-46, 50], rotation: 0, height: 52.7, tint: '#e7e3da', status: 'Finishing', shape: 'bar' },
  { id: 'B', name: 'Tower B', floors: 16, flatsPerFloor: 10, units: 190, footprint: [36, 36], position: [-46, 4], rotation: 0, height: 52.7, tint: '#e3ded4', status: 'Structure Ready', shape: 'cross' },
  { id: 'C', name: 'Tower C', floors: 16, flatsPerFloor: 10, units: 192, footprint: [36, 36], position: [-46, -50], rotation: 0, height: 52.7, tint: '#e8e4dc', status: 'In Progress', shape: 'cross' },
  { id: 'D', name: 'Tower D', floors: 16, flatsPerFloor: 10, units: 192, footprint: [36, 36], position: [8, -54], rotation: 0, height: 52.7, tint: '#e4dfd5', status: 'Structure Ready', shape: 'cross' },
  { id: 'E', name: 'Tower E', floors: 16, flatsPerFloor: 10, units: 190, footprint: [34, 34], position: [46, -42], rotation: 0, height: 52.7, tint: '#e8e4dc', status: 'In Progress', shape: 'cross' },
  { id: 'F', name: 'Tower F', floors: 16, flatsPerFloor: 10, units: 190, footprint: [22, 58], position: [36, 50], rotation: 0, height: 52.7, tint: '#e3ded4', status: 'Finishing', shape: 'bar' },
];

// Per-tower SFT mix from the printed rooftop colouring (10 units kept so inventory stays 1,144).
const mix = (sqfts) => sqfts.map((sqft) => ({ bhk: 3, sqft, base: sqft === 1825 ? 1.2 : sqft === 1585 ? 1.04 : sqft === 1415 ? 0.93 : 0.83 }));
const configsByTower = {
  A: mix([1585, 1415, 1265, 1415, 1585, 1825, 1825, 1415, 1825, 1825]),
  B: mix([1585, 1415, 1265, 1415, 1585, 1585, 1415, 1265, 1415, 1585]),
  C: mix([1585, 1415, 1265, 1415, 1585, 1585, 1415, 1265, 1415, 1585]),
  D: mix([1825, 1415, 1265, 1415, 1825, 1585, 1585, 1265, 1585, 1825]),
  E: mix([1585, 1415, 1265, 1415, 1585, 1585, 1415, 1265, 1415, 1585]),
  F: mix([1585, 1415, 1265, 1415, 1585, 1825, 1825, 1415, 1825, 1825]),
};
let seed = 11;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

const flats = [];
for (const t of towers) {
  for (let floor = 0; floor <= t.floors; floor++) {
    for (let i = 0; i < t.flatsPerFloor; i++) {
      const flatNo = String(i + 1).padStart(2, '0');
      const cfg = configsByTower[t.id][i];
      const r = rnd();
      const status = r < 0.58 ? 'available' : r < 0.86 ? 'sold' : 'reserved';
      const price = (cfg.base * (1 + floor * 0.006)).toFixed(2);
      const facing = i < 5 ? 'East' : 'West';
      flats.push({
        id: `${t.id}-${String(floor).padStart(2, '0')}${flatNo}`,
        tower: t.id, floor, flatNo, bhk: cfg.bhk, sqft: cfg.sqft, facing, status,
        price: `₹${price} Cr`, priceValue: Number(price),
        vastu: 'Compliant',
        naturalLight: facing === 'East' ? 'Morning sun' : 'Evening sun',
        planSvg: `/plans/orion-${cfg.sqft}.svg`,
        panos: { living: '/panos/living.jpg', dining: '/panos/dining.jpg', bedroom: '/panos/bedroom.jpg', kitchen: '/panos/kitchen.jpg', balcony: '/panos/balcony.jpg' },
      });
    }
  }
}

const pois = [
  { id: 'tr1', name: 'Ghatkesar Railway Station', category: 'Transport', lat: 17.4497, lng: 78.6853, image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80', rating: 4.2, description: 'Suburban rail connection serving the Pocharam–Ghatkesar corridor.' },
  { id: 'tr2', name: 'Uppal Metro Station', category: 'Transport', lat: 17.4018, lng: 78.5602, image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', rating: 4.3, description: 'Blue Line connection toward central Hyderabad and Raidurg.' },
  { id: 'edu1', name: 'Rockwoods International School', category: 'Schools', lat: 17.4432, lng: 78.6911, image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', rating: 4.3, description: 'School option in the wider Pocharam growth corridor.' },
  { id: 'edu2', name: 'Anurag University', category: 'Schools', lat: 17.4187, lng: 78.6555, image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80', rating: 4.4, description: 'University campus accessible from the Warangal Highway.' },
  { id: 'hos1', name: 'AIIMS Bibinagar', category: 'Hospitals', lat: 17.5324, lng: 78.7062, image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80', rating: 4.4, description: 'Major public medical institute north-east of the project corridor.' },
  { id: 'hos2', name: 'Prathima Hospitals, Kachiguda', category: 'Hospitals', lat: 17.3924, lng: 78.4965, image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80', rating: 4.2, description: 'Multi-speciality care reachable toward central Hyderabad.' },
  { id: 'mall1', name: 'DSL Virtue Mall', category: 'Malls', lat: 17.4033, lng: 78.5590, image: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&q=80', rating: 4.3, description: 'Retail, dining and cinema on the Uppal corridor.' },
  { id: 'road1', name: 'Infosys SEZ, Pocharam', category: 'Roads', lat: 17.4478, lng: 78.6905, image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80', rating: 4.4, description: 'Large employment campus within the Pocharam business district.' },
  { id: 'road2', name: 'Outer Ring Road · Ghatkesar Exit', category: 'Roads', lat: 17.4610, lng: 78.6993, image: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80', rating: 4.5, description: 'Regional connection to Hyderabad employment corridors and the airport.' },
  { id: 'road3', name: 'Warangal Highway · NH 163', category: 'Roads', lat: 17.4381, lng: 78.6741, image: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80', rating: 4.3, description: 'Primary arterial road serving Pocharam, Ghatkesar and Uppal.' },
];
const toRad = (d) => (d * Math.PI) / 180;
const hav = (a, b) => { const R = 6371; const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
for (const p of pois) { p.distance = Number(hav(center, p).toFixed(2)); p.travelMins = Math.max(1, Math.round((p.distance / 26) * 60 + 1)); }

const amenities = [
  { id: 'pool', name: 'Pool', tagline: 'Swimming pool with toddler section', pano: '/panos/pool.jpg', thumb: 'https://images.unsplash.com/photo-1572331165267-854da2b10ccc?w=400&q=70', level: 'Clubhouse' },
  { id: 'gym', name: 'Gym', tagline: 'Air-conditioned gym, yoga and aerobics', pano: '/panos/gym.jpg', thumb: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=70', level: 'Clubhouse Level 1' },
  { id: 'banquet', name: 'Banquet', tagline: 'Multipurpose hall and open-air amphitheatre', pano: '/panos/banquet.jpg', thumb: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&q=70', level: 'Clubhouse Ground' },
  { id: 'lounge', name: 'Lounge', tagline: 'Business lounge, guest rooms and creche', pano: '/panos/lounge.jpg', thumb: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=400&q=70', level: 'Entrance Plaza' },
];

const project = {
  project: {
    name: 'RAMKY ONE ORION', developer: 'Ramky Estates & Farms Ltd.',
    tagline: 'Explore your tower, floor, apartment and every room before possession.',
    address: 'Pocharam–Uppal Corridor, Hyderabad, Telangana',
    center: [center.lng, center.lat], rera: 'P02200005803', floorHeight: 3.1, totalUnits: 1144, possession: 'Dec 2027',
    landArea: '8.8 acres', configuration: 'G + 16 · 3 BHK', website: 'https://ramkyoneorion.com', video: 'https://www.youtube.com/watch?v=1nQDNofieq0',
  },
  towers, flats, pois, amenities,
  rooms: [
    { id: 'living', label: 'LIVING', minimap: { x: 62, y: 60 } },
    { id: 'dining', label: 'DINING', minimap: { x: 62, y: 32 } },
    { id: 'bedroom', label: 'BEDROOM', minimap: { x: 22, y: 30 } },
    { id: 'kitchen', label: 'KITCHEN', minimap: { x: 88, y: 28 } },
    { id: 'balcony', label: 'BALCONY', minimap: { x: 62, y: 88 } },
  ],
};
writeFileSync(new URL('../data/project.json', import.meta.url), JSON.stringify(project, null, 2));
console.log(`wrote data/project.json: ${flats.length} flats, ${pois.length} pois, ${amenities.length} amenities`);
