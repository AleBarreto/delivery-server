import { Courier } from '../../types';
import './tables.css';

interface Props {
  couriers: Courier[];
  onMarkAvailable: (id: string) => Promise<void>;
  onSelectCourier: (courier: Courier) => void;
}

export default function CouriersTable({ couriers, onMarkAvailable, onSelectCourier }: Props) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>Couriers</h2>
          <p className="panel__subtitle">Clique para ver a rota atual ou marcar disponível.</p>
        </div>
      </header>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {couriers.map((courier) => (
              <tr key={courier.id} className="clickable-row" onClick={() => onSelectCourier(courier)}>
                <td>{courier.id}</td>
                <td>{courier.name}</td>
                <td>{courier.status}</td>
                <td>
                  <button
                    className="button button--primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAvailable(courier.id);
                    }}
                  >
                    Marcar disponível
                  </button>
                </td>
              </tr>
            ))}
            {couriers.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  Nenhum courier cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
