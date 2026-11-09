import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { CalendarDays, ClipboardList, Clock3, History, LocateFixed, LogIn, LogOut, MapPin, MapPinOff, Navigation, ShieldCheck, TriangleAlert } from "lucide-react-native";
import { MapView } from "@/map/MapView";
import { BUILT_IN_TILES, type MapState, type MapZone } from "@/map/map-html";
import { useAuth } from "@/auth";
import { ClockButton, type ClockMode, type ClockTone } from "@/components/ClockButton";
import { IconButton, TopBar } from "@/components/TopBar";
import { Banner, Button, Field, Input, Sheet, Txt } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ApiError, api, errorMessage } from "@/api";
import { deviceId } from "@/device";
import { useLocation, type Fix } from "@/location";
import { C } from "@/theme";
import { checkZone, fmtDistance } from "@/shared/geo";
import { scheduledLength, workedMinutes, type DayView, type Schedule } from "@/shared/rules";
import { ENGLISH_DAYS, fmt12, fmtDuration, fmtMins, hm12, hmToMinutes, isoDow, longDate, mytDate, mytMinutes } from "@/shared/time";

type Today = {
  serverTime: string;
  today: string;
  schedule: Schedule | null;
  zones: MapZone[];
  policy: "reason" | "block";
  maxAccuracy: number;
  day: DayView;
  missedClockOut: string | null;
  pendingRequests: number;
};

