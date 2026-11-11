import { useFocusEffect } from 'expo-router';
import { CalendarDays, CarFront, Download, FileSpreadsheet, LogIn, LogOut, Receipt, WalletCards } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Field, SectionTitle } from '@/src/components/ui';
import { getRates, getReport, getVehicleStats } from '@/src/database/repository';
import { exportReportCsv, exportReportPdf } from '@/src/services/reportExport';
import { colors, common, radius, spacing } from '@/src/theme';
import { formatDate, formatPKR, todayKey, vehicleLabels } from '@/src/utils/format';
import { VehicleType } from '@/src/types';

type Period = 'daily' | 'weekly' | 'monthly' | 'custom';
type DateRange = { start: string; end: string; label: string };
const DAY = 24 * 60 * 60 * 1000;
const startForKey = (key: string) => new Date(`${key}T00:00:00+05:00`);
const isoEndFor = (date: Date) => new Date(date.getTime() + DAY - 1).toISOString();
const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(startForKey(value).getTime());

function makeRange(period: Period, customStart: string, customEnd: string): DateRange | null {
  const today = todayKey();
  if (period === 'custom') {
    if (!isDateKey(customStart) || !isDateKey(customEnd) || customStart > customEnd) return null;
    const start = startForKey(customStart); const end = startForKey(customEnd);
    return { start: start.toISOString(), end: isoEndFor(end), label: `${formatDate(start)} - ${formatDate(end)}` };
  }
  const todayDate = startForKey(today);
  if (period === 'daily') return { start: todayDate.toISOString(), end: isoEndFor(todayDate), label: 'Today' };
  if (period === 'monthly') { const monthStart = startForKey(`${today.slice(0, 7)}-01`); return { start: monthStart.toISOString(), end: isoEndFor(todayDate), label: 'This month' }; }
  const weekday = new Date(`${today}T12:00:00+05:00`).getUTCDay();
  const weekStart = new Date(todayDate.getTime() - weekday * DAY); const weekEnd = new Date(weekStart.getTime() + 6 * DAY);
  return { start: weekStart.toISOString(), end: isoEndFor(weekEnd), label: 'This week' };
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('daily');
  const [customStart, setCustomStart] = useState(todayKey()); const [customEnd, setCustomEnd] = useState(todayKey());
  const [appliedCustom, setAppliedCustom] = useState({ start: todayKey(), end: todayKey() });
  const [report, setReport] = useState<any>({}); const [stats, setStats] = useState<any[]>([]); const [rates, setRates] = useState<any[]>([]);
  const range = useMemo(() => makeRange(period, appliedCustom.start, appliedCustom.end) ?? makeRange('daily', '', '')!, [period, appliedCustom]);

  useFocusEffect(useCallback(() => { setReport(getReport(range.start, range.end)); setStats(getVehicleStats(range.start, range.end)); setRates(getRates()); }, [range.start, range.end]));
  const applyCustom = () => { if (!isDateKey(customStart) || !isDateKey(customEnd) || customStart > customEnd) { Alert.alert('Invalid dates', 'Use YYYY-MM-DD and keep the start date before the end date.'); return; } setAppliedCustom({ start: customStart, end: customEnd }); };
  const exportCsv = async () => { try { const result = await exportReportCsv(range.start, range.end, range.label); Alert.alert('CSV ready', `${result.filename}\n${result.count} tickets included.`); } catch (error: any) { Alert.alert('Export failed', error?.message ?? 'Could not create the CSV report.'); } };
  const exportPdf = async () => { try { const result = await exportReportPdf(range.start, range.end, range.label, { entries: report.entries ?? 0, exits: report.exits ?? 0, revenue: report.revenue ?? 0, unpaid: report.unpaid ?? 0 }); Alert.alert('PDF ready', `${result.count} tickets included.`); } catch (error: any) { Alert.alert('Export failed', error?.message ?? 'Could not create the PDF report.'); } };
  const stat = (icon: ReactNode, label: string, value: string) => <View style={[common.card, { flex: 1, minHeight: 88, gap: 7 }]}>{icon}<Text style={common.muted}>{label}</Text><Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{value}</Text></View>;
  const periodButton = (value: Period, label: string) => <Pressable onPress={() => setPeriod(value)} style={{ paddingVertical: 9, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: period === value ? colors.primary : colors.border, backgroundColor: period === value ? colors.greenSoft : colors.surface }}><Text style={{ color: period === value ? colors.primary : colors.secondary, fontWeight: '800', fontSize: 12 }}>{label}</Text></Pressable>;

  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Text style={common.label}>ANALYTICS</Text><Text style={[common.title, { marginTop: 4 }]}>{period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Custom'} Report</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>{periodButton('daily', 'Daily')}{periodButton('weekly', 'Weekly')}{periodButton('monthly', 'Monthly')}{periodButton('custom', 'Custom')}</ScrollView>
    {period === 'custom' && <View style={[common.card, { gap: 10, marginBottom: 8 }]}><View style={[common.row, { gap: 8 }]}><View style={{ flex: 1 }}><Field label="From (YYYY-MM-DD)" value={customStart} onChangeText={setCustomStart} autoCapitalize="none" /></View><View style={{ flex: 1 }}><Field label="To (YYYY-MM-DD)" value={customEnd} onChangeText={setCustomEnd} autoCapitalize="none" /></View></View><Button title="Apply dates" onPress={applyCustom} /></View>}
    <View style={[common.card, common.between, { marginTop: period === 'custom' ? 4 : 0, paddingVertical: 11 }]}><View style={[common.row, { gap: 8 }]}><CalendarDays size={17} color={colors.primary} /><Text style={{ fontWeight: '800', color: colors.text }}>{range.label}</Text></View><Text style={{ color: colors.secondary, fontSize: 12 }}>{formatDate(range.start)} - {formatDate(range.end)}</Text></View>
    <View style={[common.row, { gap: 8, marginTop: 10 }]}>{stat(<View style={{ width: 27, height: 27, borderRadius: radius.sm, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}><LogIn size={15} color={colors.primary} /></View>, 'Total Entries', String(report.entries ?? 0))}{stat(<View style={{ width: 27, height: 27, borderRadius: radius.sm, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' }}><LogOut size={15} color="#4A7FE7" /></View>, 'Total Exits', String(report.exits ?? 0))}</View>
    <View style={[common.row, { gap: 8, marginTop: 8 }]}>{stat(<View style={{ width: 27, height: 27, borderRadius: radius.sm, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}><WalletCards size={15} color={colors.primary} /></View>, 'Total Collection', formatPKR(report.revenue ?? 0))}{stat(<View style={{ width: 27, height: 27, borderRadius: radius.sm, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' }}><Receipt size={15} color={colors.danger} /></View>, 'Unpaid Amount', formatPKR(report.unpaid ?? 0))}</View>
    <SectionTitle title="Vehicle wise summary" /><View style={[common.card, { paddingVertical: 4 }]}>{(['bike', 'car', 'rickshaw', 'van', 'truck'] as VehicleType[]).map((v, i) => { const row = stats.find(x => x.type === v); const rate = rates.find(x => x.vehicle_type === v); return <View key={v} style={[common.between, { paddingVertical: 11, borderBottomWidth: i === 4 ? 0 : 1, borderBottomColor: colors.border }]}><View style={[common.row, { gap: 8 }]}><CarFront size={16} color={colors.primary} /><Text style={common.body}>{vehicleLabels[v]}</Text></View><View style={[common.row, { gap: 22 }]}><Text style={common.muted}>{row?.entries ?? 0}</Text><Text style={{ fontWeight: '800', color: colors.text }}>{formatPKR(rate?.base_rate ?? 0)}</Text></View></View>; })}</View>
    <SectionTitle title="Export report" /><View style={[common.row, { gap: 8 }]}><Pressable onPress={exportCsv} style={[common.outlineButton, { flex: 1, flexDirection: 'row', gap: 7 }]}><FileSpreadsheet size={16} color={colors.primary} /><Text style={{ fontWeight: '800', fontSize: 12 }}>Export CSV</Text></Pressable><Pressable onPress={exportPdf} style={[common.outlineButton, { flex: 1, flexDirection: 'row', gap: 7 }]}><Download size={16} color={colors.primary} /><Text style={{ fontWeight: '800', fontSize: 12 }}>Export PDF</Text></Pressable></View>
  </ScrollView>;
}
