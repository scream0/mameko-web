import type { Metadata } from "next";
import { PrivacyClient } from "./PrivacyClient";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | Mameko",
  description:
    "Kebijakan Privasi dan Perlindungan Data Pribadi Make Me Kool (Mameko). Pelajari bagaimana kami menjaga dan memproses data Anda sesuai regulasi UU PDP.",
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
