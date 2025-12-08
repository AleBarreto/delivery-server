import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminUser } from '../../types';
import {
  fetchAdmins,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
} from '../../api/client';

interface Props {
  currentAdmin: AdminUser | null;
  onSelfUpdate?: (admin: AdminUser) => void;
}

export default function AdminUsers({ currentAdmin, onSelfUpdate }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' });

  const sortedAdmins = useMemo(() => [...admins].sort((a, b) => a.name.localeCompare(b.name)), [admins]);

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdmins();
      setAdmins(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar administradores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) return;
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      await createAdminAccount(createForm.name.trim(), createForm.email.trim(), createForm.password.trim());
      setMessage('Administrador criado com sucesso.');
      setCreateForm({ name: '', email: '', password: '' });
      await loadAdmins();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao criar administrador');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (admin: AdminUser) => {
    setEditId(admin.id);
    setEditForm({ name: admin.name, email: admin.email, password: '' });
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editId) return;
    setSavingEdit(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateAdminAccount(editId, {
        name: editForm.name,
        email: editForm.email,
        password: editForm.password || undefined,
      });
      setMessage('Administrador atualizado.');
      setEditId(null);
      setEditForm({ name: '', email: '', password: '' });
      if (currentAdmin?.id === updated.id && onSelfUpdate) {
        onSelfUpdate(updated);
      }
      await loadAdmins();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar administrador');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (admins.length <= 1) {
      setError('É necessário manter pelo menos um administrador cadastrado.');
      return;
    }
    if (!confirm('Deseja remover este administrador?')) return;
    setMessage(null);
    setError(null);
    try {
      await deleteAdminAccount(id);
      setMessage('Administrador removido.');
      await loadAdmins();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao remover administrador');
    }
  };

  const disableDelete = (admin: AdminUser) => admins.length <= 1 || admin.id === currentAdmin?.id;

  return (
    <section className="panel settings-panel">
      <header className="panel__header">
        <div>
          <h2>Administradores</h2>
          <p className="panel__subtitle">
            Controle quem tem acesso ao painel. Pelo menos um administrador deve permanecer ativo.
          </p>
        </div>
        <button type="button" className="button" onClick={loadAdmins} disabled={loading}>
          {loading ? 'Atualizando...' : 'Recarregar lista'}
        </button>
      </header>

      {error && <p className="settings-error">{error}</p>}
      {message && !error && <p className="settings-success">{message}</p>}

      <form className="settings-form" onSubmit={handleCreate}>
        <h3>Novo administrador</h3>
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
            E-mail
            <input
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={createForm.password}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
        </div>
        <button className="button button--primary" type="submit" disabled={creating}>
          {creating ? 'Salvando...' : 'Criar administrador'}
        </button>
      </form>

      <table className="data-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {sortedAdmins.map((admin) => {
            const isEditing = admin.id === editId;
            return (
              <tr key={admin.id}>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  ) : (
                    admin.name
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  ) : (
                    admin.email
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                      <input
                        type="password"
                        placeholder="Nova senha (opcional)"
                        value={editForm.password}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="button button--primary"
                          type="button"
                          onClick={handleSave}
                          disabled={savingEdit}
                        >
                          {savingEdit ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button className="button" type="button" onClick={() => setEditId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="button" type="button" onClick={() => startEdit(admin)}>
                        Editar
                      </button>
                      <button
                        className="button"
                        type="button"
                        onClick={() => handleDelete(admin.id)}
                        disabled={disableDelete(admin)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {sortedAdmins.length === 0 && !loading && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '16px 0' }}>
                Nenhum administrador encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
