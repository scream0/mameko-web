"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AdminOrdersRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const subtab = searchParams.get("tab") || searchParams.get("subtab") || "orders";
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "orders");
    if (subtab && subtab !== "orders") {
      params.set("subtab", subtab);
    } else {
      params.delete("subtab");
    }
    router.replace(`/dashboard?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <p style={{ color: "#888", fontSize: "14px" }}>Mengalihkan ke dashboard pesanan...</p>
    </div>
  );
}

export default function AdminOrdersRedirectPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <AdminOrdersRedirectContent />
    </Suspense>
  );
}
