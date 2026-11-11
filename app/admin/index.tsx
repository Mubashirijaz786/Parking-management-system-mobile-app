import { useFocusEffect, useRouter } from "expo-router";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CarFront,
  CreditCard,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Settings2,
  Tag,
  Users,
  WalletCards,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SectionTitle } from "@/src/components/ui";
import { AdminDashboard, adminApi } from "@/src/services/adminApi";
import { colors, common, spacing } from "@/src/theme";
import { formatDateTime } from "@/src/utils/format";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [noticeData, setNoticeData] = useState<any>({ activity: [] });
  const [noticeCount, setNoticeCount] = useState(0);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setError("");
      const [dashboard, notices] = await Promise.all([
        adminApi.dashboard(),
        adminApi.notifications(),
      ]);
      setData(dashboard);
      setNoticeData(notices);
      setNoticeCount(
        (notices.expiring?.length ?? 0) +
          (notices.overdue?.length ?? 0) +
          (notices.stored?.length ?? 0),
      );
    } catch (e: any) {
      if (e.message === "Unauthorized" || e.message === "Admin account is inactive") router.replace("/admin/login" as any);
      else setError(e.message);
    }
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  const card = (icon: any, label: string, value: any, color: string) => (
    <View style={[common.card, { flex: 1, minHeight: 92, gap: 6 }]}>
      {icon}
      <Text style={common.muted}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: "900", color }}>
        {value ?? "-"}
      </Text>
    </View>
  );
  const logout = async () => {
    await adminApi.logout();
    router.replace("/admin/login" as any);
  };
  return (
    <ScrollView
      style={common.screen}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
      contentContainerStyle={common.content}
    >
      <View style={common.between}>
        <View>
          <Text style={common.label}>OWNER CONSOLE</Text>
          <Text style={[common.title, { marginTop: 4 }]}>Admin dashboard</Text>
        </View>
        <Pressable onPress={logout} hitSlop={10}>
          <LogOut size={20} color={colors.secondary} />
        </Pressable>
      </View>
      {error && (
        <View
          style={[
            common.card,
            {
              marginTop: spacing.lg,
              backgroundColor: colors.redSoft,
              borderColor: "#FECACA",
            },
          ]}
        >
          <Text style={{ color: colors.danger, fontWeight: "800" }}>
            {error}
          </Text>
          <Text style={[common.muted, { marginTop: 5 }]}>
            Start the backend and check EXPO_PUBLIC_ADMIN_API_URL.
          </Text>
        </View>
      )}
      {!error && (
        <>
          <View style={[common.row, { gap: 8, marginTop: spacing.lg }]}>
            {card(
              <Users size={18} color={colors.primary} />,
              "Customers",
              data?.totalCustomers,
              colors.text,
            )}
            {card(
              <BriefcaseBusiness size={18} color={colors.primary} />,
              "Active plans",
              data?.activeSubscriptions,
              colors.primary,
            )}
          </View>
          <View style={[common.row, { gap: 8, marginTop: 8 }]}>
            {card(
              <Bell size={18} color={colors.warning} />,
              "Expiring soon",
              data?.expiringSoon,
              colors.warning,
            )}
            {card(
              <CreditCard size={18} color={colors.danger} />,
              "Expired",
              data?.expiredSubscriptions,
              colors.danger,
            )}
          </View>
          <View style={[common.row, { gap: 8, marginTop: 8 }]}>
            {card(
              <WalletCards size={18} color={colors.primary} />,
              "Month revenue",
              data?.monthlyRevenue,
              colors.primary,
            )}
            {card(
              <CreditCard size={18} color={colors.warning} />,
              "Outstanding",
              data?.outstandingPayments,
              colors.warning,
            )}
          </View>
        </>
      )}
      <SectionTitle title="Quick actions" />
      <View style={[common.row, { gap: 8 }]}>
        <Pressable
          onPress={() => router.push("/admin/customer/new" as any)}
          style={[
            common.primaryButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <Plus size={16} color="#fff" />
          <Text style={common.primaryButtonText}>Add customer</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/admin/license" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <KeyRound size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Generate license</Text>
        </Pressable>
      </View>
      <View style={[common.row, { gap: 8, marginTop: 8 }]}>
        <Pressable
          onPress={() => router.push("/admin/customers" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <Users size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Customers</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/admin/expiring" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <Bell size={16} color={colors.warning} />
          <Text style={common.outlineButtonText}>Expiring</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push("/admin/expiring" as any)}
        style={[common.outlineButton, { marginTop: 8, flexDirection: "row", gap: 6 }]}
      >
        <RefreshCw size={16} color={colors.primary} />
        <Text style={common.outlineButtonText}>Renew subscription</Text>
      </Pressable>
      <View style={[common.row, { gap: 8, marginTop: 8 }]}>
        <Pressable
          onPress={() => router.replace("/(tabs)" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <CarFront size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Open parking mode</Text>
        </Pressable>
        <Pressable
          onPress={load}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <RefreshCw size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Refresh</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push("/admin/plans" as any)}
        style={[
          common.outlineButton,
          { marginTop: 8, flexDirection: "row", gap: 6 },
        ]}
      >
        <Settings2 size={16} color={colors.primary} />
        <Text style={common.outlineButtonText}>
          Manage subscription plans and prices
        </Text>
      </Pressable>
      <View style={[common.row, { gap: 8, marginTop: 8 }]}>
        <Pressable
          onPress={() => router.push("/admin/notifications" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <Bell size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Alerts</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/admin/referrals" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <Tag size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Referrals</Text>
        </Pressable>
      </View>
      <View style={[common.row, { gap: 8, marginTop: 8 }]}>
        <Pressable
          onPress={() => router.push("/admin/subscriptions" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <CalendarClock size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Subscriptions</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/admin/payment/new" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <CreditCard size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Record payment</Text>
        </Pressable>
      </View>
      <View style={[common.row, { gap: 8, marginTop: 8 }]}>
        <Pressable
          onPress={() => router.push("/admin/reports" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <BarChart3 size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Revenue reports</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/admin/settings" as any)}
          style={[
            common.outlineButton,
            { flex: 1, flexDirection: "row", gap: 6 },
          ]}
        >
          <Settings2 size={16} color={colors.primary} />
          <Text style={common.outlineButtonText}>Admin settings</Text>
        </Pressable>
      </View>
      <View style={[common.card, { marginTop: spacing.lg, gap: 10 }]}>
        <View style={common.between}>
          <Text style={common.muted}>Admin notifications</Text>
          <Text
            style={{
              color: noticeCount ? colors.warning : colors.success,
              fontWeight: "900",
            }}
          >
            {noticeCount}
          </Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Registered devices</Text>
          <Text style={common.body}>{data?.devices ?? "-"}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>New customers this month</Text>
          <Text style={common.body}>{data?.newCustomers ?? "-"}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Renewals this month</Text>
          <Text style={common.body}>{data?.renewals ?? "-"}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Total revenue</Text>
          <Text style={common.body}>
            PKR {String(data?.totalRevenue ?? "-")}
          </Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Unpaid invoices</Text>
          <Text style={common.body}>{data?.totalUnpaidInvoices ?? "-"}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Referral rewards</Text>
          <Text style={common.body}>
            PKR {String(data?.totalReferralRewards ?? "-")}
          </Text>
        </View>
      </View>
      <SectionTitle
        title="Recent activity"
        action="View all"
        onPress={() => router.push("/admin/notifications" as any)}
      />
      {(noticeData.activity ?? []).slice(0, 5).map((item: any, index: number) => (
        <View key={`${item.createdAt}-${index}`} style={[common.card, { marginBottom: 8 }]}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>{item.title}</Text>
          <Text style={[common.muted, { marginTop: 4 }]}>{item.body}</Text>
          <Text style={[common.muted, { marginTop: 4, fontSize: 11 }]}>{formatDateTime(item.createdAt)}</Text>
        </View>
      ))}
      <View
        style={[
          common.card,
          {
            marginTop: spacing.lg,
            backgroundColor: colors.greenSoft,
            borderColor: "#BFE8D2",
          },
        ]}
      >
        <Text style={{ color: colors.primary, fontWeight: "900" }}>
          Admin data is online
        </Text>
        <Text style={[common.muted, { marginTop: 5, lineHeight: 18 }]}>
          Parking entries, exits and vehicle plates stay in each customer device
          database.
        </Text>
      </View>
    </ScrollView>
  );
}