export default function ClockScreen() {
  const router = useRouter();
  const toast = useToast();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const geo = useLocation(focused);
  const { me } = useAuth();
  // Street tiles come from the server; an older server that sends none falls back to the build setting.
  const tiles = me?.mapTiles !== undefined ? me.mapTiles : BUILT_IN_TILES;
  // 250 px of map fits the whole screen on a 390 x 844 phone; taller phones get a bigger map (up to 320).
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mapHeight = Math.round(Math.min(320, Math.max(250, winH - insets.top - insets.bottom - 594)));
  const [data, setData] = useState<Today | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const offset = useRef(0);
  const [tick, setTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [reason, setReason] = useState<{ action: "in" | "out"; message: string } | null>(null);
  const [recenter, setRecenter] = useState(0);

  const load = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await api<Today>("/api/attendance/today");
      offset.current = new Date(res.serverTime).getTime() - (t0 + Date.now()) / 2;
      setData(res);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const s = AppState.addEventListener("change", (st) => st === "active" && load());
    const clock = setInterval(() => setTick(Date.now()), 1000);
    const every = setInterval(load, 5 * 60_000);
    return () => {
      s.remove();
      clearInterval(clock);
      clearInterval(every);
    };
  }, [load]);

  const serverNow = useMemo(() => new Date(tick + offset.current), [tick]);
  useEffect(() => {
    if (data && mytDate(serverNow) !== data.today) load();
  }, [data, serverNow, load]);

  const zone = useMemo(() => (geo.fix && data ? checkZone(geo.fix.lat, geo.fix.lng, data.zones) : null), [geo.fix, data]);
  const day = data?.day;
  const clockIn = day?.clockIn ? new Date(day.clockIn) : null;
  const clockOut = day?.clockOut ? new Date(day.clockOut) : null;
  const action: "in" | "out" | null = !clockIn ? "in" : !clockOut ? "out" : null;
  const worked = clockIn ? workedMinutes(clockIn, clockOut, serverNow) : null;
  const schedule = data?.schedule ?? null;

  let mode: ClockMode = "loading";
  if (data) {
    if (!action) mode = "done";
    else if (geo.status === "denied" || geo.status === "off" || geo.status === "error") mode = "nolocation";
    else if (!geo.fix) mode = "locating";
    else if (zone?.status === "external" && data.policy === "block") mode = "blocked";
    else mode = "ready";
  }
  const tone: ClockTone =
    mode === "done" ? "internal" : mode === "blocked" ? "blocked" : mode === "ready" ? (zone?.status === "external" ? "external" : "internal") : "neutral";
  const progress = clockIn ? Math.min(1, (worked ?? 0) / scheduledLength(schedule)) : mode === "ready" ? 1 : 0;
  const earlyLeaveMins =
    action === "out" && schedule && day?.workday && !day.holiday && !day.leave ? Math.max(0, hmToMinutes(schedule.end_time) - mytMinutes(serverNow)) : 0;

  async function submit(act: "in" | "out", note?: string) {
    setBusy(true);
    try {
      const fix: Fix = await geo.fresh();
      const res = await api<{ at: string; zone: string }>("/api/attendance/clock", {
        body: { action: act, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, mocked: fix.mocked, note, deviceId: await deviceId() },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(`${act === "in" ? "Clocked in" : "Clocked out"} at ${fmt12(new Date(res.at))}${res.zone === "external" ? " (External)" : ""}`);
      setReason(null);
      setConfirmOut(false);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REASON_REQUIRED") {
        setConfirmOut(false);
        setReason({ action: act, message: e.message });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        toast(errorMessage(e), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  function press() {
    if (busy || !data || !action) return;
    if (mode === "nolocation") return geo.retry();
    if (mode !== "ready") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (geo.fix?.mocked) {
      toast("Your phone is using a fake location app. Turn it off in Developer options, then try again.", "error");
      return;
    }
    if (zone?.status === "external") {
      const where = zone.zone ? `${fmtDistance(zone.outsideBy)} outside ${zone.zone.name}` : "outside the DAICOE zone";
      setReason({ action, message: `You're ${where}. Add a reason to clock ${action} as External.` });
      return;
    }
    if (action === "out") setConfirmOut(true);
    else submit("in");
  }

  const mapState: MapState = useMemo(
    () => ({
      zones: data?.zones ?? [],
      me: geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy } : null,
      padBottom: 116, // the clock button covers the bottom 100 px of the map
    }),
    [data?.zones, geo.fix],
  );

  const sub =
    mode === "nolocation" ? "Tap to fix" : mode === "locating" ? "Finding you…" : mode === "blocked" ? "Outside zone" : mode === "done" ? "Done for today" : zone?.status === "external" ? "External" : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: C.mist }}>
      <TopBar
        title="Attendance"
        brand
        right={
          <>
            <IconButton label="Requests" onPress={() => router.navigate("/requests")} badge={data?.pendingRequests}>
              <ClipboardList size={22} color={C.navy900} />
            </IconButton>
            <IconButton label="History" onPress={() => router.navigate("/history")}>
              <History size={22} color={C.navy900} />
            </IconButton>
          </>
        }
      />
      <ScrollView
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
      >
        {/* Location card */}
        <View style={st.locCard}>
          <LocationBanner status={geo.status} hasFix={!!geo.fix} mocked={!!geo.fix?.mocked} slow={geo.slow} />
          <View style={st.coords}>
            <Coord label="Latitude" value={geo.fix?.lat} />
            <View style={st.vline} />
            <Coord label="Longitude" value={geo.fix?.lng} />
          </View>
          <View style={[st.map, { height: mapHeight }]}>
            <MapView state={mapState} tiles={tiles} recenterKey={recenter} style={StyleSheet.absoluteFill} />
            {geo.fix ? (
              <View style={st.accuracy} pointerEvents="none">
                <Txt size={11.5} weight="semibold" color={C.navy800} tabular>
                  ±{fmtDistance(geo.fix.accuracy)}
                </Txt>
              </View>
            ) : null}
            <Pressable onPress={() => setRecenter((n) => n + 1)} accessibilityRole="button" accessibilityLabel="Centre the map on my location" style={st.recenter}>
              <LocateFixed size={20} color={C.white} />
            </Pressable>
          </View>
        </View>

        {/* Clock button overlapping the map, like the UMS Go layout */}
        <View style={st.clockWrap}>
          <ClockButton mode={mode} action={action} tone={tone} progress={progress} busy={busy} sub={sub} onPress={press} />
        </View>

        {loadError && !data ? (
          <View style={{ marginTop: 12 }}>
            <Banner tone="error">
              <View style={{ gap: 8 }}>
                <Txt size={13.5} weight="medium" color={C.danger700}>
                  {loadError}
                </Txt>
                <Button title="Try again" size="sm" variant="secondary" onPress={load} style={{ alignSelf: "flex-start" }} />
              </View>
            </Banner>
          </View>
        ) : null}

        {geo.slow && geo.status === "locating" ? (
          <View style={{ marginTop: 12 }}>
            <Banner tone="warn">
              <View style={{ gap: 8 }}>
                <Txt size={13.5} weight="medium" color={C.navy900}>
                  Still looking for your location. Check that Location is on, that MyAttendance has Precise location, and that
                  Google Location Accuracy is on in your phone's location settings. Indoors, GPS works better near a window.
                </Txt>
                <Button title="Open app settings" size="sm" variant="secondary" onPress={() => Linking.openSettings()} style={{ alignSelf: "flex-start" }} />
              </View>
            </Banner>
          </View>
        ) : null}

        {(geo.status === "denied" || geo.status === "off") && (
          <View style={{ marginTop: 12 }}>
            <Banner tone="warn">
              {geo.status === "denied"
                ? "Location permission is off. Tap the clock button to allow it (choose While using the app, with Precise on)."
                : "Location (GPS) is turned off. Tap the clock button to turn it on."}
            </Banner>
          </View>
        )}

        {/* Today card */}
        <View style={st.today}>
          <View style={st.todayHead}>
            <View style={st.row}>
              <CalendarDays size={18} color={C.teal300} />
              <Txt size={15} weight="semibold" color={C.white}>
                {data ? longDate(data.today) : "–"}
              </Txt>
            </View>
            <View style={st.row}>
              <Clock3 size={18} color={C.teal300} />
              <Txt size={15} weight="semibold" color={C.white} tabular>
                {data ? fmt12(serverNow, true) : "–"}
              </Txt>
            </View>
          </View>
          <View style={st.tile}>
            <View style={st.cell}>
              <Txt size={12} weight="medium" color={C.navy600}>
                Working hours
              </Txt>
              <Txt size={19} weight="bold" color={C.navy900}>
                {schedule?.code ?? "–"}
              </Txt>
              <Txt size={11.5} color={C.slate500}>
                {schedule ? `${hm12(schedule.start_time)} – ${hm12(schedule.end_time)}` : "No slot set"}
              </Txt>
            </View>
            <View style={st.vline} />
            <View style={st.cell}>
              <Txt size={12} weight="medium" color={C.navy600}>
                Zone status
              </Txt>
              <ZoneStatus geoStatus={geo.status} zone={zone} />
            </View>
          </View>
          <View style={[st.tile, { marginTop: 10 }]}>
            <TimeCell label="Clock in" value={clockIn ? fmt12(clockIn) : null} />
            <View style={st.vline} />
            <TimeCell label="Clock out" value={clockOut ? fmt12(clockOut) : null} />
            <View style={st.vline} />
            <TimeCell label="Working hrs" value={fmtDuration(worked ?? 0)} always />
          </View>
          {day ? <DayNotes day={day} schedule={schedule} /> : null}
        </View>

        {data?.missedClockOut ? (
          <Pressable
            onPress={() => router.navigate({ pathname: "/requests", params: { new: "pembetulan", date: data.missedClockOut! } })}
            style={st.missed}
            accessibilityRole="button"
          >
            <TriangleAlert size={20} color={C.gold600} />
            <Txt size={14} color={C.navy900} style={{ flex: 1 }}>
              <Txt size={14} weight="semibold" color={C.navy900}>
                No clock-out on {ENGLISH_DAYS[isoDow(data.missedClockOut) - 1]}, {longDate(data.missedClockOut)}.{" "}
              </Txt>
              Tap to send a time correction so the record is complete.
            </Txt>
          </Pressable>
        ) : null}
      </ScrollView>

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title="Clock out now?">
        <Txt size={15} color={C.slate600}>
          You&apos;ve worked{" "}
          <Txt size={15} weight="semibold" color={C.navy900} tabular>
            {fmtDuration(worked ?? 0)}
          </Txt>{" "}
          today.
          {earlyLeaveMins > 0 && schedule ? ` Your working hours end at ${hm12(schedule.end_time)}, so this will show as leaving ${fmtMins(earlyLeaveMins)} early.` : ""}
        </Txt>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button title="Not yet" variant="secondary" onPress={() => setConfirmOut(false)} style={{ flex: 1 }} />
          <Button title="Clock out" icon={<LogOut size={16} color={C.white} />} onPress={() => submit("out")} loading={busy} style={{ flex: 1 }} />
        </View>
      </Sheet>

      <ReasonSheet
        open={!!reason}
        message={reason?.message ?? ""}
        action={reason?.action ?? "in"}
        busy={busy}
        onClose={() => setReason(null)}
        onSubmit={(note) => reason && submit(reason.action, note)}
      />
    </View>
  );
}

