export type OrderStatus = 'PENDING' | 'QUEUED' | 'ON_ROUTE' | 'DELIVERED';

export interface Order {
  id: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: Date;
  sequence: number;
  status: OrderStatus;
  courierId?: string;
  routeId?: string;
  deliveryPrice?: number;
  pricingRule?: PricingRuleSummary;
}

export type CourierStatus = 'OFFLINE' | 'AVAILABLE' | 'ASSIGNED' | 'ON_TRIP';

export interface Courier {
  id: string;
  name: string;
  phone: string;
  pinHash: string;
  status: CourierStatus;
}

export type RouteStatus = 'AWAITING_COURIER' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';

export interface Route {
  id: string;
  courierId?: string;
  orderIds: string[];
  status: RouteStatus;
  createdAt: Date;
  mapsUrl?: string;
  totalPrice?: number;
}

export interface RoutingConfig {
  minBatch: number;        // mínimo de pedidos por rota
  maxBatch: number;        // máximo de pedidos por rota
  maxWaitMinutes: number;  // tempo máximo de espera do pedido mais antigo
  smartBatchHoldMinutes: number; // tempo extra para esperar pedidos na mesma região
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PricingBand {
  id: string;
  maxDistanceKm: number;
  price: number;
}

export interface PricingZone {
  id: string;
  name: string;
  matchText: string;
  price: number;
}

export interface PricingRuleSummary {
  type: 'ZONE' | 'DISTANCE';
  label: string;
}

export interface RestaurantProfile {
  id: string;
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

export interface OperationSession {
  id: string;
  startedAt: Date;
  visibleFrom: Date;
  visibleFromSequence: number;
  closedAt?: Date;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}
