import type { Metadata } from "next";
import { PrivacyClient } from "./PrivacyClient";
import privacyConfig from "@/data/ui/privacyConfig.json";

export const metadata: Metadata = {
  title: privacyConfig.metadata.title,
  description: privacyConfig.metadata.description,
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
