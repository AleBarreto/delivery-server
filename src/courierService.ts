import { couriers, persistDB } from './db';
import { Courier } from './types';
import { v4 as uuid } from 'uuid';
import { getCourierActiveRoute } from './routeService';

export class CourierAvailabilityError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'CourierAvailabilityError';
  }
}

export function createCourier(name: string, phone: string, pinHash: string): Courier {
  const courier: Courier = {
    id: uuid(),
    name,
    phone,
    pinHash,
    status: 'OFFLINE'
  };

  couriers.push(courier);
  persistDB();
  return courier;
}

export function setCourierAvailable(courierId: string): Courier {
  const courier = couriers.find(c => c.id === courierId);
  if (!courier) {
    throw new CourierAvailabilityError('Courier not found', 404);
  }

  const activeRoute = getCourierActiveRoute(courierId);
  if (activeRoute) {
    throw new CourierAvailabilityError(
      'Finalize a rota atual antes de ficar disponível novamente.',
      409
    );
  }

  courier.status = 'AVAILABLE';

  persistDB();

  return courier;
}

export function setCourierOffline(courierId: string): Courier {
  const courier = couriers.find(c => c.id === courierId);
  if (!courier) {
    throw new CourierAvailabilityError('Courier not found', 404);
  }

  const activeRoute = getCourierActiveRoute(courierId);
  if (activeRoute) {
    throw new CourierAvailabilityError(
      'Finalize a rota atual antes de ficar offline.',
      409
    );
  }

  courier.status = 'OFFLINE';
  persistDB();

  return courier;
}

export function sanitizeCourier(courier: Courier): Omit<Courier, 'pinHash'> {
  // Remove sensitive fields before returning to API consumers
  const { pinHash, ...safeCourier } = courier;
  return safeCourier;
}
