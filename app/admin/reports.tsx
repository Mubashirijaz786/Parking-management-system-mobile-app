import { useRouter } from "expo-router";
import { BarChart3 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { EmptyState, SectionTitle } from "@/src/components/ui";
import { adminApi } from "@/src/services/adminApi";
import { colors, common, spacing } from "@/src/theme";

export default function AdminReports() {
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  useEffect(() => {
    adminApi
      .reports()
      .then(setReport)
      .catch((e) => Alert.alert("Reports unavailable", e.message));
  }, []);
  if (!report)
    return (
      <View style={common.screen}>
        <Text style={[common.muted, { padding: spacing.lg }]}>
          Loading report...
        </Text>
      </View>
    );
  return (
    <ScrollView style={common.screen} contentContainerStyle={common.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.primary, fontWeight: "800" }}>
          ‹ Admin dashboard
        </Text>
      </Pressable>
      <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}>
        <BarChart3 size={25} color={colors.primary} />
        <View>
          <Text style={common.title}>Revenue reports</Text>
          <Text style={[common.muted, { marginTop: 3 }]}>
            Current calendar year · actual payments
          </Text>
        </View>
      </View>
      <View style={[common.row, { gap: 8, marginTop: spacing.lg }]}>
        <View style={[common.card, { flex: 1 }]}>
          <Text style={common.muted}>Collected</Text>
          <Text
            style={{
              color: colors.primary,
              fontSize: 20,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            ₨ {String(report.yearRevenue)}
          </Text>
        </View>
        <View style={[common.card, { flex: 1 }]}>
          <Text style={common.muted}>Unpaid</Text>
          <Text
            style={{
              color: colors.warning,
              fontSize: 20,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            ₨ {String(report.unpaid)}
          </Text>
        </View>
      </View>
      <SectionTitle title="Payments by method" />
      {report.byMethod?.length ? (
        report.byMethod.map((row: any) => (
          <View key={row.method} style={[common.card, { marginBottom: 8 }]}>
            <View style={common.between}>
              <Text style={common.body}>{row.method}</Text>
              <Text style={{ fontWeight: "900", color: colors.primary }}>
                ₨ {String(row._sum.amount ?? 0)}
              </Text>
            </View>
            <Text style={[common.muted, { marginTop: 4 }]}>
              {row._count._all} payments
            </Text>
          </View>
        ))
      ) : (
        <EmptyState
          title="No payment data"
          body="Real payment records will populate this report."
        />
      )}
      <SectionTitle title="Revenue by plan" />
      {report.byPlan?.length ? (
        report.byPlan.map((row: any) => (
          <View key={row.planId} style={[common.card, { marginBottom: 8 }]}>
            <View style={common.between}>
              <Text style={common.body}>{row.planName}</Text>
              <Text style={{ fontWeight: "900", color: colors.primary }}>
                ₨ {String(row.amount)}
              </Text>
            </View>
            <Text style={[common.muted, { marginTop: 4 }]}>
              {row.count} payments
            </Text>
          </View>
        ))
      ) : (
        <EmptyState
          title="No plan revenue data"
          body="Payments linked to subscription plans will appear here."
        />
      )}
    </ScrollView>
  );
}
