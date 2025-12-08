import { v4 as uuid } from 'uuid';
import { couriers, orders, routes, persistDB, restaurantProfile } from './db';
import { Courier, Order, Route } from './types';
import { buildMapsUrl } from './scheduler';
import { routingConfig } from './config';

export class RouteAssignmentError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'RouteAssignmentError';
  }
}

export function getCourierActiveRoute(courierId: string): Route | undefined {
  return routes
    .filter(route => route.courierId === courierId && route.status !== 'DONE')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function getRouteById(routeId: string): Route | undefined {
  return routes.find(route => route.id === routeId);
}

export function assignRouteToCourier(routeId: string, courierId: string): Route {
  const route = getRouteById(routeId);
  if (!route) {
    throw new RouteAssignmentError('Rota não encontrada', 404);
  }

  if (route.status !== 'AWAITING_COURIER') {
    throw new RouteAssignmentError('Rota já foi atribuída ou finalizada', 409);
  }

  const courier = couriers.find(c => c.id === courierId);
  if (!courier) {
    throw new RouteAssignmentError('Motoboy não encontrado', 404);
  }

  if (courier.status !== 'AVAILABLE') {
    throw new RouteAssignmentError('Motoboy não está disponível', 409);
  }

  const routeOrders = orders.filter(order => route.orderIds.includes(order.id));
  if (routeOrders.length === 0) {
    throw new RouteAssignmentError('Rota não possui pedidos', 400);
  }

  routeOrders.forEach(order => {
    order.status = 'ON_ROUTE';
    order.courierId = courier.id;
    order.routeId = route.id;
  });

  route.courierId = courier.id;
  route.status = 'ASSIGNED';
  courier.status = 'ASSIGNED';

  persistDB();
  console.log(`[routes] Rota ${route.id} atribuída ao motoboy ${courier.name}.`);

  return route;
}

function getCourierLastAssignment(courierId: string): Date | undefined {
  const assignedRoutes = routes.filter(route => route.courierId === courierId);
  if (assignedRoutes.length === 0) return undefined;
  const mostRecent = assignedRoutes.reduce((latest, route) => {
    if (!latest) return route;
    return route.createdAt > latest.createdAt ? route : latest;
  }, assignedRoutes[0]);
  return mostRecent.createdAt;
}

export function suggestCourierForRoute(routeId: string): { courier: Courier; reason: string } {
  const route = getRouteById(routeId);
  if (!route) {
    throw new RouteAssignmentError('Rota não encontrada', 404);
  }

  if (route.status !== 'AWAITING_COURIER') {
    throw new RouteAssignmentError('Rota já foi atribuída ou finalizada', 409);
  }

  const available = couriers.filter(courier => courier.status === 'AVAILABLE');
  if (available.length === 0) {
    throw new RouteAssignmentError('Nenhum motoboy disponível', 409);
  }

  const ranked = available
    .map(courier => {
      const lastAssignment = getCourierLastAssignment(courier.id);
      return { courier, lastAssignment };
    })
    .sort((a, b) => {
      if (!a.lastAssignment && !b.lastAssignment) return 0;
      if (!a.lastAssignment) return -1;
      if (!b.lastAssignment) return 1;
      return a.lastAssignment.getTime() - b.lastAssignment.getTime();
    });

  const best = ranked[0];
  if (!best) {
    throw new RouteAssignmentError('Nenhum motoboy disponível', 409);
  }

  const reason = best.lastAssignment
    ? `Última rota iniciada em ${best.lastAssignment.toLocaleString()}`
    : 'Ainda não recebeu rotas hoje';

  return { courier: best.courier, reason };
}

export function assignRouteAutomatically(routeId: string) {
  const suggestion = suggestCourierForRoute(routeId);
  const route = assignRouteToCourier(routeId, suggestion.courier.id);
  return {
    route,
    courier: suggestion.courier,
    reason: suggestion.reason
  };
}

export function createManualRoute(orderIds: string[]): Route {
  const uniqueIds = Array.from(new Set(orderIds));
  if (uniqueIds.length === 0) {
    throw new RouteAssignmentError('Selecione ao menos um pedido para criar a rota.', 400);
  }

  const selectedOrders: Order[] = uniqueIds.map(id => {
    const order = orders.find(item => item.id === id);
    if (!order) {
      throw new RouteAssignmentError(`Pedido ${id} não encontrado.`, 404);
    }
    if (order.status !== 'PENDING') {
      throw new RouteAssignmentError('Somente pedidos na fila podem ser agrupados manualmente.', 409);
    }
    return order;
  });

  const maxBatch = restaurantProfile.maxBatch ?? routingConfig.maxBatch;
  if (selectedOrders.length > maxBatch) {
    throw new RouteAssignmentError(`Uma rota manual pode conter no máximo ${maxBatch} pedidos.`, 400);
  }

  selectedOrders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const hasRestaurantCoords =
    typeof restaurantProfile?.lat === 'number' && typeof restaurantProfile?.lng === 'number';
  const origin = hasRestaurantCoords
    ? { lat: restaurantProfile.lat, lng: restaurantProfile.lng }
    : { lat: selectedOrders[0].lat, lng: selectedOrders[0].lng };

  const route: Route = {
    id: uuid(),
    orderIds: selectedOrders.map(order => order.id),
    status: 'AWAITING_COURIER',
    createdAt: new Date(),
    mapsUrl: hasRestaurantCoords ? buildMapsUrl(origin, selectedOrders) : undefined,
    totalPrice: selectedOrders.reduce((total, order) => total + (order.deliveryPrice ?? 0), 0),
  };

  routes.push(route);
  selectedOrders.forEach(order => {
    order.status = 'QUEUED';
    order.courierId = undefined;
    order.routeId = route.id;
  });

  persistDB();
  console.log(`[routes] Rota manual ${route.id} criada com pedidos: ${route.orderIds.join(', ')}`);

  return route;
}

export function refreshRouteProgress(route: Route) {
  const routeOrders = orders.filter(order => route.orderIds.includes(order.id));
  const deliveredCount = routeOrders.filter(order => order.status === 'DELIVERED').length;
  const finished = deliveredCount === routeOrders.length && routeOrders.length > 0;

  if (finished) {
    route.status = 'DONE';
    if (route.courierId) {
      const courier = couriers.find(c => c.id === route.courierId);
      if (courier) {
        courier.status = 'AVAILABLE';
      }
    }
  } else if (deliveredCount > 0 || route.status === 'IN_PROGRESS') {
    route.status = 'IN_PROGRESS';
  } else {
    route.status = route.courierId ? 'ASSIGNED' : 'AWAITING_COURIER';
  }

  persistDB();

  return {
    finished,
    deliveredCount,
    totalOrders: routeOrders.length,
  };
}

export function startRoute(routeId: string, courierId: string): Route {
  const route = getRouteById(routeId);
  if (!route) {
    throw new RouteAssignmentError('Rota não encontrada', 404);
  }

  if (route.courierId !== courierId) {
    throw new RouteAssignmentError('Você não está associado a esta rota', 403);
  }

  if (route.status !== 'ASSIGNED') {
    throw new RouteAssignmentError('Rota já foi iniciada ou finalizada', 409);
  }

  const courier = couriers.find(c => c.id === courierId);
  if (!courier) {
    throw new RouteAssignmentError('Motoboy não encontrado', 404);
  }

  route.status = 'IN_PROGRESS';
  courier.status = 'ON_TRIP';

  persistDB();
  console.log(`[routes] Motoboy ${courier.name} iniciou a rota ${route.id}.`);

  return route;
}
