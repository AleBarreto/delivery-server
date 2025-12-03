import { useCallback, useEffect, useState } from 'react';
import { fetchOrders } from '../api/client';
import { Order } from '../types';

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

const REFRESH_MS = 5000;

export function useOrders(): OrdersState {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrders();
      setOrders(data);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const id = setInterval(loadOrders, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadOrders]);

  return { orders, loading, error, refetch: loadOrders };
}
