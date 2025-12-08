import { useCallback, useEffect, useMemo, useState } from 'react';
import { Courier, Route } from '../../types';
import { deleteRoute, fetchRoutes } from '../../api/client';
import { ORDER_STATUS_LABELS, ROUTE_STATUS_LABELS } from '../../utils/statusLabels';
import './settings.css';

interface Props {
  couriers: Courier[];
  onRefresh: () => Promise<void>;
}

const PAGE_SIZE = 20;

export default function AdminRoutes({ couriers, onRefresh }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [routesPage, setRoutesPage] = useState<Route[]>([]);

  const couriersById = useMemo(() => Object.fromEntries(couriers.map((c) => [c.id, c])), [couriers]);

  const loadRoutes = useCallback(async (nextPage = 0) => {
    setLoading(true);
    try {
      const result = await fetchRoutes({ limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE, includeOrders: true });
      const sorted = [...result.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRoutesPage(sorted);
      setTotal(result.total ?? sorted.length);
      setPage(nextPage);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar rotas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes(0);
  }, [loadRoutes]);

  const totalPages = Math.max(1, Math.ceil((total || routesPage.length) / PAGE_SIZE));

  const handleDelete = async (routeId: string) => {
    if (!confirm('Remover esta rota? Pedidos não entregues voltarão para a fila.')) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await deleteRoute(routeId, { force: true });
      setMessage('Rota removida.');
      await loadRoutes(page);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao remover rota');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel settings-panel">
      <header className="panel__header">
        <div>
          <h2>Rotas</h2>
          <p className="panel__subtitle">Visualize e remova rotas (inclusive finalizadas) em caso de inconsistência.</p>
        </div>
      </header>
      {error && <p className="settings-error">{error}</p>}
      {message && !error && <p className="settings-success">{message}</p>}

      <div className="settings-card">
        <header>
          <h3>🗺️ Rotas arquivadas/ativas</h3>
          <p className="panel__subtitle">Consulte qualquer rota e remova lotes em caso de inconsistência.</p>
        </header>

        <table className="data-table">
          <thead>
            <tr>
              <th>Rota</th>
              <th>Status</th>
              <th>Motoboy</th>
              <th>Pedidos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {routesPage.map((route) => {
              const courier = route.courierId ? couriersById[route.courierId] : null;
              return (
                <tr key={route.id}>
                  <td>
                    <p className="table-title">{route.id.slice(0, 6)}</p>
                    <p className="table-subtitle">{new Date(route.createdAt).toLocaleString()}</p>
                  </td>
                  <td>{ROUTE_STATUS_LABELS[route.status]}</td>
                  <td>{courier ? `${courier.name} · ${courier.phone}` : '---'}</td>
                  <td>
                    {route.orders && route.orders.length > 0 ? (
                      <ul>
                        {route.orders.map((order) => (
                          <li key={order.id}>
                            {order.address} · {ORDER_STATUS_LABELS[order.status]}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="table-subtitle">Sem pedidos</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="button"
                      type="button"
                      disabled={loading}
                      onClick={() => handleDelete(route.id)}
                    >
                      Remover rota
                    </button>
                  </td>
                </tr>
              );
            })}
            {routesPage.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="empty">
                  Nenhuma rota cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pagination-controls">
          <button type="button" className="button" onClick={() => loadRoutes(page - 1)} disabled={page === 0 || loading}>
            Página anterior
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button
            type="button"
            className="button"
            onClick={() => loadRoutes(page + 1)}
            disabled={loading || page + 1 >= totalPages}
          >
            Próxima página
          </button>
        </div>
      </div>
    </section>
  );
}