function LocationBanner({ status, hasFix, mocked, slow }: { status: string; hasFix: boolean; mocked: boolean; slow: boolean }) {
  const active = status === "active" && hasFix && !mocked;
  const bad = status === "denied" || status === "off" || status === "error" || mocked;
  return (
    <View style={[st.banner, bad && { backgroundColor: C.danger600 }]}>
      {active ? <View style={st.dot} /> : bad ? <MapPinOff size={18} color={C.white} /> : null}
      {active ? <MapPin size={18} color={C.white} /> : null}
      <Txt size={15} weight="semibold" color={C.white}>
        {mocked ? "Fake location detected" : active ? "Location active" : bad ? "Location unavailable" : slow ? "Still finding your location…" : "Finding your location…"}
      </Txt>
    </View>
  );
}

function Coord({ label, value }: { label: string; value?: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Txt size={12.5} weight="medium" color={C.navy600}>
        {label}
      </Txt>
      <Txt size={17} weight="bold" color={C.navy900} tabular>
        {value != null ? value.toFixed(6) : "–"}
      </Txt>
    </View>
  );
}

function ZoneStatus({ geoStatus, zone }: { geoStatus: string; zone: ReturnType<typeof checkZone> | null }) {
  if (!zone) {
    return (
      <Txt size={17} weight="bold" color={C.slate400}>
        {geoStatus === "locating" ? "Checking…" : "Unknown"}
      </Txt>
    );
  }
  if (zone.status === "internal") {
    return (
      <>
        <View style={[st.row, { gap: 6 }]}>
          <Txt size={19} weight="bold" color={C.teal700}>
            Internal
          </Txt>
          <ShieldCheck size={19} color={C.teal700} />
        </View>
        <Txt size={11.5} color={C.slate500} numberOfLines={1}>
          {zone.zone?.name}
        </Txt>
      </>
    );
  }
  return (
    <>
      <View style={[st.row, { gap: 6 }]}>
        <Txt size={19} weight="bold" color={C.gold700}>
          External
        </Txt>
        <Navigation size={16} color={C.gold700} />
      </View>
      <Txt size={11.5} color={C.slate500} tabular>
        {fmtDistance(zone.outsideBy)} from zone
      </Txt>
    </>
  );
}

