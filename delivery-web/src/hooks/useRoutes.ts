import { useCallback, useEffect, useState } from 'react';
import { fetchRoutes } from '../api/client';
import { Route } from '../types';

interface RoutesState {
  routes: Route[];
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

const REFRESH_MS = 5000;

export function useRoutes(): RoutesState {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadRoutes = useCallback(async () => {
    try {
      const data = await fetchRoutes();
      setRoutes(data);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar rotas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
    const id = setInterval(loadRoutes, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadRoutes]);

  return { routes, loading, error, refetch: loadRoutes };
}
