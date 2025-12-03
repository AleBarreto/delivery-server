export type OrderStatus = 'PENDING' | 'ON_ROUTE' | 'DELIVERED';

export interface Order {
  id: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  status: OrderStatus;
  courierId?: string;
  routeId?: string;
}

export type CourierStatus = 'AVAILABLE' | 'ON_TRIP';

export interface Courier {
  id: string;
  name: string;
  status: CourierStatus;
}

export type RouteStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';

export interface Route {
  id: string;
  courierId: string;
  orderIds: string[];
  status: RouteStatus;
  createdAt: string;
  mapsUrl?: string;
}
