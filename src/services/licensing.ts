import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { getDb } from '@/src/database/db';

// Expo Go/Hermes does not provide browser crypto.subtle. Configure noble's
// synchronous hash implementation so Ed25519 verification/signing works in
// Expo Go as well as in a custom native build.
ed.etc.sha512Sync = (...messages) => sha512(ed.etc.concatBytes(...messages));
ed.etc.sha512Async = async (...messages) => ed.etc.sha512Sync!(...messages);

const PUBLIC_KEY_HEX = process.env.EXPO_PUBLIC_LICENSE_PUBLIC_KEY ?? '';
const ACTIVATION_PRIVATE_KEY = 'parkease_activation_private_key';
const CLOCK_SKEW_MS = 5 * 60 * 1000;
export type LicensePayload = { licenseId: string; customerId: string; deviceId: string; planId: string; issuedAt: string; startsAt: string; expiresAt: string; version: number };
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const hexBytes = (hex: string) => Uint8Array.from(hex.match(/.{1,2}/g)?.map(x => parseInt(x, 16)) ?? []);
const hex = (bytes: Uint8Array) => Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
const base64Url = (bytes: Uint8Array) => { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); };

async function getActivationKeyPair() {
  const saved = await SecureStore.getItemAsync(ACTIVATION_PRIVATE_KEY);
  const privateKey = saved ? hexBytes(saved) : await Crypto.getRandomBytesAsync(32);
  if (privateKey.length !== 32) throw new Error('Activation key is invalid.');
  if (!saved) await SecureStore.setItemAsync(ACTIVATION_PRIVATE_KEY, hex(privateKey));
  return { privateKey, publicKey: ed.getPublicKey(privateKey) };
}

function guardClock(db: ReturnType<typeof getDb>) {
  const now = Date.now();
  const last = db.getFirstSync<{ value: string }>('SELECT value FROM app_metadata WHERE key=?', 'last_license_clock');
  const previous = last ? Number(last.value) : 0;
  if (Number.isFinite(previous) && previous > 0 && now + CLOCK_SKEW_MS < previous) throw new Error('CLOCK_ROLLBACK: device time moved backwards. Correct the date and time before using ParkEase.');
  if (!previous || now > previous) db.runSync('INSERT OR REPLACE INTO app_metadata (key,value) VALUES (?,?)', 'last_license_clock', String(now));
}

export async function getDeviceId() {
  const db = getDb();
  const existing = db.getFirstSync<{ value: string }>('SELECT value FROM app_metadata WHERE key=?', 'device_id');
  if (existing?.value) return existing.value;
  const id = Crypto.randomUUID();
  db.runSync('INSERT OR REPLACE INTO app_metadata (key,value) VALUES (?,?)', 'device_id', id);
  return id;
}

export async function verifyLicense(input: string, deviceId: string) {
  if (!deviceId) throw new Error('Device ID is not ready yet.');
  const db = getDb();
  guardClock(db);
  if (!/^[0-9a-f]{64}$/i.test(PUBLIC_KEY_HEX)) throw new Error('License public key is not configured for this build.');
  const parts = input.trim().split('.');
  if (parts.length !== 2) throw new Error('License must be payload.signature.');
  let payload: LicensePayload;
  try { payload = JSON.parse(new TextDecoder().decode(b64(parts[0]))) as LicensePayload; }
  catch { throw new Error('License payload is invalid.'); }
  if (!payload.licenseId || !payload.customerId || !payload.deviceId || !payload.planId || !payload.issuedAt || !payload.startsAt || !payload.expiresAt || payload.version !== 1) throw new Error('License payload is incomplete.');
  const valid = ed.verify(b64(parts[1]), new TextEncoder().encode(parts[0]), hexBytes(PUBLIC_KEY_HEX));
  if (!valid) throw new Error('Signature verification failed.');
  if (payload.deviceId !== deviceId) throw new Error('This license belongs to another device.');
  const start = new Date(payload.startsAt).getTime();
  const expires = new Date(payload.expiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(expires) || expires <= start) throw new Error('License dates are invalid.');
  if (Date.now() < start || Date.now() > expires) throw new Error('License is outside its validity period.');
  db.runSync('UPDATE licenses SET active=0 WHERE device_id=?', deviceId);
  const existing = db.getFirstSync<{ id: number }>('SELECT id FROM licenses WHERE license_id=?', payload.licenseId);
  if (existing) db.runSync('UPDATE licenses SET signed_payload=?,active=1,issued_at=?,expires_at=?,device_id=? WHERE id=?', input.trim(), payload.issuedAt, payload.expiresAt, deviceId, existing.id);
  else db.runSync('INSERT INTO licenses (license_id,signed_payload,active,issued_at,expires_at,device_id) VALUES (?,?,?,?,?,?)', payload.licenseId, input.trim(), 1, payload.issuedAt, payload.expiresAt, deviceId);
  return payload;
}

export function assertLicenseActive() {
  const db = getDb();
  guardClock(db);
  const row = db.getFirstSync<{ expires_at: string }>("SELECT expires_at FROM licenses WHERE active=1 AND instr(signed_payload,'.')>0 ORDER BY id DESC LIMIT 1");
  if (!row) throw new Error('ParkEase is not activated. Enter a valid license first.');
  if (Date.now() > new Date(row.expires_at).getTime()) { db.runSync('UPDATE licenses SET active=0'); throw new Error('Subscription expired. Renew the ParkEase license before creating new entries.'); }
}

export async function validateStoredLicense() {
  const row = getDb().getFirstSync<{ signed_payload: string; device_id: string }>("SELECT signed_payload, device_id FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1");
  if (!row) return 'NOT_ACTIVATED' as const;
  try { await verifyLicense(row.signed_payload, row.device_id); return 'ACTIVE' as const; }
  catch (error: any) { if (String(error?.message ?? '').startsWith('CLOCK_ROLLBACK:')) return 'CLOCK_SUSPECTED' as const; getDb().runSync('UPDATE licenses SET active=0'); return 'EXPIRED' as const; }
}

export async function createActivationAcknowledgement(signedLicense: string, payload: LicensePayload, deviceId: string) {
  const { privateKey, publicKey } = await getActivationKeyPair();
  const message = new TextEncoder().encode(`ACK2|${payload.licenseId}|${deviceId}|${signedLicense}`);
  const signature = ed.sign(message, privateKey);
  return `ACK2.${payload.licenseId}.${deviceId}.${base64Url(publicKey)}.${base64Url(signature)}`;
}
