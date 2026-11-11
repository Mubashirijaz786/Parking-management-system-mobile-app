import { VehicleType } from '@/src/types';

export const vehicleLabels: Record<VehicleType, string> = { bike: 'Bike', car: 'Car', rickshaw: 'Rickshaw', van: 'Van', truck: 'Truck' };
export const vehicleIcons: Record<VehicleType, string> = { bike: '\u2642', car: '\u25A3', rickshaw: '\u25C8', van: '\u25A4', truck: '\u25B0' };
export const vehicleEmojis: Record<VehicleType, string> = { bike: '\u{1F3CD}\uFE0F', car: '\u{1F697}', rickshaw: '\u{1F6FA}', van: '\u{1F690}', truck: '\u{1F69A}' };
export const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const formatPKR = (amount: number) => `\u20A8 ${Math.max(0, Math.round(amount)).toLocaleString('en-PK')}`;
export const formatDate = (iso: string | Date) => new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }).format(new Date(iso));
export const formatTime = (iso: string | Date) => new Intl.DateTimeFormat('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' }).format(new Date(iso));
export const formatDateTime = (iso: string | Date) => `${formatDate(iso)} \u00B7 ${formatTime(iso)}`;
export const durationMinutes = (start: string, end = new Date().toISOString()) => Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
export const durationLabel = (minutes: number) => minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
export const todayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);
