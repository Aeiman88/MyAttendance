import { useState } from "react";
import { useRouter } from "expo-router";
import { AuthScreen } from "@/components/AuthScreen";
import { Banner, Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth } from "@/auth";
import { checkServer, errorMessage, normalizeServer } from "@/api";

export default function ServerScreen() {
  const { server, setServer, status } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(server.replace(/^https:\/\//, ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    const url = normalizeServer(value);
    if (!url) return setError("Enter the server address.");
    setBusy(true);
    setError(null);
    try {
      const { orgName } = await checkServer(url);
      await setServer(url);
      toast(`Connected to ${orgName}`);
      if (status === "signed-out" && router.canGoBack()) router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen title="Server address" intro="Enter the MyAttendance address the admin gave you. You only need to do this once.">
      <Field label="Address" hint="For example myattendance.vercel.app">
        <Input
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="myattendance.example.com"
          returnKeyType="go"
          onSubmitEditing={connect}
        />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button title="Connect" size="lg" onPress={connect} loading={busy} />
      {status === "signed-out" && router.canGoBack() ? <Button title="Cancel" variant="ghost" onPress={() => router.back()} /> : null}
    </AuthScreen>
  );
}
