import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Courier, Order } from '../../types';
import { updateOrder, deleteOrder, createOrder, fetchOrders } from '../../api/client';
import { ORDER_STATUS_LABELS } from '../../utils/statusLabels';
import './settings.css';

interface Props {
  couriers: Courier[];
  onRefresh: () => Promise<void>;
}

const PAGE_SIZE = 25;

const statusOptions: { value: Order['status']; label: string }[] = [
  { value: 'PENDING', label: ORDER_STATUS_LABELS.PENDING },
  { value: 'QUEUED', label: ORDER_STATUS_LABELS.QUEUED },
  { value: 'ON_ROUTE', label: ORDER_STATUS_LABELS.ON_ROUTE },
  { value: 'DELIVERED', label: ORDER_STATUS_LABELS.DELIVERED },
];

export default function AdminOrders({ couriers, onRefresh }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState({ address: '', lat: '', lng: '', status: 'PENDING' });
  const [createAddress, setCreateAddress] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [pagedOrders, setPagedOrders] = useState<Order[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const couriersById = useMemo(() => Object.fromEntries(couriers.map((courier) => [courier.id, courier])), [couriers]);

  const loadPage = useCallback(async (nextPage = 0) => {
    setListLoading(true);
    try {
      const result = await fetchOrders({ limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
      const sorted = [...result.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setPagedOrders(sorted);
      setTotal(result.total ?? sorted.length);
      setPage(nextPage);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil((total || pagedOrders.length) / PAGE_SIZE));

  const startEdit = (order: Order) => {
    setEditingId(order.id);
    setFormState({
      address: order.address,
      lat: String(order.lat),
      lng: String(order.lng),
      status: order.status,
    });
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setMessage(null);
    setError(null);
    try {
      await updateOrder(editingId, {
        address: formState.address,
        lat: Number(formState.lat),
        lng: Number(formState.lng),
        status: formState.status as Order['status'],
      });
      setMessage('Pedido atualizado.');
      setEditingId(null);
      await loadPage(page);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar pedido');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este pedido?')) return;
    try {
      await deleteOrder(id, { force: true });
      setMessage('Pedido removido.');
      await loadPage(page);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao remover pedido');
    }
  };

  const handleCreateOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createAddress.trim()) {
      setError('Informe ao menos o endereço completo ou rua/número.');
      return;
    }
    setCreatingOrder(true);
    setMessage(null);
    setError(null);
    try {
      await createOrder({
        address: createAddress.trim(),
        city: 'Manaus',
        state: 'Amazonas',
      });
      setMessage('Pedido criado e enviado para a fila.');
      setCreateAddress('');
      await loadPage(0);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido');
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <section className="panel settings-panel">
      <header className="panel__header">
        <div>
          <h2>Pedidos</h2>
          <p className="panel__subtitle">Edite endereços, coordenadas ou status em caso de correção.</p>
        </div>
      </header>

      {error && <p className="settings-error">{error}</p>}
      {message && !error && <p className="settings-success">{message}</p>}

      <div className="settings-card">
        <header>
          <h3>🆕 Criar pedido manual</h3>
          <p className="panel__subtitle">
            Digite o endereço completo; adicionamos automaticamente “Manaus - AM - Brasil” e buscamos a localização no Google.
          </p>
        </header>
        <form className="settings-form" onSubmit={handleCreateOrder}>
          <label>
            Endereço completo
            <input
              type="text"
              placeholder="Ex.: Av. Ramos Ferreira, 199, Aparecida"
              value={createAddress}
              onChange={(event) => setCreateAddress(event.target.value)}
              required
            />
          </label>
          <button className="button button--primary" type="submit" disabled={creatingOrder}>
            {creatingOrder ? 'Criando...' : 'Criar pedido'}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <header>
          <h3>✏️ Editar pedidos existentes</h3>
          <p className="panel__subtitle">Atualize endereço, coordenadas ou status para corrigir problemas.</p>
        </header>

        <table className="data-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Status</th>
              <th>Motoboy</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagedOrders.map((order) => {
              const isEditing = editingId === order.id;
              return (
                <tr key={order.id}>
                  <td>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={formState.address}
                          onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                          style={{ marginBottom: 6 }}
                        />
                        <div className="settings-grid">
                          <input
                            type="number"
                            value={formState.lat}
                            onChange={(event) => setFormState((prev) => ({ ...prev, lat: event.target.value }))}
                            step="0.000001"
                          />
                          <input
                            type="number"
                            value={formState.lng}
                            onChange={(event) => setFormState((prev) => ({ ...prev, lng: event.target.value }))}
                            step="0.000001"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="table-title">{order.address}</p>
                        <p className="table-subtitle">{new Date(order.createdAt).toLocaleString()}</p>
                      </>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={formState.status}
                        onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`status-pill status-pill--${order.status.toLowerCase()}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    )}
                  </td>
                  <td>{order.courierId ? couriersById[order.courierId]?.name ?? order.courierId : '---'}</td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button button--primary" type="button" onClick={handleSave}>
                          Salvar
                        </button>
                        <button className="button" type="button" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button" type="button" onClick={() => startEdit(order)}>
                          Editar
                        </button>
                        <button className="button" type="button" onClick={() => handleDelete(order.id)}>
                          Remover
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {pagedOrders.length === 0 && !listLoading && (
              <tr>
                <td colSpan={4} className="empty">
                  Nenhum pedido para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pagination-controls">
          <button type="button" className="button" onClick={() => loadPage(page - 1)} disabled={page === 0 || listLoading}>
            Página anterior
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button
            type="button"
            className="button"
            onClick={() => loadPage(page + 1)}
            disabled={listLoading || page + 1 >= totalPages}
          >
            Próxima página
          </button>
        </div>
      </div>
    </section>
  );
}
