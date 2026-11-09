import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { FileText, Printer, Share2 } from "lucide-react-native";
import { TopBar } from "@/components/TopBar";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { DateField } from "@/components/DateField";
import { FormPreview } from "@/components/FormPreview";
import { Banner, Button, Card, Field, Segmented, Txt } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth } from "@/auth";
import { api, errorMessage } from "@/api";
import { C } from "@/theme";
import { currentMonth, isMonthStr, monthRange, mytDate, shiftMonth } from "@/shared/time";

type Period = "this" | "last" | "month" | "range";
type PrintDoc = { html: string; pages: number; period: string; filename: string };

export default function PrintScreen() {
  const { me } = useAuth();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ month?: string }>();
  const [period, setPeriod] = useState<Period>("this");
  const [month, setMonth] = useState(shiftMonth(currentMonth(), -1));
  const [from, setFrom] = useState(monthRange(currentMonth()).from);
  const [to, setTo] = useState(mytDate());
  const [sig, setSig] = useState(!!me?.user.signature);
  // Turn the option on when a signature is added (or off when removed) after this screen first opened.
  useEffect(() => setSig(!!me?.user.signature), [me?.user.signature]);
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"print" | "share" | null>(null);

  useEffect(() => {
    const m = params.month;
    if (!m || !isMonthStr(m)) return;
    if (m === currentMonth()) setPeriod("this");
    else if (m === shiftMonth(currentMonth(), -1)) setPeriod("last");
    else {
      setPeriod("month");
      setMonth(m);
    }
  }, [params.month]);

  const query = (() => {
    const q = new URLSearchParams();
    if (period === "this") q.set("month", currentMonth());
    if (period === "last") q.set("month", shiftMonth(currentMonth(), -1));
    if (period === "month") q.set("month", month);
    if (period === "range") {
      q.set("from", from);
      q.set("to", to);
    }
    if (sig) q.set("sig", "1");
    return q.toString();
  })();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDoc(await api<PrintDoc>(`/api/print?${query}`));
    } catch (e) {
      setDoc(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function printNow() {
    if (!doc) return;
    setBusy("print");
    try {
      await Print.printAsync({ html: doc.html, orientation: Print.Orientation.landscape });
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    if (!doc) return;
    setBusy("share");
    try {
      const { uri } = await Print.printToFileAsync({ html: doc.html, width: 842, height: 595 });
      let shareUri = uri;
      try {
        const named = new File(Paths.cache, doc.filename);
        if (named.exists) named.delete();
        new File(uri).moveSync(named);
        shareUri = named.uri;
      } catch {
        /* keep the generated name */
      }
      await Sharing.shareAsync(shareUri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share attendance record" });
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Print record" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 14 }}>
        <Txt size={13.5} color={C.slate600}>
          The LPS form &quot;Rekod Kedatangan Pekerja&quot;, filled from your records. A4 landscape, two weeks per page.
        </Txt>
        <View style={{ gap: 8 }}>
          <Txt size={13.5} weight="semibold" color={C.navy900}>
            Period
          </Txt>
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: "this", label: "This month" },
              { value: "last", label: "Last month" },
              { value: "month", label: "Month" },
              { value: "range", label: "Dates" },
            ]}
          />
        </View>
        {period === "month" ? <MonthSwitcher month={month} onChange={setMonth} /> : null}
        {period === "range" ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="From">
                <DateField value={from} onChange={setFrom} accessibilityLabel="From" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="To">
                <DateField value={to} onChange={setTo} min={from} accessibilityLabel="To" />
              </Field>
            </View>
          </View>
        ) : null}
        <Card style={st.toggle}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={14.5} weight="semibold" color={C.navy900}>
              Print my signature in T. Tangan
            </Txt>
            <Txt size={12.5} color={C.slate500}>
              {me?.user.signature ? "On days you attended. Leave off to sign by hand." : "Add your signature in Profile first."}
            </Txt>
          </View>
          <Switch
            value={sig}
            onValueChange={setSig}
            disabled={!me?.user.signature}
            trackColor={{ true: C.teal500, false: C.navy200 }}
            thumbColor={C.white}
            accessibilityLabel="Print my signature"
          />
        </Card>

        {error ? <Banner tone="error">{error}</Banner> : null}
        {loading && !doc ? <ActivityIndicator color={C.navy600} style={{ marginVertical: 30 }} /> : null}
        {doc ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <FileText size={15} color={C.navy600} />
              <Txt size={13} weight="medium" color={C.navy700} style={{ flex: 1 }}>
                {doc.period}, {doc.pages} page{doc.pages === 1 ? "" : "s"}
              </Txt>
              {loading ? <ActivityIndicator size="small" color={C.navy600} /> : null}
            </View>
            <FormPreview html={doc.html} height={Math.round((width - 32) * 0.72)} />
          </View>
        ) : null}

        <Button
          title="Print or save as PDF"
          size="lg"
          icon={<Printer size={18} color={C.white} />}
          onPress={printNow}
          loading={busy === "print"}
          disabled={!doc || !!busy}
        />
        {Platform.OS !== "web" ? (
          <Button
            title="Share PDF (WhatsApp, email, Drive)"
            variant="secondary"
            icon={<Share2 size={17} color={C.navy800} />}
            onPress={sharePdf}
            loading={busy === "share"}
            disabled={!doc || !!busy}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
