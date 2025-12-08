import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
import {
  CourierAvailabilityError,
  createCourier,
  sanitizeCourier,
  setCourierAvailable,
  setCourierOffline
} from './courierService';
import { createOrder } from './orderService';
import { couriers, orders, routes, persistDB } from './db';
import { OrderStatus, Route } from './types';
import { JWT_EXPIRES_IN, JWT_SECRET } from './authConfig';
import { authCourier } from './middleware/authCourier';
import { authAdmin } from './middleware/authAdmin';
import {
  getCourierActiveRoute,
  getRouteById,
  refreshRouteProgress,
  assignRouteToCourier,
  RouteAssignmentError,
  assignRouteAutomatically,
  suggestCourierForRoute,
  createManualRoute,
  startRoute
} from './routeService';
import {
  listPricingBands,
  listPricingZones,
  createPricingBand,
  updatePricingBand,
  deletePricingBand,
  createPricingZone,
  updatePricingZone,
  deletePricingZone,
  calculateOrderPrice
} from './pricingService';
import { getRestaurantProfile, updateRestaurantProfile } from './restaurantService';
import { getOperationSessions, startOperationSession, closeOperationSession } from './operationSessionService';
import { getOrdersReport } from './reportService';
import {
  findAdminByEmail,
  sanitizeAdmin,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin
} from './adminService';
import { geocodeAddress, formatAddressParts, GeocodingError, GeocodeRequest } from './geocodingService';
import { startSchedulerLoop } from './scheduler';

const app = express();
app.use(cors());
app.use(bodyParser.json());

function serializeRouteWithOrders(route: Route) {
  const routeOrders = route.orderIds
    .map(id => orders.find(order => order.id === id))
    .filter((order): order is typeof orders[number] => Boolean(order))
    .map(order => ({
      id: order.id,
      address: order.address,
      status: order.status,
      deliveryPrice: order.deliveryPrice,
      lat: order.lat,
      lng: order.lng,
      createdAt: order.createdAt.toISOString()
    }));

  return {
    ...route,
    orders: routeOrders,
  };
}

const DEFAULT_PAGE_LIMIT = 200;
const MAX_PAGE_LIMIT = 1000;

function parsePaginationParams(query: any) {
  if (query.limit === undefined) {
    return null;
  }
  const rawLimit = Number(query.limit);
  if (!Number.isFinite(rawLimit)) {
    return null;
  }
  const limit = Math.min(Math.max(Math.floor(rawLimit), 1), MAX_PAGE_LIMIT);
  const rawOffset = Number(query.offset);
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.floor(rawOffset), 0) : 0;
  return { limit, offset };
}

