import { getDb } from './db';
import { PaymentMethod, RateSnapshot, Ticket, VehicleType, WatchlistMatch } from '@/src/types';
import { normalizePlate, todayKey } from '@/src/utils/format';
import { assertLicenseActive } from '@/src/services/licensing';

export const getAppMetadata = (key: string) => getDb().getFirstSync<{value:string}>('SELECT value FROM app_metadata WHERE key=?', key)?.value ?? null;
export const setAppMetadata = (key: string, value: string) => getDb().runSync('INSERT OR REPLACE INTO app_metadata (key,value) VALUES (?,?)', key, value);

const rowToTicket = (r: any): Ticket => ({ ...r, rateSnapshot: JSON.parse(r.rate_snapshot), paymentStatus: r.payment_status, paymentMethod: r.payment_method, paidAt: r.paid_at, qrPayload: r.qr_payload, printingStatus: r.printing_status, vehicleType: r.vehicle_type, entryAt: r.entry_at, exitAt: r.exit_at });
export const getSettings = () => getDb().getFirstSync<any>('SELECT * FROM business_settings WHERE id=1');
export const getRates = () => getDb().getAllSync<any>('SELECT parking_rates.*, vehicle_types.name, vehicle_types.enabled FROM parking_rates JOIN vehicle_types ON vehicle_types.id=parking_rates.vehicle_type ORDER BY CASE parking_rates.vehicle_type WHEN "bike" THEN 1 WHEN "car" THEN 2 WHEN "rickshaw" THEN 3 WHEN "van" THEN 4 ELSE 5 END');
export const setVehicleEnabled = (type: VehicleType, enabled: boolean) => getDb().runSync('UPDATE vehicle_types SET enabled=? WHERE id=?', enabled ? 1 : 0, type);
export const getDashboard = () => { const d=getDb(); const day=`${todayKey()}%`; return { parked: d.getFirstSync<any>("SELECT COUNT(*) as count FROM parking_tickets WHERE status='active'")?.count ?? 0, entries: d.getFirstSync<any>('SELECT COUNT(*) as count FROM parking_tickets WHERE entry_at LIKE ?', day)?.count ?? 0, exits: d.getFirstSync<any>("SELECT COUNT(*) as count FROM parking_tickets WHERE status='exited' AND exit_at LIKE ?", day)?.count ?? 0, collection: d.getFirstSync<any>("SELECT COALESCE(SUM(amount),0) as total FROM parking_tickets WHERE payment_status='paid' AND paid_at LIKE ?", day)?.total ?? 0 }; };
export const getVehicleStats = (from?: string, to?: string) => {
  if (!from && !to) return getDb().getAllSync<any>("SELECT vehicle_type as type, COUNT(*) as entries, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as parked FROM parking_tickets WHERE entry_at LIKE ? GROUP BY vehicle_type", `${todayKey()}%`);
  const start = from ?? `${todayKey()}T00:00:00`;
  const end = to ?? `${todayKey()}T23:59:59`;
  return getDb().getAllSync<any>("SELECT vehicle_type as type, COUNT(*) as entries, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as parked FROM parking_tickets WHERE entry_at BETWEEN ? AND ? GROUP BY vehicle_type", start, end);
};
export const getActiveTickets = (search = '', type?: VehicleType) => { const q=`%${normalizePlate(search)}%`; const rows = type ? getDb().getAllSync<any>("SELECT * FROM parking_tickets WHERE status='active' AND vehicle_type=? AND (normalized_plate LIKE ? OR id LIKE ?) ORDER BY entry_at DESC", type,q,`%${search}%`) : getDb().getAllSync<any>("SELECT * FROM parking_tickets WHERE status='active' AND (normalized_plate LIKE ? OR id LIKE ?) ORDER BY entry_at DESC", q,`%${search}%`); return rows.map(rowToTicket); };
export const getHistory = (search = '') => getDb().getAllSync<any>("SELECT * FROM parking_tickets WHERE (normalized_plate LIKE ? OR id LIKE ?) ORDER BY entry_at DESC LIMIT 500", `%${normalizePlate(search)}%`, `%${search}%`).map(rowToTicket);
export const getTicketsBetween = (from: string, to: string) => getDb().getAllSync<any>('SELECT * FROM parking_tickets WHERE entry_at BETWEEN ? AND ? ORDER BY entry_at DESC', from, to).map(rowToTicket);
export const getTicket = (id: string) => { const r=getDb().getFirstSync<any>('SELECT * FROM parking_tickets WHERE id=? OR qr_payload=?', id, id); return r ? rowToTicket(r) : null; };
export const findActiveByPlate = (plate: string) => { const r=getDb().getFirstSync<any>("SELECT * FROM parking_tickets WHERE normalized_plate=? AND status='active'", normalizePlate(plate)); return r ? rowToTicket(r) : null; };
export const findWatchlist = (plate: string): WatchlistMatch[] => getDb().getAllSync<any>("SELECT id,plate,category,make_model as makeModel,color,reason,source,reference,status FROM watchlist_vehicles WHERE normalized_plate=? AND status='active'", normalizePlate(plate));

