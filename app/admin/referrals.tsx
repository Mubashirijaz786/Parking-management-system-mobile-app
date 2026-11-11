import { useRouter } from "expo-router";
import { Gift, Tag } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Button, EmptyState, Field, SectionTitle } from "@/src/components/ui";
import { adminApi } from "@/src/services/adminApi";
import { colors, common, spacing } from "@/src/theme";

export default function AdminReferrals() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const load = () =>
    adminApi
      .referrals()
      .then(setRows)
      .catch((e) => Alert.alert("Referrals unavailable", e.message));
  useEffect(() => {
    load();
  }, []);
  const verify = async (claimId: string) => {
    const amount = Number(amounts[claimId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        "Reward amount required",
        "Enter a reward amount greater than zero in PKR.",
      );
      return;
    }
    try {
      await adminApi.verifyReferral(claimId, amount);
      await load();
      Alert.alert("Verified", "The reward is pending final issue approval.");
    } catch (e: any) {
      Alert.alert("Verification failed", e.message);
    }
  };
  const issue = async (rewardId: string) => {
    try {
      await adminApi.issueReferralReward(rewardId);
      await load();
      Alert.alert(
        "Reward issued",
        "The referral reward is now recorded as issued.",
      );
    } catch (e: any) {
      Alert.alert("Issue failed", e.message);
    }
  };
  return (
    <ScrollView style={common.screen} contentContainerStyle={common.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.primary, fontWeight: "800" }}>
          ‹ Admin dashboard
        </Text>
      </Pressable>
      <View style={[common.row, { gap: 9, marginTop: spacing.lg }]}>
        <Tag size={25} color={colors.primary} />
        <View>
          <Text style={common.title}>Referrals</Text>
          <Text style={[common.muted, { marginTop: 3 }]}>
            Codes, claims and approved rewards
          </Text>
        </View>
      </View>
      <SectionTitle title={`${rows.length} codes`} />
      {rows.length === 0 ? (
        <EmptyState
          title="No referral codes"
          body="Create a code from a customer detail screen."
        />
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            style={[common.card, { marginBottom: 8, gap: 10 }]}
          >
            <View style={common.between}>
              <View>
                <Text style={{ fontWeight: "900", color: colors.text }}>
                  {row.code}
                </Text>
                <Text style={[common.muted, { marginTop: 3 }]}>
                  {row.customer?.businessName ?? row.customerId}
                </Text>
              </View>
              <Gift size={19} color={colors.primary} />
            </View>
            {row.claims?.length ? (
              row.claims.map((claim: any) => (
                <View
                  key={claim.id}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: 9,
                    gap: 7,
                  }}
                >
                  <Text style={common.muted}>
                    Claimed by{" "}
                    {claim.claimedBy?.businessName ?? claim.claimedById} ·{" "}
                    {claim.status}
                  </Text>
                  {!claim.reward ? (
                    <>
                      <Field
                        label="Reward amount (PKR)"
                        value={amounts[claim.id] ?? ""}
                        onChangeText={(value) =>
                          setAmounts((current) => ({
                            ...current,
                            [claim.id]: value,
                          }))
                        }
                        keyboardType="decimal-pad"
                      />
                      <Button
                        title="Verify reward"
                        onPress={() => verify(claim.id)}
                      />
                    </>
                  ) : claim.reward.status === "PENDING_VERIFICATION" ? (
                    <Button
                      title="Issue reward"
                      onPress={() => issue(claim.reward.id)}
                    />
                  ) : (
                    <Text style={{ color: colors.success, fontWeight: "800" }}>
                      Reward issued: ₨ {String(claim.reward.amount)}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={common.muted}>No claims yet.</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
