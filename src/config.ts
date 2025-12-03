import { RoutingConfig, LatLng } from './types';

export const routingConfig: RoutingConfig = {
  minBatch: 2,
  maxBatch: 5,
  maxWaitMinutes: 25
};

// localização fixa do restaurante (pode ser qualquer coord agora)
export const restaurantLocation: LatLng = {
  lat: -3.1190275,
  lng: -60.0217314
};
