import { Courier, Order, Route } from '../../types';
import './summaryCards.css';

interface Props {
  orders: Order[];
  couriers: Courier[];
  routes: Route[];
}

function countOrders(orders: Order[], status?: Order['status']) {
  if (!status) return orders.length;
  return orders.filter((o) => o.status === status).length;
}

function countCouriers(couriers: Courier[], status?: Courier['status']) {
  if (!status) return couriers.length;
  return couriers.filter((c) => c.status === status).length;
}

function countActiveRoutes(routes: Route[]) {
  return routes.filter((r) => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS').length;
}

export default function SummaryCards({ orders, couriers, routes }: Props) {
  const cards = [
    { label: 'Total de pedidos', value: countOrders(orders) },
    { label: 'Pedidos PENDING', value: countOrders(orders, 'PENDING') },
    { label: 'Pedidos ON_ROUTE', value: countOrders(orders, 'ON_ROUTE') },
    { label: 'Pedidos DELIVERED', value: countOrders(orders, 'DELIVERED') },
    { label: 'Couriers AVAILABLE', value: countCouriers(couriers, 'AVAILABLE') },
    { label: 'Couriers ON_TRIP', value: countCouriers(couriers, 'ON_TRIP') },
    { label: 'Rotas ativas', value: countActiveRoutes(routes) },
  ];

  return (
    <div className="summary-grid">
      {cards.map((card) => (
        <div key={card.label} className="summary-card">
          <p className="summary-card__label">{card.label}</p>
          <p className="summary-card__value">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
