import { useEffect, useMemo, useState } from 'react';
import { Order } from '../../types';
import { formatDate, formatShortId, formatTime } from '../../utils/format';
import './manualRouteModal.css';

interface ManualRouteModalProps {
  orders: Order[];
  onClose: () => void;
  onCreateRoute: (orderIds: string[]) => Promise<void>;
}

export default function ManualRouteModal({ orders, onClose, onCreateRoute }: ManualRouteModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [orders],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => sortedOrders.some((order) => order.id === id)));
  }, [sortedOrders]);

  const toggleSelection = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selected.length === sortedOrders.length) {
      setSelected([]);
    } else {
      setSelected(sortedOrders.map((order) => order.id));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) {
      setError('Selecione ao menos um pedido para criar a rota.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreateRoute(selected);
      setSelected([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar rota.');
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected = selected.length === sortedOrders.length && sortedOrders.length > 0;

  return (
    <div className="manual-route-modal__backdrop" role="dialog" aria-modal="true">
      <form className="manual-route-modal" onSubmit={handleSubmit}>
        <header className="manual-route-modal__header">
          <div>
            <h3>Criar rota manual</h3>
            <p>Escolha pedidos na fila para formar uma nova rota.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        {sortedOrders.length === 0 ? (
          <p className="manual-route-modal__empty">Nenhum pedido disponível para seleção.</p>
        ) : (
          <>
            <div className="manual-route-modal__toolbar">
              <p>
                {selected.length} selecionado{selected.length === 1 ? '' : 's'}
              </p>
              <button type="button" onClick={handleSelectAll} className="link-button">
                {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
              </button>
            </div>
            <div className="manual-route-modal__list">
              {sortedOrders.map((order) => {
                const isChecked = selected.includes(order.id);
                return (
                  <label
                    key={order.id}
                    className={`manual-route-modal__item${isChecked ? ' is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelection(order.id)}
                    />
                    <div className="manual-route-modal__details">
                      <p className="manual-route-modal__address">{order.address}</p>
                      <p className="manual-route-modal__meta">
                        Pedido {formatShortId(order.id)} · {formatTime(order.createdAt)} ·{' '}
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="manual-route-modal__price">
                      {order.deliveryPrice !== undefined ? `R$ ${order.deliveryPrice.toFixed(2)}` : '-'}
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {error && <p className="manual-route-modal__error">{error}</p>}

        <div className="manual-route-modal__actions">
          <button type="button" className="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={selected.length === 0 || submitting || sortedOrders.length === 0}
          >
            {submitting ? 'Criando...' : 'Criar rota'}
          </button>
        </div>
      </form>
    </div>
  );
}
