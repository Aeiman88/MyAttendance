import { useState } from "react";
import { Pressable, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Input } from "./ui";
import { C } from "../theme";

export function PasswordInput(props: TextInputProps) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <Input {...props} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} style={{ paddingRight: 48 }} />
      <Pressable
        onPress={() => setShow((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" }}
      >
        {show ? <EyeOff size={19} color={C.slate400} /> : <Eye size={19} color={C.slate400} />}
      </Pressable>
    </View>
  );
}
