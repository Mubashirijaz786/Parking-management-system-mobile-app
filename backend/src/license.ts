import * as ed from '@noble/ed25519';
import { randomUUID } from 'node:crypto';
import { env } from './config.js';

const base64url = (value: Uint8Array | string) => Buffer.from(value instanceof Uint8Array ? value : Buffer.from(value)).toString('base64url');
const privateKey = Uint8Array.from(env.LICENSE_PRIVATE_KEY_HEX.match(/.{1,2}/g)!.map(value => parseInt(value, 16)));

export async function assertLicenseKeyPair() {
  const derivedPublicKey = Buffer.from(await ed.getPublicKeyAsync(privateKey)).toString('hex');
  if (derivedPublicKey.toLowerCase() !== env.LICENSE_PUBLIC_KEY_HEX.toLowerCase()) throw new Error('LICENSE_PRIVATE_KEY_HEX does not match LICENSE_PUBLIC_KEY_HEX.');
}

export async function signLicense(input: { customerId: string; deviceId: string; planId: string; startsAt: Date; expiresAt: Date; }) {
  const payload = { licenseId: `LIC-${randomUUID().slice(0, 8).toUpperCase()}`, customerId: input.customerId, deviceId: input.deviceId, planId: input.planId, issuedAt: new Date().toISOString(), startsAt: input.startsAt.toISOString(), expiresAt: input.expiresAt.toISOString(), version: 1 };
  const payloadPart = base64url(JSON.stringify(payload));
  const signature = await ed.signAsync(new TextEncoder().encode(payloadPart), privateKey);
  return { ...payload, signed: `${payloadPart}.${base64url(signature)}` };
}
