import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FilePenLine, Plus } from "lucide-react-native";
import { TopBar } from "@/components/TopBar";
import { DateField } from "@/components/DateField";
import { Banner, Button, Card, EmptyState, Field, Input, Sheet, Txt } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, errorMessage } from "@/api";
import { C } from "@/theme";
import { REQUEST_TYPES, REQUEST_TYPE_KEYS, type RequestType } from "@/shared/rules";
import { dmy, hm12, mytDate } from "@/shared/time";

type Req = {
  id: number;
  type: RequestType;
  date_from: string;
  date_to: string;
  time_in: string | null;
  time_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_note: string | null;
  reviewer: string | null;
};

const STATUS: Record<Req["status"], { label: string; bg: string; fg: string }> = {
  pending: { label: "Waiting for approval", bg: C.gold100, fg: C.gold700 },
  approved: { label: "Approved", bg: C.teal100, fg: C.teal700 },
  rejected: { label: "Not approved", bg: C.danger100, fg: C.danger700 },
  cancelled: { label: "Withdrawn", bg: "#f1f5f9", fg: C.slate500 },
};

export default function RequestsScreen() {
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ new?: string; date?: string }>();
  const [items, setItems] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ type: RequestType; date: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ requests: Req[] }>("/api/requests")).requests);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Opened from the Clock or History screen with a suggested request.
  useEffect(() => {
    const t = params.new as RequestType | undefined;
    if (t && REQUEST_TYPE_KEYS.includes(t)) {
      setForm({ type: t, date: params.date ?? mytDate() });
      router.setParams({ new: undefined, date: undefined });
    }
  }, [params.new, params.date, router]);

  async function withdraw(id: number) {
    try {
      await api(`/api/requests/${id}`, { method: "DELETE" });
      toast("Request withdrawn");
      load();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBar
        title="Requests"
        right={<Button title="New" size="sm" icon={<Plus size={16} color={C.white} />} onPress={() => setForm({ type: "cuti", date: mytDate() })} />}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={C.navy700}
          />
        }
      >
        <Txt size={13.5} color={C.slate600}>
          Leave, MC, courses, outside duty and time corrections. Approved requests fill the Perkara Khas column on your printed record.
        </Txt>
        {error ? <Banner tone="error">{error}</Banner> : null}
        {!items && !error ? <ActivityIndicator color={C.navy600} style={{ marginTop: 40 }} /> : null}
        {items?.length === 0 ? (
          <EmptyState icon={<FilePenLine size={24} color={C.navy700} />} title="No requests yet">
            Tap New to apply for leave or fix a clock-in time.
          </EmptyState>
        ) : null}
        {items?.map((r) => (
          <Card key={r.id} style={{ padding: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Txt size={15.5} weight="bold" color={C.navy900}>
                  {REQUEST_TYPES[r.type].en}
                </Txt>
                <Txt size={13.5} weight="medium" color={C.navy700} tabular>
                  {r.date_from === r.date_to ? dmy(r.date_from) : `${dmy(r.date_from)} to ${dmy(r.date_to)}`}
                  {r.type === "pembetulan" ? `${r.time_in ? `, in ${hm12(r.time_in)}` : ""}${r.time_out ? `, out ${hm12(r.time_out)}` : ""}` : ""}
                </Txt>
              </View>
              <View style={[st.pill, { backgroundColor: STATUS[r.status].bg }]}>
                <Txt size={12} weight="semibold" color={STATUS[r.status].fg}>
                  {STATUS[r.status].label}
                </Txt>
              </View>
            </View>
            <Txt size={14} color={C.slate600}>
              {r.reason}
            </Txt>
            {r.review_note ? (
              <View style={st.note}>
                <Txt size={13} color={C.navy800}>
                  {r.reviewer ?? "Admin"}: {r.review_note}
                </Txt>
              </View>
            ) : null}
            {r.status === "pending" ? <Button title="Withdraw" variant="ghost" size="sm" onPress={() => withdraw(r.id)} style={{ alignSelf: "flex-end" }} /> : null}
          </Card>
        ))}
      </ScrollView>
      <NewRequestSheet
        initial={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          toast("Request sent to the admin");
          load();
        }}
      />
    </View>
  );
}

function NewRequestSheet({ initial, onClose, onSaved }: { initial: { type: RequestType; date: string } | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<RequestType>("cuti");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setType(initial.type);
    setFrom(initial.date);
    setTo(initial.date);
    setTimeIn("");
    setTimeOut("");
    setReason("");
    setError(null);
  }, [initial]);

  const correction = type === "pembetulan";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/requests", {
        body: {
          type,
          dateFrom: from,
          dateTo: correction ? from : to || from,
          timeIn: correction ? timeIn || null : null,
          timeOut: correction ? timeOut || null : null,
          reason: reason.trim(),
        },
      });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!initial} onClose={onClose} title="New request">
      <View style={{ gap: 8 }}>
        <Txt size={13.5} weight="semibold" color={C.navy900}>
          Type
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {REQUEST_TYPE_KEYS.map((k) => {
            const on = type === k;
            return (
              <Pressable
                key={k}
                onPress={() => setType(k)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[st.type, on && { backgroundColor: C.navy800, borderColor: C.navy800 }]}
              >
                <Txt size={13.5} weight="semibold" color={on ? C.white : C.navy900}>
                  {REQUEST_TYPES[k].en}
                </Txt>
                <Txt size={11.5} color={on ? C.navy200 : C.slate500}>
                  {REQUEST_TYPES[k].hint}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {correction ? (
        <>
          <Field label="Date">
            <DateField value={from} onChange={setFrom} max={mytDate()} accessibilityLabel="Date" />
          </Field>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Correct clock in" hint="Leave empty to keep">
                <DateField mode="time" value={timeIn} onChange={setTimeIn} placeholder="--:--" accessibilityLabel="Correct clock in" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Correct clock out" hint="Leave empty to keep">
                <DateField mode="time" value={timeOut} onChange={setTimeOut} placeholder="--:--" accessibilityLabel="Correct clock out" />
              </Field>
            </View>
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="From">
              <DateField
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  if (!to || to < v) setTo(v);
                }}
                accessibilityLabel="From"
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="To">
              <DateField value={to} onChange={setTo} min={from} accessibilityLabel="To" />
            </Field>
          </View>
        </View>
      )}

      <Field label="Reason" hint={type === "kursus" || type === "tugas_luar" ? "Prints on your record, e.g. Bengkel AI di SMK Likas." : undefined}>
        <Input value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Short and clear" />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button title="Send request" size="lg" onPress={submit} loading={busy} disabled={reason.trim().length < 3 || !from} />
    </Sheet>
  );
}

const st = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  note: { backgroundColor: C.navy50, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  type: { width: "48.5%", borderRadius: 14, borderWidth: 1, borderColor: C.navy200, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
});