function TimeCell({ label, value, always }: { label: string; value: string | null; always?: boolean }) {
  return (
    <View style={st.cell}>
      <Txt size={12} weight="medium" color={C.navy600}>
        {label}
      </Txt>
      <Txt size={19} weight="bold" color={value || always ? C.navy900 : C.slate300} tabular>
        {value ?? "--:--"}
      </Txt>
    </View>
  );
}

function DayNotes({ day, schedule }: { day: DayView; schedule: Schedule | null }) {
  const notes: Array<{ text: string; tone: "teal" | "gold" | "white" }> = [];
  if (day.holiday) notes.push({ text: `Public holiday: ${day.holiday}`, tone: "white" });
  if (day.leave) notes.push({ text: `Approved: ${day.leave.label}`, tone: "white" });
  if (!day.workday && !day.holiday) notes.push({ text: "Not a working day on your schedule", tone: "white" });
  if (day.clockIn && day.workday && !day.holiday && !day.leave) {
    notes.push(
      day.lateMins > 0
        ? { text: `Late by ${fmtMins(day.lateMins)}${schedule ? ` (starts ${hm12(schedule.start_time)})` : ""}`, tone: "gold" }
        : { text: "On time", tone: "teal" },
    );
  }
  if (day.earlyMins > 0) notes.push({ text: `Left ${fmtMins(day.earlyMins)} early`, tone: "gold" });
  if (day.record?.in_zone === "external") notes.push({ text: `Clocked in External: ${day.record.in_note ?? ""}`, tone: "gold" });
  if (day.record?.out_zone === "external") notes.push({ text: `Clocked out External: ${day.record.out_note ?? ""}`, tone: "gold" });
  if (!notes.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
      {notes.map((n) => (
        <View
          key={n.text}
          style={[
            st.note,
            n.tone === "teal" && { backgroundColor: "rgba(18,168,162,0.2)" },
            n.tone === "gold" && { backgroundColor: "rgba(231,169,40,0.2)" },
          ]}
        >
          <Txt size={12} weight="semibold" color={n.tone === "teal" ? C.teal300 : n.tone === "gold" ? C.gold300 : "rgba(255,255,255,0.9)"}>
            {n.text}
          </Txt>
        </View>
      ))}
    </View>
  );
}

