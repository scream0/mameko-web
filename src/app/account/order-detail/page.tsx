"use client";
import OrderDetailWrapper from "@/components/Dashboard/User/Order/OrderDetailWrapper";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

function Content() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") || searchParams.get("orderId");

  useEffect(() => {
    if (id) {
      const queryString = searchParams.toString();
      router.replace(`/dashboard/order-detail?${queryString}`);
    }
  }, [id, router, searchParams]);

  if (!id) return null;
  return <OrderDetailWrapper orderId={id} />;
}

export default function AccountOrderDetailRoutePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}