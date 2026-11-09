import { Image } from "react-native";
import { SvgXml } from "react-native-svg";

/** Shows a saved signature: SVG (drawn in the app) or PNG (drawn on the website). */
export function SignatureImage({ dataUrl, height }: { dataUrl: string; height: number }) {
  if (dataUrl.startsWith("data:image/svg+xml;base64,")) {
    let xml = "";
    try {
      xml = atob(dataUrl.slice("data:image/svg+xml;base64,".length));
    } catch {
      return null;
    }
    return <SvgXml xml={xml} width="80%" height={height} />;
  }
  return <Image source={{ uri: dataUrl }} style={{ width: "80%", height }} resizeMode="contain" accessibilityLabel="Your saved signature" />;
}
