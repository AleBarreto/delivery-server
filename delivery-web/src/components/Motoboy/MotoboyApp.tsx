import { FormEvent, useEffect, useMemo, useState } from 'react';
import './motoboy.css';

interface MotoboyOrder {
  id: string;
  address: string;
  details?: string;
  status: 'PENDING' | 'DELIVERED';
}

interface MotoboyRoute {
  id: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';
  orderList: MotoboyOrder[];
  mapsUrl: string;
}

interface MotoboyProfile {
  name: string;
  phone: string;
  pin: string;
  route: MotoboyRoute;
}

const PROFILE: MotoboyProfile = {
  name: 'Daniel',
  phone: '11999999999',
  pin: '1234',
  route: {
    id: 'ROTA-8221',
    status: 'IN_PROGRESS',
    mapsUrl:
      'https://www.google.com/maps/dir/-23.5592887,-46.6583261/R.+dos+Pinheiros,+1151+-+Pinheiros,+S%C3%A3o+Paulo+-+SP,+05422-001/@-23.5634971,-46.6961554,14z/data=!3m1!4b1!4m14!4m13!1m5!1m1!1s0x94ce57329cbe5a27:0xced5a83d6eab7ce9!2m2!1d-46.673659!2d-23.5553452!1m5!1m1!1s0x94ce5763cf7c5a1b:0x7f0d7228c23375e0!2m2!1d-46.688032!2d-23.5611966!3e0?entry=ttu',
    orderList: [
      {
        id: 'PED-5012',
        address: 'Rua dos Pinheiros, 1151',
        details: 'Apto 42B · Interfone com porteiro',
        status: 'PENDING',
      },
      {
        id: 'PED-5013',
        address: 'Av. Brig. Faria Lima, 2232',
        details: 'Recepção do prédio · Deixar na portaria',
        status: 'PENDING',
      },
      {
        id: 'PED-5014',
        address: 'Rua Teodoro Sampaio, 914',
        details: 'Loja 3 · Cliente: Marina',
        status: 'PENDING',
      },
    ],
  },
};

const TOKEN_KEY = 'motoboy_token';

export default function MotoboyApp() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [route, setRoute] = useState<MotoboyRoute>(PROFILE.route);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken === PROFILE.phone) {
      setIsAuthenticated(true);
      setRoute(PROFILE.route);
    }
  }, []);

  const completedOrders = useMemo(
    () => route.orderList.filter((order) => order.status === 'DELIVERED').length,
    [route.orderList],
  );

  const routeStatusLabel = useMemo(() => {
    if (route.orderList.every((order) => order.status === 'DELIVERED')) {
      return 'Concluída';
    }
    if (completedOrders > 0) {
      return 'Em andamento';
    }
    return 'Aguardando entrega';
  }, [completedOrders, route.orderList]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (phone.trim() === PROFILE.phone && pin.trim() === PROFILE.pin) {
      localStorage.setItem(TOKEN_KEY, PROFILE.phone);
      setIsAuthenticated(true);
      setError(null);
      setRoute(PROFILE.route);
      return;
    }

    setError('Telefone ou PIN incorretos. Confira os dados e tente novamente.');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    setIsAvailable(false);
    setPhone('');
    setPin('');
    setRoute(PROFILE.route);
  };

  const handleToggleAvailability = () => setIsAvailable((value) => !value);

  const handleMarkDelivered = (orderId: string) => {
    setRoute((currentRoute) => ({
      ...currentRoute,
      orderList: currentRoute.orderList.map((order) =>
        order.id === orderId ? { ...order, status: 'DELIVERED' } : order,
      ),
      status: currentRoute.orderList.every((order) =>
        order.id === orderId ? true : order.status === 'DELIVERED',
      )
        ? 'DONE'
        : 'IN_PROGRESS',
    }));
  };

  const renderLogin = () => (
    <div className="motoboy-shell">
      <div className="motoboy-panel">
        <h1 className="motoboy-title">Área do Motoboy</h1>
        <p className="motoboy-subtitle">Acesse com seu telefone e PIN para ver a rota.</p>

        <form className="motoboy-form" onSubmit={handleLogin}>
          <label className="motoboy-label" htmlFor="phone">
            Telefone
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            className="motoboy-input"
            placeholder="DDD + número"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />

          <label className="motoboy-label" htmlFor="pin">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            className="motoboy-input"
            placeholder="****"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            required
          />

          {error && <p className="motoboy-error">{error}</p>}

          <button type="submit" className="motoboy-button">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );

  const renderOrderList = () => (
    <div className="motoboy-cards">
      {route.orderList.map((order) => (
        <div key={order.id} className="motoboy-card">
          <div className="motoboy-card__header">
            <span className="motoboy-pill">{order.id}</span>
            <span
              className={`motoboy-status ${
                order.status === 'DELIVERED' ? 'motoboy-status--success' : 'motoboy-status--pending'
              }`}
            >
              {order.status === 'DELIVERED' ? 'Entregue' : 'Pendente'}
            </span>
          </div>
          <p className="motoboy-card__title">{order.address}</p>
          {order.details && <p className="motoboy-card__subtitle">{order.details}</p>}
          <button
            className="motoboy-button motoboy-button--ghost"
            disabled={order.status === 'DELIVERED'}
            onClick={() => handleMarkDelivered(order.id)}
          >
            Marcar como entregue
          </button>
        </div>
      ))}
    </div>
  );

  const renderDashboard = () => (
    <div className="motoboy-shell motoboy-shell--logged">
      <header className="motoboy-topbar">
        <div>
          <p className="motoboy-eyebrow">Área do Motoboy</p>
          <h1 className="motoboy-title">Olá, {PROFILE.name}</h1>
        </div>
        <div className="motoboy-topbar__actions">
          <button
            className={`motoboy-chip ${isAvailable ? 'motoboy-chip--online' : 'motoboy-chip--offline'}`}
            onClick={handleToggleAvailability}
            type="button"
          >
            {isAvailable ? 'Estou disponível' : 'Ficar disponível'}
          </button>
          <button className="motoboy-link" onClick={handleLogout} type="button">
            Sair
          </button>
        </div>
      </header>

      <section className="motoboy-hero">
        <div>
          <p className="motoboy-eyebrow">Rota atual</p>
          <h2 className="motoboy-hero__title">{route.id}</h2>
          <p className="motoboy-hero__meta">
            Status: <strong>{routeStatusLabel}</strong> · Pedidos entregues: {completedOrders} / {route.orderList.length}
          </p>
          <div className="motoboy-hero__actions">
            <a className="motoboy-button" href={route.mapsUrl} target="_blank" rel="noreferrer">
              Abrir no Google Maps
            </a>
            <button
              className="motoboy-button motoboy-button--ghost"
              type="button"
              onClick={() => setRoute(PROFILE.route)}
            >
              Recarregar rota
            </button>
          </div>
        </div>
      </section>

      <section className="motoboy-section">
        <div className="motoboy-section__header">
          <div>
            <p className="motoboy-eyebrow">Pedidos da rota</p>
            <h3 className="motoboy-section__title">Entregas</h3>
          </div>
        </div>
        {renderOrderList()}
      </section>
    </div>
  );

  return isAuthenticated ? renderDashboard() : renderLogin();
}
