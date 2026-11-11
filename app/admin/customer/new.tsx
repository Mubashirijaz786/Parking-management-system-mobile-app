import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field } from "@/src/components/ui";
import { adminApi } from "@/src/services/adminApi";
import { colors, common, radius, spacing } from "@/src/theme";

export default function NewCustomer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    phone: "",
    whatsapp: "",
    city: "",
    address: "",
    deviceIdentifier: "",
    referralCode: "",
    paymentAmount: "",
    paymentMethod: "CASH",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    adminApi
      .plans()
      .then((items) => {
        setPlans(items);
        setPlanId(items[0]?.id ?? "");
      })
      .catch((e) => Alert.alert("Plans unavailable", e.message));
  }, []);
  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!planId) {
      Alert.alert(
        "Plan required",
        "Create or select a subscription plan first.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await adminApi.createCustomer({
        ...form,
        referralCode: form.referralCode.trim() || undefined,
        planId,
        paymentAmount: form.paymentAmount
          ? Number(form.paymentAmount)
          : undefined,
      });
      router.replace(`/admin/customer/${result.id}` as any);
    } catch (e: any) {
      Alert.alert("Customer not saved", e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      style={common.screen}
      contentContainerStyle={[
        common.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 },
      ]}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.primary, fontWeight: "800" }}>
          ‹ Customers
        </Text>
      </Pressable>
      <Text style={[common.title, { marginTop: spacing.lg }]}>
        Add customer
      </Text>
      <View style={[common.card, { marginTop: spacing.lg, gap: 12 }]}>
        <Field
          label="Full name"
          value={form.fullName}
          onChangeText={(value) => set("fullName", value)}
          placeholder="Customer owner name"
        />
        <Field
          label="Parking business name"
          value={form.businessName}
          onChangeText={(value) => set("businessName", value)}
          placeholder="Business name"
        />
        <Field
          label="Phone number"
          value={form.phone}
          onChangeText={(value) => set("phone", value)}
          keyboardType="phone-pad"
        />
        <Field
          label="WhatsApp (optional)"
          value={form.whatsapp}
          onChangeText={(value) => set("whatsapp", value)}
          keyboardType="phone-pad"
        />
        <View style={[common.row, { gap: 8 }]}>
          <View style={{ flex: 1 }}>
            <Field
              label="City"
              value={form.city}
              onChangeText={(value) => set("city", value)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Payment amount"
              value={form.paymentAmount}
              onChangeText={(value) => set("paymentAmount", value)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Field
          label="Business address"
          value={form.address}
          onChangeText={(value) => set("address", value)}
          multiline
        />
        <Field
          label="Device identifier (optional)"
          value={form.deviceIdentifier}
          onChangeText={(value) => set("deviceIdentifier", value)}
          autoCapitalize="none"
          placeholder="Paste after customer installs the app"
        />
        <Field
          label="Referral code (optional)"
          value={form.referralCode}
          onChangeText={(value) => set("referralCode", value)}
          autoCapitalize="characters"
          placeholder="PARK-XXXXXXXXXX"
        />
      </View>
      <Text style={[common.label, { marginTop: spacing.lg }]}>
        SUBSCRIPTION PLAN
      </Text>
      <View style={[common.row, { gap: 8, flexWrap: "wrap", marginTop: 8 }]}>
        {plans.map((plan) => (
          <Pressable
            key={plan.id}
            onPress={() => setPlanId(plan.id)}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 13,
              borderWidth: 1,
              borderColor: planId === plan.id ? colors.primary : colors.border,
              borderRadius: radius.md,
              backgroundColor:
                planId === plan.id ? colors.greenSoft : colors.surface,
            }}
          >
            <Text
              style={{
                fontWeight: "800",
                color: planId === plan.id ? colors.primary : colors.text,
              }}
            >
              {plan.name}
            </Text>
            <Text style={common.muted}>
              {plan.validityDays} days - ₨ {String(plan.price)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: spacing.xl }}>
        <Button
          title={busy ? "Saving..." : "Register customer"}
          onPress={save}
          loading={busy}
          disabled={busy}
        />
      </View>
    </ScrollView>
  );
}
