import { useCallback, useEffect, useState } from 'react';
import { fetchCouriers, fetchCourierCurrentRoute } from '../api/client';
import { Courier, Route } from '../types';

interface CouriersState {
  couriers: Courier[];
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
  fetchCurrentRoute: (id: string) => Promise<Route | null>;
}

const REFRESH_MS = 5000;

export function useCouriers(enabled = true): CouriersState {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string>();

  const loadCouriers = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const result = await fetchCouriers();
      setCouriers(result.data);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar couriers');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const fetchCurrentRoute = useCallback(async (id: string) => {
    if (!enabled) return null;
    try {
      return await fetchCourierCurrentRoute(id);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar rota do courier');
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCouriers([]);
      setLoading(false);
      setError(undefined);
      return;
    }
    loadCouriers();
    const id = setInterval(loadCouriers, REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, loadCouriers]);

  return { couriers, loading, error, refetch: loadCouriers, fetchCurrentRoute };
}
