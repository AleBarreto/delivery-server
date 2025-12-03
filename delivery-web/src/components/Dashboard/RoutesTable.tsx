import { Route } from '../../types';
import './tables.css';

interface Props {
  routes: Route[];
  onSelectRoute: (route: Route) => void;
}

export default function RoutesTable({ routes, onSelectRoute }: Props) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>Rotas</h2>
          <p className="panel__subtitle">Acompanhe o ciclo de vida das rotas.</p>
        </div>
      </header>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Courier</th>
              <th>Status</th>
              <th>Criada em</th>
              <th># Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id} className="clickable-row" onClick={() => onSelectRoute(route)}>
                <td>{route.id}</td>
                <td>{route.courierId}</td>
                <td>{route.status}</td>
                <td>{new Date(route.createdAt).toLocaleString()}</td>
                <td>{route.orderIds.length}</td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Nenhuma rota criada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
