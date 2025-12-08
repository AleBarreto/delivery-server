import { useMemo, useState } from 'react';
import { Courier, Order, OrderStatus } from '../../types';
import { formatDate, formatShortId, formatTime } from '../../utils/format';
import './tables.css';

interface Props {
  orders: Order[];
  couriers: Courier[];
}

type FilterValue = OrderStatus | 'ALL';

const statusFilters: { value: FilterValue; label: string; icon: string }[] = [
  { value: 'ALL', label: 'Todos', icon: '📋' },
  { value: 'PENDING', label: 'Na fila', icon: '⏳' },
  { value: 'QUEUED', label: 'Agrupados', icon: '🧺' },
  { value: 'ON_ROUTE', label: 'Em rota', icon: '🛵' },
  { value: 'DELIVERED', label: 'Entregue', icon: '✅' },
];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Na fila',
  QUEUED: 'Agrupado',
  ON_ROUTE: 'Em rota',
  DELIVERED: 'Entregue',
};

export default function OrdersTable({ orders, couriers }: Props) {
  const [statusFilter, setStatusFilter] = useState<FilterValue>('ALL');

  const couriersById = useMemo(() => Object.fromEntries(couriers.map((courier) => [courier.id, courier])), [couriers]);

  const orderStatusCounts = useMemo(() => {
    const counts: Record<FilterValue, number> = {
      ALL: orders.length,
      PENDING: 0,
      QUEUED: 0,
      ON_ROUTE: 0,
      DELIVERED: 0,
    };
    orders.forEach((order) => {
      counts[order.status] += 1;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>Pedidos</h2>
          <p className="panel__subtitle">Use os filtros rápidos para focar apenas no que importa agora.</p>
        </div>
      </header>
      <div className="chip-grid chip-grid--filters orders-filters">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`chip-button chip-button--filter${
              statusFilter === filter.value ? ' chip-button--active' : ''
            }`}
            onClick={() => setStatusFilter(filter.value)}
          >
            <span className="chip-button__icon" aria-hidden>
              {filter.icon}
            </span>
            <div>
              <p className="chip-button__value">{orderStatusCounts[filter.value]}</p>
              <p className="chip-button__label">{filter.label}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Status</th>
              <th>Entregador</th>
              <th>Valor</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <p className="table-title">{order.address}</p>
                  <p className="table-subtitle">Pedido {formatShortId(order.id)}</p>
                </td>
                <td>
                  <span className={`status-pill status-pill--${order.status.toLowerCase()}`}>
                    {statusLabels[order.status]}
                  </span>
                  {order.routeId && <p className="table-subtitle">Rota {formatShortId(order.routeId)}</p>}
                </td>
                <td>
                  {order.courierId ? (
                    <>
                      <p className="table-title">{couriersById[order.courierId]?.name ?? 'Atribuído'}</p>
                      <p className="table-subtitle">Telefone: {couriersById[order.courierId]?.phone ?? '-'}</p>
                    </>
                  ) : (
                    <p className="table-subtitle">Aguardando motoboy</p>
                  )}
                </td>
                <td>
                  <p className="table-title">
                    {order.deliveryPrice !== undefined ? `R$ ${order.deliveryPrice.toFixed(2)}` : '-'}
                  </p>
                  {order.pricingRule && (
                    <p className="table-subtitle">
                      {order.pricingRule.type === 'ZONE' ? 'Zona' : 'Distância'} · {order.pricingRule.label}
                    </p>
                  )}
                </td>
                <td>
                  <p className="table-title">{formatTime(order.createdAt)}</p>
                  <p className="table-subtitle">{formatDate(order.createdAt)}</p>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Nenhum pedido para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
