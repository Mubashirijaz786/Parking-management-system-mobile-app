import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as ed from '@noble/ed25519';

type Args = Record<string, string | boolean>;
function args(argv: string[]): Args { const out: Args = {}; for (let i = 0; i < argv.length; i += 1) { const value = argv[i]; if (!value.startsWith('--')) continue; const [key, inline] = value.slice(2).split('='); out[key] = inline ?? argv[i + 1] ?? true; if (inline === undefined && argv[i + 1] && !argv[i + 1].startsWith('--')) i += 1; } return out; }
const base64url = (bytes: Uint8Array | string) => Buffer.from(bytes instanceof Uint8Array ? bytes : Buffer.from(bytes)).toString('base64url');

async function main() {
  const input = args(process.argv.slice(2));
  if (input.help || !input.privateKey || !input.deviceId) { console.log('Usage: npm run license:generate -- --privateKey=private-key.hex --deviceId=DEVICE --customerId=CUST --planId=MONTHLY --days=30 --out=license.txt'); return; }
  const privateKey = readFileSync(String(input.privateKey), 'utf8').trim();
  if (!/^[0-9a-f]{64}$/i.test(privateKey)) throw new Error('Private key must be exactly 64 hexadecimal characters.');
  const days = Number(input.days ?? 30); if (!Number.isFinite(days) || days <= 0) throw new Error('Days must be a positive number.');
  const now = Date.now();
  const payload = { licenseId: `LIC-${randomUUID().slice(0, 8).toUpperCase()}`, customerId: String(input.customerId ?? 'customer'), deviceId: String(input.deviceId), planId: String(input.planId ?? 'MONTHLY'), issuedAt: new Date(now).toISOString(), startsAt: new Date(now).toISOString(), expiresAt: new Date(now + days * 86400000).toISOString(), version: 1 };
  const payloadPart = base64url(JSON.stringify(payload));
  const key = Uint8Array.from(privateKey.match(/.{1,2}/g)!.map(value => parseInt(value, 16)));
  const signature = await ed.signAsync(new TextEncoder().encode(payloadPart), key);
  const activation = `${payloadPart}.${base64url(signature)}`;
  if (input.out) writeFileSync(String(input.out), `${activation}\n`, { encoding: 'utf8' }); else console.log(activation);
  console.error(JSON.stringify(payload, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
