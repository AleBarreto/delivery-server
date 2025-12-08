import { v4 as uuid } from 'uuid';
import { pricingBands, pricingZones, persistDB, restaurantProfile } from './db';
import { PricingBand, PricingRuleSummary, PricingZone } from './types';

const EARTH_RADIUS_KM = 6371;

export function listPricingBands() {
  return pricingBands;
}

export function listPricingZones() {
  return pricingZones;
}

export function createPricingBand(maxDistanceKm: number, price: number): PricingBand {
  const band: PricingBand = { id: uuid(), maxDistanceKm, price };
  pricingBands.push(band);
  pricingBands.sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  persistDB();
  return band;
}

export function updatePricingBand(id: string, maxDistanceKm: number, price: number): PricingBand | null {
  const band = pricingBands.find(item => item.id === id);
  if (!band) return null;
  band.maxDistanceKm = maxDistanceKm;
  band.price = price;
  pricingBands.sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  persistDB();
  return band;
}

export function deletePricingBand(id: string): boolean {
  const index = pricingBands.findIndex(item => item.id === id);
  if (index === -1) return false;
  pricingBands.splice(index, 1);
  persistDB();
  return true;
}

export function createPricingZone(name: string, matchText: string, price: number): PricingZone {
  const zone: PricingZone = { id: uuid(), name, matchText, price };
  pricingZones.push(zone);
  persistDB();
  return zone;
}

export function updatePricingZone(id: string, data: Partial<Omit<PricingZone, 'id'>>): PricingZone | null {
  const zone = pricingZones.find(item => item.id === id);
  if (!zone) return null;
  zone.name = data.name ?? zone.name;
  zone.matchText = data.matchText ?? zone.matchText;
  if (typeof data.price === 'number') {
    zone.price = data.price;
  }
  persistDB();
  return zone;
}

export function deletePricingZone(id: string): boolean {
  const index = pricingZones.findIndex(item => item.id === id);
  if (index === -1) return false;
  pricingZones.splice(index, 1);
  persistDB();
  return true;
}

function distanceBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_KM * c;
}

export function calculateOrderPrice(
  address: string,
  lat: number,
  lng: number
): { price: number; rule: PricingRuleSummary } {
  const normalizedAddress = address.toLowerCase();
  const matchedZone = pricingZones.find(zone =>
    normalizedAddress.includes(zone.matchText.toLowerCase())
  );

  if (matchedZone) {
    return {
      price: matchedZone.price,
      rule: {
        type: 'ZONE',
        label: matchedZone.name
      }
    };
  }

  const distanceKm = distanceBetween(restaurantProfile.lat, restaurantProfile.lng, lat, lng);
  const sortedBands = [...pricingBands].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  const selectedBand = sortedBands.find(band => distanceKm <= band.maxDistanceKm) ?? sortedBands[sortedBands.length - 1];
  const beyondRadius = distanceKm > restaurantProfile.maxRadiusKm;

  if (!selectedBand) {
    return {
      price: 0,
      rule: {
        type: 'DISTANCE',
        label: 'Sem faixa configurada'
      }
    };
  }

  return {
    price: selectedBand.price,
    rule: {
      type: 'DISTANCE',
      label: beyondRadius
        ? `Fora do raio (${restaurantProfile.maxRadiusKm} km)`
        : `Até ${selectedBand.maxDistanceKm} km`
    }
  };
}
