import {
  AdminUser,
  Courier,
  Order,
  Route,
  PricingBand,
  PricingZone,
  RestaurantProfile,
  OperationSession,
  OrdersReport,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PaginationParams {
  limit?: number;
  offset?: number;
  includeOrders?: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

type HeaderMap = Record<string, string>;

let adminToken: string | null = null;

export function setAdminToken(token: string | null) {
  adminToken = token;
}

export function getAdminToken() {
  return adminToken;
}

function resolveAdminToken(override?: string | null) {
  const token = override ?? adminToken;
  if (!token) {
    throw new Error('Admin não autenticado. Faça login novamente.');
  }
  return token;
}

function withAdminHeaders(base: HeaderMap = {}, override?: string | null): HeaderMap {
  return {
    ...base,
    Authorization: `Bearer ${resolveAdminToken(override)}`,
  };
}

interface AdminRequestInit extends Omit<RequestInit, 'headers'> {
  headers?: HeaderMap;
}

function adminFetch(path: string, init: AdminRequestInit = {}, override?: string | null) {
  const headers = withAdminHeaders(init.headers, override);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

function buildPaginationQuery(params?: PaginationParams) {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set('offset', String(params.offset));
  }
  if (params.includeOrders) {
    searchParams.set('includeOrders', 'true');
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function normalizePaginatedResponse<T>(payload: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    return { data: payload };
  }
  return payload;
}

function withAuth(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Request failed with status ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

interface CourierLoginResponse {
  token: string;
  courier: Courier;
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminUser;
}

interface AdminProfileResponse {
  admin: AdminUser;
}

interface OperationSessionPayload {
  id: string;
  startedAt: string;
  visibleFrom: string;
  visibleFromSequence: number;
  closedAt?: string;
}

interface OperationDayApiResponse {
  current: OperationSessionPayload | null;
  history: OperationSessionPayload[];
}

export interface OperationDayResponse {
  current: OperationSession | null;
  history: OperationSession[];
}

function parseSession(session: OperationSessionPayload): OperationSession {
  return {
    id: session.id,
    startedAt: new Date(session.startedAt),
    visibleFrom: new Date(session.visibleFrom),
    visibleFromSequence: session.visibleFromSequence,
    closedAt: session.closedAt ? new Date(session.closedAt) : undefined,
  };
}

export async function loginCourier(phone: string, pin: string): Promise<CourierLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/courier/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin }),
  });
  return handleResponse<CourierLoginResponse>(response);
}

export async function loginAdmin(email: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AdminLoginResponse>(response);
}

export async function fetchAdminProfile(token?: string): Promise<AdminUser> {
  const response = await adminFetch('/auth/admin/me', {}, token);
  const data = await handleResponse<AdminProfileResponse>(response);
  return data.admin;
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  const response = await adminFetch('/admins');
  return handleResponse<AdminUser[]>(response);
}

export async function createAdminAccount(name: string, email: string, password: string): Promise<AdminUser> {
  const response = await adminFetch('/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse<AdminUser>(response);
}

export async function updateAdminAccount(
  id: string,
  data: Partial<{ name: string; email: string; password: string }>
): Promise<AdminUser> {
  const response = await adminFetch(`/admins/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<AdminUser>(response);
}

export async function deleteAdminAccount(id: string): Promise<void> {
  const response = await adminFetch(`/admins/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Erro ao remover administrador');
  }
}

export async function fetchOrders(params?: PaginationParams): Promise<PaginatedResponse<Order>> {
  const query = buildPaginationQuery(params);
  const response = await adminFetch(`/debug/orders${query}`);
  const payload = await handleResponse<Order[] | PaginatedResponse<Order>>(response);
  return normalizePaginatedResponse(payload);
}

export async function fetchCouriers(params?: PaginationParams): Promise<PaginatedResponse<Courier>> {
  const query = buildPaginationQuery(params);
  const response = await adminFetch(`/debug/couriers${query}`);
  const payload = await handleResponse<Courier[] | PaginatedResponse<Courier>>(response);
  return normalizePaginatedResponse(payload);
}

export async function fetchRoutes(params?: PaginationParams): Promise<PaginatedResponse<Route>> {
  const query = buildPaginationQuery(params);
  const response = await adminFetch(`/debug/routes${query}`);
  const payload = await handleResponse<Route[] | PaginatedResponse<Route>>(response);
  return normalizePaginatedResponse(payload);
}

export async function setCourierAvailable(id: string): Promise<Courier> {
  const response = await adminFetch(`/couriers/${id}/available`, { method: 'POST' });
  return handleResponse<Courier>(response);
}

export async function createCourier(name: string, phone: string, pin: string): Promise<Courier> {
  const response = await adminFetch('/couriers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, pin }),
  });
  return handleResponse<Courier>(response);
}

