import { FormEvent, useMemo, useState } from 'react';
import { createCourier, createOrder, markOrderDelivered } from '../../api/client';
import './testing.css';

interface TestingAreaProps {
  onRefreshOrders: () => Promise<void>;
  onRefreshCouriers: () => Promise<void>;
  onRefreshRoutes: () => Promise<void>;
}

const MOCK_ADDRESSES = [
  {
    label: 'Avenida Paulista, 1000 - São Paulo',
    lat: -23.56321,
    lng: -46.65425,
  },
  {
    label: 'Praça da Sé - São Paulo',
    lat: -23.55052,
    lng: -46.63331,
  },
  {
    label: 'Rua XV de Novembro - Curitiba',
    lat: -25.4284,
    lng: -49.2733,
  },
  {
    label: 'Orla de Copacabana - Rio de Janeiro',
    lat: -22.9711,
    lng: -43.1822,
  },
];

const MOCK_COURIER_NAMES = ['Rafa', 'Patrícia', 'Bianca', 'Kauan', 'Marcelo', 'Lívia'];

function randomFromArray<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function jitterCoordinate(value: number) {
  return Number((value + (Math.random() - 0.5) * 0.01).toFixed(6));
}

export default function TestingArea({
  onRefreshCouriers,
  onRefreshOrders,
  onRefreshRoutes,
}: TestingAreaProps) {
  const [courierName, setCourierName] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderLat, setOrderLat] = useState('');
  const [orderLng, setOrderLng] = useState('');
  const [deliveryOrderId, setDeliveryOrderId] = useState('');
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const isOrderFormValid = useMemo(() => {
    return Boolean(orderAddress && orderLat && orderLng && !Number.isNaN(Number(orderLat)) && !Number.isNaN(Number(orderLng)));
  }, [orderAddress, orderLat, orderLng]);

  const handleCreateCourier = async (event: FormEvent) => {
    event.preventDefault();
    if (!courierName) return;

    setLoading(true);
    setStatus(undefined);
    setError(undefined);
    try {
      const courier = await createCourier(courierName);
      setStatus(`Courier criado: ${courier.name} (id: ${courier.id})`);
      setCourierName('');
      await onRefreshCouriers();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar courier');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!isOrderFormValid) return;

    setLoading(true);
    setStatus(undefined);
    setError(undefined);
    try {
      const order = await createOrder(orderAddress, Number(orderLat), Number(orderLng));
      setStatus(`Pedido criado: ${order.id} → ${order.address}`);
      setOrderAddress('');
      setOrderLat('');
      setOrderLng('');
      await onRefreshOrders();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickMock = async () => {
    setLoading(true);
    setStatus(undefined);
    setError(undefined);

    try {
      const address = randomFromArray(MOCK_ADDRESSES);
      const courier = await createCourier(`${randomFromArray(MOCK_COURIER_NAMES)} (${new Date().toLocaleTimeString()})`);
      const firstOrder = await createOrder(
        address.label,
        jitterCoordinate(address.lat),
        jitterCoordinate(address.lng),
      );
      const secondOrder = await createOrder(
        `${address.label} - bloco ${Math.ceil(Math.random() * 10)}`,
        jitterCoordinate(address.lat),
        jitterCoordinate(address.lng),
      );

      setStatus(
        `Mocks criados: courier ${courier.name} e pedidos ${firstOrder.id} / ${secondOrder.id} na região de ${address.label}.`,
      );

      await onRefreshCouriers();
      await onRefreshOrders();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar mocks');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setLoading(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await markOrderDelivered(orderId);
      setStatus(`Pedido ${orderId} marcado como entregue.`);
      setDeliveryOrderId('');
      await onRefreshOrders();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível marcar pedido como entregue');
    } finally {
      setLoading(false);
    }
  };

  const fillRandomAddress = () => {
    const pick = randomFromArray(MOCK_ADDRESSES);
    setOrderAddress(pick.label);
    setOrderLat(pick.lat.toString());
    setOrderLng(pick.lng.toString());
  };

  return (
    <section className="panel testing">
      <header className="panel__header testing__header">
        <div>
          <h2>Área de testes / mocks rápidos</h2>
          <p className="panel__subtitle">
            Use os formulários abaixo para disparar POSTs contra o delivery-server sem precisar de cURL ou scripts externos.
          </p>
        </div>
        <button type="button" className="button button--primary" disabled={loading} onClick={handleQuickMock}>
          Gerar pacote de mocks
        </button>
      </header>

      {(status || error) && (
        <div className={`testing__message ${error ? 'testing__message--error' : 'testing__message--success'}`}>
          {error ?? status}
        </div>
      )}

      <div className="testing__grid">
        <form className="testing__card" onSubmit={handleCreateCourier}>
          <h3>Criar courier</h3>
          <p className="testing__hint">POST /couriers</p>
          <label className="testing__field">
            <span>Nome</span>
            <input
              type="text"
              value={courierName}
              onChange={(event) => setCourierName(event.target.value)}
              placeholder="Ex: Entregador fulano"
              required
            />
          </label>
          <button type="submit" className="button button--primary" disabled={loading || !courierName}>
            Criar courier
          </button>
        </form>

        <form className="testing__card" onSubmit={handleCreateOrder}>
          <h3>Criar pedido</h3>
          <p className="testing__hint">POST /orders</p>
          <label className="testing__field">
            <span>Endereço</span>
            <input
              type="text"
              value={orderAddress}
              onChange={(event) => setOrderAddress(event.target.value)}
              placeholder="Rua, número, complemento"
              required
            />
          </label>
          <div className="testing__coords">
            <label className="testing__field">
              <span>Lat</span>
              <input
                type="number"
                step="0.000001"
                value={orderLat}
                onChange={(event) => setOrderLat(event.target.value)}
                placeholder="-23.55"
                required
              />
            </label>
            <label className="testing__field">
              <span>Lng</span>
              <input
                type="number"
                step="0.000001"
                value={orderLng}
                onChange={(event) => setOrderLng(event.target.value)}
                placeholder="-46.63"
                required
              />
            </label>
          </div>
          <div className="testing__actions">
            <button type="button" className="button" onClick={fillRandomAddress} disabled={loading}>
              Preencher com endereço mock
            </button>
            <button type="submit" className="button button--primary" disabled={loading || !isOrderFormValid}>
              Criar pedido
            </button>
          </div>
        </form>
      </div>

      <details className="testing__extras">
        <summary>Marcar pedido como entregue (POST /orders/:id/delivered)</summary>
        <div className="testing__extras-content">
          <p>Informe um ID de pedido que já exista no painel para simular a conclusão da entrega.</p>
          <div className="testing__extras-form">
            <input
              type="text"
              placeholder="order-id"
              value={deliveryOrderId}
              onChange={(event) => setDeliveryOrderId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const value = event.currentTarget.value.trim();
                  if (value) {
                    handleMarkDelivered(value);
                  }
                }
              }}
            />
            <button
              type="button"
              className="button button--primary"
              disabled={loading || !deliveryOrderId.trim()}
              onClick={() => handleMarkDelivered(deliveryOrderId.trim())}
            >
              Enviar
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
