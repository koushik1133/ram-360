// Generates /data/project.json for RAMKY ONE GENEXT (Habsiguda, Hyderabad) — the single mock data source.
// Facts from ramkyonegenext.com: 5.7 acres, 4 towers, B+G+14, 596 units, 2/3 BHK, RERA P02200004880.
import { writeFileSync } from 'node:fs';

// Site centre from satellite imagery of the stepped tower row (Genpact Road, Vignana Puri)
const center = { lng: 78.5472, lat: 17.4087 };

// Four joined, stepped rectangular wings running NW→SE (x east, z south, metres). Rotation is the whole row's tilt.
const towers = [
  { id: 'T1', name: 'Tower 1', floors: 14, flatsPerFloor: 10, units: 150, footprint: [26, 40], position: [-21, -36], rotation: -18, height: 46.5, tint: '#e6e4df', status: 'Selling Fast' },
  { id: 'T2', name: 'Tower 2', floors: 14, flatsPerFloor: 10, units: 150, footprint: [26, 40], position: [-7, -12], rotation: -18, height: 46.5, tint: '#e8e6e1', status: 'Ready Structure' },
  { id: 'T3', name: 'Tower 3', floors: 14, flatsPerFloor: 10, units: 150, footprint: [26, 40], position: [7, 12], rotation: -18, height: 46.5, tint: '#e6e4df', status: 'Selling' },
  { id: 'T4', name: 'Tower 4', floors: 14, flatsPerFloor: 10, units: 150, footprint: [26, 40], position: [21, 36], rotation: -18, height: 46.5, tint: '#e8e6e1', status: 'New Release' },
];

// 10 flats per floor: 01–05 on the east face, 06–10 on the west face
const configs = [
  { bhk: 2, sqft: 1195, base: 1.2 }, { bhk: 3, sqft: 1580, base: 1.9 }, { bhk: 2, sqft: 1265, base: 1.28 }, { bhk: 3, sqft: 1745, base: 2.1 }, { bhk: 2, sqft: 1195, base: 1.2 },
  { bhk: 3, sqft: 1580, base: 1.9 }, { bhk: 2, sqft: 1265, base: 1.28 }, { bhk: 3, sqft: 1745, base: 2.1 }, { bhk: 2, sqft: 1195, base: 1.2 }, { bhk: 3, sqft: 1580, base: 1.9 },
];
let seed = 11;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

const flats = [];
for (const t of towers) {
  for (let floor = 0; floor <= t.floors; floor++) {
    for (let i = 0; i < t.flatsPerFloor; i++) {
      const flatNo = String(i + 1).padStart(2, '0');
      const cfg = configs[i];
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
        planSvg: '/plans/typical-floor.svg',
        panos: { living: '/panos/living.jpg', dining: '/panos/dining.jpg', bedroom: '/panos/bedroom.jpg', kitchen: '/panos/kitchen.jpg', balcony: '/panos/balcony.jpg' },
      });
    }
  }
}

const pois = [
  { id: 'tr1', name: 'NGRI Metro Station', category: 'Transport', lat: 17.4078, lng: 78.5521, image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80', rating: 4.4, description: 'Blue Line station one minute from the gate. Ameerpet in 30 minutes, Raidurg in 55.' },
  { id: 'tr2', name: 'Habsiguda Metro Station', category: 'Transport', lat: 17.4062, lng: 78.5402, image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80', rating: 4.3, description: 'Second metro option on the Blue Line, five minutes by auto.' },
  { id: 'tr3', name: 'Secunderabad Railway Station', category: 'Transport', lat: 17.4344, lng: 78.5013, image: 'https://images.unsplash.com/photo-1532105956626-9569c03602f6?w=800&q=80', rating: 4.2, description: 'Main junction of the twin cities, 15 minutes by road.' },
  { id: 'tr4', name: 'Rajiv Gandhi International Airport', category: 'Transport', lat: 17.2403, lng: 78.4294, image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80', rating: 4.7, description: '45 minutes via the Inner Ring Road and PVNR Expressway.' },
  { id: 'edu1', name: 'Delhi Public School, Nacharam', category: 'Schools', lat: 17.4258, lng: 78.5590, image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', rating: 4.5, description: 'CBSE campus with sports academy, ten minutes north.' },
  { id: 'edu2', name: 'Osmania University', category: 'Schools', lat: 17.4126, lng: 78.5285, image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80', rating: 4.6, description: 'Century-old university campus and green lung of the east city.' },
  { id: 'edu3', name: 'Sri Chaitanya Techno School, Habsiguda', category: 'Schools', lat: 17.4050, lng: 78.5410, image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80', rating: 4.2, description: 'K-12 school within a five-minute drive.' },
  { id: 'hos1', name: 'Aditya Hospital, Uppal', category: 'Hospitals', lat: 17.3997, lng: 78.5578, image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80', rating: 4.3, description: 'Multi-speciality hospital with 24x7 emergency, six minutes away.' },
  { id: 'hos2', name: 'Yashoda Hospitals, Malakpet', category: 'Hospitals', lat: 17.3765, lng: 78.5029, image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80', rating: 4.5, description: 'NABH-accredited tertiary care hospital.' },
  { id: 'mall1', name: 'DSL Virtue Mall, Uppal', category: 'Malls', lat: 17.4033, lng: 78.5590, image: 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=800&q=80', rating: 4.3, description: 'Retail, food court and multiplex on Warangal Highway.' },
  { id: 'mall2', name: 'Asian Mall, Uppal', category: 'Malls', lat: 17.4008, lng: 78.5603, image: 'https://images.unsplash.com/photo-1567449303078-57ad995bd17a?w=800&q=80', rating: 4.1, description: 'Cinemas and high-street brands, eight minutes.' },
  { id: 'road1', name: 'Genpact Uppal Campus', category: 'Roads', lat: 17.4103, lng: 78.5498, image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80', rating: 4.4, description: 'Genpact and Infosys offices on the doorstep: a walk-to-work address.' },
  { id: 'road2', name: 'Rajiv Gandhi Intl. Cricket Stadium', category: 'Roads', lat: 17.4066, lng: 78.5507, image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80', rating: 4.6, description: 'Uppal Stadium, adjacent to the project.' },
  { id: 'road3', name: 'Warangal Highway (NH163)', category: 'Roads', lat: 17.4020, lng: 78.5560, image: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80', rating: 4.2, description: 'Arterial highway to the ORR and the eastern IT corridor.' },
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
    name: 'RAMKY ONE GENEXT', developer: 'Ramky Estates & Farms Ltd.',
    tagline: 'Four stepped towers on a 5.7-acre podium, one minute from NGRI Metro.',
    address: 'Genpact Road, Habsiguda, Uppal, Hyderabad 500007',
    center: [center.lng, center.lat], rera: 'P02200004880', floorHeight: 3.1, totalUnits: 596, possession: 'Dec 2027',
    landArea: '5.7 acres', configuration: 'B + G + 14', website: 'https://ramkyonegenext.com', video: 'https://youtu.be/TnTwfOCORTo',
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
