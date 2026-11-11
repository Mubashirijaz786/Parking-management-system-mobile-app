import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Pencil,
  RefreshCw,
  Share2,
  UserPlus,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { setStringAsync } from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, SectionTitle } from "@/src/components/ui";
import { adminApi, AdminCustomer } from "@/src/services/adminApi";
import { colors, common, spacing } from "@/src/theme";
import { formatDate, formatPKR } from "@/src/utils/format";
import QRCode from "react-native-qrcode-svg";

const invoiceDue = (invoice: any) => {
  const paid = (invoice.payments ?? []).reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  const adjustments = (invoice.adjustments ?? []).reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  return Math.max(0, Number(invoice.amount) - Number(invoice.discount ?? 0) + adjustments - paid);
};

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [license, setLicense] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [renewAmount, setRenewAmount] = useState("");
  const [renewPaymentMethod, setRenewPaymentMethod] = useState("CASH");
  const [renewPlanId, setRenewPlanId] = useState("");
  const [newDeviceIdentifier, setNewDeviceIdentifier] = useState("");
  const [acknowledgementText, setAcknowledgementText] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    phone: "",
    whatsapp: "",
    city: "",
    address: "",
  });

  const load = async () => {
    if (!id) return;
    try {
      const result = await adminApi.customer(id);
      setCustomer(result);
      setForm({
        fullName: result.fullName,
        businessName: result.businessName,
        phone: result.phone,
        whatsapp: result.whatsapp ?? "",
        city: result.city,
        address: result.address ?? "",
      });
    } catch (e: any) {
      Alert.alert("Customer unavailable", e.message);
    }
  };
  useEffect(() => {
    load();
    adminApi
      .plans()
      .then(setPlans)
      .catch(() => undefined);
  }, [id]);
  if (!customer)
    return (
      <View style={common.screen}>
        <Text
          style={[
            common.muted,
            { padding: spacing.lg, paddingTop: insets.top + spacing.lg },
          ]}
        >
          Loading customer...
        </Text>
      </View>
    );

  const subscription = customer.subscriptions?.[0];
  const device =
    customer.devices?.find((item) => item.active) ?? customer.devices?.[0];
  const currentLicense = subscription?.licenses?.[0];
  const totalSubscribedDays = (customer.subscriptions ?? []).reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        Math.ceil(
          (new Date(item.expiresAt).getTime() -
            new Date(item.startsAt).getTime()) /
            86400000,
        ),
      ),
    0,
  );
  const totalPaid = (customer.payments ?? [])
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const paidPeriods = (customer.subscriptions ?? []).flatMap((item) => item.invoices ?? []).filter((invoice: any) => invoice.status === "PAID").length;
  const outstandingInvoices = (customer.subscriptions ?? []).flatMap((item) => item.invoices ?? []).filter((invoice: any) => invoiceDue(invoice) > 0);
  const outstanding = (customer.subscriptions ?? [])
    .flatMap((item) => item.invoices ?? [])
    .reduce((sum, invoice) => sum + invoiceDue(invoice), 0);
  const saveCustomer = async () => {
    setBusy(true);
    try {
      await adminApi.updateCustomer(customer.id, form);
      setEditing(false);
      await load();
      Alert.alert("Saved", "Customer information updated.");
    } catch (e: any) {
      Alert.alert("Update failed", e.message);
    } finally {
      setBusy(false);
    }
  };
  const issue = async () => {
    if (!subscription || !device) {
      Alert.alert(
        "Missing information",
        "Register a device and subscription before generating a license.",
      );
      return;
    }
    try {
      const result = await adminApi.issueLicense(subscription.id, device.id);
      setLicense(result);
      Alert.alert(
        "License issued",
        "Copy or share the signed license with this customer.",
      );
    } catch (e: any) {
      Alert.alert("License failed", e.message);
    }
  };
  const renew = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      await adminApi.renewSubscription(subscription.id, {
        planId: renewPlanId || undefined,
        paymentAmount: renewAmount ? Number(renewAmount) : undefined,
        paymentMethod: renewAmount ? renewPaymentMethod : undefined,
      });
      setRenewAmount("");
      await load();
      Alert.alert(
        "Renewed",
        "A new subscription period was recorded. Generate a new license for the device.",
      );
    } catch (e: any) {
      Alert.alert("Renewal failed", e.message);
    } finally {
      setBusy(false);
    }
  };
  const payment = async () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Amount required", "Enter a valid payment amount.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.recordPayment(customer.id, {
        amount,
        method: paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
      });
      setPaymentAmount("");
      setTransactionRef("");
      await load();
      Alert.alert("Payment recorded", "The customer ledger has been updated.");
    } catch (e: any) {
      Alert.alert("Payment failed", e.message);
    } finally {
      setBusy(false);
    }
  };
  const refund = (paymentId: string) =>
    Alert.alert(
      "Refund payment?",
      "This records a refund reversal and recalculates the invoice balance.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Refund",
          style: "destructive",
          onPress: async () => {
            try {
              await adminApi.refundPayment(customer.id, paymentId);
              await load();
              Alert.alert(
                "Refund recorded",
                "The payment is marked refunded and the ledger is preserved.",
              );
            } catch (e: any) {
              Alert.alert("Refund failed", e.message);
            }
          },
        },
      ],
    );
  const adjustment = async () => {
    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount === 0 || !adjustmentReason.trim()) {
      Alert.alert(
        "Adjustment required",
        "Enter a non-zero amount and a reason. Use a negative amount for a discount or credit.",
      );
      return;
    }
    setBusy(true);
    try {
      await adminApi.recordAdjustment(customer.id, {
        amount,
        reason: adjustmentReason.trim(),
        subscriptionId: subscription?.id,
      });
      setAdjustmentAmount("");
      setAdjustmentReason("");
      await load();
      Alert.alert(
        "Ledger updated",
        "The adjustment was recorded without overwriting old transactions.",
      );
    } catch (e: any) {
      Alert.alert("Adjustment failed", e.message);
    } finally {
      setBusy(false);
    }
  };
  const createReferral = async () => {
    try {
      const referral = await adminApi.createReferral(customer.id);
      Alert.alert("Referral created", referral.code);
      await load();
    } catch (e: any) {
      Alert.alert("Referral failed", e.message);
    }
  };
  const suspend = async () => {
    if (!subscription) return;
    try {
      await adminApi.suspendRenewals(subscription.id);
      await load();
      Alert.alert(
        "Renewals suspended",
        "Future renewals now require an explicit admin action.",
      );
    } catch (e: any) {
      Alert.alert("Action failed", e.message);
    }
  };
  const suspendSubscription = async () => {
    if (!subscription) return;
    try {
      await adminApi.suspendSubscription(subscription.id);
      await load();
      Alert.alert(
        "Subscription suspended",
        "The current subscription is now suspended.",
      );
    } catch (e: any) {
      Alert.alert("Action failed", e.message);
    }
  };
  const replaceDevice = async () => {
    if (!newDeviceIdentifier.trim()) {
      Alert.alert("Device ID required", "Enter the new installation ID first.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.replaceDevice(customer.id, {
        deviceIdentifier: newDeviceIdentifier.trim(),
      });
      setNewDeviceIdentifier("");
      await load();
      Alert.alert(
        "Device replaced",
        "The previous device was deactivated. Generate a new license for this device.",
      );
    } catch (e: any) {
      Alert.alert("Device replacement failed", e.message);
    } finally {
      setBusy(false);
    }
  };
  const confirmOfflineActivation = async () => {
    const latestLicense = customer.subscriptions
      ?.flatMap((item) => item.licenses ?? [])
      .sort(
        (a: any, b: any) =>
          new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
      )[0];
    if (!device || !latestLicense || !acknowledgementText.trim()) {
      Alert.alert(
        "Acknowledgement required",
        "Paste the customer acknowledgement and make sure an issued license and active device exist.",
      );
      return;
    }
    setBusy(true);
    try {
      await adminApi.acknowledgeActivation(
        latestLicense.licenseId,
        device.deviceIdentifier,
        acknowledgementText.trim(),
      );
      setAcknowledgementText("");
      await load();
      Alert.alert(
        "Activation confirmed",
        "The signed acknowledgement is now recorded against this device.",
      );
    } catch (e: any) {
      Alert.alert("Confirmation failed", e.message);
    } finally {
      setBusy(false);
    }
  };
  const archive = () =>
    Alert.alert(
      "Archive customer?",
      "Financial history will be preserved and the customer will no longer appear in the active list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            try {
              await adminApi.archiveCustomer(customer.id);
              Alert.alert("Archived", "Customer archived.");
              router.replace("/admin/customers" as any);
            } catch (e: any) {
              Alert.alert("Archive failed", e.message);
            }
          },
        },
      ],
    );
  const copy = async () => {
    if (license?.activationCode) {
      await setStringAsync(license.activationCode);
      Alert.alert("Copied", "Signed license copied.");
    }
  };
  const share = () =>
    license?.activationCode &&
    Share.share({
      message: license.activationCode,
      title: "ParkEase activation license",
    });
  const exportLicense = async () => {
    if (!license?.activationCode) return;
    try {
      const uri = `${FileSystem.documentDirectory}parkease-${license.licenseId}.txt`;
      await FileSystem.writeAsStringAsync(
        uri,
        `ParkEase activation license\nLicense ID: ${license.licenseId}\n\n${license.activationCode}`,
        { encoding: FileSystem.EncodingType.UTF8 },
      );
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "text/plain",
          dialogTitle: "Share ParkEase license file",
        });
      else Alert.alert("License saved", uri);
    } catch (e: any) {
      Alert.alert("Export failed", e.message);
    }
  };
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

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
      <View style={[common.between, { marginTop: spacing.lg }]}>
        <View>
          <Text style={common.label}>{customer.customerCode}</Text>
          <Text style={[common.title, { marginTop: 4 }]}>
            {customer.businessName}
          </Text>
          <Text style={[common.muted, { marginTop: 4 }]}>
            {customer.fullName} · {customer.city}
          </Text>
        </View>
        <CheckCircle2 size={25} color={colors.primary} />
      </View>

      <SectionTitle
        title="Customer information"
        action={editing ? "Cancel" : "Edit"}
        onPress={() => setEditing(!editing)}
      />
      {editing ? (
        <View style={[common.card, { gap: 12 }]}>
          <Field
            label="Full name"
            value={form.fullName}
            onChangeText={(v) => set("fullName", v)}
          />
          <Field
            label="Business name"
            value={form.businessName}
            onChangeText={(v) => set("businessName", v)}
          />
          <Field
            label="Phone"
            value={form.phone}
            onChangeText={(v) => set("phone", v)}
            keyboardType="phone-pad"
          />
          <Field
            label="WhatsApp"
            value={form.whatsapp}
            onChangeText={(v) => set("whatsapp", v)}
            keyboardType="phone-pad"
          />
          <Field
            label="City"
            value={form.city}
            onChangeText={(v) => set("city", v)}
          />
          <Field
            label="Address"
            value={form.address}
            onChangeText={(v) => set("address", v)}
            multiline
          />
          <Button
            title={busy ? "Saving..." : "Save customer"}
            onPress={saveCustomer}
            loading={busy}
            disabled={busy}
          />
        </View>
      ) : (
        <View style={[common.card, { gap: 9 }]}>
          <View style={common.between}>
            <Text style={common.muted}>Phone</Text>
            <Text style={common.body}>{customer.phone}</Text>
          </View>
          <View style={common.between}>
            <Text style={common.muted}>WhatsApp</Text>
            <Text style={common.body}>{customer.whatsapp || "-"}</Text>
          </View>
          <View style={common.between}>
            <Text style={common.muted}>Address</Text>
            <Text
              style={[common.body, { maxWidth: "60%", textAlign: "right" }]}
            >
              {customer.address || customer.city}
            </Text>
          </View>
        </View>
      )}

      <SectionTitle title="Subscription" />
      <View style={[common.card, { gap: 10 }]}>
        <View style={common.between}>
          <Text style={common.muted}>Plan</Text>
          <Text style={common.body}>{subscription?.plan?.name ?? "-"}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Expires</Text>
          <Text style={common.body}>
            {subscription?.expiresAt ? formatDate(subscription.expiresAt) : "-"}
          </Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Status</Text>
          <Text
            style={{
              color:
                subscription?.status === "ACTIVE"
                  ? colors.success
                  : colors.warning,
              fontWeight: "800",
            }}
          >
            {subscription?.status ?? "-"}
          </Text>
        </View>
        <View style={[common.row, { gap: 8 }]}>
          {plans.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() => setRenewPlanId(plan.id)}
              style={[
                common.outlineButton,
                {
                  flex: 1,
                  borderColor:
                    renewPlanId === plan.id ? colors.primary : colors.border,
                  backgroundColor:
                    renewPlanId === plan.id ? colors.greenSoft : colors.surface,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: renewPlanId === plan.id ? colors.primary : colors.text,
                }}
              >
                {plan.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Renewal payment (optional)"
          value={renewAmount}
          onChangeText={setRenewAmount}
          keyboardType="decimal-pad"
          placeholder="PKR"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {[["CASH", "Cash"], ["BANK_TRANSFER", "Bank"], ["EASYPAISA", "Easypaisa"], ["JAZZCASH", "JazzCash"], ["OTHER", "Other"]].map(([value, label]) => <Pressable key={value} onPress={() => setRenewPaymentMethod(value)} style={{ borderWidth: 1, borderColor: renewPaymentMethod === value ? colors.primary : colors.border, backgroundColor: renewPaymentMethod === value ? colors.greenSoft : colors.surface, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10 }}><Text style={{ color: renewPaymentMethod === value ? colors.primary : colors.secondary, fontSize: 11, fontWeight: "800" }}>{label}</Text></Pressable>)}
        </ScrollView>
        <Button
          title={busy ? "Processing..." : "Renew subscription"}
          onPress={renew}
          loading={busy}
          disabled={busy || !subscription}
        />
        <Pressable
          onPress={suspend}
          style={{ alignItems: "center", paddingVertical: 8 }}
        >
          <Text style={{ color: colors.warning, fontWeight: "800" }}>
            Suspend future renewals
          </Text>
        </Pressable>
        <Pressable
          onPress={suspendSubscription}
          style={{ alignItems: "center", paddingVertical: 8 }}
        >
          <Text style={{ color: colors.danger, fontWeight: "800" }}>
            Suspend current subscription
          </Text>
        </Pressable>
      </View>
      <View style={[common.card, { marginTop: spacing.sm, gap: 9 }]}>
        <View style={common.between}>
          <Text style={common.muted}>Registered</Text>
          <Text style={common.body}>{formatDate(customer.registeredAt)}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Subscription periods</Text>
          <Text style={common.body}>{customer.subscriptions?.length ?? 0}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Subscribed days</Text>
          <Text style={common.body}>{totalSubscribedDays}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Paid periods</Text>
          <Text style={common.body}>{paidPeriods}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Total paid</Text>
          <Text style={common.body}>{formatPKR(totalPaid)}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Outstanding</Text>
          <Text
            style={{
              color: outstanding > 0 ? colors.warning : colors.success,
              fontWeight: "900",
            }}
          >
            {formatPKR(outstanding)}
          </Text>
        </View>
      </View>

      <SectionTitle title="Subscription timeline" />
      {(customer.subscriptions ?? []).map((period: any) => {
        const invoice = period.invoices?.[0];
        return (
          <View key={period.id} style={[common.card, { marginBottom: 8, gap: 5 }]}>
            <View style={common.between}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{period.plan?.name ?? "Plan"}</Text>
              <Text style={{ color: invoice?.status === "PAID" ? colors.success : colors.warning, fontWeight: "800" }}>{invoice?.status ?? period.status}</Text>
            </View>
            <Text style={common.muted}>{formatDate(period.startsAt)} → {formatDate(period.expiresAt)}</Text>
            <Text style={common.muted}>{invoice?.invoiceNumber ?? "No invoice"} · {formatPKR(invoice ? Number(invoice.amount) : Number(period.price))}{invoice && invoiceDue(invoice) > 0 ? ` · Due ${formatPKR(invoiceDue(invoice))}` : ""}</Text>
          </View>
        );
      })}
      {outstandingInvoices.length > 0 && <View style={[common.card, { backgroundColor: colors.amberSoft, borderColor: "#FDE68A", gap: 6 }]}>
        <Text style={{ color: colors.warning, fontWeight: "900" }}>Outstanding invoices</Text>
        {outstandingInvoices.slice(0, 5).map((invoice: any) => <View key={invoice.id} style={common.between}><Text style={common.muted}>{invoice.invoiceNumber}</Text><Text style={{ color: colors.warning, fontWeight: "900" }}>{formatPKR(invoiceDue(invoice))}</Text></View>)}
      </View>}

      <SectionTitle title="Registered device" />
      <View style={[common.card, { gap: 9 }]}>
        <Text
          selectable
          style={{ fontSize: 12, fontWeight: "800", color: colors.text }}
        >
          {device?.deviceIdentifier ?? "No device registered"}
        </Text>
        <View style={common.between}>
          <Text style={common.muted}>Activation</Text>
          <Text
            style={{
              color:
                device?.activationStatus === "CONFIRMED"
                  ? colors.success
                  : colors.warning,
              fontWeight: "800",
            }}
          >
            {device?.activationStatus ?? "NOT ACTIVATED"}
          </Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Current license</Text>
          <Text style={common.body}>{currentLicense?.licenseId ?? "-"}</Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Activation confirmed</Text>
          <Text style={common.body}>
            {device?.activatedAt ? formatDate(device.activatedAt) : "-"}
          </Text>
        </View>
        <View style={common.between}>
          <Text style={common.muted}>Last acknowledgement</Text>
          <Text style={common.body}>
            {device?.lastAcknowledgedAt
              ? formatDate(device.lastAcknowledgedAt)
              : "-"}
          </Text>
        </View>
        <Button title="Generate signed license" onPress={issue} />
        <Field
          label="Replace with installation ID"
          value={newDeviceIdentifier}
          onChangeText={setNewDeviceIdentifier}
          autoCapitalize="none"
          placeholder="Paste new device ID"
        />
        <Button
          title="Replace device"
          variant="outline"
          onPress={replaceDevice}
          loading={busy}
          disabled={busy}
        />
        <Field
          label="Offline activation acknowledgement"
          value={acknowledgementText}
          onChangeText={setAcknowledgementText}
          autoCapitalize="none"
          multiline
          placeholder="Paste the ACK2 code received from the customer"
        />
        <Button
          title="Confirm offline activation"
          variant="outline"
          onPress={confirmOfflineActivation}
          loading={busy}
          disabled={busy}
        />
      </View>
      {license && (
        <View
          style={[
            common.card,
            {
              marginTop: spacing.lg,
              backgroundColor: colors.greenSoft,
              borderColor: "#BFE8D2",
              gap: 10,
            },
          ]}
        >
          <Text style={common.label}>ACTIVATION LICENSE</Text>
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <QRCode value={license.activationCode} size={150} />
          </View>
          <Text
            selectable
            style={{ fontSize: 11, lineHeight: 18, color: colors.text }}
          >
            {license.activationCode}
          </Text>
          <View style={[common.row, { gap: 8 }]}>
            <Pressable
              onPress={copy}
              style={[
                common.outlineButton,
                { flex: 1, flexDirection: "row", gap: 5 },
              ]}
            >
              <Copy size={15} color={colors.primary} />
              <Text style={common.outlineButtonText}>Copy</Text>
            </Pressable>
            <Pressable
              onPress={share}
              style={[
                common.primaryButton,
                { flex: 1, flexDirection: "row", gap: 5 },
              ]}
            >
              <Share2 size={15} color="#fff" />
              <Text style={common.primaryButtonText}>Share</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={exportLicense}
            style={[
              common.outlineButton,
              { flexDirection: "row", justifyContent: "center" },
            ]}
          >
            <Text style={common.outlineButtonText}>Save license file</Text>
          </Pressable>
        </View>
      )}

      <SectionTitle title="Payments" />
      <View style={[common.card, { gap: 10 }]}>
        <Field
          label="Record payment"
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="decimal-pad"
          placeholder="PKR"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7 }}
        >
          {[
            ["CASH", "Cash"],
            ["BANK_TRANSFER", "Bank"],
            ["EASYPAISA", "Easypaisa"],
            ["JAZZCASH", "JazzCash"],
            ["OTHER", "Other"],
          ].map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setPaymentMethod(value)}
              style={{
                borderWidth: 1,
                borderColor:
                  paymentMethod === value ? colors.primary : colors.border,
                backgroundColor:
                  paymentMethod === value ? colors.greenSoft : colors.surface,
                borderRadius: 16,
                paddingVertical: 7,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  color:
                    paymentMethod === value ? colors.primary : colors.secondary,
                  fontSize: 11,
                  fontWeight: "800",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Field
          label="Transaction reference (optional)"
          value={transactionRef}
          onChangeText={setTransactionRef}
          placeholder="Bank/e-wallet reference"
        />
        <Button
          title="Record payment"
          onPress={payment}
          loading={busy}
          disabled={busy}
        />
        {customer.payments?.slice(0, 8).map((item) => (
          <View
            key={item.id}
            style={[common.between, { alignItems: "center" }]}
          >
            <View>
              <Text style={common.muted}>
                <Text style={common.muted}>{item.invoice?.invoiceNumber ?? "Unapplied"} · </Text>
                {formatDate(item.paidAt)} · {item.method}
              </Text>
              <Text
                style={{
                  color:
                    item.status === "REFUNDED" ? colors.danger : colors.text,
                  fontWeight: "800",
                  marginTop: 2,
                }}
              >
                {formatPKR(Number(item.amount))} · {item.status}
              </Text>
            </View>
            {item.status === "PAID" && (
              <Pressable
                onPress={() => refund(item.id)}
                style={[
                  common.outlineButton,
                  { minHeight: 32, paddingVertical: 6, paddingHorizontal: 9 },
                ]}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: "800",
                    fontSize: 11,
                  }}
                >
                  Refund
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <SectionTitle title="License history" />
      {(customer.subscriptions ?? []).flatMap((item) => item.licenses ?? [])
        .length === 0 ? (
        <View style={[common.card, { paddingVertical: 14 }]}>
          <Text style={common.muted}>No licenses issued yet.</Text>
        </View>
      ) : (
        (customer.subscriptions ?? [])
          .flatMap((item) => item.licenses ?? [])
          .map((item: any) => (
            <View
              key={item.id}
              style={[common.card, { marginBottom: 8, gap: 5 }]}
            >
              <View style={common.between}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {item.licenseId}
                </Text>
                <Text
                  style={{
                    color: item.revokedAt ? colors.danger : colors.success,
                    fontWeight: "800",
                  }}
                >
                  {item.revokedAt ? "REVOKED" : "ISSUED"}
                </Text>
              </View>
              <Text style={common.muted}>
                {formatDate(item.issuedAt)} → {formatDate(item.expiresAt)}
              </Text>
            </View>
          ))
      )}
      <SectionTitle title="Ledger adjustment" />
      <View style={[common.card, { gap: 10 }]}>
        <Text style={common.muted}>
          Use a negative amount for a discount or credit, and a positive amount
          for an additional charge.
        </Text>
        <Field
          label="Adjustment amount (PKR)"
          value={adjustmentAmount}
          onChangeText={setAdjustmentAmount}
          keyboardType="numbers-and-punctuation"
          placeholder="-500"
        />
        <Field
          label="Reason"
          value={adjustmentReason}
          onChangeText={setAdjustmentReason}
          placeholder="Approved referral discount"
        />
        <Button
          title="Record adjustment"
          variant="outline"
          onPress={adjustment}
          loading={busy}
          disabled={busy}
        />
      </View>
      <SectionTitle title="Referrals" />
      <View style={[common.card, { gap: 9 }]}>
        <Text style={common.muted}>
          {customer.referrals?.length ?? 0} referral codes assigned
        </Text>
        {customer.referrals?.map((referral: any) => (
          <View
            key={referral.id}
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 8,
              gap: 3,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {referral.code}
            </Text>
            <Text style={common.muted}>
              {referral.active ? "Available" : "Inactive"} ·{" "}
              {referral.claims?.length ?? 0} claim
              {referral.claims?.length === 1 ? "" : "s"}
            </Text>
            {referral.claims?.map((claim: any) => (
              <Text
                key={claim.id}
                style={{
                  color:
                    claim.reward?.status === "REWARD_ISSUED"
                      ? colors.success
                      : colors.warning,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {claim.claimedBy?.businessName ?? claim.claimedById}:{" "}
                {claim.reward?.status ?? claim.status}
              </Text>
            ))}
          </View>
        ))}
        <Button title="Create referral code" onPress={createReferral} />
        <Text style={[common.muted, { fontSize: 11 }]}>
          Maximum two active codes per customer. Rewards require admin
          verification.
        </Text>
      </View>
      <Pressable
        onPress={archive}
        style={{ alignItems: "center", paddingVertical: 15 }}
      >
        <Text style={{ color: colors.danger, fontWeight: "800" }}>
          Archive customer
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/admin" as any)}
        style={[
          common.outlineButton,
          { marginTop: spacing.lg, flexDirection: "row", gap: 6 },
        ]}
      >
        <RefreshCw size={15} color={colors.primary} />
        <Text style={common.outlineButtonText}>Back to dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}
