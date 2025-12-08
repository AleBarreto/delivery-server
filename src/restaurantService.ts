import { restaurantProfile, persistDB } from './db';
import { RestaurantProfile } from './types';

export function getRestaurantProfile(): RestaurantProfile {
  return restaurantProfile;
}

interface UpdateRestaurantData {
  name: string;
  address: string;
  lat: number;
  lng: number;
  contactPhone?: string;
  maxRadiusKm: number;
  minBatch?: number;
  maxBatch?: number;
  maxWaitMinutes?: number;
  smartBatchHoldMinutes?: number;
}

export function updateRestaurantProfile(data: UpdateRestaurantData): RestaurantProfile {
  if (!data.name.trim()) {
    throw new Error('Nome do restaurante é obrigatório.');
  }
  if (!data.address.trim()) {
    throw new Error('Endereço do restaurante é obrigatório.');
  }
  if (Number.isNaN(data.lat) || Number.isNaN(data.lng)) {
    throw new Error('Coordenadas inválidas.');
  }
  if (data.maxRadiusKm <= 0) {
    throw new Error('O raio máximo precisa ser maior que zero.');
  }

  restaurantProfile.name = data.name.trim();
  restaurantProfile.address = data.address.trim();
  restaurantProfile.lat = data.lat;
  restaurantProfile.lng = data.lng;
  restaurantProfile.contactPhone = data.contactPhone?.trim() || undefined;
  restaurantProfile.maxRadiusKm = data.maxRadiusKm;
  if (typeof data.minBatch === 'number') {
    restaurantProfile.minBatch = data.minBatch;
  }
  if (typeof data.maxBatch === 'number') {
    restaurantProfile.maxBatch = data.maxBatch;
  }
  if (typeof data.maxWaitMinutes === 'number') {
    restaurantProfile.maxWaitMinutes = data.maxWaitMinutes;
  }
  if (typeof data.smartBatchHoldMinutes === 'number') {
    restaurantProfile.smartBatchHoldMinutes = data.smartBatchHoldMinutes;
  }

  persistDB();
  return restaurantProfile;
}