function paginateList<T>(list: T[], limit: number, offset: number) {
  return {
    data: list.slice(offset, offset + limit),
    total: list.length,
    limit,
    offset,
  };
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function parseCoordinate(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function extractGeocodeRequest(body: any): GeocodeRequest {
  return {
    addressLine: normalizeString(body.address ?? body.addressLine),
    street: normalizeString(body.street ?? body.logradouro),
    number: normalizeString(body.number ?? body.numero ?? body.houseNumber),
    neighborhood: normalizeString(body.neighborhood ?? body.bairro),
    city: normalizeString(body.city ?? body.municipio),
    state: normalizeString(body.state ?? body.uf),
    country: normalizeString(body.country ?? body.pais),
    complement: normalizeString(body.complement ?? body.complemento),
    reference: normalizeString(body.reference ?? body.referencia)
  };
}

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('/restaurant', authAdmin, (_, res) => {
  res.json(getRestaurantProfile());
});

app.put('/restaurant', authAdmin, (req, res) => {
  try {
    const profile = updateRestaurantProfile({
      name: req.body.name,
      address: req.body.address,
      lat: Number(req.body.lat),
      lng: Number(req.body.lng),
      contactPhone: req.body.contactPhone,
      maxRadiusKm: Number(req.body.maxRadiusKm),
      minBatch: req.body.minBatch ? Number(req.body.minBatch) : undefined,
      maxBatch: req.body.maxBatch ? Number(req.body.maxBatch) : undefined,
      maxWaitMinutes: req.body.maxWaitMinutes ? Number(req.body.maxWaitMinutes) : undefined,
      smartBatchHoldMinutes: req.body.smartBatchHoldMinutes ? Number(req.body.smartBatchHoldMinutes) : undefined
    });
    res.json(profile);
  } catch (error) {
    console.error('[restaurant] Failed to update profile', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar restaurante';
    res.status(400).json({ error: message });
  }
});

app.get('/operation-day', authAdmin, (_, res) => {
  res.json(getOperationSessions());
});

app.post('/operation-day/start', authAdmin, (_, res) => {
  try {
    const session = startOperationSession();
    res.status(201).json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao iniciar dia';
    res.status(400).json({ error: message });
  }
});

app.post('/operation-day/close', authAdmin, (_, res) => {
  try {
    const session = closeOperationSession();
    res.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao fechar dia';
    res.status(400).json({ error: message });
  }
});

app.get('/reports/orders', authAdmin, (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if (from && Number.isNaN(from.getTime())) {
    return res.status(400).json({ error: 'Parâmetro \"from\" inválido.' });
  }
  if (to && Number.isNaN(to.getTime())) {
    return res.status(400).json({ error: 'Parâmetro \"to\" inválido.' });
  }
  const report = getOrdersReport({ from, to });
  res.json(report);
});

app.post('/auth/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const admin = findAdminByEmail(String(email));
  if (!admin) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const isValid = await bcrypt.compare(String(password), admin.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ adminId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  console.log(`[auth] Admin login: ${admin.email}`);
  res.json({ token, admin: sanitizeAdmin(admin) });
});

app.get('/auth/admin/me', authAdmin, (req, res) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({ admin: sanitizeAdmin(req.admin) });
});

app.get('/admins', authAdmin, (_, res) => {
  res.json(listAdmins());
});

app.post('/admins', authAdmin, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const admin = await createAdmin(
      typeof name === 'string' ? name : '',
      typeof email === 'string' ? email : '',
      typeof password === 'string' ? password : ''
    );
    res.status(201).json(admin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar administrador';
    const status = message === 'Admin not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

app.put('/admins/:id', authAdmin, async (req, res) => {
  try {
    const admin = await updateAdmin(req.params.id, {
      name: typeof req.body.name === 'string' ? req.body.name : undefined,
      email: typeof req.body.email === 'string' ? req.body.email : undefined,
      password: typeof req.body.password === 'string' ? req.body.password : undefined
    });
    res.json(admin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar administrador';
    const status = message === 'Admin not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

app.delete('/admins/:id', authAdmin, (req, res) => {
  if (req.admin?.id === req.params.id) {
    return res.status(400).json({ error: 'Você não pode remover o próprio usuário logado.' });
  }

  try {
    deleteAdmin(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao remover administrador';
    const status = message === 'Admin not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

async function registerCourier(name: string, phone: string, pin: string) {
  const pinHash = await bcrypt.hash(pin, 10);
  const courier = createCourier(name, phone, pinHash);
  console.log(`[auth] Courier registered: ${courier.id} (${courier.phone})`);
  return courier;
}

app.post('/auth/courier/register', async (req, res) => {
  const { name, phone, pin } = req.body;
  if (!name || !phone || !pin) {
    return res.status(400).json({ error: 'name, phone and pin are required' });
  }

  const existingCourier = couriers.find(c => c.phone === phone);
  if (existingCourier) {
    return res.status(400).json({ error: 'Courier with this phone already exists' });
  }

  const courier = await registerCourier(name, phone, pin);
  res.status(201).json(sanitizeCourier(courier));
});

app.post('/auth/courier/login', async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) {
    return res.status(400).json({ error: 'phone and pin are required' });
  }

  const courier = couriers.find(c => c.phone === phone);
  if (!courier) return res.status(401).json({ error: 'Invalid credentials' });

  const isValidPin = await bcrypt.compare(pin, courier.pinHash);
  if (!isValidPin) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ courierId: courier.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  console.log(`[auth] Courier login: ${courier.id} (${courier.phone})`);
  res.json({ token, courier: sanitizeCourier(courier) });
});

app.post('/couriers', authAdmin, async (req, res) => {
  const { name, phone, pin } = req.body;
  if (!name || !phone || !pin) return res.status(400).json({ error: 'name, phone and pin are required' });

  const existingCourier = couriers.find(c => c.phone === phone);
  if (existingCourier) {
    return res.status(400).json({ error: 'Courier with this phone already exists' });
  }

  const courier = await registerCourier(name, phone, pin);
  res.status(201).json(sanitizeCourier(courier));
});

app.put('/couriers/:id', authAdmin, async (req, res) => {
  const courier = couriers.find(c => c.id === req.params.id);
  if (!courier) {
    return res.status(404).json({ error: 'Courier not found' });
  }

  const { name, phone, pin } = req.body;

  if (typeof name === 'string' && name.trim()) {
    courier.name = name.trim();
  }

  if (typeof phone === 'string' && phone.trim()) {
    const exists = couriers.find(c => c.phone === phone.trim() && c.id !== courier.id);
    if (exists) {
      return res.status(409).json({ error: 'Já existe um motoboy com este telefone.' });
    }
    courier.phone = phone.trim();
  }

  if (typeof pin === 'string' && pin.trim()) {
    courier.pinHash = await bcrypt.hash(pin.trim(), 10);
  }

  persistDB();
  res.json(sanitizeCourier(courier));
});

app.delete('/couriers/:id', authAdmin, (req, res) => {
  const index = couriers.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Courier not found' });
  }

  const courier = couriers[index];
  const hasActiveRoute = routes.some(route => route.courierId === courier.id && route.status !== 'DONE');
  if (hasActiveRoute || courier.status === 'ON_TRIP' || courier.status === 'ASSIGNED') {
    return res.status(409).json({ error: 'Finalize ou reprograme as rotas antes de remover este motoboy.' });
  }

  couriers.splice(index, 1);
  persistDB();
  res.status(204).send();
});

app.post('/couriers/me/available', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const updatedCourier = setCourierAvailable(courier.id);
    console.log(`[courier] Availability updated for courier ${courier.id}`);
    res.json(sanitizeCourier(updatedCourier));
  } catch (error) {
    if (error instanceof CourierAvailabilityError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[courier] Failed to update availability', error);
    return res.status(500).json({ error: 'Unexpected error updating availability' });
  }
});

app.post('/couriers/me/offline', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const updatedCourier = setCourierOffline(courier.id);
    console.log(`[courier] Courier ${courier.id} ficou offline.`);
    res.json(sanitizeCourier(updatedCourier));
  } catch (error) {
    if (error instanceof CourierAvailabilityError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[courier] Failed to set offline', error);
    return res.status(500).json({ error: 'Unexpected error updating availability' });
  }
});

app.get('/couriers/me', authCourier, (req, res) => {
  if (!req.courier) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(sanitizeCourier(req.courier));
});

app.post('/couriers/:id/available', authAdmin, (req, res) => {
  try {
    const courier = setCourierAvailable(req.params.id);
    res.json(sanitizeCourier(courier));
  } catch (error) {
    if (error instanceof CourierAvailabilityError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[courier] Failed to update availability', error);
    return res.status(500).json({ error: 'Unexpected error updating availability' });
  }
});

app.post('/couriers/:id/offline', authAdmin, (req, res) => {
  try {
    const courier = setCourierOffline(req.params.id);
    res.json(sanitizeCourier(courier));
  } catch (error) {
    if (error instanceof CourierAvailabilityError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[courier] Failed to set offline', error);
    return res.status(500).json({ error: 'Unexpected error updating availability' });
  }
});

app.get('/couriers/me/current-route', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  const route = getCourierActiveRoute(courier.id);
  if (!route) return res.status(404).json({ error: 'No active route for courier' });
  res.json(serializeRouteWithOrders(route));
});

app.get('/couriers/me/history', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  const limitParam = req.query.limit ? Number(req.query.limit) : 5;
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 50) : 5;

  const history = routes
    .filter(route => route.courierId === courier.id && route.status === 'DONE')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map(route => ({
      id: route.id,
      status: route.status,
      createdAt: route.createdAt,
      totalPrice: route.totalPrice ?? 0,
      orderCount: route.orderIds.length,
    }));

  res.json({ history });
});

app.get('/couriers/:id/current-route', authAdmin, (req, res) => {
  const route = getCourierActiveRoute(req.params.id);
  if (!route) return res.status(404).json({ error: 'No active route for courier' });
  res.json(serializeRouteWithOrders(route));
});

app.post('/couriers/me/orders/:id/delivered', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.courierId !== courier.id) {
    return res.status(403).json({ error: 'Este pedido não está atribuído a você.' });
  }

  if (order.status === 'DELIVERED') {
    return res.status(409).json({ error: 'Pedido já foi marcado como entregue.' });
  }
  if (order.status !== 'ON_ROUTE') {
    return res.status(409).json({ error: 'Pedido ainda não saiu para entrega.' });
  }

  order.status = 'DELIVERED';
  console.log(`[courier] Pedido ${order.id} entregue pelo motoboy ${courier.id}.`);

  if (order.routeId) {
    const route = getRouteById(order.routeId);
    if (route) {
      const { finished } = refreshRouteProgress(route);
      if (finished) {
        console.log(`[courier] Rota ${route.id} concluída.`);
      }
    }
  }

  persistDB();
  res.json(order);
});

app.post('/orders', authAdmin, async (req, res) => {
  const addressParts = extractGeocodeRequest(req.body);
  if (!addressParts.addressLine && !addressParts.street) {
    return res.status(400).json({ error: 'Informe o endereço completo ou rua/número do pedido.' });
  }

  let finalAddress = addressParts.addressLine;
  let lat = parseCoordinate(req.body.lat);
  let lng = parseCoordinate(req.body.lng);

  try {
    if (lat == null || lng == null) {
      const result = await geocodeAddress(addressParts);
      lat = result.lat;
      lng = result.lng;
      if (!finalAddress) {
        finalAddress = result.formattedAddress;
      }
    }

    if (!finalAddress) {
      finalAddress = formatAddressParts(addressParts);
    }

    if (!finalAddress) {
      return res.status(400).json({ error: 'Não foi possível montar o endereço textual do pedido.' });
    }

    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'Não foi possível determinar as coordenadas do endereço informado.' });
    }

    const order = createOrder(finalAddress, lat, lng);
    const pricing = calculateOrderPrice(order.address, order.lat, order.lng);
    order.deliveryPrice = pricing.price;
    order.pricingRule = pricing.rule;
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof GeocodingError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[orders] Failed to criar pedido', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Erro ao criar pedido' });
  }
});

