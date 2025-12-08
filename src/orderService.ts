import { orders, persistDB } from './db';
import { Order } from './types';
import { v4 as uuid } from 'uuid';
import { onNewOrderCreated } from './scheduler';
import { calculateOrderPrice } from './pricingService';

let nextOrderSequence = orders.reduce((max, order) => Math.max(max, order.sequence ?? 0), 0) + 1;

export function createOrder(address: string, lat: number, lng: number): Order {
  const pricing = calculateOrderPrice(address, lat, lng);

  const order: Order = {
    id: uuid(),
    address,
    lat,
    lng,
    createdAt: new Date(),
    sequence: nextOrderSequence++,
    status: 'PENDING',
    deliveryPrice: pricing.price,
    pricingRule: pricing.rule
  };

  orders.push(order);
  persistDB();
  onNewOrderCreated(order);

  return order;
}
