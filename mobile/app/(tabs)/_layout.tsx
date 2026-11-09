import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

export const unstable_settings = { initialRouteName: "index" };

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#f2f5fa" } }}
    >
      <Tabs.Screen name="history" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="print" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
