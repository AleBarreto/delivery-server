import { orders } from './db';
import { Order } from './types';
import { v4 as uuid } from 'uuid';
import { onNewOrderCreated } from './scheduler';

export function createOrder(address: string, lat: number, lng: number): Order {
  const order: Order = {
    id: uuid(),
    address,
    lat,
    lng,
    createdAt: new Date(),
    status: 'PENDING'
  };

  orders.push(order);
  onNewOrderCreated(order);

  return order;
}
