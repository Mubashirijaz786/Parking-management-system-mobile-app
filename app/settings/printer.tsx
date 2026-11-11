import { useRouter } from 'expo-router';
import { Bluetooth, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/src/components/ui';
import { pairedPrinters, PairedPrinter, selectPrinter, selectedPrinter } from '@/src/services/printer';
import { colors, common, spacing } from '@/src/theme';

export default function PrinterSettings() {
  const router = useRouter();
  const [rows, setRows] = useState<PairedPrinter[]>([]);
  const [selected, setSelected] = useState(selectedPrinter());
  const [busy, setBusy] = useState(false);
  const discover = async () => { setBusy(true); try { setRows(await pairedPrinters()); } catch (error: any) { Alert.alert('Printer discovery failed', error.message); } finally { setBusy(false); } };
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '700' }}>‹ Settings</Text></Pressable>
    <Text style={[common.title, { marginTop: spacing.lg }]}>Printer</Text>
    <Text style={[common.muted, { marginTop: 5 }]}>58 mm ESC/POS thermal printing.</Text>
    <View style={[common.card, { marginTop: spacing.xl, gap: 12 }]}>
      <View style={[common.row, { gap: 10 }]}><Bluetooth size={21} color={colors.secondary} /><View style={{ flex: 1 }}><Text style={common.body}>{selected ? 'Printer selected' : 'No printer selected'}</Text><Text selectable style={common.muted}>{selected ?? 'Pair a printer in Android Bluetooth settings first.'}</Text></View></View>
      <Button title={busy ? 'Discovering...' : 'Discover paired printers'} onPress={discover} loading={busy} disabled={busy} />
      {rows.length > 0 && <View style={{ gap: 8 }}>{rows.map(printer => <Pressable key={printer.id} onPress={() => { selectPrinter(printer.id); setSelected(printer.id); Alert.alert('Printer selected', printer.name); }} style={[common.card, { padding: 12, borderColor: selected === printer.id ? colors.primary : colors.border, backgroundColor: selected === printer.id ? colors.greenSoft : colors.surface }]}><Text style={{ fontWeight: '800', color: colors.text }}>{printer.name}</Text><Text selectable style={[common.muted, { marginTop: 3 }]}>{printer.id}</Text></Pressable>)}</View>}
    </View>
    <View style={[common.card, { marginTop: spacing.lg, backgroundColor: colors.amberSoft, borderColor: '#FDE68A' }]}><View style={[common.row, { gap: 8 }]}><Printer size={18} color={colors.warning} /><Text style={{ fontWeight: '800', color: '#92400E' }}>Development build required</Text></View><Text style={[common.muted, { marginTop: 6, lineHeight: 18 }]}>Expo Go shows a clear fallback. Build the Android development client, pair the 58 mm printer in Android settings, then select it here.</Text></View>
  </ScrollView>;
}
