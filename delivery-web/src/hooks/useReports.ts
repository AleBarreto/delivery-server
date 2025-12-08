import { useState } from 'react';
import { OrdersReport } from '../types';
import { fetchOrdersReport } from '../api/client';

export function useOrdersReport(defaultFrom: Date, defaultTo: Date) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<OrdersReport | null>(null);

  const fetchReport = async (overrideFrom?: Date, overrideTo?: Date) => {
    const fromDate = overrideFrom ?? from;
    const toDate = overrideTo ?? to;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrdersReport(fromDate, toDate);
      setReport(data);
      setFrom(fromDate);
      setTo(toDate);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  return { report, loading, error, from, to, fetchReport };
}
