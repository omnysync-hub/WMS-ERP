import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { fetchJob, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";

import { formatMoney, parseJobLine } from "@/lib/jobLineFormat";

export default function DiscountModal() {
  const { jobId, itemId: preselectedItemId } = useLocalSearchParams<{
    jobId: string;
    itemId?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.employee?.name) ?? "Technician";

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => fetchJob(jobId!),
  });
  const rawItems = jobQuery.data?.items ?? [];
  const inventoryItems = rawItems.filter((it) => {
    const line = parseJobLine(it);
    return (
      !line.isService &&
      !line.isEquipment &&
      Number(line.unitRate ?? 0) > 0
    );
  });
  // Only inventory parts can have discounts requested
  const items =
    inventoryItems.length > 0
      ? inventoryItems
      : rawItems.filter(
          (it) =>
            !parseJobLine(it).isEquipment &&
            (it.unitRate ?? it.unitPrice ?? 0) > 0
        );

  const [itemId, setItemId] = useState(preselectedItemId || "");
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!itemId || !items.some((it) => it.id === itemId)) {
      if (preselectedItemId && items.some((it) => it.id === preselectedItemId)) {
        setItemId(preselectedItemId);
      } else if (items[0]?.id) {
        setItemId(items[0].id);
      }
    }
  }, [itemId, items, preselectedItemId]);

  const selectedItem = items.find((it) => it.id === itemId) ?? items[0];
  const selectedLine = selectedItem ? parseJobLine(selectedItem) : null;
  const maxAllowedDiscount = selectedLine
    ? Math.max(
        0,
        Number(selectedLine.unitRate ?? 0) *
          Math.max(1, Number(selectedLine.qtyPlanned ?? 1), Number(selectedLine.qtyActual ?? 0))
      )
    : 0;

  const numericDiscount = Number(discount);
  const isDiscountOverLimit =
    Number.isFinite(numericDiscount) && numericDiscount > maxAllowedDiscount;

  const mutation = useMutation({
    mutationFn: () =>
      transitionJob(jobId!, {
        action: "request_item_discount",
        itemId,
        discountRequested: Number(discount) || 0,
        reason,
        actor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      toast("Discount request sent", "success");
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't send", e.message);
    },
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Ask for discount</Text>
      <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 20 }}>
        Pick the inventory item and requested discount. Cannot exceed item price.
      </Text>

      {jobQuery.isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : jobQuery.isError ? (
        <View>
          <InlineBanner
            title="Couldn't load job items"
            detail="Refresh the job and try again."
            tone="error"
          />
          <Button title="Try again" variant="secondary" onPress={() => void jobQuery.refetch()} />
        </View>
      ) : items.length > 0 ? (
        <View style={{ gap: 8, marginBottom: 14 }}>
          {items.map((it) => {
            const active = itemId === it.id;
            const line = parseJobLine(it);
            const linePrice =
              Number(line.unitRate ?? 0) *
              Math.max(1, Number(it.quantityPlanned ?? 1), Number(it.quantityActual ?? 0));
            return (
              <Pressable
                key={it.id}
                onPress={() => {
                  void haptic.select();
                  setItemId(it.id);
                }}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: active ? colors.primaryMuted : colors.surface,
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "700", flex: 1, fontSize: 15 }}>
                    {line.title}
                  </Text>
                  {line.unitRate != null ? (
                    <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>
                      {formatMoney(line.unitRate)} / unit
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: colors.textDim, fontSize: 12 }}>
                    Issued: {it.quantityPlanned ?? 1}
                  </Text>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    Max discount: {formatMoney(linePrice)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <InlineBanner
          title="No inventory items for discount"
          detail="This job does not have any priced inventory or parts assigned."
          tone="info"
        />
      )}

      <Text style={{ color: colors.textDim, marginBottom: 6 }}>
        Discount (PKR)
        {maxAllowedDiscount > 0 ? (
          <Text style={{ color: colors.primary, fontWeight: "700" }}>
            {" "}· Max allowed: {formatMoney(maxAllowedDiscount)}
          </Text>
        ) : null}
      </Text>
      <TextInput
        value={discount}
        onChangeText={setDiscount}
        keyboardType="decimal-pad"
        placeholder={maxAllowedDiscount > 0 ? String(Math.min(500, maxAllowedDiscount)) : "0"}
        placeholderTextColor={colors.textDim}
        style={[
          field,
          isDiscountOverLimit && { borderColor: colors.danger, borderWidth: 1.5 },
        ]}
      />

      {isDiscountOverLimit ? (
        <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "700", marginTop: 4 }}>
          ⚠️ Discount cannot exceed {formatMoney(maxAllowedDiscount)} (the full price of this inventory item).
        </Text>
      ) : null}

      <Text style={{ color: colors.textDim, marginTop: 12, marginBottom: 6 }}>Why?</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        placeholder="Customer asked for a small concession on parts"
        placeholderTextColor={colors.textDim}
        style={[field, { minHeight: 90, textAlignVertical: "top" }]}
      />

      <Button
        title="Send request"
        loading={mutation.isPending}
        style={{ marginTop: 18 }}
        onPress={() => {
          const amount = Number(discount);
          if (!itemId || !Number.isFinite(amount) || amount <= 0) {
            Alert.alert("Pick an item and amount", "Please enter a valid discount amount.");
            return;
          }
          if (amount > maxAllowedDiscount) {
            void haptic.error();
            Alert.alert(
              "Discount limit exceeded",
              `You cannot request a discount of ${formatMoney(amount)}. The maximum discount for this inventory item is ${formatMoney(maxAllowedDiscount)}.`
            );
            return;
          }
          if (!reason.trim()) {
            Alert.alert("Reason required", "Briefly explain why the discount is needed.");
            return;
          }
          mutation.mutate();
        }}
        disabled={
          jobQuery.isLoading ||
          jobQuery.isError ||
          items.length === 0 ||
          isDiscountOverLimit ||
          !discount.trim()
        }
      />
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
  minHeight: 48,
} as const;
