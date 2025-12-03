import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createCourier, sanitizeCourier, setCourierAvailable } from './courierService';
import { createOrder } from './orderService';
import { couriers, orders, routes } from './db';
import { JWT_EXPIRES_IN, JWT_SECRET } from './authConfig';
import { authCourier } from './middleware/authCourier';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
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

app.post('/couriers', async (req, res) => {
  const { name, phone, pin } = req.body;
  if (!name || !phone || !pin) return res.status(400).json({ error: 'name, phone and pin are required' });

  const existingCourier = couriers.find(c => c.phone === phone);
  if (existingCourier) {
    return res.status(400).json({ error: 'Courier with this phone already exists' });
  }

  const courier = await registerCourier(name, phone, pin);
  res.status(201).json(sanitizeCourier(courier));
});

app.post('/couriers/:id/available', (req, res) => {
  const courier = setCourierAvailable(req.params.id);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  res.json(sanitizeCourier(courier));
});

app.post('/couriers/me/available', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  const updatedCourier = setCourierAvailable(courier.id);
  if (!updatedCourier) return res.status(404).json({ error: 'Courier not found' });

  console.log(`[courier] Availability updated for courier ${courier.id}`);
  res.json(sanitizeCourier(updatedCourier));
});

function findActiveRoute(courierId: string) {
  const courierRoutes = routes
    .filter(r => r.courierId === courierId && r.status !== 'DONE')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return courierRoutes[0];
}

app.get('/couriers/:id/current-route', (req, res) => {
  const route = findActiveRoute(req.params.id);
  if (!route) return res.status(404).json({ error: 'No active route for courier' });
  res.json(route);
});

app.get('/couriers/me/current-route', authCourier, (req, res) => {
  const courier = req.courier;
  if (!courier) return res.status(401).json({ error: 'Unauthorized' });

  const route = findActiveRoute(courier.id);
  if (!route) return res.status(404).json({ error: 'No active route for courier' });
  res.json(route);
});

app.post('/orders', (req, res) => {
  const { address, lat, lng } = req.body;
  if (!address || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'address, lat and lng are required' });
  }

  const order = createOrder(address, lat, lng);
  res.status(201).json(order);
});

app.post('/orders/:id/delivered', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = 'DELIVERED';
  res.json(order);
});

app.get('/debug/orders', (_, res) => {
  res.json(orders);
});

app.get('/debug/routes', (_, res) => {
  res.json(routes);
});

app.get('/debug/couriers', (_, res) => {
  res.json(couriers.map(c => sanitizeCourier(c)));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
