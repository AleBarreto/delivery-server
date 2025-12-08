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

export function useRoutes(enabled = true): RoutesState {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string>();

  const loadRoutes = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const result = await fetchRoutes();
      setRoutes(result.data);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar rotas');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setRoutes([]);
      setLoading(false);
      setError(undefined);
      return;
    }
    loadRoutes();
    const id = setInterval(loadRoutes, REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, loadRoutes]);

  return { routes, loading, error, refetch: loadRoutes };
}
