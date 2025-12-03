import { v4 as uuid } from 'uuid';
import { couriers, orders, routes } from './db';
import { routingConfig, restaurantLocation } from './config';
import { Courier, LatLng, Order, Route } from './types';

/**
 * Calcula a diferença em minutos entre duas datas.
 */
export function diffInMinutes(a: Date, b: Date): number {
  const diffMs = a.getTime() - b.getTime();
  return diffMs / 1000 / 60;
}

/**
 * Distância aproximada usando fórmula de Haversine.
 */
export function distance(a: LatLng, b: LatLng): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // raio da Terra em km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return R * c;
}

/**
 * Retorna o pedido mais próximo do ponto atual.
 */
export function findClosest(current: LatLng, candidates: Order[]): Order {
  return candidates.reduce((closest, order) => {
    const currentDistance = distance(current, { lat: order.lat, lng: order.lng });
    const closestDistance = distance(current, { lat: closest.lat, lng: closest.lng });
    return currentDistance < closestDistance ? order : closest;
  }, candidates[0]);
}

/**
 * Monta uma URL placeholder para abrir a rota no Google Maps.
 */
export function buildMapsUrl(origin: LatLng, selectedOrders: Order[]): string {
  if (selectedOrders.length === 0) return '';

  const waypoints = selectedOrders
    .slice(0, -1)
    .map(o => `${o.lat},${o.lng}`)
    .join('|');

  const destination = selectedOrders[selectedOrders.length - 1];
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`
  });

  if (waypoints) {
    params.append('waypoints', waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function onNewOrderCreated(order: Order) {
  // No MVP, apenas logamos. A lógica principal dispara quando o motoboy fica disponível.
  console.log(`[scheduler] Novo pedido criado: ${order.id}`);
}

export function onCourierAvailable(courier: Courier) {
  const pending = orders.filter(o => o.status === 'PENDING').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (pending.length === 0) {
    console.log('[scheduler] Nenhum pedido pendente.');
    return;
  }

  const now = new Date();
  const oldest = pending[0];
  const waitMinutes = diffInMinutes(now, oldest.createdAt);
  const hasMinBatch = pending.length >= routingConfig.minBatch;
  const hasOldOrder = waitMinutes >= routingConfig.maxWaitMinutes;

  if (!hasMinBatch && !hasOldOrder) {
    console.log('[scheduler] Aguardando mais pedidos para formar rota.');
    return;
  }

  const selected: Order[] = [];
  let currentPoint: LatLng = restaurantLocation;

  // começa com o pedido mais antigo
  selected.push(oldest);
  currentPoint = { lat: oldest.lat, lng: oldest.lng };

  const remaining = pending.slice(1);

  while (selected.length < routingConfig.maxBatch && remaining.length > 0) {
    const closest = findClosest(currentPoint, remaining);
    selected.push(closest);
    currentPoint = { lat: closest.lat, lng: closest.lng };
    const index = remaining.findIndex(o => o.id === closest.id);
    remaining.splice(index, 1);
  }

  const route: Route = {
    id: uuid(),
    courierId: courier.id,
    orderIds: selected.map(o => o.id),
    status: 'ASSIGNED',
    createdAt: new Date(),
    mapsUrl: buildMapsUrl(restaurantLocation, selected)
  };

  routes.push(route);

  selected.forEach(order => {
    order.status = 'ON_ROUTE';
    order.courierId = courier.id;
    order.routeId = route.id;
  });

  courier.status = 'ON_TRIP';

  console.log(
    `[scheduler] Rota ${route.id} criada para courier ${courier.name} com pedidos: ${route.orderIds.join(', ')}`
  );
}
