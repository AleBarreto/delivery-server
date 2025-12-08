import { orders, couriers } from './db';
import { Order } from './types';

interface OrdersReportFilters {
  from?: Date;
  to?: Date;
}

interface OrdersReportByDay {
  date: string;
  count: number;
  delivered: number;
  totalValue: number;
}

interface CourierStat {
  courierId: string;
  courierName: string | null;
  count: number;
}

export function getOrdersReport(filters: OrdersReportFilters) {
  const { from, to } = filters;
  const filtered = orders.filter(order => {
    const created = order.createdAt.getTime();
    if (from && created < from.getTime()) return false;
    if (to && created > to.getTime()) return false;
    return true;
  });

  const perDay = new Map<string, OrdersReportByDay>();
  const courierStats = new Map<string, CourierStat>();

  const totals = filtered.reduce(
    (acc, order) => {
      acc.count += 1;
      acc.byStatus[order.status] = (acc.byStatus[order.status] ?? 0) + 1;
      acc.totalValue += order.deliveryPrice ?? 0;

      if (order.courierId) {
        acc.byCourier[order.courierId] = (acc.byCourier[order.courierId] ?? 0) + 1;

        if (!courierStats.has(order.courierId)) {
          const courierName = couriers.find(c => c.id === order.courierId)?.name ?? null;
          courierStats.set(order.courierId, {
            courierId: order.courierId,
            courierName,
            count: 0
          });
        }
        const stats = courierStats.get(order.courierId);
        if (stats) {
          stats.count += 1;
        }
      }

      const dateKey = order.createdAt.toISOString().slice(0, 10);
      if (!perDay.has(dateKey)) {
        perDay.set(dateKey, { date: dateKey, count: 0, delivered: 0, totalValue: 0 });
      }
      const daily = perDay.get(dateKey)!;
      daily.count += 1;
      daily.totalValue += order.deliveryPrice ?? 0;
      if (order.status === 'DELIVERED') {
        daily.delivered += 1;
      }
      return acc;
    },
    {
      count: 0,
      totalValue: 0,
      byStatus: {} as Record<Order['status'], number>,
      byCourier: {} as Record<string, number>
    }
  );

  const enriched = filtered.map(order => ({
    ...order,
    courierName: order.courierId ? couriers.find(c => c.id === order.courierId)?.name ?? null : null
  }));

  const deliveredCount = totals.byStatus.DELIVERED ?? 0;
  const averageValue = totals.count > 0 ? totals.totalValue / totals.count : 0;
  const deliveredRate = totals.count > 0 ? deliveredCount / totals.count : 0;

  return {
    orders: enriched,
    totals: {
      ...totals,
      deliveredCount,
      deliveredRate,
      averageValue
    },
    byDay: Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    courierStats: Array.from(courierStats.values()).sort((a, b) => b.count - a.count)
  };
}
