import { useMemo } from 'react';
import { Courier } from '../../types';
import { COURIER_STATUS_LABELS } from '../../utils/statusLabels';
import './tables.css';

interface Props {
  couriers: Courier[];
  onSelectCourier: (courier: Courier) => void;
}

export default function CouriersTable({ couriers, onSelectCourier }: Props) {
  const counts = useMemo(() => {
    const base = {
      OFFLINE: 0,
      AVAILABLE: 0,
      ASSIGNED: 0,
      ON_TRIP: 0,
    };
    couriers.forEach((courier) => {
      base[courier.status] += 1;
    });
    return base;
  }, [couriers]);

  const summary = [
    { status: 'AVAILABLE' as const, label: 'Prontos para rota', hint: 'Aguardando pedidos', icon: '✅' },
    { status: 'ASSIGNED' as const, label: 'Rotas pendentes', hint: 'Esperando iniciar', icon: '🛵' },
    { status: 'ON_TRIP' as const, label: 'Em rota', hint: 'Na rua agora', icon: '📍' },
    { status: 'OFFLINE' as const, label: 'Offline', hint: 'Precisam ativar disponibilidade', icon: '🛠️' },
  ].map((item) => ({
    ...item,
    count: counts[item.status],
  }));

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>Motoboys</h2>
          <p className="panel__subtitle">Painel rápido de disponibilidade e status de rota.</p>
        </div>
      </header>

      <div className="chip-grid couriers-summary">
        {summary.map((item) => (
          <div key={item.status} className={`chip-button couriers-summary__chip couriers-summary__chip--${item.status.toLowerCase()}`}>
            <span className="chip-button__icon" aria-hidden>
              {item.icon}
            </span>
            <div>
              <p className="chip-button__value">{item.count}</p>
              <p className="chip-button__label">{item.label}</p>
              <p className="chip-button__hint">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Motoboy</th>
              <th>Contato</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {couriers.map((courier) => (
              <tr key={courier.id} className="clickable-row" onClick={() => onSelectCourier(courier)}>
                <td>
                  <p className="table-title">{courier.name}</p>
                  <p className="table-subtitle">ID interno: {courier.id.slice(0, 6).toUpperCase()}</p>
                </td>
                <td>
                  <p className="table-title">{courier.phone}</p>
                  <p className="table-subtitle">Login no app do motoboy</p>
                </td>
                <td>
                  <span className={`status-pill status-pill--${courier.status.toLowerCase()}`}>
                    {COURIER_STATUS_LABELS[courier.status]}
                  </span>
                  <p className="table-subtitle couriers-table__status-hint">
                    {courier.status === 'AVAILABLE' && 'Pode receber nova rota imediatamente.'}
                    {courier.status === 'ASSIGNED' && 'Existe uma rota aguardando ele iniciar.'}
                    {courier.status === 'ON_TRIP' && 'Entregas em andamento, acompanhe pela aba Rotas.'}
                    {courier.status === 'OFFLINE' && 'Aguardando login/disponibilidade no app.'}
                  </p>
                </td>
                <td>
                  {courier.status === 'OFFLINE' ? (
                    <p className="table-subtitle">O próprio motoboy ativa a disponibilidade pelo app.</p>
                  ) : (
                    <div>
                      <p className="table-subtitle">
                        {courier.status === 'AVAILABLE' && 'Sistema já sabe que ele está pronto.'}
                        {courier.status === 'ASSIGNED' && 'Aguardando o motoboy iniciar a rota pelo app.'}
                        {courier.status === 'ON_TRIP' && 'Finalize a rota atual para liberar novas entregas.'}
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {couriers.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  Nenhum motoboy cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
