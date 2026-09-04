export type ModuleId = 'master' | 'location' | 'amenities' | 'towers' | 'plans' | 'tour';
export type FlatStatus = 'available' | 'sold' | 'reserved';
export type PoiCategory = 'Schools' | 'Hospitals' | 'Transport' | 'Malls' | 'Roads';
export type RoomId = 'living' | 'dining' | 'bedroom' | 'kitchen' | 'balcony';

export interface Tower {
  id: string;
  name: string;
  floors: number;
  flatsPerFloor: number;
  units: number;
  footprint: [number, number];
  position: [number, number];
  rotation: number;
  height: number;
  tint: string;
  status: string;
}

export interface Flat {
  id: string;
  tower: string;
  floor: number;
  flatNo: string;
  bhk: number;
  sqft: number;
  facing: 'North' | 'East' | 'West' | 'South';
  status: FlatStatus;
  price: string;
  priceValue: number;
  vastu: string;
  naturalLight: string;
  planSvg: string;
  panos: Record<RoomId, string>;
}

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  image: string;
  rating: number;
  description: string;
  distance: number;
  travelMins: number;
}

export interface Amenity {
  id: string;
  name: string;
  tagline: string;
  pano: string;
  thumb: string;
  level: string;
}

export interface Room {
  id: RoomId;
  label: string;
  minimap: { x: number; y: number };
}

export interface ProjectData {
  project: {
    name: string;
    developer: string;
    tagline: string;
    address: string;
    center: [number, number];
    rera: string;
    floorHeight: number;
    totalUnits: number;
    possession: string;
    landArea: string;
    configuration: string;
    website: string;
    video: string;
  };
  towers: Tower[];
  flats: Flat[];
  pois: Poi[];
  amenities: Amenity[];
  rooms: Room[];
}
