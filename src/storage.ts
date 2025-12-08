import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { Courier, Order, PricingBand, PricingRuleSummary, PricingZone, Route, RestaurantProfile, OperationSession, AdminUser } from './types';

const dataDir = path.join(__dirname, '..', 'data');
const sqliteFile = path.join(dataDir, 'delivery.db');
const legacyJsonFile = path.join(dataDir, 'db.json');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(sqliteFile);
db.pragma('journal_mode = WAL');

initializeDatabase();

interface LegacyOrder extends Omit<Order, 'createdAt' | 'sequence'> {
  createdAt: string;
}

interface LegacyRoute extends Omit<Route, 'createdAt'> {
  createdAt: string;
}

let legacyOrderSequence = 0;

interface LegacyDatabase {
  orders: LegacyOrder[];
  couriers: Courier[];
  routes: LegacyRoute[];
  pricingBands: PricingBand[];
  pricingZones: PricingZone[];
}

interface CountRow {
  count: number;
}

interface OrderRow {
  id: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
  sequence: number;
  status: string;
  courier_id: string | null;
  route_id: string | null;
  delivery_price: number | null;
  pricing_rule_type: string | null;
  pricing_rule_label: string | null;
}

interface RouteRow {
  id: string;
  courier_id: string | null;
  order_ids: string;
  status: string;
  created_at: string;
  maps_url: string | null;
  total_price: number | null;
}

interface PricingBandRow {
  id: string;
  max_distance_km: number;
  price: number;
}

interface PricingZoneRow {
  id: string;
  name: string;
  match_text: string;
  price: number;
}

interface CourierRow {
  id: string;
  name: string;
  phone: string;
  pin_hash: string;
  status: string;
}

interface TableInfoRow {
  name: string;
  notnull: number;
}

interface RestaurantProfileRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  contact_phone: string | null;
  max_radius_km: number;
  min_batch: number | null;
  max_batch: number | null;
  max_wait_minutes: number | null;
  smart_batch_hold_minutes: number | null;
}

interface OperationSessionRow {
  id: string;
  started_at: string;
  visible_from: string | null;
  visible_from_sequence: number | null;
  closed_at: string | null;
}

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}

