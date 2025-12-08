import { FormEvent, useEffect, useState } from 'react';
import { useRestaurant } from '../../hooks/useRestaurant';

const DEFAULT_ROUTING = {
  minBatch: 2,
  maxBatch: 5,
  maxWaitMinutes: 25,
  smartBatchHoldMinutes: 5,
};
import './settings.css';

export default function RestaurantSettings() {
  const { profile, loading, error, updateProfile, refetch } = useRestaurant();
  const [formState, setFormState] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    contactPhone: '',
    maxRadiusKm: '',
    minBatch: '',
    maxBatch: '',
    maxWaitMinutes: '',
    smartBatchHoldMinutes: ''
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormState({
        name: profile.name,
        address: profile.address,
        lat: String(profile.lat),
        lng: String(profile.lng),
        contactPhone: profile.contactPhone ?? '',
        maxRadiusKm: String(profile.maxRadiusKm),
        minBatch: String(profile.minBatch ?? DEFAULT_ROUTING.minBatch),
        maxBatch: String(profile.maxBatch ?? DEFAULT_ROUTING.maxBatch),
        maxWaitMinutes: String(profile.maxWaitMinutes ?? DEFAULT_ROUTING.maxWaitMinutes),
        smartBatchHoldMinutes: String(profile.smartBatchHoldMinutes ?? DEFAULT_ROUTING.smartBatchHoldMinutes)
      });
    }
  }, [profile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setFeedback(null);
    setLocalError(null);
    try {
      await updateProfile({
        name: formState.name,
        address: formState.address,
        lat: Number(formState.lat),
        lng: Number(formState.lng),
        contactPhone: formState.contactPhone,
        maxRadiusKm: Number(formState.maxRadiusKm),
        minBatch: Number(formState.minBatch),
        maxBatch: Number(formState.maxBatch),
        maxWaitMinutes: Number(formState.maxWaitMinutes),
        smartBatchHoldMinutes: Number(formState.smartBatchHoldMinutes)
      });
      setFeedback('Dados atualizados com sucesso.');
    } catch (err) {
      console.error(err);
      setLocalError(err instanceof Error ? err.message : 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel settings-panel">
      <header className="panel__header">
        <div>
          <h2>Configurações do restaurante</h2>
          <p className="panel__subtitle">Defina o ponto de origem, dados de contato e raio máximo de entrega.</p>
        </div>
        <button type="button" className="button" onClick={refetch} disabled={loading}>
          Atualizar dados
        </button>
      </header>

      {error && <p className="settings-error">{error}</p>}
      {localError && <p className="settings-error">{localError}</p>}
      {feedback && <p className="settings-success">{feedback}</p>}

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-card">
          <header>
            <h3>🍽️ Perfil do restaurante</h3>
            <p className="panel__subtitle">Endereço base, contato e ponto de partida das rotas.</p>
          </header>
          <label>
            Nome
            <input
              type="text"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Endereço
            <input
              type="text"
              value={formState.address}
              onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
              required
            />
          </label>
          <label>
            Telefone de contato
            <input
              type="text"
              value={formState.contactPhone}
              onChange={(event) => setFormState((prev) => ({ ...prev, contactPhone: event.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </label>
          <div className="settings-grid">
            <label>
              Latitude
              <input
                type="number"
                value={formState.lat}
                onChange={(event) => setFormState((prev) => ({ ...prev, lat: event.target.value }))}
                step="0.000001"
                required
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                value={formState.lng}
                onChange={(event) => setFormState((prev) => ({ ...prev, lng: event.target.value }))}
                step="0.000001"
                required
              />
            </label>
            <label>
              Raio máximo (km)
              <input
                type="number"
                value={formState.maxRadiusKm}
                onChange={(event) => setFormState((prev) => ({ ...prev, maxRadiusKm: event.target.value }))}
                step="0.5"
                min="0"
                required
              />
            </label>
          </div>
        </div>

        <div className="settings-card">
          <header>
            <h3>🛣️ Configurações das rotas</h3>
            <p className="panel__subtitle">
              Ajuste como os pedidos são agrupados automaticamente e o tempo máximo de espera.
            </p>
          </header>
          <div className="settings-grid">
            <label>
              Pedidos por rota (mínimo)
              <input
                type="number"
                min="1"
                value={formState.minBatch}
                onChange={(event) => setFormState((prev) => ({ ...prev, minBatch: event.target.value }))}
              />
            </label>
            <label>
              Pedidos por rota (máximo)
              <input
                type="number"
                min="1"
                value={formState.maxBatch}
                onChange={(event) => setFormState((prev) => ({ ...prev, maxBatch: event.target.value }))}
              />
            </label>
            <label>
              SLA máximo (min)
              <input
                type="number"
                min="1"
                value={formState.maxWaitMinutes}
                onChange={(event) => setFormState((prev) => ({ ...prev, maxWaitMinutes: event.target.value }))}
              />
            </label>
            <label>
              Espera por pares próximos (min)
              <input
                type="number"
                min="0"
                value={formState.smartBatchHoldMinutes}
                onChange={(event) => setFormState((prev) => ({ ...prev, smartBatchHoldMinutes: event.target.value }))}
              />
            </label>
          </div>
        </div>
        <button type="submit" className="button button--primary" disabled={saving || loading}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </section>
  );
}
