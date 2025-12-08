import { useCallback, useEffect, useState } from 'react';
import { fetchOperationDay, closeOperationDay, startOperationDay, OperationDayResponse } from '../api/client';

export function useOperationDay(enabled = true) {
  const [data, setData] = useState<OperationDayResponse>({ current: null, history: [] });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const payload = await fetchOperationDay();
      setData(payload);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar status do dia.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const startDay = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const payload = await startOperationDay();
      setData(payload);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao iniciar dia.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const closeDayAction = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const payload = await closeOperationDay();
      setData(payload);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao fechar dia.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setData({ current: null, history: [] });
      setLoading(false);
      setError(null);
      return;
    }
    fetchData();
  }, [enabled, fetchData]);

  return { ...data, loading, error, refetch: fetchData, startDay, closeDay: closeDayAction };
}
