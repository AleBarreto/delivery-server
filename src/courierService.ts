import { couriers } from './db';
import { Courier } from './types';
import { v4 as uuid } from 'uuid';
import { onCourierAvailable } from './scheduler';

export function createCourier(name: string): Courier {
  const courier: Courier = {
    id: uuid(),
    name,
    status: 'AVAILABLE'
  };

  couriers.push(courier);
  return courier;
}

export function setCourierAvailable(courierId: string): Courier | null {
  const courier = couriers.find(c => c.id === courierId);
  if (!courier) return null;

  courier.status = 'AVAILABLE';

  // dispara a lógica de roteirização baseada em distância
  onCourierAvailable(courier);

  return courier;
}