function ReasonSheet({
  open,
  message,
  action,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  message: string;
  action: "in" | "out";
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const quick = ["Kursus / bengkel", "Tugas luar", "Lawatan sekolah", "Mesyuarat luar"];
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={`Clock ${action} as External`}>
      <Txt size={14.5} color={C.slate600}>
        {message}
      </Txt>
      <Field label="Reason" hint="This prints in the Perkara Khas column of your attendance record.">
        <Input value={note} onChangeText={setNote} multiline maxLength={300} placeholder="e.g. Bengkel AI di SMK Likas" />
      </Field>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {quick.map((q) => (
          <Pressable key={q} onPress={() => setNote((n) => (n ? `${n}, ${q}` : q))} style={st.quick} accessibilityRole="button">
            <Txt size={13} weight="medium" color={C.navy700}>
              {q}
            </Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={`Clock ${action}`}
          icon={action === "in" ? <LogIn size={16} color={C.white} /> : <LogOut size={16} color={C.white} />}
          onPress={() => note.trim().length >= 3 && onSubmit(note.trim())}
          disabled={note.trim().length < 3}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  locCard: { backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.navy100, overflow: "hidden" },
  banner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.navy800, paddingVertical: 11 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.teal300, boxShadow: "0 0 0 4px rgba(125,217,211,0.25)" },
  coords: { flexDirection: "row", paddingVertical: 10 },
  vline: { width: 1, alignSelf: "stretch", backgroundColor: C.navy100 },
  map: { borderTopWidth: 1, borderTopColor: C.navy100, backgroundColor: "#eaeff6" },
  accuracy: { position: "absolute", left: 12, bottom: 12, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.navy100 },
  recenter: { position: "absolute", right: 12, top: 12, width: 44, height: 44, borderRadius: 16, backgroundColor: C.navy800, alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px -6px rgba(6,18,46,0.6)" },
  clockWrap: { marginTop: -100, alignItems: "center", zIndex: 10 },
  today: { marginTop: 12, backgroundColor: C.navy800, borderRadius: 24, padding: 16 },
  todayHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 12 },
  tile: { flexDirection: "row", backgroundColor: C.white, borderRadius: 18, paddingVertical: 12 },
  cell: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  note: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.1)" },
  missed: { marginTop: 12, flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: C.gold50, borderRadius: 18, borderWidth: 1, borderColor: C.gold100, padding: 14 },
  quick: { backgroundColor: C.navy50, borderRadius: 999, borderWidth: 1, borderColor: C.navy100, paddingHorizontal: 12, paddingVertical: 7 },
});
