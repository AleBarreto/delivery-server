import { randomUUID } from 'crypto';
import { couriers, orders, routes, persistDB } from '../db';
import { createCourier } from '../courierService';
import { createOrder } from '../orderService';
import { Courier, Order, Route } from '../types';

const COURIER_NAMES = ['Rafa', 'Patrícia', 'Bianca', 'Kauan', 'Marcelo', 'Lívia', 'Igor', 'Camila', 'João', 'Vitória'];
const BASE_ADDRESS = 'Spetto House - R. Profa. Clotilde Pinheiro, 550 - São Jorge';
const BASE_LAT = -3.1120367;
const BASE_LNG = -60.0348224;
const PIN_HASH = '$2a$10$Tdo1DWTJT4Rp04hxUzkO..JhoFjeJzOlrFity2PM87XVzUWE.peC2';

function jitterCoordinate(value: number) {
  return Number((value + (Math.random() - 0.5) * 0.05).toFixed(6));
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chunk<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

function ensureCouriers(): Courier[] {
  const created: Courier[] = [];
  for (const name of COURIER_NAMES) {
    const phone = `+5591${Math.floor(900000000 + Math.random() * 99999)}`;
    const courier = createCourier(name, phone, PIN_HASH);
    courier.status = 'AVAILABLE';
    created.push(courier);
  }
  return created;
}

function setOrderStatus(order: Order, couriersPool: Courier[]) {
  const roll = Math.random();
  if (roll < 0.7) {
    const courier = randomFromArray(couriersPool);
    order.status = 'DELIVERED';
    order.courierId = courier.id;
  } else if (roll < 0.85) {
    const courier = randomFromArray(couriersPool);
    order.status = 'ON_ROUTE';
    order.courierId = courier.id;
  } else if (roll < 0.95) {
    order.status = 'QUEUED';
  } else {
    order.status = 'PENDING';
  }
}

function buildRoutesFromOrders(selected: Order[], status: Route['status'], requireCourier: boolean) {
  const batches = chunk(selected, 5);
  batches.forEach((batch) => {
    if (batch.length === 0) return;
    const courierId = requireCourier ? batch.find((order) => order.courierId)?.courierId : undefined;
    const route: Route = {
      id: randomUUID(),
      courierId,
      orderIds: batch.map((order) => order.id),
      status,
      createdAt: batch[0].createdAt,
      mapsUrl: 'https://maps.google.com',
      totalPrice: batch.reduce((sum, order) => sum + (order.deliveryPrice ?? 0), 0),
    };
    routes.push(route);
    batch.forEach((order) => {
      order.routeId = route.id;
    });
  });
}

async function seed() {
  orders.length = 0;
  routes.length = 0;
  couriers.length = 0;

  const couriersPool = ensureCouriers();
  const now = new Date();
  const dailySummary: { date: string; count: number }[] = [];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - dayOffset);
    dayStart.setHours(8, 0, 0, 0);
    const ordersPerDay = 110 + Math.floor(Math.random() * 30);
    const todaysOrders: Order[] = [];

    for (let i = 0; i < ordersPerDay; i += 1) {
      const order = createOrder(`${BASE_ADDRESS} · Cliente ${i + 1}`, jitterCoordinate(BASE_LAT), jitterCoordinate(BASE_LNG));
      const offsetMinutes = Math.floor(Math.random() * 12 * 60);
      const createdAt = new Date(dayStart.getTime() + offsetMinutes * 60 * 1000);
      order.createdAt = createdAt;
      order.deliveryPrice = Number((15 + Math.random() * 20).toFixed(2));
      setOrderStatus(order, couriersPool);
      todaysOrders.push(order);
    }

    buildRoutesFromOrders(todaysOrders.filter((order) => order.status === 'DELIVERED'), 'DONE', true);
    buildRoutesFromOrders(todaysOrders.filter((order) => order.status === 'ON_ROUTE'), 'IN_PROGRESS', true);
    buildRoutesFromOrders(todaysOrders.filter((order) => order.status === 'QUEUED'), 'AWAITING_COURIER', false);

    dailySummary.push({ date: dayStart.toLocaleDateString(), count: todaysOrders.length });
  }

  persistDB();
  console.log('[seed] Base resetada com sucesso.');
  dailySummary.forEach((entry) => {
    console.log(`[seed] ${entry.date}: ${entry.count} pedidos gerados.`);
  });
}

seed().catch((err) => {
  console.error('[seed] Falha ao gerar dados demo', err);
  process.exit(1);
});
