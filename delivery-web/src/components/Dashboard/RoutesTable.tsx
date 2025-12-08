import { useMemo, useState } from 'react';
import { Courier, Order, Route } from '../../types';
import { formatDate, formatShortId, formatTime } from '../../utils/format';
import { ROUTE_STATUS_LABELS } from '../../utils/statusLabels';
import './tables.css';

interface Props {
  routes: Route[];
  couriers: Courier[];
  orders: Order[];
  onSelectRoute: (route: Route) => void;
}

export default function RoutesTable({ routes, couriers, orders, onSelectRoute }: Props) {
  const [statusFilter, setStatusFilter] = useState<Route['status'] | 'ALL'>('ALL');
  const couriersById = useMemo(() => Object.fromEntries(couriers.map((courier) => [courier.id, courier])), [couriers]);
  const ordersById = useMemo(() => Object.fromEntries(orders.map((order) => [order.id, order])), [orders]);
  const routeCountByStatus = useMemo(() => {
    const counts: Record<Route['status'], number> = {
      AWAITING_COURIER: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    };
    routes.forEach((route) => {
      counts[route.status] += 1;
    });
    return counts;
  }, [routes]);

  const routeChips = [
    {
      status: 'AWAITING_COURIER' as const,
      label: 'Aguardando motoboy',
      hint: 'Prontas para atribuir',
      icon: '🛵',
      count: routeCountByStatus.AWAITING_COURIER,
    },
    {
      status: 'ASSIGNED' as const,
      label: 'Confirmadas',
      hint: 'Aguardando início',
      icon: '⏱️',
      count: routeCountByStatus.ASSIGNED,
    },
    {
      status: 'IN_PROGRESS' as const,
      label: 'Em execução',
      hint: 'Na rua agora',
      icon: '📍',
      count: routeCountByStatus.IN_PROGRESS,
    },
    {
      status: 'DONE' as const,
      label: 'Finalizadas',
      hint: 'Últimas 24h',
      icon: '✅',
      count: routeCountByStatus.DONE,
    },
  ];

  const filteredRoutes = useMemo(() => {
    if (statusFilter === 'ALL') return routes;
    return routes.filter((route) => route.status === statusFilter);
  }, [routes, statusFilter]);

  const currentFilterLabel =
    statusFilter === 'ALL' ? null : routeChips.find((chip) => chip.status === statusFilter)?.label;

  return (
    <section className="panel panel--routes">
      <header className="panel__header">
        <div>
          <h2>Rotas</h2>
          <p className="panel__subtitle">Acompanhe o ciclo de vida das rotas.</p>
        </div>
      </header>

      <div className="chip-grid">
        {routeChips.map((chip) => (
          <button
            key={chip.status}
            className={`chip-button chip-button--${chip.status.toLowerCase()}${
              statusFilter === chip.status ? ' chip-button--active' : ''
            }`}
            onClick={() => setStatusFilter((prev) => (prev === chip.status ? 'ALL' : chip.status))}
            type="button"
          >
            <span className="chip-button__icon" aria-hidden>
              {chip.icon}
            </span>
            <div>
              <p className="chip-button__value">{chip.count}</p>
              <p className="chip-button__label">{chip.label}</p>
              <p className="chip-button__hint">{chip.hint}</p>
            </div>
          </button>
        ))}
      </div>
      {currentFilterLabel && (
        <div className="chip-filter-hint">
          <span>Filtrando por: {currentFilterLabel}</span>
          <button type="button" onClick={() => setStatusFilter('ALL')}>
            Limpar filtro
          </button>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table routes-table">
          <thead>
            <tr>
              <th>Rota</th>
              <th>Motoboy</th>
              <th>Status</th>
              <th>Valor estimado</th>
              <th>Criada em</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.map((route) => (
              <tr key={route.id} className="clickable-row" onClick={() => onSelectRoute(route)}>
                <td>
                  <p className="table-title">Rota {formatShortId(route.id)}</p>
                  <p className="table-subtitle">{route.orderIds.length} paradas</p>
                </td>
                <td>
                  <p className="table-title">
                    {route.courierId ? couriersById[route.courierId]?.name ?? 'Motoboy desconhecido' : 'Não atribuído'}
                  </p>
                  <p className="table-subtitle">
                    {route.courierId ? couriersById[route.courierId]?.phone ?? '' : 'Aguardando decisão'}
                  </p>
                </td>
                <td>
                  <span className={`status-pill status-pill--route-${route.status.toLowerCase()}`}>
                    {ROUTE_STATUS_LABELS[route.status]}
                  </span>
                  <p className="table-subtitle">
                    {
                      `${
                        route.orderIds.filter((id) => ordersById[id]?.status === 'DELIVERED').length
                      } / ${route.orderIds.length} entregues`
                    }
                  </p>
                </td>
                <td>
                  {route.totalPrice !== undefined ? (
                    <p className="table-title">R$ {route.totalPrice.toFixed(2)}</p>
                  ) : (
                    <p className="table-subtitle">-</p>
                  )}
                </td>
                <td>
                  <p className="table-title">{formatTime(route.createdAt)}</p>
                  <p className="table-subtitle">{formatDate(route.createdAt)}</p>
                </td>
              </tr>
            ))}
            {filteredRoutes.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {statusFilter === 'ALL' ? 'Nenhuma rota criada ainda.' : 'Nenhuma rota nesse status agora.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
