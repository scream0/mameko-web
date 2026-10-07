import type { Metadata } from "next";
import { TermsClient } from "./TermsClient";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan | Mameko",
  description:
    "Syarat dan Ketentuan Transaksi serta Penggunaan Layanan Make Me Kool (Mameko). Pelajari aturan pemesanan, pembayaran, pengiriman, dan kebijakan retur kami.",
};

export default function TermsPage() {
  return <TermsClient />;
}
