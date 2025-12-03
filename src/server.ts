import express from 'express';
import bodyParser from 'body-parser';
import { createCourier, setCourierAvailable } from './courierService';
import { createOrder } from './orderService';
import { couriers, orders, routes } from './db';

const app = express();
app.use(bodyParser.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.post('/couriers', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const courier = createCourier(name);
  res.status(201).json(courier);
});

app.post('/couriers/:id/available', (req, res) => {
  const courier = setCourierAvailable(req.params.id);
  if (!courier) return res.status(404).json({ error: 'Courier not found' });
  res.json(courier);
});

app.get('/couriers/:id/current-route', (req, res) => {
  const courierId = req.params.id;
  const courierRoutes = routes
    .filter(r => r.courierId === courierId && r.status !== 'DONE')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const route = courierRoutes[0];
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
  res.json(couriers);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