app.put('/orders/:id', authAdmin, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const { address, lat, lng, status } = req.body;
  let locationChanged = false;

  if (typeof address === 'string' && address.trim()) {
    order.address = address.trim();
    locationChanged = true;
  }

  if (typeof lat === 'number' && typeof lng === 'number') {
    order.lat = lat;
    order.lng = lng;
    locationChanged = true;
  }

  if (locationChanged) {
    const pricing = calculateOrderPrice(order.address, order.lat, order.lng);
    order.deliveryPrice = pricing.price;
    order.pricingRule = pricing.rule;
  }

  if (typeof status === 'string') {
    const allowed: OrderStatus[] = ['PENDING', 'QUEUED', 'ON_ROUTE', 'DELIVERED'];
    if (!allowed.includes(status as OrderStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if ((status === 'ON_ROUTE' || status === 'DELIVERED') && !order.courierId) {
      return res.status(409).json({ error: 'Não há motoboy associado ao pedido' });
    }

    if (status === 'QUEUED' && !order.routeId) {
      return res.status(409).json({ error: 'Pedido não está vinculado a uma rota' });
    }

    if (status === 'PENDING') {
      order.courierId = undefined;
      order.routeId = undefined;
    }

    order.status = status as OrderStatus;
  }

  persistDB();
  res.json(order);
});

app.post('/orders/:id/delivered', authAdmin, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.status === 'DELIVERED') {
    return res.status(409).json({ error: 'Order already delivered' });
  }
  if (order.status !== 'ON_ROUTE') {
    return res.status(409).json({ error: 'Order not assigned to a route yet' });
  }

  order.status = 'DELIVERED';
  console.log(`[orders] Pedido ${order.id} marcado como entregue.`);

  if (order.routeId) {
    const route = getRouteById(order.routeId);
    if (route) {
      const { finished, deliveredCount, totalOrders } = refreshRouteProgress(route);
      console.log(
        `[routes] Progresso atualizado para rota ${route.id}: ${deliveredCount}/${totalOrders} entregues${finished ? ' (rota finalizada)' : ''}.`
      );
    }
  }

  persistDB();
  res.json(order);
});