export interface DatabaseData {
  orders: Order[];
  couriers: Courier[];
  routes: Route[];
  pricingBands: PricingBand[];
  pricingZones: PricingZone[];
  restaurantProfile: RestaurantProfile;
  operationSessions: OperationSession[];
  adminUsers: AdminUser[];
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS couriers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      created_at TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      status TEXT NOT NULL,
      courier_id TEXT,
      route_id TEXT,
      delivery_price REAL,
      pricing_rule_type TEXT,
      pricing_rule_label TEXT
    );

    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      courier_id TEXT,
      order_ids TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      maps_url TEXT,
      total_price REAL
    );

    CREATE TABLE IF NOT EXISTS pricing_bands (
      id TEXT PRIMARY KEY,
      max_distance_km REAL NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pricing_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      match_text TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurant_profile (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      contact_phone TEXT,
      max_radius_km REAL NOT NULL,
      min_batch INTEGER,
      max_batch INTEGER,
      max_wait_minutes INTEGER,
      smart_batch_hold_minutes INTEGER
    );

    CREATE TABLE IF NOT EXISTS operation_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      visible_from TEXT,
      visible_from_sequence INTEGER DEFAULT 0,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
  `);

  ensureOrdersTableSchema();
  ensureRoutesTableSchema();
  ensureOperationSessionsSchema();
  ensureRestaurantProfileSchema();
  ensureRestaurantProfile();
  migrateLegacyDataIfNeeded();
  ensureDefaultPricingBands();
  ensureDefaultAdminUser();
}

function ensureRoutesTableSchema() {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='routes'")
    .get() as { name?: string } | undefined;
  if (!exists) return;

  const columns = db.prepare('PRAGMA table_info(routes)').all() as TableInfoRow[];
  const courierColumn = columns.find(column => column.name === 'courier_id');

  if (courierColumn && courierColumn.notnull === 1) {
    console.log('[storage] Atualizando schema de routes para permitir courier_id nulo.');
    db.exec(`
      ALTER TABLE routes RENAME TO routes_backup;
      CREATE TABLE routes (
        id TEXT PRIMARY KEY,
        courier_id TEXT,
        order_ids TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        maps_url TEXT,
        total_price REAL
      );
      INSERT INTO routes (
        id,
        courier_id,
        order_ids,
        status,
        created_at,
        maps_url,
        total_price
      )
      SELECT
        id,
        courier_id,
        order_ids,
        status,
        created_at,
        maps_url,
        total_price
      FROM routes_backup;
      DROP TABLE routes_backup;
    `);
  }
}

function ensureOrdersTableSchema() {
  const columns = db.prepare('PRAGMA table_info(orders)').all() as TableInfoRow[];
  const hasSequence = columns.some(column => column.name === 'sequence');
  if (!hasSequence) {
    console.log('[storage] Adicionando coluna sequence em orders.');
    db.prepare('ALTER TABLE orders ADD COLUMN sequence INTEGER').run();
    db.prepare('UPDATE orders SET sequence = rowid').run();
  }
}

function ensureOperationSessionsSchema() {
  const columns = db.prepare('PRAGMA table_info(operation_sessions)').all() as TableInfoRow[];
  const hasVisibleFrom = columns.some(column => column.name === 'visible_from');
  const hasSequence = columns.some(column => column.name === 'visible_from_sequence');
  if (!hasVisibleFrom) {
    console.log('[storage] Adicionando coluna visible_from em operation_sessions.');
    db.prepare('ALTER TABLE operation_sessions ADD COLUMN visible_from TEXT').run();
    db.prepare('UPDATE operation_sessions SET visible_from = started_at').run();
  }
  if (!hasSequence) {
    console.log('[storage] Adicionando coluna visible_from_sequence em operation_sessions.');
    db.prepare('ALTER TABLE operation_sessions ADD COLUMN visible_from_sequence INTEGER DEFAULT 0').run();
    db.prepare('UPDATE operation_sessions SET visible_from_sequence = 0').run();
  }
}

function ensureRestaurantProfileSchema() {
  const columns = db.prepare('PRAGMA table_info(restaurant_profile)').all() as TableInfoRow[];
  const col = (name: string) => columns.some(column => column.name === name);
  if (!col('min_batch')) {
    console.log('[storage] Adicionando coluna min_batch em restaurant_profile.');
    db.prepare('ALTER TABLE restaurant_profile ADD COLUMN min_batch INTEGER').run();
  }
  if (!col('max_batch')) {
    console.log('[storage] Adicionando coluna max_batch em restaurant_profile.');
    db.prepare('ALTER TABLE restaurant_profile ADD COLUMN max_batch INTEGER').run();
  }
  if (!col('max_wait_minutes')) {
    console.log('[storage] Adicionando coluna max_wait_minutes em restaurant_profile.');
    db.prepare('ALTER TABLE restaurant_profile ADD COLUMN max_wait_minutes INTEGER').run();
  }
  if (!col('smart_batch_hold_minutes')) {
    console.log('[storage] Adicionando coluna smart_batch_hold_minutes em restaurant_profile.');
    db.prepare('ALTER TABLE restaurant_profile ADD COLUMN smart_batch_hold_minutes INTEGER').run();
  }
}

function ensureDefaultPricingBands() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM pricing_bands').get() as CountRow;
  if (count > 0) return;

  const defaults: PricingBand[] = [
    { id: randomUUID(), maxDistanceKm: 3, price: 5 },
    { id: randomUUID(), maxDistanceKm: 10, price: 10 },
    { id: randomUUID(), maxDistanceKm: 30, price: 15 }
  ];

  const insert = db.prepare(`
    INSERT INTO pricing_bands (id, max_distance_km, price)
    VALUES (@id, @maxDistanceKm, @price)
  `);

  const tx = db.transaction(() => {
    defaults.forEach(band => insert.run(band));
  });

  tx();
}

function isDatabaseEmpty(): boolean {
  const tables = ['orders', 'couriers', 'routes', 'pricing_bands', 'pricing_zones'];
  return tables.every(table => {
    const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as CountRow;
    return count === 0;
  });
}

function reviveLegacyOrder(order: LegacyOrder): Order {
  return {
    ...order,
    createdAt: new Date(order.createdAt),
    sequence: legacyOrderSequence++
  };
}

function reviveLegacyRoute(route: LegacyRoute): Route {
  return {
    ...route,
    createdAt: new Date(route.createdAt)
  };
}

function migrateLegacyDataIfNeeded() {
  if (!fs.existsSync(legacyJsonFile) || !isDatabaseEmpty()) {
    return;
  }

  try {
    const content = fs.readFileSync(legacyJsonFile, 'utf-8');
    const raw = JSON.parse(content) as LegacyDatabase;

    const data: DatabaseData = {
      orders: (raw.orders ?? []).map(reviveLegacyOrder),
      couriers: raw.couriers ?? [],
      routes: (raw.routes ?? []).map(reviveLegacyRoute),
      pricingBands: raw.pricingBands ?? [],
      pricingZones: raw.pricingZones ?? [],
      restaurantProfile: getRestaurantProfile(),
      operationSessions: [],
      adminUsers: []
    };

    saveDatabase(data);
    console.log('[storage] Dados migrados de db.json para SQLite.');
  } catch (err) {
    console.error('[storage] Falha ao migrar dados legados de db.json', err);
  }
}

function mapOrderRow(row: OrderRow): Order {
  const pricingRule =
    row.pricing_rule_type != null
      ? {
          type: row.pricing_rule_type as PricingRuleSummary['type'],
          label: row.pricing_rule_label ?? ''
        }
      : undefined;

  return {
    id: row.id,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    createdAt: new Date(row.created_at),
    sequence: row.sequence ?? 0,
    status: row.status as Order['status'],
    courierId: row.courier_id ?? undefined,
    routeId: row.route_id ?? undefined,
    deliveryPrice: row.delivery_price ?? undefined,
    pricingRule
  };
}

function mapRouteRow(row: RouteRow): Route {
  let orderIds: string[] = [];
  if (row.order_ids) {
    try {
      const parsed = JSON.parse(row.order_ids);
      if (Array.isArray(parsed)) {
        orderIds = parsed;
      }
    } catch {
      orderIds = [];
    }
  }

  return {
    id: row.id,
    courierId: row.courier_id ?? undefined,
    orderIds,
    status: row.status as Route['status'],
    createdAt: new Date(row.created_at),
    mapsUrl: row.maps_url ?? undefined,
    totalPrice: row.total_price ?? undefined
  };
}

export function loadDatabase(): DatabaseData {
  const orderRows = db.prepare('SELECT * FROM orders').all() as OrderRow[];
  const orders = orderRows.map(mapOrderRow);
  const courierRows = db.prepare('SELECT * FROM couriers').all() as CourierRow[];
  const couriers = courierRows.map(row => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    pinHash: row.pin_hash,
    status: row.status as Courier['status']
  }));
  const routeRows = db.prepare('SELECT * FROM routes').all() as RouteRow[];
  const routes = routeRows.map(mapRouteRow);
  const pricingBandRows = db.prepare('SELECT * FROM pricing_bands ORDER BY max_distance_km ASC').all() as PricingBandRow[];
  const pricingBands = pricingBandRows.map(row => ({
      id: row.id,
      maxDistanceKm: row.max_distance_km,
      price: row.price
    }));
  const pricingZoneRows = db.prepare('SELECT * FROM pricing_zones').all() as PricingZoneRow[];
  const pricingZones = pricingZoneRows.map(row => ({
    id: row.id,
    name: row.name,
    matchText: row.match_text,
    price: row.price
  }));
  const restaurantProfile = getRestaurantProfile();
  const sessionRows = db.prepare('SELECT * FROM operation_sessions ORDER BY started_at DESC').all() as OperationSessionRow[];
  const operationSessions = sessionRows.map(mapOperationSession);
  const adminUserRows = db.prepare('SELECT * FROM admin_users').all() as AdminUserRow[];
  const adminUsers = adminUserRows.map(mapAdminUser);

  return {
    orders,
    couriers,
    routes,
    pricingBands,
    pricingZones,
    restaurantProfile,
    operationSessions,
    adminUsers
  };
}

function serializeOrder(order: Order): OrderRow {
  return {
    id: order.id,
    address: order.address,
    lat: order.lat,
    lng: order.lng,
    created_at: order.createdAt.toISOString(),
    sequence: order.sequence,
    status: order.status,
    courier_id: order.courierId ?? null,
    route_id: order.routeId ?? null,
    delivery_price: order.deliveryPrice ?? null,
    pricing_rule_type: order.pricingRule?.type ?? null,
    pricing_rule_label: order.pricingRule?.label ?? null
  };
}

function serializeRoute(route: Route): RouteRow {
  return {
    id: route.id,
    courier_id: route.courierId ?? null,
    order_ids: JSON.stringify(route.orderIds ?? []),
    status: route.status,
    created_at: route.createdAt.toISOString(),
    maps_url: route.mapsUrl ?? null,
    total_price: route.totalPrice ?? null
  };
}

export function saveDatabase(data: DatabaseData) {
  const tx = db.transaction((payload: DatabaseData) => {
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM couriers').run();
    db.prepare('DELETE FROM routes').run();
    db.prepare('DELETE FROM pricing_bands').run();
    db.prepare('DELETE FROM pricing_zones').run();
    db.prepare('DELETE FROM restaurant_profile').run();
    db.prepare('DELETE FROM operation_sessions').run();
    db.prepare('DELETE FROM admin_users').run();

    const insertCourier = db.prepare(`
      INSERT INTO couriers (id, name, phone, pin_hash, status)
      VALUES (@id, @name, @phone, @pinHash, @status)
    `);
    payload.couriers.forEach(courier => insertCourier.run(courier));

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id,
        address,
        lat,
        lng,
        created_at,
        sequence,
        status,
        courier_id,
        route_id,
        delivery_price,
        pricing_rule_type,
        pricing_rule_label
      ) VALUES (
        @id,
        @address,
        @lat,
        @lng,
        @created_at,
        @sequence,
        @status,
        @courier_id,
        @route_id,
        @delivery_price,
        @pricing_rule_type,
        @pricing_rule_label
      )
    `);
    payload.orders.map(serializeOrder).forEach(order => insertOrder.run(order));

    const insertRoute = db.prepare(`
      INSERT INTO routes (
        id,
        courier_id,
        order_ids,
        status,
        created_at,
        maps_url,
        total_price
      ) VALUES (
        @id,
        @courier_id,
        @order_ids,
        @status,
        @created_at,
        @maps_url,
        @total_price
      )
    `);
    payload.routes.map(serializeRoute).forEach(route => insertRoute.run(route));

    const insertBand = db.prepare(`
      INSERT INTO pricing_bands (id, max_distance_km, price)
      VALUES (@id, @maxDistanceKm, @price)
    `);
    payload.pricingBands.forEach(band => insertBand.run(band));

    const insertZone = db.prepare(`
      INSERT INTO pricing_zones (id, name, match_text, price)
      VALUES (@id, @name, @matchText, @price)
    `);
    payload.pricingZones.forEach(zone => insertZone.run(zone));

    db.prepare(`
      INSERT INTO restaurant_profile (
        id, name, address, lat, lng, contact_phone, max_radius_km, min_batch, max_batch, max_wait_minutes, smart_batch_hold_minutes
      )
      VALUES (@id, @name, @address, @lat, @lng, @contactPhone, @maxRadiusKm, @minBatch, @maxBatch, @maxWaitMinutes, @smartBatchHoldMinutes)
    `).run({
      id: payload.restaurantProfile.id,
      name: payload.restaurantProfile.name,
      address: payload.restaurantProfile.address,
      lat: payload.restaurantProfile.lat,
      lng: payload.restaurantProfile.lng,
      contactPhone: payload.restaurantProfile.contactPhone ?? null,
      maxRadiusKm: payload.restaurantProfile.maxRadiusKm,
      minBatch: payload.restaurantProfile.minBatch ?? null,
      maxBatch: payload.restaurantProfile.maxBatch ?? null,
      maxWaitMinutes: payload.restaurantProfile.maxWaitMinutes ?? null,
      smartBatchHoldMinutes: payload.restaurantProfile.smartBatchHoldMinutes ?? null
    });

    const insertSession = db.prepare(`
      INSERT INTO operation_sessions (id, started_at, visible_from, visible_from_sequence, closed_at)
      VALUES (@id, @started_at, @visible_from, @visible_from_sequence, @closed_at)
    `);
    payload.operationSessions.forEach(session =>
      insertSession.run({
        id: session.id,
        started_at: session.startedAt.toISOString(),
        visible_from: session.visibleFrom.toISOString(),
        visible_from_sequence: session.visibleFromSequence,
        closed_at: session.closedAt ? session.closedAt.toISOString() : null
      })
    );

    const insertAdmin = db.prepare(`
      INSERT INTO admin_users (id, name, email, password_hash)
      VALUES (@id, @name, @email, @passwordHash)
    `);
    payload.adminUsers.forEach(admin => insertAdmin.run(admin));
  });

  tx(data);
}

