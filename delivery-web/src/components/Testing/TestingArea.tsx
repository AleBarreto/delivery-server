import { FormEvent, useState } from 'react';
import { createCourier, createOrder, markOrderDelivered } from '../../api/client';
import './testing.css';

interface TestingAreaProps {
  onRefreshOrders: () => Promise<void>;
  onRefreshCouriers: () => Promise<void>;
  onRefreshRoutes: () => Promise<void>;
}

const MOCK_ADDRESSES = [
  {
    label: 'Restaurante · Spetto House - R. Profa. Clotilde Pinheiro, 550 - São Jorge',
    lat: -3.1120367,
    lng: -60.0348224,
  },
  {
    label: 'Até 3 km · Vista Del Rio - Av. Ramos Ferreira, 199 - Aparecida',
    lat: -3.1273728,
    lng: -60.0328293,
  },
  {
    label: 'Até 5 km · Lê Boulevard Place de La Concorde - Av. São Jorge, 529',
    lat: -3.0952542,
    lng: -60.0509423,
  },
  {
    label: 'Até 10 km · Hiper DB Ponta Negra - Av. Coronel Teixeira, 7687',
    lat: -3.0952542,
    lng: -60.0689668,
  },
  {
    label: 'Até 10 km · CSU Parque 10 - Parque Dez de Novembro',
    lat: -3.0907975,
    lng: -60.0496549,
  },
];

const MOCK_COURIER_NAMES = ['Rafa', 'Patrícia', 'Bianca', 'Kauan', 'Marcelo', 'Lívia'];

function randomFromArray<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function jitterCoordinate(value: number) {
  return Number((value + (Math.random() - 0.5) * 0.01).toFixed(6));
}

function generateRandomPhone() {
  const random = Math.floor(100000000 + Math.random() * 900000000);
  return `11${random}`;
}

function generateRandomPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function TestingArea({
  onRefreshCouriers,
  onRefreshOrders,
  onRefreshRoutes,
}: TestingAreaProps) {
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState(generateRandomPhone());
  const [courierPin, setCourierPin] = useState(generateRandomPin());
  const [selectedMockArea, setSelectedMockArea] = useState(MOCK_ADDRESSES[0].label);
  const [mockComplement, setMockComplement] = useState('');
  const [deliveryOrderId, setDeliveryOrderId] = useState('');
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const resetCourierDefaults = () => {
    setCourierPhone(generateRandomPhone());
    setCourierPin(generateRandomPin());
  };

  const handleCreateCourier = async (event: FormEvent) => {
    event.preventDefault();
    if (!courierName || !courierPhone || !courierPin) return;

    setLoading(true);
    setStatus(undefined);
    setError(undefined);
    try {
      const courier = await createCourier(courierName.trim(), courierPhone.trim(), courierPin.trim());
      setStatus(`Motoboy ${courier.name} gerado! Telefone ${courier.phone} · PIN ${courierPin}.`);
      setCourierName('');
      resetCourierDefaults();
      await onRefreshCouriers();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar o motoboy');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMockOrder = async (event: FormEvent) => {
    event.preventDefault();

    const mockBase = MOCK_ADDRESSES.find((item) => item.label === selectedMockArea) ?? MOCK_ADDRESSES[0];
    const fullAddress = mockComplement ? `${mockBase.label} - ${mockComplement}` : mockBase.label;

    setLoading(true);
    setStatus(undefined);
    setError(undefined);
    try {
      const order = await createOrder({
        address: fullAddress,
        lat: jitterCoordinate(mockBase.lat),
        lng: jitterCoordinate(mockBase.lng),
      });
      setStatus(`Pedido mock ${fullAddress} criado (${order.id.slice(0, 6)}...).`);
      setMockComplement('');
      await onRefreshOrders();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar o pedido mock');
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
      const mockName = `${randomFromArray(MOCK_COURIER_NAMES)} (${new Date().toLocaleTimeString()})`;
      const phone = generateRandomPhone();
      const pin = generateRandomPin();

      const courier = await createCourier(mockName, phone, pin);
      const firstOrder = await createOrder({
        address: address.label,
        lat: jitterCoordinate(address.lat),
        lng: jitterCoordinate(address.lng),
      });
      const secondOrder = await createOrder({
        address: `${address.label} - bloco ${Math.ceil(Math.random() * 10)}`,
        lat: jitterCoordinate(address.lat),
        lng: jitterCoordinate(address.lng),
      });

      setStatus(
        `Pacote gerado: motoboy ${courier.name} (tel ${phone} / PIN ${pin}) + pedidos ${firstOrder.id.slice(0, 6)} e ${secondOrder.id.slice(0, 6)}.`,
      );

      await onRefreshCouriers();
      await onRefreshOrders();
      await onRefreshRoutes();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível criar o pacote de mocks');
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

  return (
    <section className="panel testing">
      <header className="panel__header testing__header">
        <div>
          <h2>Simulador rápido</h2>
          <p className="panel__subtitle">
            Gere motoboys e pedidos fake para validar o fluxo completo, sem precisar de scripts externos.
          </p>
        </div>
        <button type="button" className="button button--primary" disabled={loading} onClick={handleQuickMock}>
          Gerar pacote completo
        </button>
      </header>

      {(status || error) && (
        <div className={`testing__message ${error ? 'testing__message--error' : 'testing__message--success'}`}>
          {error ?? status}
        </div>
      )}

      <div className="testing__grid">
        <form className="testing__card" onSubmit={handleCreateCourier}>
          <h3>Criar motoboy</h3>
          <p className="testing__hint">POST /couriers</p>
          <label className="testing__field">
            <span>Nome</span>
            <input
              type="text"
              value={courierName}
              onChange={(event) => setCourierName(event.target.value)}
              placeholder="Ex: Motoboy João"
              required
            />
          </label>
          <label className="testing__field">
            <span>Telefone</span>
            <input
              type="tel"
              value={courierPhone}
              onChange={(event) => setCourierPhone(event.target.value)}
              placeholder="11999999999"
              required
            />
          </label>
          <label className="testing__field">
            <span>PIN para login</span>
            <input
              type="text"
              value={courierPin}
              onChange={(event) => setCourierPin(event.target.value)}
              placeholder="4 dígitos"
              maxLength={4}
              required
            />
          </label>
          <p className="testing__hint">Use o telefone e o PIN acima no app do motoboy (/motoboy).</p>
          <button
            type="submit"
            className="button button--primary"
            disabled={loading || !courierName || !courierPhone || !courierPin}
          >
            Criar motoboy
          </button>
        </form>

        <form className="testing__card" onSubmit={handleCreateMockOrder}>
          <h3>Gerar pedido mock</h3>
          <p className="testing__hint">POST /orders</p>
          <label className="testing__field">
            <span>Região</span>
            <select
              value={selectedMockArea}
              onChange={(event) => setSelectedMockArea(event.target.value)}
            >
              {MOCK_ADDRESSES.map((address) => (
                <option key={address.label} value={address.label}>
                  {address.label}
                </option>
              ))}
            </select>
          </label>
          <label className="testing__field">
            <span>Complemento opcional</span>
            <input
              type="text"
              value={mockComplement}
              onChange={(event) => setMockComplement(event.target.value)}
              placeholder="Ex: bloco A, apto 32"
            />
          </label>
          <p className="testing__hint">
            As coordenadas são geradas automaticamente com base na região escolhida.
          </p>
          <button type="submit" className="button button--primary" disabled={loading}>
            Criar pedido mock
          </button>
        </form>
      </div>

      <details className="testing__extras">
        <summary>Marcar pedido como entregue (POST /orders/:id/delivered)</summary>
        <div className="testing__extras-content">
          <p>Informe um código exibido na tabela de pedidos para simular a finalização da entrega.</p>
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
