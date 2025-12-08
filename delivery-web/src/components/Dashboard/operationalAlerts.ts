import { Courier, Order } from '../../types';

const MIN_BATCH_TARGET = 2; // mantenha alinhado com routingConfig.minBatch
const MAX_WAIT_MINUTES = 25; // mantenha alinhado com routingConfig.maxWaitMinutes

export type AlertLevel = 'info' | 'warning' | 'danger';
export type AlertCategory = 'orders' | 'routes' | 'couriers';

export interface OperationalAlert {
  id: string;
  title: string;
  description: string;
  level: AlertLevel;
  category: AlertCategory;
}

function minutesSince(dateIso: string): number {
  const createdAt = new Date(dateIso).getTime();
  if (Number.isNaN(createdAt)) return 0;
  const diffMinutes = (Date.now() - createdAt) / 1000 / 60;
  return Math.max(0, Math.round(diffMinutes));
}

export function buildOperationalAlerts(orders: Order[], couriers: Courier[]): OperationalAlert[] {
  const pendingOrders = orders
    .filter((order) => order.status === 'PENDING')
    .map((order) => ({
      ...order,
      waitMinutes: minutesSince(order.createdAt),
    }))
    .sort((a, b) => a.waitMinutes - b.waitMinutes);

  const queuedOrders = orders
    .filter((order) => order.status === 'QUEUED')
    .map((order) => ({
      ...order,
      waitMinutes: minutesSince(order.createdAt),
    }))
    .sort((a, b) => b.waitMinutes - a.waitMinutes);

  const availableCouriers = couriers.filter((courier) => courier.status === 'AVAILABLE').length;
  const couriersWithRoute = couriers.filter((courier) => courier.status === 'ASSIGNED').length;

  const alerts: OperationalAlert[] = [];

  if (pendingOrders.length === 0) {
    alerts.push({
      id: 'no-pending',
      title: 'Nenhum pedido aguardando roteamento',
      description: queuedOrders.length > 0
        ? 'Todos os pedidos já estão agrupados aguardando atribuição.'
        : availableCouriers > 0
          ? 'Temos motoboys livres para novos pedidos.'
          : 'Assim que novos pedidos chegarem eles aparecem aqui.',
      level: 'info',
      category: 'orders',
    });
  } else {
    const oldest = pendingOrders[pendingOrders.length - 1];
    const overdueOrders = pendingOrders.filter((order) => order.waitMinutes >= MAX_WAIT_MINUTES);

    alerts.push({
      id: 'pending-count',
      title: `${pendingOrders.length} pedidos aguardando roteamento`,
      description: `Pedido mais antigo há ${oldest.waitMinutes} min. Lote ideal: ${MIN_BATCH_TARGET} pedidos.`,
      level: overdueOrders.length > 0 ? 'danger' : 'warning',
      category: 'orders',
    });

    if (overdueOrders.length > 0) {
      alerts.push({
        id: 'sla-risk',
        title: `${overdueOrders.length} pedidos prestes a estourar SLA`,
        description: `Aguarda há ${overdueOrders[0].waitMinutes}+ min (limite ${MAX_WAIT_MINUTES} min).`,
        level: 'danger',
        category: 'orders',
      });
    }

    if (availableCouriers === 0) {
      alerts.push({
        id: 'no-couriers',
        title: 'Nenhum motoboy disponível',
        description: 'Libere alguém para evitar fila de pedidos.',
        level: 'warning',
        category: 'couriers',
      });
    } else if (availableCouriers > 0 && pendingOrders.length < MIN_BATCH_TARGET) {
      alerts.push({
        id: 'waiting-batch',
        title: 'Aguardando completar o lote mínimo',
        description: `Precisamos de ${MIN_BATCH_TARGET} pedidos para roteamento automático. Restam ${Math.max(
          0,
          MIN_BATCH_TARGET - pendingOrders.length,
        )}.`,
        level: 'info',
        category: 'orders',
      });
    }
  }

  if (queuedOrders.length > 0) {
    const routesAwaiting = new Set(
      queuedOrders
        .map((order) => order.routeId)
        .filter((routeId): routeId is string => Boolean(routeId)),
    ).size;

    alerts.push({
      id: 'queued-orders',
      title: `${queuedOrders.length} pedidos aguardando motoboy`,
      description: routesAwaiting > 0
        ? `${routesAwaiting} rota${routesAwaiting > 1 ? 's' : ''} pronta(s) para atribuir.`
        : 'Existe ao menos um lote aguardando decisão.',
      level: availableCouriers > 0 ? 'warning' : 'danger',
      category: 'routes',
    });
  }

  if (couriersWithRoute > 0) {
    alerts.push({
      id: 'couriers-pending-start',
      title: `${couriersWithRoute} motoboy${couriersWithRoute > 1 ? 's' : ''} aguardando iniciar rota`,
      description: 'Confirme com eles ou inicie automaticamente pelo painel.',
      level: 'warning',
      category: 'couriers',
    });
  }

  return alerts;
}
