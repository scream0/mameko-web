/**
 * src/utils/notificationRouter.ts
 *
 * Mameko Canonical Notification Router (Zero 404 Guarantee)
 * Mencegah navigasi 404 ketika pengguna mengklik notifikasi dengan
 * menormalisasi tautan relatif/backend lama ke rute resmi Next.js App Router.
 */

export function resolveCanonicalNotificationUrl(
  rawLink?: string | null,
  notification?: any
): string {
  if (!rawLink || typeof rawLink !== "string" || !rawLink.trim()) {
    return getFallbackUrlByCategory(notification);
  }

  const link = rawLink.trim();

  // 1. Eksternal URL (http/https): Kembalikan apa adanya bila valid
  if (/^https?:\/\//i.test(link)) {
    return link;
  }

  // 2. Pola Order Detail: "order/ORD-123", "/order/ORD-123", "orders/ORD-123", "/dashboard/order-detail?id=..."
  const orderDetailMatch = link.match(/^(?:\/)?(?:dashboard\/)?orders?(?:-detail)?\/([A-Za-z0-9_-]+)/i);
  if (orderDetailMatch && orderDetailMatch[1]) {
    return `/dashboard/order-detail?id=${encodeURIComponent(orderDetailMatch[1])}`;
  }

  // Jika sudah berupa format query: "/dashboard/order-detail?id=..."
  if (link.startsWith("/dashboard/order-detail") || link.startsWith("/account/order-detail")) {
    return link.startsWith("/") ? link : `/${link}`;
  }

  // 3. Pola Tab Admin: "/admin/orders", "/admin/chat", "/admin/products", dll.
  if (link.startsWith("/admin/") || link.startsWith("admin/")) {
    const cleanSub = link.replace(/^\/?admin\//, "").split("?")[0].toLowerCase();
    const adminTabMap: Record<string, string> = {
      orders: "orders",
      order: "orders",
      chat: "chat",
      chats: "chat",
      products: "products",
      product: "products",
      promotions: "promotions",
      promo: "promotions",
      reviews: "reviews",
      review: "reviews",
      settings: "settings",
      setting: "settings",
      notifications: "notifications",
      overview: "overview",
      analytics: "analytics",
    };
    const mapped = adminTabMap[cleanSub] || "overview";
    return `/dashboard?tab=${mapped}`;
  }

  // 4. Pola Tab User Standar: "/orders", "/wallet", "/vouchers", "/cart", "/profile"
  const cleanLink = link.startsWith("/") ? link : `/${link}`;

  if (cleanLink === "/orders" || cleanLink === "/dashboard/orders") {
    return "/dashboard?tab=orders";
  }
  if (cleanLink === "/wallet" || cleanLink === "/dashboard/wallet") {
    return "/dashboard?tab=profile";
  }
  if (cleanLink === "/vouchers" || cleanLink === "/dashboard/vouchers" || cleanLink.includes("voucher")) {
    return "/dashboard?tab=vouchers";
  }
  if (cleanLink === "/chat" || cleanLink === "/dashboard/chat") {
    return "/dashboard?tab=chat";
  }
  if (cleanLink === "/profile" || cleanLink === "/dashboard/profile" || cleanLink === "/account") {
    return "/dashboard?tab=profile";
  }
  if (cleanLink === "/admin") {
    return "/dashboard";
  }

  // 5. Jika rute sudah berawalan "/dashboard"
  if (cleanLink.startsWith("/dashboard")) {
    return cleanLink;
  }

  // 6. Jika berupa rute publik valid: "/product/...", "/privacy", "/terms", "/feed", "/shop"
  if (
    cleanLink.startsWith("/product/") ||
    cleanLink === "/privacy" ||
    cleanLink === "/terms" ||
    cleanLink === "/feed" ||
    cleanLink === "/shop"
  ) {
    return cleanLink;
  }

  // 7. Fallback Aman: Arahkan ke tab dashboard yang relevan (Menjamin Zero 404)
  return getFallbackUrlByCategory(notification);
}

function getFallbackUrlByCategory(n?: any): string {
  if (!n) return "/dashboard?tab=notifications";

  const type = String(n.type || "").toLowerCase();
  const title = String(n.title || "").toLowerCase();
  const message = String(n.message || "").toLowerCase();
  const combined = `${type} ${title} ${message}`;

  if (combined.includes("voucher") || combined.includes("promo") || combined.includes("diskon")) {
    return "/dashboard?tab=vouchers";
  }

  if (
    combined.includes("order") ||
    combined.includes("pesanan") ||
    combined.includes("bayar") ||
    combined.includes("payment") ||
    combined.includes("resi")
  ) {
    return "/dashboard?tab=orders";
  }

  if (combined.includes("wallet") || combined.includes("saldo") || combined.includes("penarikan")) {
    return "/dashboard?tab=profile";
  }

  if (combined.includes("chat") || combined.includes("pesan")) {
    return "/dashboard?tab=chat";
  }

  return "/dashboard?tab=notifications";
}

