export type OrderStatus = 'PENDING' | 'QUEUED' | 'ON_ROUTE' | 'DELIVERED';

export interface Order {
  id: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
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
  status: CourierStatus;
}

export type RouteStatus = 'AWAITING_COURIER' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';

export interface Route {
  id: string;
  courierId?: string;
  orderIds: string[];
  status: RouteStatus;
  createdAt: string;
  mapsUrl?: string;
  totalPrice?: number;
  orders?: Order[];
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
}

export interface OrdersReport {
  orders: Array<Order & { courierName: string | null }>;
  totals: {
    count: number;
    totalValue: number;
    byStatus: Record<Order['status'], number>;
    byCourier: Record<string, number>;
    deliveredCount: number;
    deliveredRate: number;
    averageValue: number;
  };
  byDay: Array<{
    date: string;
    count: number;
    delivered: number;
    totalValue: number;
  }>;
  courierStats: Array<{
    courierId: string;
    courierName: string | null;
    count: number;
  }>;
}