function ensureRestaurantProfile() {
  const row = db.prepare('SELECT COUNT(*) as count FROM restaurant_profile').get() as CountRow;
  if (row.count > 0) return;

  db.prepare(`
    INSERT INTO restaurant_profile (id, name, address, lat, lng, contact_phone, max_radius_km, min_batch, max_batch, max_wait_minutes, smart_batch_hold_minutes)
    VALUES (@id, @name, @address, @lat, @lng, @contactPhone, @maxRadiusKm, @minBatch, @maxBatch, @maxWaitMinutes, @smartBatchHoldMinutes)
  `).run({
    id: randomUUID(),
    name: 'Spetto House',
    address: 'R. Profa. Clotilde Pinheiro, 550 - São Jorge, Manaus - AM, 69033-660',
    lat: -3.1120367,
    lng: -60.0348224,
    contactPhone: null,
    maxRadiusKm: 15,
    minBatch: 2,
    maxBatch: 5,
    maxWaitMinutes: 25,
    smartBatchHoldMinutes: 5
  });
}

function mapRestaurantProfile(row: RestaurantProfileRow): RestaurantProfile {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    contactPhone: row.contact_phone ?? undefined,
    maxRadiusKm: row.max_radius_km,
    minBatch: row.min_batch ?? undefined,
    maxBatch: row.max_batch ?? undefined,
    maxWaitMinutes: row.max_wait_minutes ?? undefined,
    smartBatchHoldMinutes: row.smart_batch_hold_minutes ?? undefined
  };
}

function getRestaurantProfile(): RestaurantProfile {
  const row = db.prepare('SELECT * FROM restaurant_profile LIMIT 1').get() as RestaurantProfileRow;
  return mapRestaurantProfile(row);
}

function mapOperationSession(row: OperationSessionRow): OperationSession {
  return {
    id: row.id,
    startedAt: new Date(row.started_at),
    visibleFrom: row.visible_from ? new Date(row.visible_from) : new Date(row.started_at),
    visibleFromSequence: row.visible_from_sequence ?? 0,
    closedAt: row.closed_at ? new Date(row.closed_at) : undefined
  };
}

function mapAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash
  };
}

function ensureDefaultAdminUser() {
  const row = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as CountRow;
  if (row.count > 0) return;

  const defaultHash = '$2a$10$8ilZlx1ncIjnFbtuFN2b2.ZtUGlpobizW4eFousx6Dz4vhRHVD2Zq'; // admin123
  db.prepare(`
    INSERT INTO admin_users (id, name, email, password_hash)
    VALUES (@id, @name, @email, @passwordHash)
  `).run({
    id: randomUUID(),
    name: 'Administrador',
    email: 'admin@demo.com',
    passwordHash: defaultHash
  });
}
