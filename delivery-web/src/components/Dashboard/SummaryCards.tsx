import { Courier, Order, Route } from '../../types';
import { buildOperationalAlerts, OperationalAlert } from './operationalAlerts';
import './summaryCards.css';

type GroupKey = 'orders' | 'routes' | 'couriers' | 'finance';

interface Props {
  orders: Order[];
  couriers: Courier[];
  routes: Route[];
  onFocusRoutes?: () => void;
  onOpenManualRoute?: () => void;
}

function countOrders(orders: Order[], status?: Order['status']) {
  if (!status) return orders.length;
  return orders.filter((o) => o.status === status).length;
}

function countCouriers(couriers: Courier[], status?: Courier['status']) {
  if (!status) return couriers.length;
  return couriers.filter((c) => c.status === status).length;
}

function sumOrderValue(orders: Order[]) {
  return orders.reduce((total, order) => total + (order.deliveryPrice ?? 0), 0);
}

const alertBadgeLabel: Record<OperationalAlert['level'], string> = {
  info: 'Info',
  warning: 'Atenção',
  danger: 'Crítico',
};

export default function SummaryCards({
  orders,
  couriers,
  routes,
  onFocusRoutes,
  onOpenManualRoute,
}: Props) {
  const countRoutes = (status: Route['status']) => routes.filter((route) => route.status === status).length;
  const alerts = buildOperationalAlerts(orders, couriers);

  const groups: Array<{
    key: GroupKey;
    title: string;
    icon: string;
    cards: { label: string; value: string | number }[];
    actions?: { label: string; icon: string; handler: () => void }[];
  }> = [
    {
      key: 'orders',
      title: 'Pedidos',
      icon: '📦',
      cards: [
        { label: 'Na fila', value: countOrders(orders, 'PENDING') },
        { label: 'Agrupados', value: countOrders(orders, 'QUEUED') },
        { label: 'Em rota', value: countOrders(orders, 'ON_ROUTE') },
        { label: 'Entregues', value: countOrders(orders, 'DELIVERED') },
      ],
    },
    {
      key: 'routes',
      title: 'Rotas',
      icon: '🛣️',
      cards: [
        { label: 'Aguardando motoboy', value: countRoutes('AWAITING_COURIER') },
        { label: 'Confirmadas', value: countRoutes('ASSIGNED') },
        { label: 'Na rua agora', value: countRoutes('IN_PROGRESS') },
      ],
      actions: [
        onFocusRoutes && { label: 'Ver rotas ativas', icon: '👀', handler: onFocusRoutes },
        onOpenManualRoute && { label: 'Criar rota manual', icon: '🆕', handler: onOpenManualRoute },
      ].filter((action): action is { label: string; icon: string; handler: () => void } => Boolean(action)),
    },
    {
      key: 'couriers',
      title: 'Motoboys',
      icon: '🛵',
      cards: [
        { label: 'Offline', value: countCouriers(couriers, 'OFFLINE') },
        { label: 'Disponíveis', value: countCouriers(couriers, 'AVAILABLE') },
        { label: 'Aguardando rota', value: countCouriers(couriers, 'ASSIGNED') },
        { label: 'Em rota', value: countCouriers(couriers, 'ON_TRIP') },
      ],
    },
    {
      key: 'finance',
      title: 'Financeiro',
      icon: '💰',
      cards: [{ label: 'Valor previsto', value: `R$ ${sumOrderValue(orders).toFixed(2)}` }],
    },
  ];

  return (
    <div className="summary-sections">
      {groups.map((group) => {
        const groupAlerts = alerts.filter((alert) => alert.category === group.key);
        return (
          <section key={group.key} className="summary-section">
            <header className="summary-section__header">
              <span aria-hidden>{group.icon}</span>
              <h3>{group.title}</h3>
            </header>
            <div className="summary-grid">
              {group.cards.map((card) => (
                <div key={card.label} className="summary-card">
                  <p className="summary-card__label">{card.label}</p>
                  <p className="summary-card__value">{card.value}</p>
                </div>
              ))}
            </div>

            {groupAlerts.length > 0 && (
              <ul className="summary-alerts">
                {groupAlerts.map((alert) => (
                  <li key={alert.id} className={`summary-alert summary-alert--${alert.level}`}>
                    <span className="summary-alert__badge">{alertBadgeLabel[alert.level]}</span>
                    <div>
                      <p className="summary-alert__title">{alert.title}</p>
                      <p className="summary-alert__description">{alert.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {group.actions && group.actions.length > 0 && (
              <div className="summary-actions">
                {group.actions.map((action) => (
                  <button key={action.label} type="button" className="summary-actions__button" onClick={action.handler}>
                    <span aria-hidden>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
