import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Courier, Order, Route } from '../../types';
import {
  fetchMyCurrentRoute,
  fetchMyCourierProfile,
  fetchMyRouteHistory,
  loginCourier,
  markMyOrderDelivered,
  setMyCourierAvailable,
  setMyCourierOffline,
  startMyRoute,
  CourierRouteSummary,
} from '../../api/client';
import './motoboy.css';

interface MotoboyOrder {
  id: string;
  address: string;
  details?: string;
  status: 'PENDING' | 'DELIVERED';
  price?: number;
}

const TOKEN_KEY = 'motoboy_token';
const COURIER_KEY = 'motoboy_profile';

type MotoboyView = 'dashboard' | 'history';

export default function MotoboyApp() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeOrders, setRouteOrders] = useState<MotoboyOrder[]>([]);
  const [routeHistory, setRouteHistory] = useState<CourierRouteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeView, setActiveView] = useState<MotoboyView>('dashboard');

  const isAuthenticated = Boolean(token && courier);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedCourier = localStorage.getItem(COURIER_KEY);

    if (storedToken && storedCourier) {
      try {
        const parsed = JSON.parse(storedCourier) as Courier;
        setToken(storedToken);
        setCourier(parsed);
      } catch {
        localStorage.removeItem(COURIER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }, []);

  const persistAuth = useCallback((authToken: string, courierProfile: Courier) => {
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(COURIER_KEY, JSON.stringify(courierProfile));
  }, []);

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(COURIER_KEY);
  };

  const refreshCourierProfile = useCallback(
    async (overrideToken?: string) => {
      const authToken = overrideToken ?? token;
      if (!authToken) return;
      try {
        const profile = await fetchMyCourierProfile(authToken);
        setCourier(profile);
        persistAuth(authToken, profile);
      } catch (err) {
        console.error(err);
      }
    },
    [token, persistAuth],
  );

  const loadHistory = useCallback(
    async (overrideToken?: string) => {
      const authToken = overrideToken ?? token;
      if (!authToken) return;
      try {
        const history = await fetchMyRouteHistory(authToken, 5);
        setRouteHistory(history);
      } catch (err) {
        console.error(err);
      }
    },
    [token],
  );

  const loadRoute = useCallback(
    async (overrideToken?: string) => {
      const authToken = overrideToken ?? token;
      if (!authToken) return;

      setLoadingRoute(true);
      try {
        const currentRoute = await fetchMyCurrentRoute(authToken);
        if (!currentRoute) {
          setRoute(null);
          setRouteOrders([]);
          setError(null);
        } else {
          const ordersInRoute = (currentRoute.orders ?? currentRoute.orderIds.map((id) => ({ id } as Order)))
            .map((order) => {
              const normalizedStatus: MotoboyOrder['status'] =
                order.status === 'DELIVERED' ? 'DELIVERED' : 'PENDING';

              return {
                id: order.id,
                address: order.address,
                status: normalizedStatus,
                price: order.deliveryPrice,
              };
            });

          setRoute({ ...currentRoute, orders: undefined });
          setRouteOrders(ordersInRoute);
          setError(null);
        }
        await Promise.all([refreshCourierProfile(authToken), loadHistory(authToken)]);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a rota.');
      } finally {
        setLoadingRoute(false);
      }
    },
    [token, refreshCourierProfile, loadHistory],
  );

  useEffect(() => {
    if (token) {
      loadRoute();
      loadHistory();
    } else {
      setRoute(null);
      setRouteOrders([]);
      setRouteHistory([]);
    }
  }, [token, loadRoute, loadHistory]);

  const completedOrders = useMemo(
    () => routeOrders.filter((order) => order.status === 'DELIVERED').length,
    [routeOrders],
  );

  const historyTotal = useMemo(
    () => routeHistory.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0),
    [routeHistory],
  );

  const courierStatus = useMemo(() => {
    const status = courier?.status ?? 'OFFLINE';
    if (status === 'AVAILABLE') {
      return {
        label: 'Disponível',
        description: 'Aguardando novos pedidos.',
        tone: 'available',
      };
    }
    if (status === 'ASSIGNED') {
      return {
        label: 'Rota pendente',
        description: 'Confirme o recebimento e inicie sua rota assim que estiver pronto.',
        tone: 'assigned',
      };
    }
    if (status === 'ON_TRIP') {
      return {
        label: 'Em rota',
        description: 'Finalize todos os pedidos antes de pedir novas entregas.',
        tone: 'ontrip',
      };
    }
    return {
      label: 'Offline',
      description: 'Avise quando estiver pronto para voltar para a rua.',
      tone: 'offline',
    };
  }, [courier]);

  const routeStatusLabel = useMemo(() => {
    if (!route) {
      return 'Nenhuma rota ativa';
    }

    if (route.status === 'DONE') return 'Concluída';
    if (route.status === 'IN_PROGRESS') return 'Em andamento';
    if (route.status === 'ASSIGNED') return 'Aguardando início';
    return 'Aguardando entrega';
  }, [route]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setInfoMessage(null);
    try {
      const { token: authToken, courier: courierProfile } = await loginCourier(phone.trim(), pin.trim());
      setToken(authToken);
      setCourier(courierProfile);
      persistAuth(authToken, courierProfile);
      setPhone('');
      setPin('');
      await Promise.all([loadRoute(authToken), refreshCourierProfile(authToken)]);
      setInfoMessage('Login realizado com sucesso.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível fazer login. Confira seus dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setInfoMessage(null);
    if (token) {
      try {
        await setMyCourierOffline(token);
      } catch (err) {
        console.warn('Falha ao notificar logout do motoboy, prosseguindo mesmo assim.', err);
      }
    }

    clearAuth();
    setToken(null);
    setCourier(null);
    setRoute(null);
    setRouteOrders([]);
    setPhone('');
    setPin('');
    setActiveView('dashboard');
    setInfoMessage('Sessão encerrada.');
  };

  const handleSetAvailable = async () => {
    if (!token) return;
    setActionLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const updatedCourier = await setMyCourierAvailable(token);
      setCourier(updatedCourier);
      persistAuth(token, updatedCourier);
      await Promise.all([loadRoute(token), refreshCourierProfile(token)]);
      setInfoMessage('Disponibilidade atualizada! Vamos te chamar assim que surgir uma rota.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar sua disponibilidade.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshRoute = async () => {
    if (!token) return;
    await loadRoute(token);
    setInfoMessage('Rota atualizada.');
  };

  const handleMarkDelivered = async (orderId: string) => {
    if (!token) return;
    setActionLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      await markMyOrderDelivered(token, orderId);
      setRouteOrders((currentRoute) =>
        currentRoute.map((order) =>
          order.id === orderId ? { ...order, status: 'DELIVERED' } : order,
        ),
      );
      await loadRoute(token);
      setInfoMessage('Pedido entregue! Conferindo se ainda há paradas.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível marcar o pedido como entregue.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRoute = async () => {
    if (!token || !route) return;
    setActionLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      await startMyRoute(token, route.id);
      if (courier) {
        const updatedCourier: Courier = { ...courier, status: 'ON_TRIP' };
        setCourier(updatedCourier);
        persistAuth(token, updatedCourier);
      }
      await loadRoute(token);
      setInfoMessage('Rota iniciada! Boa entrega.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a rota.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderLogin = () => (
    <div className="motoboy-shell">
      <div className="motoboy-panel">
        <div className="motoboy-logo">🛵</div>
        <h1 className="motoboy-title">Área do Motoboy</h1>
        <p className="motoboy-subtitle">Acesse com seu telefone e PIN para ver a rota.</p>
        <ul className="motoboy-steps">
          <li>📱 Informe o telefone cadastrado</li>
          <li>🔐 Digite seu PIN de 4 dígitos</li>
          <li>🚀 Veja sua rota e confirme as entregas</li>
        </ul>

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

          <button type="submit" className="motoboy-button" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderOrderList = () => {
    if (!route) {
      return <p className="motoboy-subtitle">Nenhuma rota ativa no momento.</p>;
    }

    if (loadingRoute) {
      return <p className="motoboy-subtitle">Carregando pedidos...</p>;
    }

    if (routeOrders.length === 0) {
      return <p className="motoboy-subtitle">Nenhum pedido atribuído a esta rota.</p>;
    }

    return (
      <div className="motoboy-timeline">
        {routeOrders.map((order, index) => (
          <div key={order.id} className="motoboy-stop">
            <div className="motoboy-stop__line" aria-hidden />
            <div className="motoboy-stop__badge">{index + 1}</div>
            <div className="motoboy-stop__content">
              <div className="motoboy-stop__header">
                <p className="motoboy-card__title">{order.address}</p>
                <span
                  className={`motoboy-status ${
                    order.status === 'DELIVERED' ? 'motoboy-status--success' : 'motoboy-status--pending'
                  }`}
                >
                  {order.status === 'DELIVERED' ? 'Entregue' : 'Pendente'}
                </span>
              </div>
              <p className="motoboy-card__subtitle">Código interno: {order.id.slice(0, 6).toUpperCase()}</p>
              {order.price !== undefined && (
                <p className="motoboy-card__subtitle">Pagamento previsto: R$ {order.price.toFixed(2)}</p>
              )}
              <button
                className="motoboy-button motoboy-button--ghost"
                disabled={order.status === 'DELIVERED' || actionLoading}
                onClick={() => handleMarkDelivered(order.id)}
              >
                Marcar como entregue
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHistory = () => (
    <section className="motoboy-section">
      <div className="motoboy-section__header">
        <div>
          <p className="motoboy-eyebrow">Histórico de rotas</p>
          <h3 className="motoboy-section__title">Seus ganhos recentes</h3>
          <p className="motoboy-card__subtitle">
            Veja quanto entregou por rota. Em breve abriremos filtros por período e turno.
          </p>
        </div>
        {routeHistory.length > 0 && (
          <div className="motoboy-history__total">
            <span>Total últimos {routeHistory.length} registros:</span>
            <strong>R$ {historyTotal.toFixed(2)}</strong>
          </div>
        )}
      </div>
      {routeHistory.length === 0 ? (
        <p className="motoboy-subtitle">Nada por aqui ainda. Finalize rotas para consultar depois.</p>
      ) : (
        <div className="motoboy-history motoboy-history--page">
          {routeHistory.map((history) => (
            <div key={history.id} className="motoboy-history__card">
              <div>
                <p className="motoboy-card__title">Rota {history.id.slice(0, 6)}</p>
                <p className="motoboy-card__subtitle">
                  {new Date(history.createdAt).toLocaleDateString()} · {history.orderCount} paradas
                </p>
              </div>
              <div className="motoboy-history__meta">
                <span>Status: {history.status === 'DONE' ? 'Concluída' : '---'}</span>
                <span>Ganhos: R$ {history.totalPrice.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderDashboard = () => (
    <div className="motoboy-shell motoboy-shell--logged">
      <header className="motoboy-topbar">
        <div>
          <p className="motoboy-eyebrow">Área do Motoboy</p>
          <h1 className="motoboy-title">Olá, {courier?.name ?? 'Motoboy'}</h1>
          <p className="motoboy-subtitle">{courier?.phone}</p>
          <div className="motoboy-topbar__status">
            <span className={`motoboy-chip motoboy-chip--${courierStatus.tone}`}>{courierStatus.label}</span>
            <p className="motoboy-status-text">{courierStatus.description}</p>
          </div>
        </div>
        <div className="motoboy-topbar__actions">
          <button className="motoboy-link" onClick={handleLogout} type="button">
            Sair
          </button>
        </div>
      </header>

      {error && <p className="motoboy-error">{error}</p>}
      {infoMessage && !error && <p className="motoboy-info">{infoMessage}</p>}

      <nav className="motoboy-tabs">
        <button
          type="button"
          className={`motoboy-tab ${activeView === 'dashboard' ? 'motoboy-tab--active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          🚚 Rota atual
        </button>
        <button
          type="button"
          className={`motoboy-tab ${activeView === 'history' ? 'motoboy-tab--active' : ''}`}
          onClick={() => setActiveView('history')}
        >
          💰 Histórico
        </button>
      </nav>

      {activeView === 'dashboard' ? (
        <>
          <section className="motoboy-hero">
            <div className="motoboy-hero__grid">
              <div>
                <p className="motoboy-eyebrow">Rota atual</p>
            {route ? (
              <>
                <h2 className="motoboy-hero__title">Rota {route.id.slice(0, 6)}</h2>
                <p className="motoboy-hero__meta">
                  Status: <strong>{routeStatusLabel}</strong> · {completedOrders}/{routeOrders.length} entregues
                </p>
                {route.totalPrice !== undefined && (
                  <p className="motoboy-hero__meta">Valor previsto da rota: R$ {route.totalPrice.toFixed(2)}</p>
                )}
                <div className="motoboy-progress">
                  <div
                    className="motoboy-progress__bar"
                    style={{
                      width: `${routeOrders.length ? Math.round((completedOrders / routeOrders.length) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="motoboy-hero__actions">
                  {route.status === 'ASSIGNED' && (
                    <button
                      className="motoboy-button"
                      type="button"
                      onClick={handleStartRoute}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Iniciando...' : 'Iniciar rota'}
                    </button>
                  )}
                  <button
                    className="motoboy-button motoboy-button--ghost"
                    type="button"
                    onClick={handleRefreshRoute}
                    disabled={loadingRoute}
                  >
                    {loadingRoute ? 'Atualizando...' : 'Recarregar rota'}
                  </button>
                </div>
                {route.status === 'ASSIGNED' && (
                  <p className="motoboy-hint">Toque em “Iniciar rota” quando estiver pronto para sair.</p>
                )}
              </>
            ) : (
              <>
                <h2 className="motoboy-hero__title">Sem rota ativa</h2>
                <p className="motoboy-hero__meta">
                  Assim que você ficar disponível, vamos atribuir novos pedidos automaticamente.
                </p>
                <div className="motoboy-hero__actions">
                  <button
                    className="motoboy-button"
                    type="button"
                    onClick={handleSetAvailable}
                    disabled={actionLoading || courier?.status !== 'OFFLINE'}
                  >
                    Avisar que estou disponível
                  </button>
                </div>
              </>
            )}
          </div>
          {route && route.mapsUrl && (
            <div className="motoboy-map-card">
              <p className="motoboy-eyebrow">Mapa rápido</p>
              <p className="motoboy-card__subtitle">Visualize as paradas no mapa</p>
              <a className="motoboy-button" href={route.mapsUrl} target="_blank" rel="noreferrer">
                Abrir no Google Maps
              </a>
            </div>
          )}
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
        </>
      ) : (
        renderHistory()
      )}
    </div>
  );

  return isAuthenticated ? renderDashboard() : renderLogin();
}
