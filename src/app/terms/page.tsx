import type { Metadata } from "next";
import { TermsClient } from "./TermsClient";
import termsConfig from "@/data/ui/termsConfig.json";

export const metadata: Metadata = {
  title: termsConfig.metadata.title,
  description: termsConfig.metadata.description,
};

export default function TermsPage() {
  return <TermsClient />;
}