export function createTicket(input: { plate: string; vehicleType: VehicleType; payAtEntry: boolean; customAmount?: number; paymentMethod?: PaymentMethod }) {
  assertLicenseActive(); const db=getDb(); const plate=input.plate.trim().toUpperCase(); const normalized=normalizePlate(plate); if (!normalized) throw new Error('Enter a vehicle number.');
  if (findActiveByPlate(plate)) throw new Error('This vehicle is already parked.');
  const rate=db.getFirstSync<any>('SELECT parking_rates.*, vehicle_types.enabled FROM parking_rates JOIN vehicle_types ON vehicle_types.id=parking_rates.vehicle_type WHERE parking_rates.vehicle_type=?', input.vehicleType); if (!rate) throw new Error('Parking rate is not configured.'); if (!rate.enabled) throw new Error('This vehicle type is disabled in Settings.');
  const snap: RateSnapshot={model: rate.pricing_model, baseRate: rate.base_rate, hourlyRate: rate.hourly_rate, graceMinutes: rate.grace_minutes, minimumCharge: rate.minimum_charge, maximumDailyCharge: rate.maximum_daily_charge};
  const amount=input.customAmount ?? (input.payAtEntry ? rate.base_rate : 0); const now=new Date().toISOString(); const id=`PK-${todayKey().replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; const qr=`PK1:${id}:${Math.random().toString(36).slice(2,14)}`;
  const match=findWatchlist(plate); db.withTransactionSync(() => { db.runSync('INSERT INTO parking_tickets (id,plate,normalized_plate,vehicle_type,entry_at,status,amount,payment_status,payment_method,paid_at,qr_payload,rate_snapshot,printing_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', id,plate,normalized,input.vehicleType,now,'active',amount,input.payAtEntry?'paid':'unpaid',input.payAtEntry?(input.paymentMethod??'cash'):null,input.payAtEntry?now:null,qr,JSON.stringify(snap),'pending'); if (input.payAtEntry) db.runSync('INSERT INTO payments (ticket_id,amount,payment_method,payment_at) VALUES (?,?,?,?)',id,amount,input.paymentMethod??'cash',now); match.forEach(m=>db.runSync('INSERT INTO watchlist_alerts (ticket_id,watchlist_id,match_type,alert_at,details) VALUES (?,?,?,?,?)',id,m.id,'exact',now,m.reason)); });
  return { ticket: getTicket(id)!, watchlistMatches: match };
}
export function exitTicket(ticketId: string, payment?: { amount: number; method: PaymentMethod }) { const db=getDb(); const ticket=getTicket(ticketId); if (!ticket) throw new Error('Ticket not found.'); if (ticket.status==='exited') throw new Error(`This vehicle already exited at ${ticket.exitAt}.`); const now=new Date().toISOString(); db.withTransactionSync(()=>{ if(payment) { db.runSync('INSERT INTO payments (ticket_id,amount,payment_method,payment_at) VALUES (?,?,?,?)',ticket.id,payment.amount,payment.method,now); db.runSync("UPDATE parking_tickets SET amount=amount+?,payment_status='paid',payment_method=?,paid_at=? WHERE id=?",payment.amount,payment.method,now,ticket.id); } db.runSync("UPDATE parking_tickets SET status='exited',exit_at=? WHERE id=?",now,ticket.id); }); return getTicket(ticket.id)!; }
export const setPrintingStatus = (id: string, status: Ticket['printingStatus']) => getDb().runSync('UPDATE parking_tickets SET printing_status=? WHERE id=?', status,id);
export const getActiveLicense = () => getDb().getFirstSync<any>('SELECT * FROM licenses WHERE active=1 AND expires_at>? ORDER BY id DESC LIMIT 1', new Date().toISOString());
export const getLatestLicense = () => getDb().getFirstSync<any>('SELECT * FROM licenses ORDER BY id DESC LIMIT 1');
export const getLicenseStatus = () => { const license = getLatestLicense(); if (!license) return 'NOT_ACTIVATED' as const; if (license.active && new Date(license.expires_at).getTime() > Date.now()) return 'ACTIVE' as const; return 'EXPIRED' as const; };
export function updateTicketBasics(id: string, input: { plate: string; vehicleType: VehicleType }) {
  const db=getDb(); const ticket=getTicket(id); if(!ticket) throw new Error('Ticket not found.'); const normalized=normalizePlate(input.plate); if(!normalized) throw new Error('Enter a vehicle number.'); const duplicate=db.getFirstSync<any>("SELECT id FROM parking_tickets WHERE normalized_plate=? AND status='active' AND id<>?",normalized,id); if(duplicate) throw new Error('This vehicle is already parked.'); const rate=db.getFirstSync<any>('SELECT * FROM parking_rates WHERE vehicle_type=?',input.vehicleType); if(!rate) throw new Error('Parking rate is not configured.'); const snap: RateSnapshot={model:rate.pricing_model,baseRate:rate.base_rate,hourlyRate:rate.hourly_rate,graceMinutes:rate.grace_minutes,minimumCharge:rate.minimum_charge,maximumDailyCharge:rate.maximum_daily_charge}; db.runSync('UPDATE parking_tickets SET plate=?,normalized_plate=?,vehicle_type=?,rate_snapshot=? WHERE id=?',input.plate.trim().toUpperCase(),normalized,input.vehicleType,JSON.stringify(snap),id); return getTicket(id)!;
}
export function deleteTicket(id: string) { const db=getDb(); if(!getTicket(id)) throw new Error('Ticket not found.'); db.withTransactionSync(()=>{db.runSync('DELETE FROM payments WHERE ticket_id=?',id);db.runSync('DELETE FROM watchlist_alerts WHERE ticket_id=?',id);db.runSync('DELETE FROM parking_tickets WHERE id=?',id)}); }
export const getWatchlist = () => getDb().getAllSync<any>('SELECT id,plate,category,make_model as makeModel,color,reason,source,reference,status,reported_at as reportedAt FROM watchlist_vehicles ORDER BY status,reported_at DESC');
export const addWatchlist = (v: {plate:string; category:VehicleType; reason:string; makeModel?:string; color?:string; source?:string; reference?:string; contact?:string; notes?:string}) => getDb().runSync('INSERT INTO watchlist_vehicles (plate,normalized_plate,category,make_model,color,reason,source,reference,contact,reported_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',v.plate.toUpperCase(),normalizePlate(v.plate),v.category,v.makeModel??'',v.color??'',v.reason,v.source??'',v.reference??'',v.contact??'',new Date().toISOString(),v.notes??'');
export const setRate = (type: VehicleType, model: string, base: number, hourly: number) => getDb().runSync('UPDATE parking_rates SET pricing_model=?,base_rate=?,hourly_rate=? WHERE vehicle_type=?',model,base,hourly,type);
export const updateBusiness = (name:string, contact:string, footer:string, capacity:number) => getDb().runSync('UPDATE business_settings SET business_name=?,contact=?,receipt_footer=?,capacity=? WHERE id=1',name,contact,footer,capacity);
export const getReport = (from?: string, to?: string) => { const d=getDb(); const start=from??`${todayKey()}T00:00:00`; const end=to??`${todayKey()}T23:59:59`; return { entries:d.getFirstSync<any>('SELECT COUNT(*) as n FROM parking_tickets WHERE entry_at BETWEEN ? AND ?',start,end)?.n??0, exits:d.getFirstSync<any>('SELECT COUNT(*) as n FROM parking_tickets WHERE exit_at BETWEEN ? AND ?',start,end)?.n??0, revenue:d.getFirstSync<any>("SELECT COALESCE(SUM(amount),0) as n FROM parking_tickets WHERE payment_status='paid' AND paid_at BETWEEN ? AND ?",start,end)?.n??0, unpaid:d.getFirstSync<any>("SELECT COALESCE(SUM(amount),0) as n FROM parking_tickets WHERE payment_status='unpaid' AND entry_at BETWEEN ? AND ?",start,end)?.n??0, avgDuration:d.getFirstSync<any>("SELECT AVG((julianday(exit_at)-julianday(entry_at))*1440) as n FROM parking_tickets WHERE exit_at BETWEEN ? AND ?",start,end)?.n??0 }; };

const backupTables = [
  { name: 'app_metadata', columns: ['key', 'value'] },
  { name: 'business_settings', columns: ['id', 'business_name', 'contact', 'address', 'receipt_footer', 'paper_width', 'capacity', 'long_stay_minutes'] },
  { name: 'vehicle_types', columns: ['id', 'name', 'enabled'] },
  { name: 'parking_rates', columns: ['vehicle_type', 'pricing_model', 'base_rate', 'hourly_rate', 'grace_minutes', 'minimum_charge', 'maximum_daily_charge'] },
  { name: 'parking_tickets', columns: ['id', 'plate', 'normalized_plate', 'vehicle_type', 'entry_at', 'exit_at', 'status', 'amount', 'payment_status', 'payment_method', 'paid_at', 'qr_payload', 'rate_snapshot', 'printing_status', 'created_by'] },
  { name: 'payments', columns: ['id', 'ticket_id', 'amount', 'payment_method', 'payment_at', 'transaction_type'] },
  { name: 'watchlist_vehicles', columns: ['id', 'plate', 'normalized_plate', 'category', 'make_model', 'color', 'reason', 'source', 'reference', 'contact', 'reported_at', 'notes', 'status'] },
  { name: 'watchlist_alerts', columns: ['id', 'ticket_id', 'watchlist_id', 'match_type', 'alert_at', 'details'] },
  { name: 'licenses', columns: ['id', 'license_id', 'signed_payload', 'active', 'issued_at', 'expires_at', 'device_id'] },
  { name: 'operators', columns: ['id', 'display_name', 'role', 'pin_hash', 'active'] },
  { name: 'audit_logs', columns: ['id', 'operator_id', 'action_type', 'related_id', 'at', 'details'] },
] as const;

export type LocalBackup = { format: 'parkease-local-backup'; version: 1; createdAt: string; tables: Record<string, any[]> };
export const exportLocalBackup = (): LocalBackup => ({ format: 'parkease-local-backup', version: 1, createdAt: new Date().toISOString(), tables: Object.fromEntries(backupTables.map(table => [table.name, getDb().getAllSync<any>(`SELECT ${table.columns.join(',')} FROM ${table.name}`)])) });
export function restoreLocalBackup(backup: LocalBackup) {
  if (!backup || backup.format !== 'parkease-local-backup' || backup.version !== 1 || !backup.tables) throw new Error('This backup file is not a supported ParkEase backup.');
  for (const table of backupTables) if (!Array.isArray(backup.tables[table.name])) throw new Error(`Backup is missing the ${table.name} table.`);
  const db = getDb();
  const deleteOrder = ['watchlist_alerts', 'payments', 'parking_tickets', 'parking_rates', 'vehicle_types', 'watchlist_vehicles', 'licenses', 'operators', 'audit_logs', 'app_metadata', 'business_settings'];
  db.withTransactionSync(() => {
    deleteOrder.forEach(table => db.runSync(`DELETE FROM ${table}`));
    backupTables.forEach(table => backup.tables[table.name].forEach(row => { const placeholders = table.columns.map(() => '?').join(','); db.runSync(`INSERT INTO ${table.name} (${table.columns.join(',')}) VALUES (${placeholders})`, ...table.columns.map(column => row[column] ?? null)); }));
  });
}
