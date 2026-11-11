import { useRouter } from 'expo-router';
import { Plus, Save, Settings2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Field } from '@/src/components/ui';
import { adminApi } from '@/src/services/adminApi';
import { colors, common, spacing } from '@/src/theme';

export default function AdminPlans() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ code: 'CUSTOM', name: 'Custom', validityDays: '90', price: '0' });
  const load = () => adminApi.plans().then(setPlans).catch(e => Alert.alert('Plans unavailable', e.message));
  useEffect(() => { load(); }, []);
  const update = async (plan: any) => { setBusy(plan.id); try { await adminApi.updatePlan(plan.id, { code: plan.code, name: plan.name, validityDays: Number(plan.validityDays), price: Number(plan.price) }); await load(); Alert.alert('Saved', `${plan.name} price updated for future subscriptions.`); } catch (e: any) { Alert.alert('Plan update failed', e.message); } finally { setBusy(''); } };
  const create = async () => { const code = draft.code.trim().toUpperCase(); const validityDays = Number(draft.validityDays); const price = Number(draft.price); if (!/^[A-Z0-9_-]{2,}$/.test(code) || !draft.name.trim() || !Number.isInteger(validityDays) || validityDays < 1 || !Number.isFinite(price) || price < 0) { Alert.alert('Invalid plan', 'Enter a unique code, name, positive validity days and a non-negative PKR price.'); return; } setBusy('new'); try { await adminApi.createPlan({ code, name: draft.name.trim(), validityDays, price }); setShowNew(false); setDraft({ code: 'CUSTOM', name: 'Custom', validityDays: '90', price: '0' }); await load(); Alert.alert('Plan created', 'The custom plan is available for future customers and renewals.'); } catch (e: any) { Alert.alert('Plan creation failed', e.message); } finally { setBusy(''); } };
  const set = (id: string, key: string, value: string) => setPlans(rows => rows.map(plan => plan.id === id ? { ...plan, [key]: value } : plan));
  return <ScrollView style={common.screen} contentContainerStyle={common.content}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Admin dashboard</Text></Pressable>
    <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}><Settings2 size={25} color={colors.primary} /><View><Text style={common.title}>Subscription plans</Text><Text style={[common.muted, { marginTop: 3 }]}>Prices apply to future subscriptions only.</Text></View></View>
    <Pressable onPress={() => setShowNew(value => !value)} style={[common.primaryButton, { marginTop: spacing.lg, flexDirection: 'row', gap: 6 }]}><Plus size={16} color="#fff" /><Text style={common.primaryButtonText}>{showNew ? 'Close custom plan' : 'Add custom plan'}</Text></Pressable>
    {showNew && <View style={[common.card, { marginTop: spacing.lg, gap: 12 }]}><Text style={common.label}>NEW PLAN</Text><Field label="Plan code" value={draft.code} onChangeText={value => setDraft(current => ({ ...current, code: value }))} autoCapitalize="characters" /><Field label="Plan name" value={draft.name} onChangeText={value => setDraft(current => ({ ...current, name: value }))} /><View style={[common.row, { gap: 8 }]}><View style={{ flex: 1 }}><Field label="Validity days" value={draft.validityDays} onChangeText={value => setDraft(current => ({ ...current, validityDays: value }))} keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Field label="Price (PKR)" value={draft.price} onChangeText={value => setDraft(current => ({ ...current, price: value }))} keyboardType="decimal-pad" /></View></View><Pressable onPress={create} disabled={busy === 'new'} style={[common.primaryButton, { flexDirection: 'row', gap: 6, opacity: busy === 'new' ? 0.6 : 1 }]}><Save size={16} color="#fff" /><Text style={common.primaryButtonText}>{busy === 'new' ? 'Creating...' : 'Create plan'}</Text></Pressable></View>}
    {plans.map(plan => <View key={plan.id} style={[common.card, { marginTop: spacing.lg, gap: 12 }]}><Text style={common.label}>{plan.code}</Text><Field label="Plan name" value={String(plan.name)} onChangeText={value => set(plan.id, 'name', value)} /><View style={[common.row, { gap: 8 }]}><View style={{ flex: 1 }}><Field label="Validity days" value={String(plan.validityDays)} onChangeText={value => set(plan.id, 'validityDays', value)} keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Field label="Price (PKR)" value={String(plan.price)} onChangeText={value => set(plan.id, 'price', value)} keyboardType="decimal-pad" /></View></View><Pressable onPress={() => update(plan)} disabled={busy === plan.id} style={[common.primaryButton, { flexDirection: 'row', gap: 6, opacity: busy === plan.id ? 0.6 : 1 }]}><Save size={16} color="#fff" /><Text style={common.primaryButtonText}>{busy === plan.id ? 'Saving...' : 'Save plan'}</Text></Pressable></View>)}
    {!plans.length && <View style={[common.card, { marginTop: spacing.lg }]}><Text style={common.muted}>No plans configured.</Text></View>}
  </ScrollView>;
}