app.delete('/orders/:id', authAdmin, (req, res) => {
  const force = String(req.query.force ?? '').toLowerCase() === 'true';
  const index = orders.findIndex(o => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const order = orders[index];
  if (!force && (order.status === 'ON_ROUTE' || order.status === 'DELIVERED')) {
    return res.status(409).json({ error: 'Não é possível remover pedidos em rota ou finalizados.' });
  }
  if (order.routeId) {
    const route = getRouteById(order.routeId);
    if (route) {
      route.orderIds = route.orderIds.filter(id => id !== order.id);
      if (route.orderIds.length === 0) {
        route.status = 'DONE';
        if (route.courierId) {
          const courier = couriers.find(c => c.id === route.courierId);
          if (courier) {
            courier.status = 'AVAILABLE';
          }
        }
      } else {
        refreshRouteProgress(route);
      }
    }
  }
  orders.splice(index, 1);
  persistDB();
  res.status(204).send();
});

app.delete('/routes/:id', authAdmin, (req, res) => {
  const force = String(req.query.force ?? '').toLowerCase() === 'true';
  const index = routes.findIndex(route => route.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Route not found' });
  }

  const route = routes[index];
  if (!force && route.status !== 'AWAITING_COURIER') {
    return res.status(409).json({ error: 'Esta rota já foi atribuída. Use o modo força para remover.' });
  }

  route.orderIds.forEach(orderId => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    order.routeId = undefined;
    if (force && order.status === 'DELIVERED') {
      order.courierId = undefined;
      return;
    }
    if (order.status !== 'DELIVERED') {
      order.status = 'PENDING';
      order.courierId = undefined;
    }
  });

  if (route.courierId) {
    const courier = couriers.find(c => c.id === route.courierId);
    if (courier) {
      courier.status = 'AVAILABLE';
    }
  }

  routes.splice(index, 1);
  persistDB();
  res.status(204).send();
});

