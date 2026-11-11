import { useRouter } from "expo-router";
import { CreditCard } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { EmptyState, SectionTitle } from "@/src/components/ui";
import { adminApi } from "@/src/services/adminApi";
import { colors, common, spacing } from "@/src/theme";
import { formatDate } from "@/src/utils/format";

export default function AdminPayments() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    adminApi
      .payments()
      .then(setRows)
      .catch((e) => Alert.alert("Payments unavailable", e.message));
  }, []);
  return (
    <ScrollView style={common.screen} contentContainerStyle={common.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.primary, fontWeight: "800" }}>
          ‹ Admin dashboard
        </Text>
      </Pressable>
      <View style={[common.between, { marginTop: spacing.lg }]}>
        <View style={[common.row, { gap: 9 }]}>
          <CreditCard size={25} color={colors.primary} />
          <View>
            <Text style={common.title}>Payments</Text>
            <Text style={[common.muted, { marginTop: 3 }]}>
              Manual customer payment ledger
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/admin/payment/new" as any)}
          style={[
            common.primaryButton,
            { minHeight: 36, paddingVertical: 8, paddingHorizontal: 10 },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
            Record
          </Text>
        </Pressable>
      </View>
      <SectionTitle title={`${rows.length} payments`} />
      {rows.length === 0 ? (
        <EmptyState
          title="No payments"
          body="Recorded customer payments will appear here."
        />
      ) : (
        rows.map((payment) => (
          <View key={payment.id} style={[common.card, { marginBottom: 8 }]}>
            <View style={common.between}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: colors.text }}>
                  {payment.customer?.businessName ?? payment.customerId}
                </Text>
                <Text style={[common.muted, { marginTop: 3 }]}>
                  {formatDate(payment.paidAt)} · {payment.method}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: "900" }}>
                ₨ {String(payment.amount)}
              </Text>
            </View>
            <Text style={[common.muted, { marginTop: 9 }]}>
              Payment ID: {payment.paymentId}
              {payment.transactionRef
                ? ` · Ref: ${payment.transactionRef}`
                : ""}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
