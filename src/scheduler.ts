import { v4 as uuid } from 'uuid';
import { orders, routes, persistDB, restaurantProfile } from './db';
import { routingConfig } from './config';
import { LatLng, Order, Route, RoutingConfig } from './types';

const ROUTE_CHECK_INTERVAL_MS = 30_000;
let schedulerInterval: NodeJS.Timeout | null = null;

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
  console.log(`[scheduler] Novo pedido criado: ${order.id}`);
  generateRoutesFromPending();
}

function selectOrdersForRoute(pending: Order[], config: RoutingConfig): Order[] {
  if (pending.length === 0) return [];

  const selected: Order[] = [];
  let currentPoint: LatLng = { lat: restaurantProfile.lat, lng: restaurantProfile.lng };

  const oldest = pending[0];
  selected.push(oldest);
  currentPoint = { lat: oldest.lat, lng: oldest.lng };

  const remaining = pending.slice(1);

  while (selected.length < config.maxBatch && remaining.length > 0) {
    const closest = findClosest(currentPoint, remaining);
    selected.push(closest);
    currentPoint = { lat: closest.lat, lng: closest.lng };
    const index = remaining.findIndex(o => o.id === closest.id);
    remaining.splice(index, 1);
  }

  return selected;
}

function createPendingRoute(selected: Order[]): Route {
  const route: Route = {
    id: uuid(),
    orderIds: selected.map(o => o.id),
    status: 'AWAITING_COURIER',
    createdAt: new Date(),
    mapsUrl: buildMapsUrl({ lat: restaurantProfile.lat, lng: restaurantProfile.lng }, selected),
    totalPrice: selected.reduce((total, order) => total + (order.deliveryPrice ?? 0), 0)
  };

  routes.push(route);

  selected.forEach(order => {
    order.status = 'QUEUED';
    order.courierId = undefined;
    order.routeId = route.id;
  });

  console.log(
    `[scheduler] Rota ${route.id} criada aguardando atribuição com pedidos: ${route.orderIds.join(', ')}`
  );

  return route;
}

export function generateRoutesFromPending() {
  let pending = orders
    .filter(o => o.status === 'PENDING')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (pending.length === 0) {
    console.log('[scheduler] Nenhum pedido pendente para agrupar.');
    return;
  }

  const createdRoutes: string[] = [];
  const config = resolveRoutingConfig();

  while (pending.length > 0) {
    const now = new Date();
    const oldest = pending[0];
    const waitMinutes = diffInMinutes(now, oldest.createdAt);
    const hasMinBatch = pending.length >= config.minBatch;
    const holdExpired =
      !!config.smartBatchHoldMinutes && waitMinutes >= config.smartBatchHoldMinutes;
    const hasOldOrder = waitMinutes >= config.maxWaitMinutes || holdExpired;
    const clusteredSelection = findNearbyCluster(pending, config);
    const holdingForCluster = !clusteredSelection && shouldHoldForCluster(pending, waitMinutes, config);

    if (!clusteredSelection && holdingForCluster && !hasOldOrder) {
      console.log('[scheduler] Segurando pedidos para combinar rota na mesma região.');
      break;
    }

    if (!clusteredSelection && !hasMinBatch && !hasOldOrder) {
      console.log('[scheduler] Aguardando mais pedidos ou SLA para formar nova rota.');
      break;
    }

    const selected = clusteredSelection ?? selectOrdersForRoute(pending, config);
    if (selected.length === 0) break;

    const route = createPendingRoute(selected);
    createdRoutes.push(route.id);

    const selectedIds = new Set(selected.map(o => o.id));
    pending = pending.filter(order => !selectedIds.has(order.id));
  }

  if (createdRoutes.length > 0) {
    persistDB();
  }
}

const SMART_BATCH_DISTANCE_KM = 3;

function isWithinClusterDistance(target: Order, reference: Order): boolean {
  return distance({ lat: target.lat, lng: target.lng }, { lat: reference.lat, lng: reference.lng }) <= SMART_BATCH_DISTANCE_KM;
}

function buildClusterFromSeed(pending: Order[], seedIndex: number, config: RoutingConfig): Order[] {
  const seed = pending[seedIndex];
  const cluster: Order[] = [seed];

  for (let i = 0; i < pending.length && cluster.length < config.maxBatch; i++) {
    if (i === seedIndex) continue;
    const candidate = pending[i];
    const isClose = cluster.some(item => isWithinClusterDistance(candidate, item));
    if (isClose) {
      cluster.push(candidate);
    }
  }

  return cluster;
}

function findNearbyCluster(pending: Order[], config: RoutingConfig): Order[] | undefined {
  for (let i = 0; i < pending.length; i++) {
    const cluster = buildClusterFromSeed(pending, i, config);
    if (cluster.length >= config.minBatch) {
      return cluster
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, config.maxBatch);
    }
  }
  return undefined;
}

export function startSchedulerLoop() {
  if (schedulerInterval) {
    return;
  }

  console.log(`[scheduler] Loop automático iniciado (a cada ${ROUTE_CHECK_INTERVAL_MS / 1000}s).`);
  schedulerInterval = setInterval(() => {
    try {
      generateRoutesFromPending();
    } catch (error) {
      console.error('[scheduler] Falha ao reprocessar pedidos pendentes automaticamente.', error);
    }
  }, ROUTE_CHECK_INTERVAL_MS);

  // processamento inicial para ordens já pendentes
  generateRoutesFromPending();
}

function resolveRoutingConfig(): RoutingConfig {
  return {
    minBatch: restaurantProfile.minBatch ?? routingConfig.minBatch,
    maxBatch: restaurantProfile.maxBatch ?? routingConfig.maxBatch,
    maxWaitMinutes: restaurantProfile.maxWaitMinutes ?? routingConfig.maxWaitMinutes,
    smartBatchHoldMinutes:
      restaurantProfile.smartBatchHoldMinutes ?? routingConfig.smartBatchHoldMinutes ?? 0,
  };
}

function shouldHoldForCluster(pending: Order[], waitMinutes: number, config: RoutingConfig): boolean {
  if (!config.smartBatchHoldMinutes || config.smartBatchHoldMinutes <= 0) return false;
  if (pending.length < 2) return false;
  if (waitMinutes >= config.smartBatchHoldMinutes) return false;

  const first = pending[0];
  let minGap = Infinity;

  for (let i = 1; i < pending.length; i++) {
    const candidate = pending[i];
    const gap = distance({ lat: first.lat, lng: first.lng }, { lat: candidate.lat, lng: candidate.lng });
    if (gap < minGap) {
      minGap = gap;
    }
  }

  return minGap >= SMART_BATCH_DISTANCE_KM;
}
