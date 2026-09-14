"use client";
import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";

function WalletRedirectContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?tab=profile");
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <p style={{ color: "#888", fontSize: "14px" }}>Mengalihkan ke profil...</p>
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
