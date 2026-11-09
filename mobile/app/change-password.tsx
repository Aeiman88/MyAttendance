import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { AuthScreen } from "@/components/AuthScreen";
import { PasswordInput } from "@/components/PasswordInput";
import { Banner, Button, Field } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth } from "@/auth";
import { errorMessage } from "@/api";

export default function ChangePasswordScreen() {
  const { status, changePassword, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const forced = status === "must-change-password";
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Leave once the new password is in and the app knows it: back to Profile, or on to the Clock screen after a first login.
  useEffect(() => {
    if (!saved || status !== "signed-in") return;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [saved, status, router]);

  async function save() {
    if (f.next.length < 8) return setError("The new password needs at least 8 characters.");
    if (f.next !== f.confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await changePassword(f.current, f.next);
      toast("Password saved");
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title={forced ? "Choose your own password" : "Change password"}
      intro={forced ? "You're signed in with a temporary password. Choose your own to continue." : "Your other devices will be signed out."}
    >
      <Field label={forced ? "Temporary password" : "Current password"}>
        <PasswordInput value={f.current} onChangeText={(v) => setF({ ...f, current: v })} autoComplete="current-password" />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput value={f.next} onChangeText={(v) => setF({ ...f, next: v })} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput value={f.confirm} onChangeText={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" onSubmitEditing={save} />
      </Field>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button title="Save new password" size="lg" onPress={save} loading={busy} />
      {forced ? (
        <Button title="Log out" variant="ghost" onPress={signOut} />
      ) : (
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      )}
    </AuthScreen>
  );
}
