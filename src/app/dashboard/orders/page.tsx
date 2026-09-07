"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OrdersRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "orders");
    router.replace(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <p style={{ color: "#888", fontSize: "14px" }}>Mengalihkan ke halaman pesanan...</p>
    </div>
  );
}

export default function OrdersRedirectPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <OrdersRedirectContent />
    </Suspense>
  );
}