export interface CreateOrderPayload {
  address?: string;
  lat?: number;
  lng?: number;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  complement?: string;
  reference?: string;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const response = await adminFetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Order>(response);
}

export async function markOrderDelivered(id: string): Promise<Order> {
  const response = await adminFetch(`/orders/${id}/delivered`, { method: 'POST' });
  return handleResponse<Order>(response);
}

export async function markMyOrderDelivered(token: string, id: string): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/couriers/me/orders/${id}/delivered`, {
    method: 'POST',
    headers: withAuth(token),
  });
  return handleResponse<Order>(response);
}

export async function fetchCourierCurrentRoute(id: string): Promise<Route | null> {
  const response = await adminFetch(`/couriers/${id}/current-route`);
  if (response.status === 204) {
    return null;
  }
  return handleResponse<Route>(response);
}

export async function fetchMyCurrentRoute(token: string): Promise<Route | null> {
  const response = await fetch(`${API_BASE_URL}/couriers/me/current-route`, {
    headers: withAuth(token),
  });

  if (response.status === 404 || response.status === 204) {
    return null;
  }

  return handleResponse<Route>(response);
}

export async function setMyCourierAvailable(token: string): Promise<Courier> {
  const response = await fetch(`${API_BASE_URL}/couriers/me/available`, {
    method: 'POST',
    headers: withAuth(token),
  });
  return handleResponse<Courier>(response);
}

export async function setMyCourierOffline(token: string): Promise<Courier | null> {
  const response = await fetch(`${API_BASE_URL}/couriers/me/offline`, {
    method: 'POST',
    headers: withAuth(token),
  });
  if (response.status === 404 || response.status === 401) {
    return null;
  }
  return handleResponse<Courier>(response);
}

export async function fetchMyCourierProfile(token: string): Promise<Courier> {
  const response = await fetch(`${API_BASE_URL}/couriers/me`, {
    headers: withAuth(token),
  });
  return handleResponse<Courier>(response);
}

export interface CourierRouteSummary {
  id: string;
  status: Route['status'];
  createdAt: string;
  totalPrice: number;
  orderCount: number;
}

export async function fetchMyRouteHistory(token: string, limit = 5): Promise<CourierRouteSummary[]> {
  const response = await fetch(`${API_BASE_URL}/couriers/me/history?limit=${limit}`, {
    headers: withAuth(token),
  });
  const data = await handleResponse<{ history: CourierRouteSummary[] }>(response);
  return data.history;
}

export async function assignRoute(routeId: string, courierId: string): Promise<Route> {
  const response = await adminFetch(`/routes/${routeId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courierId }),
  });
  return handleResponse<Route>(response);
}

interface AutoAssignResponse {
  route: Route;
  courier: Courier;
  reason: string;
}

export async function assignRouteAutomatically(routeId: string): Promise<AutoAssignResponse> {
  const response = await adminFetch(`/routes/${routeId}/assign/auto`, {
    method: 'POST',
  });
  return handleResponse<AutoAssignResponse>(response);
}

export async function createManualRoute(orderIds: string[]): Promise<Route> {
  const response = await adminFetch('/routes/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds }),
  });
  return handleResponse<Route>(response);
}

export async function startMyRoute(token: string, routeId: string): Promise<Route> {
  const response = await fetch(`${API_BASE_URL}/routes/${routeId}/start`, {
    method: 'POST',
    headers: withAuth(token),
  });
  return handleResponse<Route>(response);
}

