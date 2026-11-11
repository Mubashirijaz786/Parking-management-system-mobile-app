import * as ed from '@noble/ed25519';

const privateKey = ed.utils.randomPrivateKey();
const publicKey = await ed.getPublicKeyAsync(privateKey);
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

console.log(`LICENSE_PRIVATE_KEY_HEX=${hex(privateKey)}`);
console.log(`LICENSE_PUBLIC_KEY_HEX=${hex(publicKey)}`);
console.error('Store the private value only in the backend secret manager. Put the public value in the mobile EXPO_PUBLIC_LICENSE_PUBLIC_KEY build variable.');
