import { useCallback, useEffect, useState } from 'react';
import { fetchCouriers, fetchCourierCurrentRoute, setCourierAvailable } from '../api/client';
import { Courier, Route } from '../types';

interface CouriersState {
  couriers: Courier[];
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
  markAvailable: (id: string) => Promise<void>;
  fetchCurrentRoute: (id: string) => Promise<Route | null>;
}

const REFRESH_MS = 5000;

export function useCouriers(): CouriersState {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadCouriers = useCallback(async () => {
    try {
      const data = await fetchCouriers();
      setCouriers(data);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar couriers');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAvailable = useCallback(async (id: string) => {
    await setCourierAvailable(id);
    await loadCouriers();
  }, [loadCouriers]);

  const fetchCurrentRoute = useCallback(async (id: string) => {
    try {
      return await fetchCourierCurrentRoute(id);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar rota do courier');
      return null;
    }
  }, []);

  useEffect(() => {
    loadCouriers();
    const id = setInterval(loadCouriers, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadCouriers]);

  return { couriers, loading, error, refetch: loadCouriers, markAvailable, fetchCurrentRoute };
}
