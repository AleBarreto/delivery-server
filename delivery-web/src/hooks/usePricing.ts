import { useCallback, useEffect, useState } from 'react';
import {
  fetchPricingBands,
  fetchPricingZones,
  createPricingBand,
  updatePricingBand,
  deletePricingBand,
  createPricingZone,
  updatePricingZone,
  deletePricingZone,
} from '../api/client';
import { PricingBand, PricingZone } from '../types';

export interface PricingState {
  bands: PricingBand[];
  zones: PricingZone[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  addBand: (maxDistanceKm: number, price: number) => Promise<void>;
  editBand: (id: string, maxDistanceKm: number, price: number) => Promise<void>;
  removeBand: (id: string) => Promise<void>;
  addZone: (name: string, matchText: string, price: number) => Promise<void>;
  editZone: (id: string, data: Partial<Omit<PricingZone, 'id'>>) => Promise<void>;
  removeZone: (id: string) => Promise<void>;
}

export function usePricing(): PricingState {
  const [bands, setBands] = useState<PricingBand[]>([]);
  const [zones, setZones] = useState<PricingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [bandsData, zonesData] = await Promise.all([fetchPricingBands(), fetchPricingZones()]);
      setBands(bandsData);
      setZones(zonesData);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as regras de preço');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addBand = useCallback(async (maxDistanceKm: number, price: number) => {
    await createPricingBand(maxDistanceKm, price);
    await loadAll();
  }, [loadAll]);

  const editBand = useCallback(async (id: string, maxDistanceKm: number, price: number) => {
    await updatePricingBand(id, maxDistanceKm, price);
    await loadAll();
  }, [loadAll]);

  const removeBand = useCallback(async (id: string) => {
    await deletePricingBand(id);
    await loadAll();
  }, [loadAll]);

  const addZone = useCallback(async (name: string, matchText: string, price: number) => {
    await createPricingZone(name, matchText, price);
    await loadAll();
  }, [loadAll]);

  const editZone = useCallback(async (id: string, data: Partial<Omit<PricingZone, 'id'>>) => {
    await updatePricingZone(id, data);
    await loadAll();
  }, [loadAll]);

  const removeZone = useCallback(async (id: string) => {
    await deletePricingZone(id);
    await loadAll();
  }, [loadAll]);

  return {
    bands,
    zones,
    loading,
    error,
    refresh: loadAll,
    addBand,
    editBand,
    removeBand,
    addZone,
    editZone,
    removeZone,
  };
}
