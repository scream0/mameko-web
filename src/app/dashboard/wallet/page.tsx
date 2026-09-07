"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function WalletRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "profile");
    params.set("subtab", "wallet");
    router.replace(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <p style={{ color: "#888", fontSize: "14px" }}>Mengalihkan ke dompet...</p>
    </div>
  );
}

export default function WalletRedirectPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <WalletRedirectContent />
    </Suspense>
  );
}
