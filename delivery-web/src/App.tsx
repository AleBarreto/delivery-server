import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Layout from './components/Layout/Layout';
import SummaryCards from './components/Dashboard/SummaryCards';
import OrdersTable from './components/Dashboard/OrdersTable';
import CouriersTable from './components/Dashboard/CouriersTable';
import RoutesTable from './components/Dashboard/RoutesTable';
import ManualRouteModal from './components/Dashboard/ManualRouteModal';
import PricingPanel from './components/Pricing/PricingPanel';
import RestaurantSettings from './components/Settings/RestaurantSettings';
import AdminCouriers from './components/Settings/AdminCouriers';
import AdminOrders from './components/Settings/AdminOrders';
import AdminUsers from './components/Settings/AdminUsers';
import AdminRoutes from './components/Settings/AdminRoutes';
import ReportsPanel from './components/Reports/ReportsPanel';
import StatusGuide from './components/Guide/StatusGuide';
import { useOrders } from './hooks/useOrders';
import { useCouriers } from './hooks/useCouriers';
import { useRoutes } from './hooks/useRoutes';
import { AdminUser, Courier, Route } from './types';
import { formatShortId } from './utils/format';
import {
  assignRoute,
  assignRouteAutomatically,
  createManualRoute,
  fetchAdminProfile,
  loginAdmin,
  setAdminToken,
} from './api/client';
import { useOperationDay } from './hooks/useOperationDay';
import { useRestaurant } from './hooks/useRestaurant';
import RouteMap from './components/Map/RouteMap';
import 'leaflet/dist/leaflet.css';
import './app.css';

function SectionMessage({ message }: { message: string }) {
  return <p style={{ color: '#b91c1c', margin: '12px 0' }}>{message}</p>;
}

function DetailPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }} className="panel">
      <header className="panel__header">
        <h3>{title}</h3>
      </header>
      {children}
    </div>
  );
}

type TabId = 'operations' | 'couriers' | 'orders' | 'pricing' | 'settings' | 'reports' | 'guide' | 'admin';

const tabs: { id: TabId; label: string; description: string }[] = [
  { id: 'operations', label: '📦 Operação', description: 'Resumo diário e rotas em andamento' },
  { id: 'couriers', label: '🏍️ Motoboys', description: 'Disponibilidade e rotas ativas' },
  { id: 'orders', label: '🧾 Pedidos', description: 'Fila do dia e correções' },
  { id: 'pricing', label: '💰 Regras de preço', description: 'CRUD de faixas e zonas' },
  { id: 'admin', label: '🛠️ Administração', description: 'CRUD completo (pedidos, motoboys, rotas)' },
  { id: 'settings', label: '⚙️ Configurações', description: 'Dados do restaurante e preferências' },
  { id: 'reports', label: '📊 Relatórios', description: 'Histórico e métricas por período' },
  { id: 'guide', label: '🧭 Guia', description: 'Entenda cada status e label do painel' }
];

