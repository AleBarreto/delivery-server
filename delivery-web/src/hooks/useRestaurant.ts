import { useEffect, useState } from 'react';
import { RestaurantProfile } from '../types';
import { fetchRestaurantProfile, updateRestaurantProfile as apiUpdateRestaurantProfile } from '../api/client';

export function useRestaurant(enabled = true) {
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchRestaurantProfile();
      setProfile(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar restaurante');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<Omit<RestaurantProfile, 'id'>>) => {
    if (!profile) return;
    const payload = {
      name: data.name ?? profile.name,
      address: data.address ?? profile.address,
      lat: data.lat ?? profile.lat,
      lng: data.lng ?? profile.lng,
      contactPhone: data.contactPhone ?? profile.contactPhone,
      maxRadiusKm: data.maxRadiusKm ?? profile.maxRadiusKm,
      minBatch: data.minBatch ?? profile.minBatch ?? undefined,
      maxBatch: data.maxBatch ?? profile.maxBatch ?? undefined,
      maxWaitMinutes: data.maxWaitMinutes ?? profile.maxWaitMinutes ?? undefined,
      smartBatchHoldMinutes: data.smartBatchHoldMinutes ?? profile.smartBatchHoldMinutes ?? undefined,
    };

    try {
      const updated = await apiUpdateRestaurantProfile(payload);
      setProfile(updated);
      setError(null);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  useEffect(() => {
    if (!enabled) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    fetchProfile();
  }, [enabled]);

  return { profile, loading, error, refetch: fetchProfile, updateProfile };
}
