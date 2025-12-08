import { CourierStatus, OrderStatus, RouteStatus } from '../types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Na fila',
  QUEUED: 'Agrupado',
  ON_ROUTE: 'Em rota',
  DELIVERED: 'Entregue',
};

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  AWAITING_COURIER: 'Aguardando motoboy',
  ASSIGNED: 'Separando pedidos',
  IN_PROGRESS: 'Em rota',
  DONE: 'Finalizada',
};

export const COURIER_STATUS_LABELS: Record<CourierStatus, string> = {
  OFFLINE: 'Offline',
  AVAILABLE: 'Disponível',
  ASSIGNED: 'Aguardando rota',
  ON_TRIP: 'Em rota',
};
