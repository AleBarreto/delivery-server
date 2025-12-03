import { Courier, Order, Route } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchOrders(): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/debug/orders`);
  return handleResponse<Order[]>(response);
}

export async function fetchCouriers(): Promise<Courier[]> {
  const response = await fetch(`${API_BASE_URL}/debug/couriers`);
  return handleResponse<Courier[]>(response);
}

export async function fetchRoutes(): Promise<Route[]> {
  const response = await fetch(`${API_BASE_URL}/debug/routes`);
  return handleResponse<Route[]>(response);
}

export async function setCourierAvailable(id: string): Promise<Courier> {
  const response = await fetch(`${API_BASE_URL}/couriers/${id}/available`, {
    method: 'POST',
  });
  return handleResponse<Courier>(response);
}

export async function createCourier(name: string): Promise<Courier> {
  const response = await fetch(`${API_BASE_URL}/couriers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return handleResponse<Courier>(response);
}

export async function createOrder(address: string, lat: number, lng: number): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, lat, lng }),
  });
  return handleResponse<Order>(response);
}

export async function markOrderDelivered(id: string): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/${id}/delivered`, {
    method: 'POST',
  });
  return handleResponse<Order>(response);
}

export async function fetchCourierCurrentRoute(id: string): Promise<Route | null> {
  const response = await fetch(`${API_BASE_URL}/couriers/${id}/current-route`);
  if (response.status === 204) {
    return null;
  }
  return handleResponse<Route>(response);
}
