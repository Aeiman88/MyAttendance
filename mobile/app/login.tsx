import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Server } from "lucide-react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { PasswordInput } from "@/components/PasswordInput";
import { Banner, Button, Field, Input, Txt } from "@/components/ui";
import { useAuth } from "@/auth";
import { errorMessage } from "@/api";
import { C } from "@/theme";

export default function LoginScreen() {
  const { signIn, server } = useAuth();
  const router = useRouter();
  const [staffNo, setStaffNo] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!staffNo.trim() || !password) return setError("Enter your staff number and password.");
    setBusy(true);
    setError(null);
    try {
      await signIn(staffNo.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title="Log in"
      intro="Use the staff number and password the DAICOE admin gave you."
      footer={
        <Pressable onPress={() => router.push("/server")} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Server size={14} color={C.slate500} />
          <Txt size={13} color={C.slate500} numberOfLines={1}>
            {server ? server.replace(/^https?:\/\//, "") : "No server set"}
          </Txt>
          <Txt size={13} weight="semibold" color={C.iris600}>
            Change
          </Txt>
        </Pressable>
      }
    >
      <Field label="Staff number">
        <Input
          value={staffNo}
          onChangeText={setStaffNo}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="username"
          placeholder="e.g. DAICOE-01"
          returnKeyType="next"
        />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChangeText={setPassword} autoComplete="current-password" returnKeyType="go" onSubmitEditing={submit} />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button title="Log in" size="lg" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
      <View>
        <Txt size={13} color={C.slate500} align="center">
          Forgot your password? Ask the DAICOE admin to reset it.
        </Txt>
      </View>
    </AuthScreen>
  );
}