export async function fetchPricingBands(): Promise<PricingBand[]> {
  const response = await adminFetch('/pricing/bands');
  return handleResponse<PricingBand[]>(response);
}

export async function createPricingBand(maxDistanceKm: number, price: number): Promise<PricingBand> {
  const response = await adminFetch('/pricing/bands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxDistanceKm, price }),
  });
  return handleResponse<PricingBand>(response);
}

export async function updatePricingBand(id: string, maxDistanceKm: number, price: number): Promise<PricingBand> {
  const response = await adminFetch(`/pricing/bands/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxDistanceKm, price }),
  });
  return handleResponse<PricingBand>(response);
}

export async function deletePricingBand(id: string): Promise<void> {
  const response = await adminFetch(`/pricing/bands/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(text || 'Erro ao remover faixa de preço');
  }
}

export async function fetchPricingZones(): Promise<PricingZone[]> {
  const response = await adminFetch('/pricing/zones');
  return handleResponse<PricingZone[]>(response);
}

export async function createPricingZone(name: string, matchText: string, price: number): Promise<PricingZone> {
  const response = await adminFetch('/pricing/zones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, matchText, price }),
  });
  return handleResponse<PricingZone>(response);
}

export async function updatePricingZone(
  id: string,
  data: Partial<Omit<PricingZone, 'id'>>
): Promise<PricingZone> {
  const response = await adminFetch(`/pricing/zones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<PricingZone>(response);
}

export async function deletePricingZone(id: string): Promise<void> {
  const response = await adminFetch(`/pricing/zones/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(text || 'Erro ao remover zona');
  }
}

export async function updateCourier(
  id: string,
  data: Partial<{ name: string; phone: string; pin: string }>
): Promise<Courier> {
  const response = await adminFetch(`/couriers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Courier>(response);
}

export async function deleteCourier(id: string): Promise<void> {
  const response = await adminFetch(`/couriers/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(text || 'Erro ao remover motoboy');
  }
}

export async function updateOrder(
  id: string,
  data: Partial<{ address: string; lat: number; lng: number; status: Order['status'] }>
): Promise<Order> {
  const response = await adminFetch(`/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Order>(response);
}

export async function deleteOrder(id: string, options?: { force?: boolean }): Promise<void> {
  const params = new URLSearchParams();
  if (options?.force) {
    params.set('force', 'true');
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await adminFetch(`/orders/${id}${suffix}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(text || 'Erro ao remover pedido');
  }
}

export async function deleteRoute(id: string, options?: { force?: boolean }): Promise<void> {
  const params = new URLSearchParams();
  if (options?.force) {
    params.set('force', 'true');
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await adminFetch(`/routes/${id}${suffix}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(text || 'Erro ao remover rota');
  }
}

export async function fetchRestaurantProfile(): Promise<RestaurantProfile> {
  const response = await adminFetch('/restaurant');
  return handleResponse<RestaurantProfile>(response);
}

export async function updateRestaurantProfile(payload: Partial<Omit<RestaurantProfile, 'id'>>): Promise<RestaurantProfile> {
  const response = await adminFetch('/restaurant', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<RestaurantProfile>(response);
}

export async function fetchOperationDay(): Promise<OperationDayResponse> {
  const response = await adminFetch('/operation-day');
  const data = await handleResponse<OperationDayApiResponse>(response);
  return {
    current: data.current ? parseSession(data.current) : null,
    history: data.history.map(parseSession),
  };
}

export async function startOperationDay(): Promise<OperationDayResponse> {
  await adminFetch('/operation-day/start', { method: 'POST' });
  return fetchOperationDay();
}

export async function closeOperationDay(): Promise<OperationDayResponse> {
  await adminFetch('/operation-day/close', { method: 'POST' });
  return fetchOperationDay();
}

export async function fetchOrdersReport(from: Date, to: Date): Promise<OrdersReport> {
  const params = new URLSearchParams();
  params.append('from', from.toISOString());
  params.append('to', to.toISOString());
  const response = await adminFetch(`/reports/orders?${params.toString()}`);
  return handleResponse<OrdersReport>(response);
}
