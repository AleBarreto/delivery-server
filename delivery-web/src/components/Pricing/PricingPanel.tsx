import { FormEvent, useMemo, useState } from 'react';
import { usePricing } from '../../hooks/usePricing';
import './pricing.css';

export default function PricingPanel() {
  const {
    bands,
    zones,
    loading,
    error,
    addBand,
    editBand,
    removeBand,
    addZone,
    editZone,
    removeZone,
  } = usePricing();

  const [bandDistance, setBandDistance] = useState('');
  const [bandPrice, setBandPrice] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneKeyword, setZoneKeyword] = useState('');
  const [zonePrice, setZonePrice] = useState('');
  const [bandDraft, setBandDraft] = useState<{ id: string; maxDistanceKm: number; price: number } | null>(null);
  const [zoneDraft, setZoneDraft] = useState<{ id: string; name: string; matchText: string; price: number } | null>(null);
  const [feedback, setFeedback] = useState<string>();
  const [feedbackError, setFeedbackError] = useState<string>();

  const sortedBands = useMemo(
    () => [...bands].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm),
    [bands],
  );

  const handleAddBand = async (event: FormEvent) => {
    event.preventDefault();
    const distance = Number(bandDistance);
    const price = Number(bandPrice);
    if (Number.isNaN(distance) || Number.isNaN(price)) return;

    try {
      await addBand(distance, price);
      setBandDistance('');
      setBandPrice('');
      setFeedback('Faixa criada com sucesso.');
      setFeedbackError(undefined);
    } catch (err) {
      console.error(err);
      setFeedback(undefined);
      setFeedbackError('Não foi possível criar a faixa.');
    }
  };

  const handleSaveBand = async () => {
    if (!bandDraft) return;
    const { id, maxDistanceKm, price } = bandDraft;
    try {
      await editBand(id, maxDistanceKm, price);
      setBandDraft(null);
      setFeedback('Faixa atualizada.');
      setFeedbackError(undefined);
    } catch (err) {
      console.error(err);
      setFeedback(undefined);
      setFeedbackError('Erro ao atualizar faixa.');
    }
  };

  const handleAddZone = async (event: FormEvent) => {
    event.preventDefault();
    if (!zoneName || !zoneKeyword) return;
    const price = Number(zonePrice);
    if (Number.isNaN(price)) return;

    try {
      await addZone(zoneName, zoneKeyword, price);
      setZoneName('');
      setZoneKeyword('');
      setZonePrice('');
      setFeedback('Zona criada.');
      setFeedbackError(undefined);
    } catch (err) {
      console.error(err);
      setFeedback(undefined);
      setFeedbackError('Não foi possível criar a zona.');
    }
  };

  const handleSaveZone = async () => {
    if (!zoneDraft) return;
    const { id, name, matchText, price } = zoneDraft;
    try {
      await editZone(id, { name, matchText, price });
      setZoneDraft(null);
      setFeedback('Zona atualizada.');
      setFeedbackError(undefined);
    } catch (err) {
      console.error(err);
      setFeedback(undefined);
      setFeedbackError('Erro ao atualizar zona.');
    }
  };

  return (
    <section className="panel pricing-panel">
      <header className="panel__header">
        <div>
          <h2>Regras de preço</h2>
          <p className="panel__subtitle">
            Configure quanto cobrar por faixa de distância ou por zonas especiais (bairros/palavras-chave).
          </p>
        </div>
        {loading && <span className="pricing-chip">Carregando...</span>}
      </header>

      {(feedback || feedbackError || error) && (
        <p className={`pricing-message ${feedbackError || error ? 'pricing-message--error' : 'pricing-message--success'}`}>
          {feedbackError ?? error ?? feedback}
        </p>
      )}

      <div className="pricing-grid">
        <div className="pricing-card">
          <header className="pricing-card__header">
            <h3>📏 Faixas por distância</h3>
            <p className="pricing-description">Para pedidos fora das zonas especiais (usamos a menor distância que se encaixar).</p>
          </header>
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Até (km)</th>
                <th>Valor (R$)</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedBands.map((band) => {
                const isEditing = bandDraft?.id === band.id;
                return (
                  <tr key={band.id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          value={bandDraft?.maxDistanceKm ?? band.maxDistanceKm}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isNaN(value) && bandDraft) {
                              setBandDraft({ ...bandDraft, maxDistanceKm: value });
                            }
                          }}
                        />
                      ) : (
                        `${band.maxDistanceKm} km`
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={bandDraft?.price ?? band.price}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isNaN(value) && bandDraft) {
                              setBandDraft({ ...bandDraft, price: value });
                            }
                          }}
                        />
                      ) : (
                        `R$ ${band.price.toFixed(2)}`
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <>
                          <button
                            className="button button--primary"
                            onClick={handleSaveBand}
                          >
                            Salvar
                          </button>
                          <button className="button" onClick={() => setBandDraft(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="button" onClick={() => setBandDraft({ ...band })}>
                            Editar
                          </button>
                          <button className="button" onClick={() => removeBand(band.id)}>
                            Remover
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {bands.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">Nenhuma faixa cadastrada.</td>
                </tr>
              )}
            </tbody>
          </table>

          <form className="pricing-form" onSubmit={handleAddBand}>
            <h4>Adicionar faixa</h4>
            <label>
              Até (km)
              <input
                type="number"
                value={bandDistance}
                onChange={(event) => setBandDistance(event.target.value)}
                placeholder="Ex: 5"
                required
                min="0"
                step="0.5"
              />
            </label>
            <label>
              Valor (R$)
              <input
                type="number"
                step="0.5"
                value={bandPrice}
                onChange={(event) => setBandPrice(event.target.value)}
                placeholder="Ex: 8"
                required
                min="0"
              />
            </label>
            <button type="submit" className="button button--primary">
              Adicionar faixa
            </button>
          </form>
        </div>

        <div className="pricing-card">
          <header className="pricing-card__header">
            <h3>🗺️ Zonas especiais</h3>
            <p className="pricing-description">Se o endereço contiver a palavra-chave, esta tarifa tem prioridade sobre a distância.</p>
          </header>
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Zona</th>
                <th>Palavra-chave</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => {
                const isEditing = zoneDraft?.id === zone.id;
                return (
                  <tr key={zone.id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={zoneDraft?.name ?? zone.name}
                          onChange={(event) => {
                            setZoneDraft((draft) => (draft ? { ...draft, name: event.target.value } : draft));
                          }}
                        />
                      ) : (
                        zone.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          value={zoneDraft?.matchText ?? zone.matchText}
                          onChange={(event) => {
                            setZoneDraft((draft) => (draft ? { ...draft, matchText: event.target.value } : draft));
                          }}
                        />
                      ) : (
                <span className="pricing-keyword">{zone.matchText}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={zoneDraft?.price ?? zone.price}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isNaN(value) && zoneDraft) {
                              setZoneDraft({ ...zoneDraft, price: value });
                            }
                          }}
                        />
                      ) : (
                        `R$ ${zone.price.toFixed(2)}`
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <>
                          <button
                            className="button button--primary"
                            onClick={handleSaveZone}
                          >
                            Salvar
                          </button>
                          <button className="button" onClick={() => setZoneDraft(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="button" onClick={() => setZoneDraft({ ...zone })}>
                            Editar
                          </button>
                          <button className="button" onClick={() => removeZone(zone.id)}>
                            Remover
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {zones.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">Nenhuma zona cadastrada.</td>
                </tr>
              )}
            </tbody>
          </table>

            <form className="pricing-form" onSubmit={handleAddZone}>
              <h4>Adicionar zona</h4>
              <label>
                Nome
                <input
                  type="text"
                  value={zoneName}
                  onChange={(event) => setZoneName(event.target.value)}
                  placeholder="Ex: Centro expandido"
                  required
                />
              </label>
              <label>
                Palavra-chave (no endereço)
                <input
                  type="text"
                  value={zoneKeyword}
                  onChange={(event) => setZoneKeyword(event.target.value)}
                  placeholder="Ex: Copacabana"
                  required
                />
              </label>
              <label>
                Valor (R$)
                <input
                  type="number"
                  step="0.5"
                  value={zonePrice}
                  onChange={(event) => setZonePrice(event.target.value)}
                  placeholder="Ex: 12"
                  required
                  min="0"
                />
              </label>
              <button type="submit" className="button button--primary">
                Adicionar zona
              </button>
            </form>
        </div>
      </div>
    </section>
  );
}
