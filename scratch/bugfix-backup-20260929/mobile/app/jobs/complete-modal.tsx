import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { returnJobStock, transitionJob } from "@/services/jobsService";
import { useAuthStore } from "@/store/authStore";
import { colors, radius, space, tapMin, type } from "@/constants/theme";
import { toast } from "@/store/toastStore";
import { haptic } from "@/lib/haptics";
import { parseJobLine } from "@/lib/jobLineFormat";
import type { JobItem } from "@/types";

const PAYMENTS = [
  { id: "cash", label: "Cash" },
  { id: "online", label: "Online" },
  { id: "cheque", label: "Cheque" },
  { id: "unmarked", label: "No payment" },
] as const;

const MAX_PHOTOS = 8;

async function uriToDataUrl(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const lower = uri.toLowerCase();
  const mime = lower.includes(".png")
    ? "image/png"
    : lower.includes(".webp")
      ? "image/webp"
      : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

export default function CompleteModal() {
  const { jobId, itemsJson } = useLocalSearchParams<{
    jobId: string;
    itemsJson?: string;
  }>();
  const router = useRouter();
  const qc = useQueryClient();
  const employee = useAuthStore((s) => s.employee);
  const actor = employee?.name ?? "Technician";

  const initialItems = useMemo(() => {
    try {
      return JSON.parse(itemsJson || "[]") as JobItem[];
    } catch {
      return [] as JobItem[];
    }
  }, [itemsJson]);

  const [items, setItems] = useState<JobItem[]>(initialItems);
  const [remarks, setRemarks] = useState("");
  const [paymentMeans, setPaymentMeans] =
    useState<(typeof PAYMENTS)[number]["id"]>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [unusedReason, setUnusedReason] = useState("");
  /** Local preview URIs */
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      let hasUnused = false;
      for (const it of items) {
        const line = parseJobLine(it);
        if (line.isService) continue;
        const planned = Number(it.quantityPlanned ?? 0);
        const actual = Number(it.quantityActual ?? planned);
        const unused = Math.max(0, planned - actual);
        if (unused > 0) {
          hasUnused = true;
          if (!employee?.id) throw new Error("Not signed in");
          if (!unusedReason.trim()) {
            throw new Error("Say why leftover parts weren’t used");
          }
          await returnJobStock(jobId!, {
            technicianId: employee.id,
            item: `${line.title} (Unused: ${unused} — ${unusedReason.trim()})`,
            qtyReturned: unused,
          });
        }
      }

      const photos: string[] = [];
      for (const uri of photoUris) {
        photos.push(await uriToDataUrl(uri));
      }

      return transitionJob(jobId!, {
        action: "complete",
        actualItems: items.map((it) => {
          const line = parseJobLine(it);
          return {
            id: it.id,
            quantityActual: line.isService
              ? 1
              : Number(it.quantityActual ?? it.quantityPlanned ?? 0),
          };
        }),
        completionDetails: {
          workingRemarks: remarks,
          paymentMeans,
          paymentAmount:
            paymentMeans === "unmarked" ? 0 : Number(paymentAmount) || 0,
          paymentNotes: "",
          unusedReason: hasUnused ? unusedReason.trim() : undefined,
          photos,
          technicianEmployeeId: employee?.id,
        },
        actor: actor,
        technicianId: employee?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast(
        photoUris.length
          ? `Job finished · ${photoUris.length} photo${photoUris.length === 1 ? "" : "s"} saved`
          : "Job finished · payment logged",
        "success"
      );
      router.back();
    },
    onError: (e: Error) => {
      toast(e.message, "error");
      Alert.alert("Couldn't finish", e.message);
    },
  });

  async function addFromCamera() {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit", `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera blocked", "Allow camera access to take job photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.55,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    void haptic.press();
    setPhotoUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  }

  async function addFromLibrary() {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert("Photo limit", `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos blocked", "Allow photo access to attach job pictures.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.55,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photoUris.length,
    });
    if (result.canceled || !result.assets?.length) return;
    void haptic.press();
    setPhotoUris((prev) =>
      [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS)
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Finish job"
        subtitle="Add proof photos, payment, then submit."
      />

      <Text style={{ color: colors.textDim, marginBottom: space.sm, ...type.label }}>
        Proof of work photos
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: space.md, ...type.subtitle }}>
        Take pictures of the finished work. These save on the job in the office ERP.
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md }}>
        {photoUris.map((uri) => (
          <View key={uri} style={{ width: 88, height: 88 }}>
            <Image
              source={{ uri }}
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
              }}
            />
            <Pressable
              onPress={() => {
                void haptic.select();
                setPhotoUris((prev) => prev.filter((u) => u !== uri));
              }}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "rgba(0,0,0,0.7)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.xl }}>
        <Button
          title="Take photo"
          variant="secondary"
          size="md"
          icon={<Camera size={18} color={colors.text} />}
          onPress={() => void addFromCamera()}
          style={{ flex: 1 }}
        />
        <Button
          title="From gallery"
          variant="secondary"
          size="md"
          icon={<ImagePlus size={18} color={colors.text} />}
          onPress={() => void addFromLibrary()}
          style={{ flex: 1 }}
        />
      </View>

      <Text style={{ color: colors.textDim, marginBottom: 8, fontWeight: "700" }}>
        Payment from customer
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PAYMENTS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPaymentMeans(p.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: paymentMeans === p.id ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: paymentMeans === p.id ? colors.primary : colors.border,
              minWidth: "46%",
              alignItems: "center",
              minHeight: tapMin,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {paymentMeans !== "unmarked" && (
        <>
          <Text style={{ color: colors.textDim, marginTop: 14, marginBottom: 6 }}>
            Amount received (PKR)
          </Text>
          <TextInput
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textDim}
            style={[field, { fontSize: 22, fontWeight: "700" }]}
          />
        </>
      )}

      <Text style={{ color: colors.textDim, marginTop: 18, marginBottom: 6 }}>
        What did you do?
      </Text>
      <TextInput
        value={remarks}
        onChangeText={setRemarks}
        multiline
        style={[field, { minHeight: 88, textAlignVertical: "top" }]}
        placeholderTextColor={colors.textDim}
        placeholder="Short note for the office"
      />

      {items.filter((it) => !parseJobLine(it).isService).length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: colors.textDim, marginBottom: 8, fontWeight: "700" }}>
            Stock used (issued materials only)
          </Text>
          {items
            .filter((it) => !parseJobLine(it).isService)
            .map((it) => {
              const line = parseJobLine(it);
              return (
                <View
                  key={it.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{line.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                    Issued / planned {it.quantityPlanned ?? 0}
                  </Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={String(it.quantityActual ?? it.quantityPlanned ?? 0)}
                    onChangeText={(t) =>
                      setItems((prev) =>
                        prev.map((row) =>
                          row.id === it.id
                            ? {
                                ...row,
                                quantityActual: Number(t.replace(/[^0-9.]/g, "")) || 0,
                              }
                            : row
                        )
                      )
                    }
                    style={[field, { marginTop: 8, minHeight: 44 }]}
                  />
                </View>
              );
            })}
          <Text style={{ color: colors.textDim, marginTop: 6, marginBottom: 6 }}>
            Leftover parts reason (if any)
          </Text>
          <TextInput
            value={unusedReason}
            onChangeText={setUnusedReason}
            placeholder="Returned to store / not needed"
            placeholderTextColor={colors.textDim}
            style={field}
          />
        </View>
      )}

      <Button
        title={
          photoUris.length
            ? `Submit & close · ${photoUris.length} photo${photoUris.length === 1 ? "" : "s"}`
            : "Submit & close job"
        }
        loading={mutation.isPending}
        style={{ marginTop: 22 }}
        onPress={() => {
          if (!remarks.trim()) {
            Alert.alert("Add a short work note");
            return;
          }
          if (paymentMeans !== "unmarked" && !paymentAmount) {
            Alert.alert("Enter amount received", "Or choose “No payment”.");
            return;
          }
          if (photoUris.length === 0) {
            Alert.alert(
              "No photos",
              "Add at least one proof photo of the finished work?",
              [
                { text: "Add photos", style: "cancel" },
                { text: "Finish without", onPress: () => mutation.mutate() },
              ]
            );
            return;
          }
          mutation.mutate();
        }}
      />
    </ScrollView>
  );
}

const field = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  color: colors.text,
  padding: 12,
  minHeight: 48,
} as const;
