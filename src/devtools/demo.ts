import bcrypt from 'bcryptjs';
import { createOrder } from '../orderService';
import { couriers, orders, persistDB, routes } from '../db';
import { createCourier, setCourierAvailable } from '../courierService';
import { generateRoutesFromPending } from '../scheduler';
import { assignRouteToCourier, getCourierActiveRoute, refreshRouteProgress } from '../routeService';
import { Order, Route } from '../types';

async function ensureDemoCourier() {
  const demoPhone = '+5591999990000';
  let courier = couriers.find(c => c.phone === demoPhone);

  if (!courier) {
    const pinHash = await bcrypt.hash('1234', 10);
    courier = createCourier('Motoboy Demo', demoPhone, pinHash);
    console.log(`[demo] Motoboy demo criado (${courier.phone}). PIN: 1234`);
  }

  const activeRoute = getCourierActiveRoute(courier.id);
  if (activeRoute) {
    activeRoute.orderIds.forEach(orderId => {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.status = 'DELIVERED';
      }
    });
    refreshRouteProgress(activeRoute);
    console.log(`[demo] Finalizando rota pendente ${activeRoute.id} para liberar o motoboy demo.`);
  }

  if (courier.status !== 'AVAILABLE') {
    setCourierAvailable(courier.id);
  }

  return courier;
}

function describeOrders(title: string, list: Order[]) {
  console.log(`\n${title}`);
  const grouped = list.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});
  Object.entries(grouped).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });
}

function describeRoutes(title: string, list: Route[]) {
  console.log(`\n${title}`);
  list.forEach(route => {
    console.log(
      `  - ${route.id} :: status=${route.status} :: pedidos=${route.orderIds.length} :: courier=${route.courierId ?? '---'}`
    );
  });
}

async function seedOrders() {
  const sampleOrders = [
    { address: 'Rua das Flores, 10', lat: -3.1201, lng: -60.0212 },
    { address: 'Av. Brasil, 255', lat: -3.1185, lng: -60.019 },
    { address: 'Rua Afonso Pena, 350', lat: -3.1195, lng: -60.024 },
    { address: 'Rua do Comércio, 500', lat: -3.121, lng: -60.02 }
  ];

  for (const sample of sampleOrders) {
    const order = createOrder(sample.address, sample.lat, sample.lng);
    console.log(`[demo] Pedido ${order.id} criado para ${order.address}`);
  }
}

async function runDemo() {
  console.log('=== Demo: agrupamento e atribuição manual de rotas ===');
  const courier = await ensureDemoCourier();

  await seedOrders();
  generateRoutesFromPending();

  describeOrders('Resumo dos pedidos', orders);

  const awaitingRoutes = routes.filter(route => route.status === 'AWAITING_COURIER');
  describeRoutes('Rotas aguardando motoboy', awaitingRoutes);

  if (awaitingRoutes.length > 0) {
    const targetRoute = awaitingRoutes[0];
    console.log(`\n[demo] Atribuindo rota ${targetRoute.id} para ${courier.name}`);
    assignRouteToCourier(targetRoute.id, courier.id);
  }

  const activeRoutes = routes.filter(route => route.status !== 'DONE');
  describeRoutes('Estado final das rotas', activeRoutes);
  describeOrders('Estado final dos pedidos', orders);

  persistDB();
  console.log('\n[demo] Finalizado. Confira os dados no painel / endpoints de debug.');
}

runDemo().catch(err => {
  console.error('[demo] Falha ao executar simulação', err);
  process.exit(1);
});
