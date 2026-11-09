import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { ChevronRight, KeyRound, LogOut, PenLine, Server } from "lucide-react-native";
import { TopBar } from "@/components/TopBar";
import { SignaturePad, type Strokes } from "@/components/SignaturePad";
import { SignatureImage } from "@/components/SignatureImage";
import { Avatar, Button, Card, Sheet, Txt } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth } from "@/auth";
import { api, errorMessage } from "@/api";
import { C } from "@/theme";
import { hm12 } from "@/shared/time";

export default function ProfileScreen() {
  const { me, refresh, signOut, server } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const u = me?.user;

  async function saveSignature(body: { strokes: Strokes } | { signature: null }) {
    setBusy(true);
    try {
      await api("/api/me/signature", { method: "PUT", body });
      toast("signature" in body ? "Signature removed" : "Signature saved");
      setSigning(false);
      await refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  function confirmLogout() {
    if (Platform.OS === "web") return signOut();
    Alert.alert("Log out?", "You'll need your staff number and password to log in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Profile" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}>
        <View style={st.hero}>
          <Avatar name={u?.name ?? "?"} size={56} dark />
          <View style={{ flex: 1 }}>
            <Txt size={17} weight="bold" color={C.white} numberOfLines={1}>
              {u?.name ?? "–"}
            </Txt>
            <Txt size={13.5} color={C.navy200}>
              {u?.staffNo}
              {u?.position ? `, ${u.position}` : ""}
            </Txt>
            <Txt size={12.5} color={C.navy200} style={{ marginTop: 2 }}>
              {me?.orgName}
            </Txt>
          </View>
          {u?.role === "admin" ? (
            <View style={st.admin}>
              <Txt size={11.5} weight="bold" color={C.navy950}>
                Admin
              </Txt>
            </View>
          ) : null}
        </View>

        <Card style={{ padding: 16, gap: 2 }}>
          <Txt size={13} weight="semibold" color={C.navy600}>
            Working hours
          </Txt>
          <Txt size={16} weight="bold" color={C.navy900}>
            {me?.schedule ? `${me.schedule.code}, ${hm12(me.schedule.start_time)} – ${hm12(me.schedule.end_time)}` : "Not set"}
          </Txt>
          <Txt size={12.5} color={C.slate500}>
            Set by the admin. Clocking in after the start time counts as late.
          </Txt>
        </Card>

        <Card style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="bold" color={C.navy900}>
                My signature
              </Txt>
              <Txt size={12.5} color={C.slate500}>
                Printed in the T. Tangan column when you choose to.
              </Txt>
            </View>
            <Button title={u?.signature ? "Redo" : "Draw"} size="sm" variant="secondary" icon={<PenLine size={15} color={C.navy800} />} onPress={() => setSigning(true)} />
          </View>
          <View style={st.sigBox}>
            {u?.signature ? (
              <SignatureImage dataUrl={u.signature} height={72} />
            ) : (
              <Txt size={13} color={C.slate400}>
                No signature saved
              </Txt>
            )}
          </View>
          {u?.signature ? (
            <Pressable onPress={() => saveSignature({ signature: null })} accessibilityRole="button">
              <Txt size={13} weight="semibold" color={C.danger600}>
                Remove signature
              </Txt>
            </Pressable>
          ) : null}
        </Card>

        <Card>
          <Row icon={<KeyRound size={20} color={C.navy600} />} label="Change password" onPress={() => router.push("/change-password")} />
          <Row
            icon={<Server size={20} color={C.navy600} />}
            label="Server"
            detail={server.replace(/^https?:\/\//, "")}
            last
            onPress={() =>
              Platform.OS === "web"
                ? router.push("/server")
                : Alert.alert("Change server?", "You'll be logged out and asked for the new address.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Change", onPress: () => signOut().then(() => router.push("/server")) },
                  ])
            }
          />
        </Card>

        <Button title="Log out" variant="secondary" icon={<LogOut size={16} color={C.navy800} />} onPress={confirmLogout} />
        <Txt size={12} color={C.slate400} align="center">
          MyAttendance {Application.nativeApplicationVersion ?? "1.0.0"}
        </Txt>
      </ScrollView>

      <Sheet open={signing} onClose={() => setSigning(false)} title="Draw your signature">
        <SignaturePad onSave={(strokes) => saveSignature({ strokes })} busy={busy} />
      </Sheet>
    </View>
  );
}

function Row({ icon, label, detail, onPress, last }: { icon: React.ReactNode; label: string; detail?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [st.row, !last && st.rowLine, pressed && { backgroundColor: C.navy50 }]}>
      {icon}
      <Txt size={15} weight="semibold" color={C.navy900} style={{ flex: 1 }}>
        {label}
      </Txt>
      {detail ? (
        <Txt size={13} color={C.slate500} numberOfLines={1} style={{ maxWidth: 170 }}>
          {detail}
        </Txt>
      ) : null}
      <ChevronRight size={16} color={C.slate400} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.navy800, borderRadius: 22, padding: 16 },
  admin: { alignSelf: "flex-start", backgroundColor: C.gold500, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  sigBox: { height: 96, borderRadius: 14, backgroundColor: "rgba(240,244,251,0.6)", borderWidth: 1, borderColor: C.navy100, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.navy50 },
});
