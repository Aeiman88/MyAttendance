import { Linking, Pressable, StyleSheet, View } from "react-native";
import { ExternalLink, LogIn, LogOut } from "lucide-react-native";
import { Button, FlagChip, Sheet, StatusChip, Txt } from "./ui";
import { C } from "../theme";
import { STATUS_LABEL, type DayView, type RecordRow } from "../shared/rules";
import { fmt12, fmtDuration, fmtMins, longDate } from "../shared/time";
import { fmtDistance, mapsLink } from "../shared/geo";

export function DayFlags({ day }: { day: DayView }) {
  return (
    <>
      {day.flags.map((f) => (
        <FlagChip key={f} flag={f} detail={f === "late" ? fmtMins(day.lateMins) : f === "early" ? fmtMins(day.earlyMins) : undefined} />
      ))}
    </>
  );
}

function Punch({ kind, at, r }: { kind: "in" | "out"; at: string | null; r: Omit<RecordRow, "in_device" | "out_device"> }) {
  const p = kind === "in"
    ? { zone: r.in_zone, name: r.in_zone_name, dist: r.in_distance_m, note: r.in_note, lat: r.in_lat, lng: r.in_lng, acc: r.in_accuracy }
    : { zone: r.out_zone, name: r.out_zone_name, dist: r.out_distance_m, note: r.out_note, lat: r.out_lat, lng: r.out_lng, acc: r.out_accuracy };
  const Icon = kind === "in" ? LogIn : LogOut;
  return (
    <View style={st.punch}>
      <View style={st.punchIcon}>
        <Icon size={18} color={C.navy700} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Txt size={13} weight="medium" color={C.navy600}>
            {kind === "in" ? "Clock in" : "Clock out"}
          </Txt>
          <Txt size={17} weight="bold" color={C.navy900} tabular>
            {at ? fmt12(new Date(at)) : "--:--"}
          </Txt>
        </View>
        {at && p.zone ? (
          <Txt size={13} color={C.slate600}>
            <Txt size={13} weight="semibold" color={p.zone === "internal" ? C.teal700 : C.gold700}>
              {p.zone === "internal" ? "Internal" : "External"}
            </Txt>
            {p.name ? `, ${fmtDistance(p.dist)} from ${p.name} centre` : ""}
            {p.acc != null ? `, GPS ±${fmtDistance(p.acc)}` : ""}
          </Txt>
        ) : null}
        {at && !p.zone ? (
          <Txt size={13} color={C.slate500}>
            Time entered by request or by the admin, so there is no GPS position.
          </Txt>
        ) : null}
        {p.note ? (
          <Txt size={13} color={C.navy800}>
            Reason: {p.note}
          </Txt>
        ) : null}
        {p.lat != null && p.lng != null ? (
          <Pressable onPress={() => Linking.openURL(mapsLink(p.lat!, p.lng!))} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessibilityRole="link">
            <Txt size={13} weight="semibold" color={C.iris600} tabular>
              {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
            </Txt>
            <ExternalLink size={13} color={C.iris600} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function DayDetailSheet({ day, onClose, onRequest }: { day: DayView | null; onClose: () => void; onRequest?: (type: "pembetulan" | "cuti", date: string) => void }) {
  const r = day?.record;
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? `${day.dayEn}, ${longDate(day.date)}` : ""}>
      {day && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <StatusChip status={day.status} label={STATUS_LABEL[day.status]} />
            <DayFlags day={day} />
            {day.workedMins != null && day.clockOut ? (
              <Txt size={13} weight="semibold" color={C.navy700} tabular style={{ marginLeft: "auto" }}>
                {fmtDuration(day.workedMins)} worked
              </Txt>
            ) : null}
          </View>
          {day.holiday ? <Txt size={14} color={C.navy800}>Public holiday: {day.holiday}</Txt> : null}
          {day.leave ? (
            <Txt size={14} color={C.navy800}>
              Approved {day.leave.label}
              {day.leave.reason ? `: ${day.leave.reason}` : ""}
            </Txt>
          ) : null}
          {r ? (
            <>
              <Punch kind="in" at={day.clockIn} r={r} />
              <Punch kind="out" at={day.clockOut} r={r} />
            </>
          ) : null}
          {day.remarkMs ? (
            <View style={st.remark}>
              <Txt size={12} weight="semibold" color={C.navy600}>
                Prints in Perkara Khas
              </Txt>
              <Txt size={14} color={C.navy900}>
                {day.remarkMs}
              </Txt>
            </View>
          ) : null}
          {onRequest && (day.status === "incomplete" || day.status === "absent" || day.flags.includes("late")) ? (
            <Button
              title={day.status === "absent" ? "Send a leave request" : "Send a time correction"}
              onPress={() => onRequest(day.status === "absent" ? "cuti" : "pembetulan", day.date)}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  punch: { flexDirection: "row", gap: 12, backgroundColor: C.navy50, borderRadius: 18, padding: 14 },
  punchIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.navy100, alignItems: "center", justifyContent: "center" },
  remark: { borderWidth: 1, borderStyle: "dashed", borderColor: C.navy200, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, gap: 2 },
});
