export type OrderStatus = 'PENDING' | 'ON_ROUTE' | 'DELIVERED';

export interface Order {
  id: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: Date;
  status: OrderStatus;
  courierId?: string;
  routeId?: string;
}

export type CourierStatus = 'AVAILABLE' | 'ON_TRIP';

export interface Courier {
  id: string;
  name: string;
  phone: string;
  pinHash: string;
  status: CourierStatus;
}

export type RouteStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';

export interface Route {
  id: string;
  courierId: string;
  orderIds: string[];
  status: RouteStatus;
  createdAt: Date;
  mapsUrl?: string;
}

export interface RoutingConfig {
  minBatch: number;        // mínimo de pedidos por rota
  maxBatch: number;        // máximo de pedidos por rota
  maxWaitMinutes: number;  // tempo máximo de espera do pedido mais antigo
}

export interface LatLng {
  lat: number;
  lng: number;
}
