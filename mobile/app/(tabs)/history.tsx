import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarX2, Printer } from "lucide-react-native";
import { IconButton, TopBar } from "@/components/TopBar";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { DayDetailSheet, DayFlags } from "@/components/DayDetail";
import { Banner, EmptyState, StatusChip, Txt } from "@/components/ui";
import { api, errorMessage } from "@/api";
import { C } from "@/theme";
import { STATUS_LABEL, type DayView } from "@/shared/rules";
import { currentMonth, fmt12, fmtDuration, mytDate } from "@/shared/time";

type History = {
  month: string;
  summary: { present: number; late: number; external: number; leave: number; absent: number; workedMins: number; workdays: number };
  days: DayView[];
};

export default function HistoryScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<DayView | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<History>(`/api/attendance/history?month=${month}`));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const today = mytDate();
  const days = (data?.days ?? []).filter((d) => d.date <= today && d.status !== "untracked").reverse();

  return (
    <View style={{ flex: 1 }}>
      <TopBar
        title="History"
        right={
          <IconButton label="Print this month" onPress={() => router.navigate({ pathname: "/print", params: { month } })}>
            <Printer size={22} color={C.navy900} />
          </IconButton>
        }
      />
      <FlatList
        data={data ? days : []}
        keyExtractor={(d) => d.date}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
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
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <MonthSwitcher month={month} onChange={setMonth} />
            {data ? (
              <View style={st.summary}>
                <Stat label="Present" value={`${data.summary.present}`} sub={`of ${data.summary.workdays}`} />
                <Stat label="Late" value={`${data.summary.late}`} gold={data.summary.late > 0} />
                <Stat label="External" value={`${data.summary.external}`} />
                <Stat label="Hours" value={fmtDuration(data.summary.workedMins)} last />
              </View>
            ) : null}
            {error ? <Banner tone="error">{error}</Banner> : null}
            {!data && !error ? <ActivityIndicator color={C.navy600} style={{ marginTop: 40 }} /> : null}
          </View>
        }
        ListEmptyComponent={
          data ? <EmptyState icon={<CalendarX2 size={24} color={C.navy700} />} title="Nothing recorded this month">Your clock-ins show here day by day.</EmptyState> : undefined
        }
        renderItem={({ item: d, index }) => (
          <Pressable
            onPress={() => setOpen(d)}
            accessibilityRole="button"
            accessibilityLabel={`${d.dayEn} ${Number(d.date.slice(8))}: ${STATUS_LABEL[d.status]}${d.clockIn ? `, in ${fmt12(new Date(d.clockIn))}` : ""}${d.clockOut ? `, out ${fmt12(new Date(d.clockOut))}` : ""}`}
            accessibilityHint="Shows the details of this day"
            style={({ pressed }) => [st.item, index === 0 && st.first, index === days.length - 1 && st.last, pressed && { backgroundColor: C.navy50 }]}
          >
            <View style={[st.date, !(d.workday && !d.holiday) && { backgroundColor: "#f8fafc" }]}>
              <Txt size={17} weight="bold" color={d.workday && !d.holiday ? C.navy900 : C.slate400} tabular style={{ lineHeight: 20 }}>
                {Number(d.date.slice(8))}
              </Txt>
              <Txt size={10.5} weight="semibold" color={d.workday && !d.holiday ? C.navy900 : C.slate400}>
                {d.dayEn.slice(0, 3)}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {d.clockIn || d.clockOut ? (
                <Txt size={15} weight="semibold" color={C.navy900} tabular>
                  {d.clockIn ? fmt12(new Date(d.clockIn)) : "--:--"}
                  <Txt size={15} color={C.slate300}> to </Txt>
                  {d.clockOut ? fmt12(new Date(d.clockOut)) : "--:--"}
                </Txt>
              ) : (
                <Txt size={14} weight="medium" color={C.slate500} numberOfLines={1}>
                  {d.holiday ?? d.leave?.label ?? (d.workday ? "No record" : "Weekend")}
                </Txt>
              )}
              {d.flags.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  <DayFlags day={d} />
                </View>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <StatusChip status={d.status} label={STATUS_LABEL[d.status]} />
              {d.clockOut && d.workedMins != null ? (
                <Txt size={12} weight="semibold" color={C.slate500} tabular>
                  {fmtDuration(d.workedMins)}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      <DayDetailSheet
        day={open}
        onClose={() => setOpen(null)}
        onRequest={(type, date) => {
          setOpen(null);
          router.navigate({ pathname: "/requests", params: { new: type, date } });
        }}
      />
    </View>
  );
}

function Stat({ label, value, sub, gold, last }: { label: string; value: string; sub?: string; gold?: boolean; last?: boolean }) {
  return (
    <View style={[{ flex: 1, alignItems: "center" }, !last && { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.1)" }]}>
      <Txt size={11.5} weight="medium" color={C.navy200}>
        {label}
      </Txt>
      <Txt size={20} weight="bold" color={gold ? C.gold300 : C.white} tabular>
        {value}
        {sub ? (
          <Txt size={12} weight="semibold" color={C.navy200}>
            {" "}
            {sub}
          </Txt>
        ) : null}
      </Txt>
    </View>
  );
}

const st = StyleSheet.create({
  summary: { flexDirection: "row", backgroundColor: C.navy800, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.navy50, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.navy100 },
  first: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1 },
  last: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1, borderBottomColor: C.navy100 },
  date: { width: 46, alignItems: "center", backgroundColor: C.navy50, borderRadius: 12, paddingVertical: 6 },
});
