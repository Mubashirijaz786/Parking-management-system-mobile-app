import { useFocusEffect, useRouter } from 'expo-router';
import { Clock3 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { EmptyState, SectionTitle } from '@/src/components/ui';
import { adminApi, AdminCustomer } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';
import { formatDate } from '@/src/utils/format';

export default function ExpiringCustomers() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminCustomer[]>([]);
  const load = useCallback(async () => { try { const customers = await adminApi.customers('', 'ACTIVE'); setRows(customers.filter(customer => { const expires = customer.subscriptions?.[0]?.expiresAt; if (!expires) return false; const days = Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000); return days >= 0 && days <= 7; })); } catch (error: any) { Alert.alert('Expiring customers unavailable', error.message); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Admin dashboard</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><Clock3 size={25} color={colors.warning} /><View><Text style={common.title}>Expiring customers</Text><Text style={[common.muted, { marginTop: 3 }]}>Renewals due within seven days</Text></View></View>
    <SectionTitle title={`${rows.length} customers`} />
    {rows.length === 0 ? <EmptyState title="No expiring subscriptions" body="All active subscriptions have more than seven days remaining." /> : rows.map(customer => { const subscription = customer.subscriptions?.[0]; const days = Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86400000); return <Pressable key={customer.id} onPress={() => router.push(`/admin/customer/${customer.id}` as any)} style={[common.card, { marginBottom: 8 }]}><View style={common.between}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '900' }}>{customer.businessName}</Text><Text style={[common.muted, { marginTop: 3 }]}>{customer.phone} · {subscription.plan?.name ?? 'Plan'}</Text></View><Text style={{ color: colors.warning, fontWeight: '900' }}>{days}d</Text></View><Text style={[common.muted, { marginTop: 8 }]}>Expires {formatDate(subscription.expiresAt)} · Tap to renew</Text></Pressable>; })}
  </ScrollView>;
}
