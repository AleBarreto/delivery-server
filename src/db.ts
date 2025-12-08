import { Courier, Order, PricingBand, PricingZone, Route, RestaurantProfile, OperationSession, AdminUser } from './types';
import { loadDatabase, saveDatabase, DatabaseData } from './storage';

const database: DatabaseData = loadDatabase();

export const orders: Order[] = database.orders;
export const couriers: Courier[] = database.couriers;
export const routes: Route[] = database.routes;
export const pricingBands: PricingBand[] = database.pricingBands;
export const pricingZones: PricingZone[] = database.pricingZones;
export const restaurantProfile: RestaurantProfile = database.restaurantProfile;
export const operationSessions: OperationSession[] = database.operationSessions;
export const adminUsers: AdminUser[] = database.adminUsers;

export function persistDB() {
  saveDatabase(database);
}
