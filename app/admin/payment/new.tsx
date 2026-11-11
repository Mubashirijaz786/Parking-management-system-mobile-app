import { useFocusEffect, useRouter } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, EmptyState, Field, SectionTitle } from '@/src/components/ui';
import { adminApi, AdminCustomer } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';

const methods: Array<[string, string]> = [['CASH', 'Cash'], ['BANK_TRANSFER', 'Bank'], ['EASYPAISA', 'Easypaisa'], ['JAZZCASH', 'JazzCash'], ['OTHER', 'Other']];

export default function RecordPayment() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { adminApi.customers('', 'ALL').then(setRows).catch(error => Alert.alert('Customers unavailable', error.message)); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const save = async () => {
    const numeric = Number(amount);
    if (!selected || !numeric || numeric <= 0) { Alert.alert('Payment required', 'Select a customer and enter a valid amount.'); return; }
    setBusy(true);
    try { await adminApi.recordPayment(selected.id, { amount: numeric, method, transactionRef: reference.trim() || undefined }); Alert.alert('Payment recorded', 'The customer ledger has been updated.', [{ text: 'Done', onPress: () => router.replace('/admin/payments' as any) }]); }
    catch (error: any) { Alert.alert('Payment failed', error.message); }
    finally { setBusy(false); }
  };
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Payments</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><CreditCard size={25} color={colors.primary} /><View><Text style={common.title}>Record payment</Text><Text style={[common.muted, { marginTop: 3 }]}>Manual ledger entry</Text></View></View>
    <SectionTitle title="Choose customer" />
    {rows.length === 0 ? <EmptyState title="No customers" body="Register a customer before recording a payment." /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{rows.map(customer => <Pressable key={customer.id} onPress={() => setSelected(customer)} style={{ minWidth: 150, padding: 12, borderWidth: 1, borderColor: selected?.id === customer.id ? colors.primary : colors.border, borderRadius: 12, backgroundColor: selected?.id === customer.id ? colors.greenSoft : colors.surface }}><Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{customer.businessName}</Text><Text style={[common.muted, { marginTop: 4 }]}>{customer.customerCode}</Text></Pressable>)}</ScrollView>}
    <View style={[common.card, { marginTop: spacing.lg, gap: 12 }]}><Field label="Amount (PKR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1500" /><Text style={common.label}>PAYMENT METHOD</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{methods.map(([value, label]) => <Pressable key={value} onPress={() => setMethod(value)} style={{ borderWidth: 1, borderColor: method === value ? colors.primary : colors.border, backgroundColor: method === value ? colors.greenSoft : colors.surface, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10 }}><Text style={{ color: method === value ? colors.primary : colors.secondary, fontSize: 11, fontWeight: '800' }}>{label}</Text></Pressable>)}</ScrollView><Field label="Transaction reference (optional)" value={reference} onChangeText={setReference} placeholder="Bank/e-wallet reference" /><Button title={busy ? 'Saving...' : 'Record payment'} onPress={save} loading={busy} disabled={busy} /></View>
  </ScrollView>;
}
