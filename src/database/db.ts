import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
export const getDb = () => { if (!db) db = SQLite.openDatabaseSync('parkease.db'); return db; };

export function initializeDatabase() {
  const database = getDb();
  database.execSync(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS business_settings (id INTEGER PRIMARY KEY CHECK (id=1), business_name TEXT NOT NULL, contact TEXT, address TEXT, receipt_footer TEXT NOT NULL, paper_width INTEGER NOT NULL DEFAULT 58, capacity INTEGER NOT NULL DEFAULT 100, long_stay_minutes INTEGER NOT NULL DEFAULT 360);
    CREATE TABLE IF NOT EXISTS vehicle_types (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS parking_rates (vehicle_type TEXT PRIMARY KEY REFERENCES vehicle_types(id), pricing_model TEXT NOT NULL, base_rate REAL NOT NULL, hourly_rate REAL NOT NULL, grace_minutes INTEGER NOT NULL, minimum_charge REAL NOT NULL, maximum_daily_charge REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS parking_tickets (id TEXT PRIMARY KEY NOT NULL, plate TEXT NOT NULL, normalized_plate TEXT NOT NULL, vehicle_type TEXT NOT NULL REFERENCES vehicle_types(id), entry_at TEXT NOT NULL, exit_at TEXT, status TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, payment_status TEXT NOT NULL, payment_method TEXT, paid_at TEXT, qr_payload TEXT NOT NULL UNIQUE, rate_snapshot TEXT NOT NULL, printing_status TEXT NOT NULL DEFAULT 'pending', created_by TEXT);
    CREATE INDEX IF NOT EXISTS idx_ticket_active_plate ON parking_tickets(normalized_plate, status);
    CREATE INDEX IF NOT EXISTS idx_ticket_entry ON parking_tickets(entry_at);
    CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL REFERENCES parking_tickets(id), amount REAL NOT NULL, payment_method TEXT NOT NULL, payment_at TEXT NOT NULL, transaction_type TEXT NOT NULL DEFAULT 'payment');
    CREATE TABLE IF NOT EXISTS watchlist_vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT, plate TEXT NOT NULL, normalized_plate TEXT NOT NULL, category TEXT NOT NULL, make_model TEXT, color TEXT, reason TEXT NOT NULL, source TEXT, reference TEXT, contact TEXT, reported_at TEXT NOT NULL, notes TEXT, status TEXT NOT NULL DEFAULT 'active');
    CREATE INDEX IF NOT EXISTS idx_watchlist_plate ON watchlist_vehicles(normalized_plate, status);
    CREATE TABLE IF NOT EXISTS watchlist_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT, watchlist_id INTEGER NOT NULL REFERENCES watchlist_vehicles(id), match_type TEXT NOT NULL, alert_at TEXT NOT NULL, details TEXT);
    CREATE TABLE IF NOT EXISTS licenses (id INTEGER PRIMARY KEY AUTOINCREMENT, license_id TEXT NOT NULL, signed_payload TEXT NOT NULL, active INTEGER NOT NULL, issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, device_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS operators (id INTEGER PRIMARY KEY AUTOINCREMENT, display_name TEXT NOT NULL, role TEXT NOT NULL, pin_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, operator_id INTEGER, action_type TEXT NOT NULL, related_id TEXT, at TEXT NOT NULL, details TEXT);
  `);
  const settings = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM business_settings');
  if (!settings?.count) database.runSync('INSERT INTO business_settings (id,business_name,contact,address,receipt_footer,paper_width,capacity,long_stay_minutes) VALUES (1,?,?,?,?,?,?,?)', 'City Parking Point', '', '', 'Keep this receipt safe. Thank you!', 58, 100, 360);
  const types = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM vehicle_types');
  if (!types?.count) {
    const defaults: Array<[string, string, number]> = [['bike','Bike',50],['car','Car',100],['rickshaw','Rickshaw',80],['van','Van',150],['truck','Truck',250]];
    database.withTransactionSync(() => defaults.forEach(([id,name,rate]) => { database.runSync('INSERT INTO vehicle_types (id,name) VALUES (?,?)', id, name); database.runSync('INSERT INTO parking_rates (vehicle_type,pricing_model,base_rate,hourly_rate,grace_minutes,minimum_charge,maximum_daily_charge) VALUES (?,?,?,?,?,?,?)', id, 'fixed', rate, rate, 15, rate, rate * 4); }));
  }
  database.runSync("INSERT OR IGNORE INTO app_metadata (key,value) VALUES ('schema_version','1')");
  database.runSync("UPDATE licenses SET active=0 WHERE instr(signed_payload,'.')=0");
}
