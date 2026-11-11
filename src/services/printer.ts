import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { getAppMetadata, setAppMetadata } from '@/src/database/repository';
import { Ticket } from '@/src/types';
import { formatDateTime } from '@/src/utils/format';

export type PairedPrinter = { id: string; name: string };
type NativePrinter = { pairedPrinters: () => Promise<PairedPrinter[]>; print: (deviceAddress: string, text: string, qrPayload?: string) => Promise<boolean> };

const nativePrinter = NativeModules.ParkEasePrinter as NativePrinter | undefined;
const PRINTER_KEY = 'selected_printer_address';

async function ensureBluetoothPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, { title: 'Nearby devices', message: 'ParkEase needs nearby-device access to connect to the thermal printer.', buttonPositive: 'Allow' });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function pairedPrinters() {
  if (!nativePrinter) throw new Error('Bluetooth printing requires the ParkEase Android development build.');
  if (!await ensureBluetoothPermission()) throw new Error('Nearby-device permission was not granted.');
  return nativePrinter.pairedPrinters();
}

export const selectedPrinter = () => getAppMetadata(PRINTER_KEY);
export const selectPrinter = (address: string) => setAppMetadata(PRINTER_KEY, address);

export async function printTicket(ticket: Ticket, businessName: string, footer: string) {
  if (!nativePrinter) throw new Error('Bluetooth printing requires the ParkEase Android development build.');
  const address = selectedPrinter();
  if (!address) throw new Error('Select a paired thermal printer in Settings first.');
  if (!await ensureBluetoothPermission()) throw new Error('Nearby-device permission was not granted.');
  const text = [`${businessName || 'ParkEase'}`.padStart(16 + Math.ceil((businessName || 'ParkEase').length / 2)), '------------------------------', `Ticket: ${ticket.id}`, `Vehicle: ${ticket.plate}`, `Type: ${ticket.vehicleType}`, `Entry: ${formatDateTime(ticket.entryAt)}`, `Amount: PKR ${Math.round(ticket.amount)}`, `Payment: ${ticket.paymentStatus === 'paid' ? 'PAID' : 'PAY AT EXIT'}`, '', footer || '', '', ''].join('\n');
  return nativePrinter.print(address, text, ticket.qrPayload);
}
