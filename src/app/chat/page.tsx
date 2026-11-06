"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChatRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const productId = searchParams.get("productId");
    const targetUrl = productId
      ? `/dashboard?tab=chat&productId=${encodeURIComponent(productId)}`
      : "/dashboard?tab=chat";
    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        color: "var(--text-secondary, #64748b)",
        backgroundColor: "var(--background-color, #f8fafc)",
      }}
    >
      <p>Membuka ruang chat...</p>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            color: "var(--text-secondary, #64748b)",
            backgroundColor: "var(--background-color, #f8fafc)",
          }}
        >
          <p>Memuat chat...</p>
        </div>
      }
    >
      <ChatRedirectContent />
    </Suspense>
  );
}

