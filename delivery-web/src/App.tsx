import React, { useMemo, useState } from 'react';
import Layout from './components/Layout/Layout';
import SummaryCards from './components/Dashboard/SummaryCards';
import OrdersTable from './components/Dashboard/OrdersTable';
import CouriersTable from './components/Dashboard/CouriersTable';
import RoutesTable from './components/Dashboard/RoutesTable';
import { useOrders } from './hooks/useOrders';
import { useCouriers } from './hooks/useCouriers';
import { useRoutes } from './hooks/useRoutes';
import { Courier, Route } from './types';

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

export default function App() {
  const { orders, error: ordersError } = useOrders();
  const { couriers, error: couriersError, markAvailable, fetchCurrentRoute } = useCouriers();
  const { routes, error: routesError } = useRoutes();

  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [courierRoute, setCourierRoute] = useState<Route | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loadingCourierRoute, setLoadingCourierRoute] = useState(false);

  const ordersById = useMemo(() => Object.fromEntries(orders.map((order) => [order.id, order])), [orders]);

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

  return (
    <Layout>
      <SummaryCards orders={orders} couriers={couriers} routes={routes} />

      {(ordersError || couriersError || routesError) && (
        <SectionMessage
          message={`Erro ao carregar dados: ${ordersError ?? couriersError ?? routesError}. Verifique se a API está rodando em http://localhost:3000.`}
        />
      )}

      <OrdersTable orders={orders} />

      <CouriersTable couriers={couriers} onMarkAvailable={markAvailable} onSelectCourier={handleSelectCourier} />

      {selectedCourier && (
        <DetailPanel title={`Courier selecionado: ${selectedCourier.name}`}>
          <p><strong>Status:</strong> {selectedCourier.status}</p>
          <p><strong>ID:</strong> {selectedCourier.id}</p>
          {loadingCourierRoute && <p>Carregando rota atual...</p>}
          {!loadingCourierRoute && courierRoute && (
            <div>
              <p>
                <strong>Rota atual:</strong> {courierRoute.id} ({courierRoute.status})
              </p>
              <p><strong>Pedidos:</strong></p>
              <ul>
                {courierRoute.orderIds.map((id) => (
                  <li key={id}>
                    {id} – {ordersById[id]?.address ?? 'Endereço desconhecido'}
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

      <RoutesTable routes={routes} onSelectRoute={handleSelectRoute} />

      {selectedRoute && (
        <DetailPanel title={`Detalhes da rota ${selectedRoute.id}`}>
          <p><strong>Courier:</strong> {selectedRoute.courierId}</p>
          <p><strong>Status:</strong> {selectedRoute.status}</p>
          <p><strong>Criada em:</strong> {new Date(selectedRoute.createdAt).toLocaleString()}</p>
          {selectedRoute.mapsUrl && (
            <p>
              <a href={selectedRoute.mapsUrl} target="_blank" rel="noreferrer">
                Abrir no Maps
              </a>
            </p>
          )}
          <p><strong>Pedidos:</strong></p>
          <ul>
            {selectedRoute.orderIds.map((id) => (
              <li key={id}>
                {id} – {ordersById[id]?.address ?? 'Endereço desconhecido'}
              </li>
            ))}
          </ul>
        </DetailPanel>
      )}
    </Layout>
  );
}
