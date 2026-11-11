import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getTicketsBetween } from '@/src/database/repository';
import { formatDateTime, formatPKR, vehicleLabels } from '@/src/utils/format';

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const htmlCell = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function exportReportCsv(from: string, to: string, label: string) {
  const rows = getTicketsBetween(from, to);
  const header = ['Ticket', 'Plate', 'Vehicle', 'Entry', 'Exit', 'Status', 'Amount (PKR)', 'Payment', 'Payment method'];
  const body = rows.map(ticket => [ticket.id, ticket.plate, vehicleLabels[ticket.vehicleType as keyof typeof vehicleLabels] ?? ticket.vehicleType, formatDateTime(ticket.entryAt), ticket.exitAt ? formatDateTime(ticket.exitAt) : '', ticket.status, Math.round(ticket.amount), ticket.paymentStatus, ticket.paymentMethod ?? ''].map(csvCell).join(','));
  const csv = [header.map(csvCell).join(','), ...body].join('\n');
  const filename = `parkease-report-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Share ParkEase CSV report' });
  return { uri, filename, count: rows.length };
}

export async function exportReportPdf(from: string, to: string, label: string, summary: { entries: number; exits: number; revenue: number; unpaid: number }) {
  const rows = getTicketsBetween(from, to);
  const htmlRows = rows.map(ticket => `<tr><td>${htmlCell(ticket.id)}</td><td>${htmlCell(ticket.plate)}</td><td>${htmlCell(vehicleLabels[ticket.vehicleType as keyof typeof vehicleLabels] ?? ticket.vehicleType)}</td><td>${htmlCell(formatDateTime(ticket.entryAt))}</td><td>${htmlCell(ticket.exitAt ? formatDateTime(ticket.exitAt) : '-')}</td><td>${htmlCell(ticket.status)}</td><td>${htmlCell(formatPKR(ticket.amount))}</td></tr>`).join('');
  const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:Arial;color:#17202a;padding:24px}h1{font-size:22px}p{color:#536273}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #d9e1e8;padding:6px;text-align:left}th{background:#eaf8f0;color:#087f4f}.summary{display:flex;gap:20px;margin:18px 0}.summary b{display:block;font-size:16px}</style></head><body><h1>ParkEase report</h1><p>${htmlCell(label)}</p><div class="summary"><div>Entries<b>${summary.entries}</b></div><div>Exits<b>${summary.exits}</b></div><div>Collection<b>${htmlCell(formatPKR(summary.revenue))}</b></div><div>Unpaid<b>${htmlCell(formatPKR(summary.unpaid))}</b></div></div><table><thead><tr><th>Ticket</th><th>Plate</th><th>Vehicle</th><th>Entry</th><th>Exit</th><th>Status</th><th>Amount</th></tr></thead><tbody>${htmlRows || '<tr><td colspan="7">No tickets in this period.</td></tr>'}</tbody></table></body></html>`;
  const result = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: 'Share ParkEase PDF report' });
  return { uri: result.uri, count: rows.length };
}
