import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Courier } from '../../types';
import { createCourier as apiCreateCourier, updateCourier, deleteCourier, fetchCouriers } from '../../api/client';
import { COURIER_STATUS_LABELS } from '../../utils/statusLabels';
import './settings.css';

interface Props {
  couriers: Courier[];
  onRefresh: () => Promise<void>;
}

const PAGE_SIZE = 25;

export default function AdminCouriers({ couriers, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', pin: '' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', pin: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagedCouriers, setPagedCouriers] = useState<Courier[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const loadPage = useCallback(async (nextPage = 0) => {
    setListLoading(true);
    try {
      const result = await fetchCouriers({ limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
      const sorted = [...result.data].sort((a, b) => a.name.localeCompare(b.name));
      setPagedCouriers(sorted);
      setTotal(result.total ?? sorted.length);
      setPage(nextPage);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar motoboys');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil((total || pagedCouriers.length) / PAGE_SIZE));

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!createForm.name || !createForm.phone || !createForm.pin) return;
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      await apiCreateCourier(createForm.name.trim(), createForm.phone.trim(), createForm.pin.trim());
      setCreateForm({ name: '', phone: '', pin: '' });
      setMessage('Motoboy criado com sucesso.');
      await loadPage(0);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao criar motoboy');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (courier: Courier) => {
    setEditId(courier.id);
    setEditForm({ name: courier.name, phone: courier.phone, pin: '' });
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editId) return;
    try {
      await updateCourier(editId, {
        name: editForm.name,
        phone: editForm.phone,
        pin: editForm.pin || undefined,
      });
      setMessage('Motoboy atualizado.');
      setEditId(null);
      await loadPage(page);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar motoboy');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este motoboy?')) return;
    try {
      await deleteCourier(id);
      setMessage('Motoboy removido.');
      await loadPage(page);
      await onRefresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao remover motoboy');
    }
  };

  const sortedCouriers = useMemo(() => pagedCouriers, [pagedCouriers]);

  return (
    <section className="panel settings-panel">
      <header className="panel__header">
        <div>
          <h2>Motoboys</h2>
          <p className="panel__subtitle">Gerencie cadastros e dados de contato.</p>
        </div>
      </header>

      {error && <p className="settings-error">{error}</p>}
      {message && !error && <p className="settings-success">{message}</p>}

      <div className="settings-card">
        <header>
          <h3>🆕 Novo motoboy</h3>
          <p className="panel__subtitle">Cadastre nome, telefone e PIN usado no app.</p>
        </header>

        <form className="settings-form" onSubmit={handleCreate}>
          <div className="settings-grid">
            <label>
              Nome
              <input
                type="text"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Telefone
              <input
                type="text"
                value={createForm.phone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                required
              />
            </label>
            <label>
              PIN
              <input
                type="text"
                value={createForm.pin}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, pin: event.target.value }))}
                required
              />
            </label>
          </div>
          <button className="button button--primary" type="submit" disabled={creating}>
            {creating ? 'Salvando...' : 'Criar motoboy'}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <header>
          <h3>📋 Motoboys cadastrados</h3>
          <p className="panel__subtitle">Edite dados ou remova cadastros quando necessário.</p>
        </header>

        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedCouriers.map((courier) => {
              const isEditing = editId === courier.id;
              return (
                <tr key={courier.id}>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    ) : (
                      courier.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    ) : (
                      courier.phone
                    )}
                  </td>
                  <td>
                    <span className={`status-pill status-pill--${courier.status.toLowerCase()}`}>
                      {COURIER_STATUS_LABELS[courier.status]}
                    </span>
                  </td>
                  <td>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          placeholder="Novo PIN"
                          value={editForm.pin}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, pin: event.target.value }))}
                          style={{ marginBottom: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="button button--primary" type="button" onClick={handleSave}>
                            Salvar
                          </button>
                          <button className="button" type="button" onClick={() => setEditId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="button" type="button" onClick={() => handleEdit(courier)}>
                          Editar
                        </button>
                        <button className="button" type="button" onClick={() => handleDelete(courier.id)}>
                          Remover
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedCouriers.length === 0 && !listLoading && (
              <tr>
                <td colSpan={4} className="empty">
                  Nenhum motoboy cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pagination-controls">
          <button type="button" className="button" onClick={() => loadPage(page - 1)} disabled={page === 0 || listLoading}>
            Página anterior
          </button>
          <span>Página {page + 1} de {Math.max(1, totalPages)}</span>
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