app.get('/debug/orders', authAdmin, (req, res) => {
  const pagination = parsePaginationParams(req.query);
  if (!pagination) {
    return res.json(orders);
  }
  const { limit, offset } = pagination;
  res.json(paginateList(orders, limit, offset));
});

app.get('/debug/routes', authAdmin, (req, res) => {
  const includeOrders = String(req.query.includeOrders ?? '').toLowerCase() === 'true';
  const baseList = includeOrders ? routes.map(route => serializeRouteWithOrders(route)) : routes;
  const pagination = parsePaginationParams(req.query);
  if (!pagination) {
    return res.json(baseList);
  }
  const { limit, offset } = pagination;
  res.json(paginateList(baseList, limit, offset));
});

app.post('/routes/manual', authAdmin, (req, res) => {
  const { orderIds } = req.body ?? {};
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: 'Selecione ao menos um pedido para criar a rota.' });
  }

  try {
    const route = createManualRoute(orderIds);
    res.json(route);
  } catch (error) {
    if (error instanceof RouteAssignmentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[routes] Failed to create manual route', error);
    res.status(500).json({ error: 'Erro ao criar rota manual' });
  }
});

app.get('/debug/couriers', authAdmin, (req, res) => {
  const sanitized = couriers.map(c => sanitizeCourier(c));
  const pagination = parsePaginationParams(req.query);
  if (!pagination) {
    return res.json(sanitized);
  }
  const { limit, offset } = pagination;
  res.json(paginateList(sanitized, limit, offset));
});

