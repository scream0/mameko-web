import type { Metadata } from "next";
import FeedView from "@/components/Feed/FeedView";

export const metadata: Metadata = {
  title: "Komunitas & Inspirasi Koleksi | Mameko",
  description: "Temukan cerita koleksi, inspirasi wewangian, dan ulasan produk terbaru dari komunitas Mameko.",
};

export default function FeedPage() {
  return <FeedView />;
}
