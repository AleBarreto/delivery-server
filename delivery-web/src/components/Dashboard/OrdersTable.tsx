import { useMemo, useState } from 'react';
import { Order, OrderStatus } from '../../types';
import './tables.css';

interface Props {
  orders: Order[];
}

const statusFilters: OrderStatus[] = ['PENDING', 'ON_ROUTE', 'DELIVERED'];

export default function OrdersTable({ orders }: Props) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>Pedidos</h2>
          <p className="panel__subtitle">Filtre por status para enxergar rapidamente o fluxo.</p>
        </div>
        <div className="filter-group">
          <button
            className={statusFilter === 'ALL' ? 'button button--primary' : 'button'}
            onClick={() => setStatusFilter('ALL')}
          >
            Todos
          </button>
          {statusFilters.map((status) => (
            <button
              key={status}
              className={statusFilter === status ? 'button button--primary' : 'button'}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </header>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Endereço</th>
              <th>Status</th>
              <th>Criado em</th>
              <th>Courier</th>
              <th>RouteId</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.address}</td>
                <td>{order.status}</td>
                <td>{new Date(order.createdAt).toLocaleString()}</td>
                <td>{order.courierId ?? '-'}</td>
                <td>{order.routeId ?? '-'}</td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
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