// Pricing management endpoints
app.get('/pricing/bands', authAdmin, (_, res) => {
  res.json(listPricingBands());
});

app.post('/pricing/bands', authAdmin, (req, res) => {
  const { maxDistanceKm, price } = req.body;
  if (typeof maxDistanceKm !== 'number' || typeof price !== 'number') {
    return res.status(400).json({ error: 'maxDistanceKm and price must be numbers' });
  }
  const band = createPricingBand(maxDistanceKm, price);
  res.status(201).json(band);
});

app.put('/pricing/bands/:id', authAdmin, (req, res) => {
  const { maxDistanceKm, price } = req.body;
  if (typeof maxDistanceKm !== 'number' || typeof price !== 'number') {
    return res.status(400).json({ error: 'maxDistanceKm and price must be numbers' });
  }
  const updated = updatePricingBand(req.params.id, maxDistanceKm, price);
  if (!updated) return res.status(404).json({ error: 'Band not found' });
  res.json(updated);
});

app.delete('/pricing/bands/:id', authAdmin, (req, res) => {
  const deleted = deletePricingBand(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Band not found' });
  res.status(204).send();
});

app.get('/pricing/zones', authAdmin, (_, res) => {
  res.json(listPricingZones());
});

app.post('/pricing/zones', authAdmin, (req, res) => {
  const { name, matchText, price } = req.body;
  if (!name || !matchText || typeof price !== 'number') {
    return res.status(400).json({ error: 'name, matchText and price are required' });
  }
  const zone = createPricingZone(name, matchText, price);
  res.status(201).json(zone);
});

app.put('/pricing/zones/:id', authAdmin, (req, res) => {
  const { name, matchText, price } = req.body;
  const updated = updatePricingZone(req.params.id, {
    name,
    matchText,
    price
  });
  if (!updated) return res.status(404).json({ error: 'Zone not found' });
  res.json(updated);
});

app.delete('/pricing/zones/:id', authAdmin, (req, res) => {
  const deleted = deletePricingZone(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Zone not found' });
  res.status(204).send();
});

app.post('/routes/:id/assign', authAdmin, (req, res) => {
  const { courierId } = req.body;
  if (!courierId) {
    return res.status(400).json({ error: 'courierId is required' });
  }

  try {
    const route = assignRouteToCourier(req.params.id, courierId);
    res.json(route);
  } catch (error) {
    if (error instanceof RouteAssignmentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[routes] Failed to assign route', error);
    return res.status(500).json({ error: 'Unexpected error assigning route' });
  }
});

app.post('/routes/:id/assign/auto', authAdmin, (req, res) => {
  try {
    const result = assignRouteAutomatically(req.params.id);
    res.json(result);
  } catch (error) {
    if (error instanceof RouteAssignmentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[routes] Failed to auto assign route', error);
    return res.status(500).json({ error: 'Unexpected error assigning route automatically' });
  }
});

app.get('/routes/:id/suggest-courier', authAdmin, (req, res) => {
  try {
    const suggestion = suggestCourierForRoute(req.params.id);
    res.json(suggestion);
  } catch (error) {
    if (error instanceof RouteAssignmentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[routes] Failed to suggest courier', error);
    return res.status(500).json({ error: 'Unexpected error suggesting courier' });
  }
});

app.post('/routes/:id/start', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const route = startRoute(req.params.id, courier.id);
    res.json(route);
  } catch (error) {
    if (error instanceof RouteAssignmentError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[routes] Failed to start route', error);
    return res.status(500).json({ error: 'Unexpected error starting route' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
  startSchedulerLoop();
});