export default function App() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginEmail, setLoginEmail] = useState('admin@demo.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const isAuthenticated = Boolean(adminUser);
  const { orders, error: ordersError, refetch: refetchOrders } = useOrders(isAuthenticated);
  const { couriers, error: couriersError, fetchCurrentRoute, refetch: refetchCouriers } = useCouriers(isAuthenticated);
  const { routes, error: routesError, refetch: refetchRoutes } = useRoutes(isAuthenticated);
  const {
    current: currentSession,
    history: sessionHistory,
    loading: sessionLoading,
    error: sessionError,
    startDay,
    closeDay
  } = useOperationDay(isAuthenticated);
  const { profile: restaurantProfile, loading: restaurantLoading } = useRestaurant(isAuthenticated);

  const [activeTab, setActiveTab] = useState<TabId>('operations');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [courierRoute, setCourierRoute] = useState<Route | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loadingCourierRoute, setLoadingCourierRoute] = useState(false);
  const [assigningRoute, setAssigningRoute] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const routesSectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollRoutes, setShouldScrollRoutes] = useState(false);
  const [showManualRouteModal, setShowManualRouteModal] = useState(false);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setCheckingSession(false);
      return;
    }
    const storedToken = window.localStorage.getItem('adminToken');
    if (!storedToken) {
      setCheckingSession(false);
      return;
    }
    setAdminToken(storedToken);
    fetchAdminProfile(storedToken)
      .then(profile => {
        setAdminUser(profile);
      })
      .catch(error => {
        console.error(error);
        window.localStorage.removeItem('adminToken');
        setAdminToken(null);
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const { token, admin } = await loginAdmin(loginEmail.trim(), loginPassword.trim());
      setAdminToken(token);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('adminToken', token);
      }
      setAdminUser(admin);
      setLoginPassword('');
    } catch (error) {
      console.error(error);
      setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar. Verifique as credenciais.');
    } finally {
      setLoginLoading(false);
      setCheckingSession(false);
    }
  };

  const handleLogout = () => {
    setAdminUser(null);
    setAdminToken(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('adminToken');
    }
    setActiveTab('operations');
    setSelectedCourier(null);
    setSelectedRoute(null);
  };

  const ordersById = useMemo(() => Object.fromEntries(orders.map((order) => [order.id, order])), [orders]);
  const couriersById = useMemo(() => Object.fromEntries(couriers.map((value) => [value.id, value])), [couriers]);
  const availableCouriers = useMemo(
    () => couriers.filter((courier) => courier.status === 'AVAILABLE'),
    [couriers],
  );

  const visibleOrders = useMemo(() => {
    if (showHistory) return orders;
    if (!currentSession) return [];
    return orders.filter((order) => order.sequence > currentSession.visibleFromSequence);
  }, [orders, currentSession, showHistory]);

  const currentShiftOrders = useMemo(() => {
    if (!currentSession) return [];
    return orders.filter((order) => order.sequence > currentSession.visibleFromSequence);
  }, [orders, currentSession]);

  const visibleOrderIds = useMemo(() => new Set(visibleOrders.map((order) => order.id)), [visibleOrders]);

  const currentShiftOrderIds = useMemo(() => new Set(currentShiftOrders.map((order) => order.id)), [currentShiftOrders]);

  const visibleRoutes = useMemo(() => {
    if (showHistory) return routes;
    if (!currentSession) return [];
    return routes.filter((route) => route.orderIds.some((id) => visibleOrderIds.has(id)));
  }, [routes, currentSession, showHistory, visibleOrderIds]);

  const currentShiftRoutes = useMemo(() => {
    if (!currentSession) return [];
    return routes.filter((route) => route.orderIds.some((id) => currentShiftOrderIds.has(id)));
  }, [routes, currentSession, currentShiftOrderIds]);

  const manualRouteOrders = useMemo(
    () => visibleOrders.filter((order) => order.status === 'PENDING'),
    [visibleOrders],
  );

  useEffect(() => {
    setAssignError(null);
    setAssignSuccess(null);
    setSelectedAssignee('');
  }, [selectedRoute]);

  useEffect(() => {
    setShowHistory(false);
  }, [currentSession?.id]);

  useEffect(() => {
    if (shouldScrollRoutes && activeTab === 'operations') {
      routesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShouldScrollRoutes(false);
    }
  }, [shouldScrollRoutes, activeTab]);

  const courierStatusLabel = (status: Courier['status']) => {
    if (status === 'OFFLINE') return 'Offline';
    if (status === 'AVAILABLE') return 'Aguardando pedidos';
    return 'Em rota';
  };

  const routeStatusLabel: Record<Route['status'], string> = {
    AWAITING_COURIER: 'Aguardando motoboy',
    ASSIGNED: 'Separando pedidos',
    IN_PROGRESS: 'Em rota',
    DONE: 'Finalizada',
  };

  const focusRoutesPanel = () => {
    if (activeTab === 'operations') {
      routesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setShouldScrollRoutes(true);
      setActiveTab('operations');
    }
  };

  const handleOpenManualRoute = () => {
    setShowManualRouteModal(true);
  };

  const handleManualRouteCreation = async (orderIds: string[]) => {
    await createManualRoute(orderIds);
    await Promise.all([refetchOrders(), refetchRoutes()]);
  };

  const handleCloseDayRequest = () => {
    if (!currentSession) return;
    setShowCloseDayModal(true);
  };

  const handleConfirmCloseDay = async () => {
    setShowCloseDayModal(false);
    await closeDay();
  };

  const handleSelectCourier = async (courier: Courier) => {
    setSelectedCourier(courier);
    setSelectedRoute(null);
    setLoadingCourierRoute(true);
    const route = await fetchCurrentRoute(courier.id);
    setCourierRoute(route);
    setLoadingCourierRoute(false);
  };

  const handleSelectRoute = (route: Route) => {
    setSelectedRoute(route);
    setSelectedCourier(null);
  };

  const currentSelectedCourier = selectedCourier
    ? couriers.find((courier) => courier.id === selectedCourier.id) ?? selectedCourier
    : null;

  const currentSelectedRoute = selectedRoute
    ? routes.find((route) => route.id === selectedRoute.id) ?? selectedRoute
    : null;
  const currentRouteOrders = useMemo(() => {
    if (!currentSelectedRoute) return [];
    return currentSelectedRoute.orderIds
      .map((id) => ordersById[id])
      .filter((order): order is NonNullable<typeof order> => Boolean(order));
  }, [currentSelectedRoute, ordersById]);

  const handleAssignSelectedRoute = async () => {
    if (!currentSelectedRoute || !selectedAssignee) return;
    setAssigningRoute(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      await assignRoute(currentSelectedRoute.id, selectedAssignee);
      setAssignSuccess('Rota atribuída com sucesso.');
      setSelectedAssignee('');
      await Promise.all([refetchRoutes(), refetchOrders(), refetchCouriers()]);
    } catch (error) {
      console.error(error);
      setAssignError(error instanceof Error ? error.message : 'Não foi possível atribuir a rota.');
    } finally {
      setAssigningRoute(false);
    }
  };

  const handleAutoAssignRoute = async () => {
    if (!currentSelectedRoute) return;
    setAssigningRoute(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const result = await assignRouteAutomatically(currentSelectedRoute.id);
      setAssignSuccess(`Rota atribuída automaticamente para ${result.courier.name}.`);
      await Promise.all([refetchRoutes(), refetchOrders(), refetchCouriers()]);
    } catch (error) {
      console.error(error);
      setAssignError(error instanceof Error ? error.message : 'Não foi possível atribuir automaticamente.');
    } finally {
      setAssigningRoute(false);
    }
  };

  if (checkingSession) {
    return (
      <Layout>
        <section className="login-panel">
          <h2>Carregando painel...</h2>
          <p className="login-panel__hint">Validando sessão em andamento.</p>
        </section>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <section className="login-panel">
          <h2>Acesso administrativo</h2>
          <p className="login-panel__hint">
            Use suas credenciais para acessar o painel. Padrão: <strong>admin@demo.com</strong> / <strong>admin123</strong>.
          </p>
          {loginError && <p className="login-panel__error">{loginError}</p>}
          <form className="login-panel__form" onSubmit={handleLogin}>
            <label>
              E-mail
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
            </label>
            <button className="button button--primary" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </section>
      </Layout>
    );
  }

  const renderOperations = () => (
    <>
      <section className={`panel shift-panel ${!currentSession ? 'shift-panel--attention' : ''}`}>
        <div className="shift-panel__info">
          {!currentSession ? (
            <>
              <span className="shift-panel__badge">Primeiro passo</span>
              <h3 className="shift-panel__title shift-panel__title--highlight">Abra o turno do dia</h3>
              <p className="shift-panel__hint" style={{ marginBottom: 8 }}>
                Sem turno, não mostramos pedidos nem rotas. Toque em “Abrir turno” para liberar toda a operação.
              </p>
              <p className="shift-panel__subhint">Isso inicia os contadores do dia e informa os motoboys que o restaurante já está operando.</p>
            </>
          ) : (
            <>
              <p className="shift-panel__title">
                Turno aberto em {currentSession.startedAt.toLocaleString()}
              </p>
              <p className="shift-panel__hint">
                Quando o último motoboy retornar, encerre o turno para arquivar todos os pedidos deste período.
              </p>
              {sessionHistory.length > 0 && showHistory && (
                <p className="shift-panel__hint" style={{ marginTop: 12 }}>
                  Histórico recente: {sessionHistory.slice(0, 3).map((session) => session.startedAt.toLocaleDateString()).join(', ')}...
                </p>
              )}
            </>
          )}
          {sessionError && <p className="settings-error" style={{ marginTop: 8 }}>{sessionError}</p>}
        </div>
        <div className="shift-panel__actions">
          <div>
            <p className="shift-panel__cta">{currentSession ? 'Operação em andamento' : 'Clique para começar o dia'}</p>
            <button
              className="button button--primary shift-panel__button"
              onClick={startDay}
              disabled={sessionLoading || Boolean(currentSession)}
            >
              🚀 Abrir turno
            </button>
          </div>
          <button
            className="button shift-panel__button"
            onClick={handleCloseDayRequest}
            disabled={sessionLoading || !currentSession}
          >
            Encerrar turno
          </button>
          <label className="operation-bar__toggle" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(event) => setShowHistory(event.target.checked)}
            />
            Exibir histórico completo
          </label>
        </div>
      </section>
      {!showHistory && currentSession && (
        <p className="panel__subtitle" style={{ marginTop: -8 }}>
          Mostrando apenas pedidos criados após {currentSession.startedAt.toLocaleString()}.
        </p>
      )}
      {showHistory && sessionHistory.length > 0 && (
        <p className="panel__subtitle" style={{ marginTop: -8 }}>
          Histórico recente: {sessionHistory.slice(0, 3).map((session) => session.startedAt.toLocaleDateString()).join(', ')}...
        </p>
      )}

      {currentSession && (
        <SummaryCards
          orders={visibleOrders}
          couriers={couriers}
          routes={visibleRoutes}
          onFocusRoutes={focusRoutesPanel}
          onOpenManualRoute={handleOpenManualRoute}
        />
      )}

      {(ordersError || couriersError || routesError) && (
        <SectionMessage
          message={`Erro ao carregar dados: ${ordersError ?? couriersError ?? routesError}. Verifique se a API está rodando em http://localhost:3000.`}
        />
      )}

      <div ref={routesSectionRef}>
        <RoutesTable routes={visibleRoutes} couriers={couriers} orders={visibleOrders} onSelectRoute={handleSelectRoute} />
      </div>

      {currentSelectedRoute && (
        <DetailPanel title={`Detalhes da rota ${formatShortId(currentSelectedRoute.id)}`}>
          <p><strong>Motoboy:</strong> {currentSelectedRoute.courierId ? couriersById[currentSelectedRoute.courierId]?.name ?? currentSelectedRoute.courierId : 'Não atribuído'}</p>
          <p><strong>Telefone:</strong> {currentSelectedRoute.courierId ? couriersById[currentSelectedRoute.courierId]?.phone ?? '-' : '-'}</p>
          <p><strong>Status:</strong> {routeStatusLabel[currentSelectedRoute.status]}</p>
          {currentSelectedRoute.totalPrice !== undefined && (
            <p><strong>Valor total:</strong> R$ {currentSelectedRoute.totalPrice.toFixed(2)}</p>
          )}
          <p><strong>Criada em:</strong> {new Date(currentSelectedRoute.createdAt).toLocaleString()}</p>
          {currentSelectedRoute.mapsUrl && (
            <p>
              <a href={currentSelectedRoute.mapsUrl} target="_blank" rel="noreferrer">
                Abrir no Maps
              </a>
            </p>
          )}
          <p><strong>Pedidos:</strong></p>
          <ul>
            {currentSelectedRoute.orderIds.map((id) => (
              <li key={id}>
                Pedido {formatShortId(id)} – {ordersById[id]?.address ?? 'Endereço desconhecido'}
                {ordersById[id]?.deliveryPrice !== undefined && ` · R$ ${ordersById[id]?.deliveryPrice?.toFixed(2)}`}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 8px' }}>Visualização no mapa</h4>
            {restaurantLoading && <p className="table-subtitle">Carregando localização do restaurante...</p>}
            {!restaurantLoading && restaurantProfile && currentRouteOrders.length > 0 && (
              <RouteMap restaurant={restaurantProfile} orders={currentRouteOrders} />
            )}
            {!restaurantLoading && restaurantProfile && currentRouteOrders.length === 0 && (
              <p className="table-subtitle">Nenhum pedido com coordenadas para esta rota.</p>
            )}
            {!restaurantLoading && !restaurantProfile && (
              <p className="table-subtitle">Configure o endereço do restaurante na aba Configurações para habilitar o mapa.</p>
            )}
          </div>
          {currentSelectedRoute.status === 'AWAITING_COURIER' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p><strong>Atribuir motoboy</strong></p>
              <select
                value={selectedAssignee}
                onChange={(event) => setSelectedAssignee(event.target.value)}
                className="button"
                disabled={assigningRoute || availableCouriers.length === 0}
              >
                <option value="">Selecione um motoboy disponível</option>
                {availableCouriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>
                    {courier.name} · {courier.phone}
                  </option>
                ))}
              </select>
              {availableCouriers.length === 0 && (
                <p className="table-subtitle">Nenhum motoboy disponível no momento.</p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="button button--primary"
                  disabled={!selectedAssignee || assigningRoute}
                  onClick={handleAssignSelectedRoute}
                >
                  {assigningRoute ? 'Atribuindo...' : 'Atribuir rota'}
                </button>
                <button
                  className="button"
                  disabled={assigningRoute || availableCouriers.length === 0}
                  onClick={handleAutoAssignRoute}
                >
                  {assigningRoute ? 'Atribuindo...' : 'Atribuir automaticamente'}
                </button>
              </div>
              {assignError && <p style={{ color: '#b91c1c', margin: 0 }}>{assignError}</p>}
              {assignSuccess && <p style={{ color: '#15803d', margin: 0 }}>{assignSuccess}</p>}
            </div>
          )}
        </DetailPanel>
      )}
    </>
  );

  const renderCouriersTab = () => (
    <>
      <section className="panel">
        <header className="panel__header">
          <div>
            <h2>Motoboys em operação</h2>
            <p className="panel__subtitle">Acompanhe disponibilidade e rotas em andamento.</p>
          </div>
        </header>
        {couriersError && <SectionMessage message={`Erro ao carregar motoboys: ${couriersError}`} />}
        <CouriersTable couriers={couriers} onSelectCourier={handleSelectCourier} />
      </section>
      {currentSelectedCourier && (
        <DetailPanel title={`Motoboy: ${currentSelectedCourier.name}`}>
          <p><strong>Telefone:</strong> {currentSelectedCourier.phone}</p>
          <p><strong>Situação:</strong> {courierStatusLabel(currentSelectedCourier.status)}</p>
          <p><strong>Código interno:</strong> {formatShortId(currentSelectedCourier.id)}</p>
          {loadingCourierRoute && <p>Carregando rota atual...</p>}
          {!loadingCourierRoute && courierRoute && (
            <div>
              <p>
                <strong>Rota atual:</strong> {formatShortId(courierRoute.id)} ({routeStatusLabel[courierRoute.status]})
              </p>
              {courierRoute.totalPrice !== undefined && (
                <p><strong>Valor total estimado:</strong> R$ {courierRoute.totalPrice.toFixed(2)}</p>
              )}
              <p><strong>Pedidos:</strong></p>
              <ul>
                {courierRoute.orderIds.map((id) => (
                  <li key={id}>
                    Pedido {formatShortId(id)} – {ordersById[id]?.address ?? 'Endereço desconhecido'}{' '}
                    {ordersById[id]?.deliveryPrice !== undefined && ` · R$ ${ordersById[id]?.deliveryPrice?.toFixed(2)}`}
                  </li>
                ))}
              </ul>
              {courierRoute.mapsUrl && (
                <p>
                  <a href={courierRoute.mapsUrl} target="_blank" rel="noreferrer">
                    Abrir no Maps
                  </a>
                </p>
              )}
            </div>
          )}
          {!loadingCourierRoute && !courierRoute && <p>Nenhuma rota ativa para este courier.</p>}
        </DetailPanel>
      )}

      <AdminCouriers couriers={couriers} onRefresh={refetchCouriers} />
    </>
  );

  const renderOrdersTab = () => (
    <>
      <section className="panel">
        <header className="panel__header">
          <div>
            <h2>Pedidos do turno</h2>
            <p className="panel__subtitle">Veja a fila ativa, atualize status ou abra históricos.</p>
          </div>
        </header>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <label className="operation-bar__toggle">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(event) => setShowHistory(event.target.checked)}
            />
            Exibir histórico completo
          </label>
        </div>
        {!showHistory && currentSession && (
          <p className="panel__subtitle" style={{ marginTop: -8 }}>
            Mostrando apenas pedidos criados após {currentSession.startedAt.toLocaleString()}.
          </p>
        )}
        {ordersError && <SectionMessage message={`Erro ao carregar pedidos: ${ordersError}`} />}
        <OrdersTable orders={visibleOrders} couriers={couriers} />
      </section>
      <AdminOrders
        couriers={couriers}
        onRefresh={async () => {
          await refetchOrders();
          await refetchCouriers();
        }}
      />
    </>
  );

  const renderPricing = () => <PricingPanel />;
  const renderAdmin = () => (
    <>
      <section className="panel settings-panel">
        <header className="panel__header">
          <div>
            <h2>Administração</h2>
            <p className="panel__subtitle">Use as ferramentas abaixo para corrigir qualquer dado do sistema.</p>
          </div>
        </header>
      </section>
      <AdminOrders
        couriers={couriers}
        onRefresh={async () => {
          await refetchOrders();
          await refetchCouriers();
        }}
      />
      <AdminCouriers couriers={couriers} onRefresh={refetchCouriers} />
      <AdminRoutes couriers={couriers} onRefresh={async () => {
        await refetchRoutes();
        await refetchOrders();
        await refetchCouriers();
      }} />
      <AdminUsers currentAdmin={adminUser} onSelfUpdate={(admin) => setAdminUser(admin)} />
    </>
  );

  const renderSettings = () => (
    <>
      <RestaurantSettings />
    </>
  );
  const renderReports = () => <ReportsPanel />;
  const renderGuide = () => <StatusGuide />;

  return (
    <Layout adminName={adminUser?.name} onLogout={handleLogout}>
      <nav className="app-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'app-tabs__button app-tabs__button--active' : 'app-tabs__button'}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedCourier(null);
              setSelectedRoute(null);
            }}
          >
            <span className="app-tabs__label">{tab.label}</span>
            <span className="app-tabs__description">{tab.description}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'operations' && renderOperations()}
      {activeTab === 'couriers' && renderCouriersTab()}
      {activeTab === 'orders' && renderOrdersTab()}
      {activeTab === 'pricing' && renderPricing()}
      {activeTab === 'admin' && renderAdmin()}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'reports' && renderReports()}
      {activeTab === 'guide' && renderGuide()}

      {showManualRouteModal && (
        <ManualRouteModal
          orders={manualRouteOrders}
          onClose={() => setShowManualRouteModal(false)}
          onCreateRoute={handleManualRouteCreation}
        />
      )}

      {showCloseDayModal && (
        <div className="close-day-modal__backdrop" role="dialog" aria-modal="true">
          <div className="close-day-modal">
            <header>
              <h3>Encerrar turno agora?</h3>
              <p>Confirme se deseja arquivar os pedidos deste período.</p>
            </header>
            <div className="close-day-modal__actions">
              <button type="button" className="button" onClick={() => setShowCloseDayModal(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleConfirmCloseDay}
                disabled={sessionLoading}
              >
                Confirmar encerramento
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
