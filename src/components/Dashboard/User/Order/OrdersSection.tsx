// @ts-nocheck
"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { auth, db } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import toast from "react-hot-toast";
import { useStore } from "@/context/StoreContext";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { OrdersSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { formatAddressDisplay } from "@/utils/address";
import { sortOrdersByNewestFirst } from "./orderSorting";
import { useRouter, useSearchParams } from "next/navigation";
import ReturnsCenter from "@/components/Dashboard/User/Returns/ReturnsCenter"; // Sesuaikan path jika berbeda
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";
import { getApiBaseUrl } from "@/lib/apiClient";
import { convertToWebP } from "@/utils/imageConverter";

function getStatusInfo(rawStatus: any) {
  const key = (rawStatus || "pending").toLowerCase();
  return (
    ordersConfig.status[key] || {
      label: (rawStatus || "PENDING").toUpperCase(),
      badgeClass: "statusProcessing",
    }
  );
}

function formatOrderDoc(item: any, primaryAddress: any) {
  const rawStatus = (item.status || "pending").toLowerCase();

  let displayName = item.product_name || item.name || ordersConfig.card.defaultCategory;
  if (item.items && Array.isArray(item.items) && item.items.length > 0) {
    const firstItem = item.items[0];
    displayName = `${firstItem.product_name || firstItem.name || ordersConfig.card.defaultItemName} (${firstItem.variant_name || firstItem.size || ordersConfig.card.defaultVariant})`;
    if (item.items.length > 1) {
      displayName += ` +${item.items.length - 1} ${ordersConfig.card.moreProductsSuffix}`;
    }
  }

  const orderAddressObj =
    item.shippingAddress || item.shipping_address || item.address;
  const formattedAddress = orderAddressObj
    ? formatAddressDisplay(orderAddressObj)
    : primaryAddress || ordersConfig.card.primaryAddressUnset;

  const rawAmount = Number(item.amount || item.gross_amount || item.total_amount || item.grand_total || item.price || 0);

  const reviewedItemIds = Array.isArray(item.reviewedItemIds)
    ? item.reviewedItemIds
    : [];

  return {
    id: item.orderId || item.order_id || item.id,
    order_number: item.order_number || item.orderNumber || item.orderId || item.order_id || item.id,
    name: displayName,
    items: item.items || [],
    hasBeenReviewed: item.hasBeenReviewed || false,
    reviewedItemIds,
    shippingReceiptNumber: item.shippingReceiptNumber || null,
    statusHistory: Array.isArray(item.statusHistory) ? item.statusHistory : [],
    concentration:
      item.concentration ||
      (item.items?.[0] ? `Varian: ${item.items[0].variant_name || item.items[0].size || ordersConfig.card.defaultVariant}` : ordersConfig.card.defaultConcentration),
    notes: item.notes || ordersConfig.card.defaultNotes,
    price: `Rp ${rawAmount.toLocaleString("id-ID")}`,
    rawPrice: rawAmount,
    status: rawStatus,
    snap_token: item.snap_token || item.snapToken || null,
    date:
      item.createdAt || item.created_at
        ? new Date(
          item.createdAt?.seconds
            ? item.createdAt.seconds * 1000
            : item.createdAt || item.created_at,
        ).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        : ordersConfig.card.today,
    paymentMethod:
      item.payment_type ||
      item.paymentType ||
      ordersConfig.card.defaultPaymentMethod,
    shippingAddress: formattedAddress,
    return_status: item.return_status || item.returnStatus || "",
    return_admin_note: item.return_admin_note || item.returnAdminNote || "",
    waybill_id: item.waybill_id || item.waybillId || null,
    shipping_detail: item.shipping_detail || item.shippingDetail || null,
    updated_at: item.updated_at || item.updatedAt || null,
  };
}

export default function OrdersSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status") || searchParams.get("filter");

  const [filter, setFilter] = useState(
    statusParam && ["all", "pending", "unpaid", "processing", "shipping", "shipped", "delivered", "completed", "cancelled", "history", "return"].includes(statusParam)
      ? statusParam === "completed" ? "delivered" : statusParam
      : "all"
  );

  useEffect(() => {
    if (statusParam && ["all", "pending", "unpaid", "processing", "shipping", "shipped", "delivered", "completed", "cancelled", "history", "return"].includes(statusParam)) {
      setFilter(statusParam === "completed" ? "delivered" : statusParam);
    }
  }, [statusParam]);

  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useStore();
  const [visibleCount, setVisibleCount] = useState(5);

  const [currentUser, setCurrentUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isMidtransEnabled, setIsMidtransEnabled] = useState(false);

  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPayingId, setIsPayingId] = useState(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState(null);
  const [orderToConfirm, setOrderToConfirm] = useState(null);
  const lastUserIdRef = useRef(null);

  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [reviewTargetItem, setReviewTargetItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewPhotoFile, setReviewPhotoFile] = useState(null);
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnEvidenceFile, setReturnEvidenceFile] = useState(null);
  const [returnEvidencePreview, setReturnEvidencePreview] = useState(null);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (session) {
        setCurrentSession(session);
        setCurrentUser(session?.user || null);
      }

      if (!session) {
        setLoading(false);
        setOrders([]);
      }

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;

        if (session) {
          setCurrentSession(session);
          setCurrentUser(session?.user || null);
        }
        if (!session) {
          setLoading(false);
          setOrders([]);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadMidtrans = async () => {
      try {
        const { getPublicSettings } = await import('@/services/settingsService');
        const settings = await getPublicSettings();
        if (!settings || settings.enableMidtrans === false) {
          setIsMidtransEnabled(false);
          return;
        }

        setIsMidtransEnabled(true);
        const isProduction = settings.midtransIsProduction === true;
        const snapScriptUrl = isProduction
          ? "https://app.midtrans.com/snap/snap.js"
          : "https://app.sandbox.midtrans.com/snap/snap.js";

        // Karena di client NEXT_PUBLIC_ ditarik saat build, 
        // pastikan env yang sesuai mode ditarik.
        const clientKey = isProduction
          ? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_PRODUCTION
          : process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX;

        if (!document.getElementById("midtrans-snap-script") && clientKey) {
          const script = document.createElement("script");
          script.id = "midtrans-snap-script";
          script.src = snapScriptUrl;
          script.setAttribute("data-client-key", clientKey);
          script.async = true;
          document.body.appendChild(script);
        }
      } catch (err) {
        console.error("Failed to load midtrans settings", err);
      }
    };
    loadMidtrans();
  }, []);

  useEffect(() => {
    if (!currentUser || !currentSession) return;

    let isActive = true;
    setLoading(true);

    const loadOrders = async () => {
      try {
        const userId = currentUser.id || currentUser.uid;
        const token = currentSession.access_token;

        const response = await fetch(getApiBaseUrl() + `/api/user/orders?userId=${userId}&limit=1000`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Gagal mengambil data pesanan (status ${response.status})`);
        }

        const result = await response.json();
        if (!isActive) return;

        const primaryAddress = result.primaryAddress || "Belum diatur";

        const formatted = (result.orders || []).map((order: any) =>
          formatOrderDoc(order, primaryAddress),
        );

        const sorted = sortOrdersByNewestFirst(formatted);

        setOrders(sorted);
      } catch (error) {
        console.error("Gagal memuat pesanan dari API:", error);
        if (isActive) {
          toast.error(ordersConfig.toasts.fetchOrdersError || "Gagal memuat data pesanan.");
          setOrders([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    // Subscribe to realtime changes for current user
    const userId = currentUser.id || currentUser.uid;
    const userOrdersChannel = db.channel(`user-orders-list-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      db.removeChannel(userOrdersChannel);
    };
  }, [currentUser, currentSession]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filter !== "all" && filter !== "return") {
      if (filter === "pending") {
        result = result.filter((o) => ["pending", "unpaid"].includes(o.status));
      } else if (filter === "processing") {
        result = result.filter((o) => ["paid", "success", "processing", "settlement", "capture", "verifying"].includes(o.status));
      } else if (filter === "shipping") {
        result = result.filter((o) => ["shipping", "shipped"].includes(o.status));
      } else if (filter === "history") {
        result = result.filter((o) => ["completed", "delivered", "cancelled", "canceled", "return_requested", "returning", "returned", "return_rejected"].includes(o.status));
      }
    }

    if (searchQuery.trim() !== "") {
      const query_ = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          (o.order_number || o.id).toLowerCase().includes(query_) ||
          o.name.toLowerCase().includes(query_) ||
          o.concentration.toLowerCase().includes(query_),
      );
    }

    return result;
  }, [orders, filter, searchQuery]);

  const orderStats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => ["pending", "unpaid"].includes(o.status)).length;
    const processing = orders.filter((o) => ["paid", "success", "processing", "settlement", "capture", "verifying"].includes(o.status)).length;
    const shipping = orders.filter((o) => ["shipping", "shipped"].includes(o.status)).length;
    const history = orders.filter((o) => ["completed", "delivered", "cancelled", "canceled", "return_requested", "returning", "returned", "return_rejected"].includes(o.status)).length;
    const returnCount = orders.filter((o) =>
      ["return_requested", "returning", "returned", "return_rejected"].includes(o.status) ||
      Boolean(o.return_status)
    ).length;

    return { total, pending, processing, shipping, history, returnCount };
  }, [orders]);

  const filterTabs = useMemo(() => {
    const tabs = ordersConfig.filterTabs || [
      { key: "all", label: "Semua", icon: "grid" },
      { key: "pending", label: "Belum Bayar", icon: "wallet" },
      { key: "processing", label: "Sedang Dikemas", icon: "package" },
      { key: "shipping", label: "Dikirim", icon: "truck" },
      { key: "history", label: "Riwayat Pesanan", icon: "clock" },
      { key: "return", label: "Retur", icon: "rotate-ccw" },
    ];

    return tabs.map((tab) => {
      let count = 0;
      if (tab.key === "all") count = orderStats.total;
      else if (tab.key === "pending") count = orderStats.pending;
      else if (tab.key === "processing") count = orderStats.processing;
      else if (tab.key === "shipping") count = orderStats.shipping;
      else if (tab.key === "history") count = orderStats.history;
      else if (tab.key === "return") count = orderStats.returnCount;
      return { ...tab, count };
    });
  }, [orderStats]);

  const handlePayOrder = async (order: any) => {
    if (isPayingId) return;
    setIsPayingId(order.id);
    let snapToken = order.snap_token;

    if (!snapToken) {
      toast.loading(ordersConfig.toasts.connectPayment || "Menghubungkan sistem pembayaran...", { id: "snap-pay-loader" });
      try {
        const { data: { session } } = await auth.getSession();
        const token = session?.access_token;
        const userId = currentUser?.id || currentUser?.uid;

        const res = await fetch(getApiBaseUrl() + `/api/user/orders/${order.id}/pay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId }),
        });

        const data = await res.json();
        toast.dismiss("snap-pay-loader");

        if (!res.ok) {
          throw new Error(data.error || ordersConfig.toasts.tokenGenerateError || "Gagal menghasilkan token pembayaran.");
        }

        snapToken = data.snap_token;
      } catch (err) {
        toast.dismiss("snap-pay-loader");
        toast.error(err.message || ordersConfig.toasts.paymentSystemError || "Gagal memuat sistem pembayaran.");
        setIsPayingId(null);
        return;
      }
    }

    setIsPayingId(null);

    if (!snapToken) {
      toast.error(ordersConfig.toasts.tokenNotFound || "Token pembayaran tidak ditemukan. Silakan buka detail pesanan.");
      return;
    }

    if (typeof window.snap === "undefined") {
      toast.error(ordersConfig.toasts.snapModuleLoading || "Modul pembayaran sedang dimuat, coba sesaat lagi.");
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess: async function (result: any) {
        toast.success(ordersConfig.toasts.paySuccess || "Pembayaran Berhasil! Pesanan sekarang sedang dikemas.");
        try {
          const { data: { session } } = await auth.getSession();
          const token = session?.access_token;
          await fetch(getApiBaseUrl() + `/api/user/orders/${order.id}/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              transaction_status: result.transaction_status || "settlement",
              status_code: result.status_code,
              order_id: result.order_id,
            }),
          });
        } catch (e) {
          console.error("Sync payment error:", e);
        }

        // Mutasi status lokal agar badge dan daftar langsung berpindah ke Sedang Dikemas
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: "paid" } : o
          )
        );
        setFilter("processing");
      },
      onPending: function () {
        toast(ordersConfig.toasts.payPending || "Menunggu pembayaran Anda diselesaikan.", { icon: "⏳" });
      },
      onClose: function () {
        toast(ordersConfig.toasts.payClosed || "Popup pembayaran ditutup.", { icon: "ℹ️" });
      },
    });
  };

  const handleReOrder = async (order: any) => {
    const toastId = toast.loading(ordersConfig.toasts.checkingStock || "Memeriksa ketersediaan stok produk...");
    try {
      if (!currentUser) throw new Error(ordersConfig.toasts.unauthenticated || "Pengguna tidak terautentikasi.");

      const productsRes = await fetch(getApiBaseUrl() + "/api/products", { cache: "no-store" });
      const productsResult = await productsRes.json();
      if (!productsRes.ok) throw new Error(ordersConfig.toasts.checkStockError || "Gagal memeriksa stok produk.");

      const latestProducts =
        productsResult.data || productsResult.products || [];
      const orderItems =
        order.items && order.items.length > 0
          ? order.items
          : [
            {
              id: order.id,
              name: order.name,
              quantity: 1,
              size: order.concentration,
              price: order.rawPrice,
            },
          ];

      let addedCount = 0;

      for (const item of orderItems) {
        const itemName = item.name || item.product_name || ordersConfig.card.defaultItemName;
        const pId = String(item.id || item.productId || item.product_id || "");
        const orderedSize = String(item.size || item.variant_name || "").trim();
        const orderedQty = Number(item.quantity || item.qty || 1);

        const foundProduct = latestProducts.find(
          (p: any) =>
            String(p.id || p._id) === pId ||
            p.name?.toLowerCase() === itemName.toLowerCase(),
        );

        if (!foundProduct) {
          toast.error((ordersConfig.toasts.productUnavailable || 'Produk "{name}" sudah tidak tersedia.').replace("{name}", itemName));
          continue;
        }

        let targetVariant = null;
        let currentStock = 0;

        if (
          Array.isArray(foundProduct.variants) &&
          foundProduct.variants.length > 0
        ) {
          targetVariant = foundProduct.variants.find(
            (v: any) =>
              String(v.size || "")
                .trim()
                .toLowerCase() === orderedSize.toLowerCase(),
          );
          currentStock = Number(
            targetVariant?.stock ?? targetVariant?.stok ?? 0,
          );
        } else {
          currentStock = Number(foundProduct.stock ?? foundProduct.stok ?? 0);
        }

        if (currentStock <= 0) {
          toast.error(
            (ordersConfig.toasts.stockEmpty || 'Stok "{name} ({size})" sudah habis.')
              .replace("{name}", itemName)
              .replace("{size}", orderedSize || ordersConfig.card.defaultVariant),
          );
          continue;
        }

        const finalQty = Math.min(orderedQty, currentStock);
        if (finalQty < orderedQty) {
          toast(
            (ordersConfig.toasts.stockAdjusted || 'Stok terbatas! Jumlah "{name}" disesuaikan jadi {qty}.')
              .replace("{name}", itemName)
              .replace("{qty}", finalQty),
          );
        }

        const variantData = targetVariant || {
          size: orderedSize || ordersConfig.card.defaultVariant,
          price: Number(item.price || foundProduct.price || 0),
          stock: currentStock,
        };

        const result = await addToCart(foundProduct, variantData, finalQty, true);
        if (result && result.success) {
          addedCount++;
        }
      }

      toast.dismiss(toastId);

      if (addedCount > 0) {
        toast.success(ordersConfig.toasts.reorderSuccess || "Produk berhasil dimasukkan ke keranjang!");
      } else {
        toast.error(ordersConfig.toasts.reorderEmpty || "Gagal menambahkan produk ke keranjang karena stok habis.");
      }
    } catch (err) {
      console.error("Re-Order Error:", err);
      toast.error(err.message || ordersConfig.toasts.reorderError || "Gagal memproses pesanan ulang.", {
        id: toastId,
      });
    }
  };

  const handleOpenOrderDetail = async (order: any) => {
    if (!currentUser) return;
    router.push(`/dashboard/order-detail?id=${order.id}`);
  };

  const handleCancelOrder = (order: any) => {
    if (isCancelling) return;
    setSelectedOrderToCancel(order);
    setIsCancelModalOpen(true);
  };

  const confirmCancelOrder = async () => {
    if (!selectedOrderToCancel) return;
    const order = selectedOrderToCancel;
    setIsCancelModalOpen(false);
    setSelectedOrderToCancel(null);

    setIsCancelling(true);
    const toastId = toast.loading(ordersConfig.modals.cancel.loading || "Membatalkan pesanan...");
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser?.id || currentUser?.uid;

      if (!userId) throw new Error(ordersConfig.toasts.unauthenticated || "Pengguna tidak terautentikasi.");

      const res = await fetch(getApiBaseUrl() + `/api/user/orders/${order.id}/cancel?userId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ orderId: order.id, userId }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || ordersConfig.modals.cancel.error || "Gagal membatalkan pesanan.");

      toast.success(ordersConfig.modals.cancel.success || "Pesanan berhasil dibatalkan.", { id: toastId });

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o))
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("product-stock-updated"));
      }
    } catch (err) {
      console.error("Cancel Order Error:", err);
      toast.error(err.message || ordersConfig.modals.cancel.error || "Gagal membatalkan pesanan.", { id: toastId });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmReceived = (order: any) => {
    if (isConfirming) return;
    setOrderToConfirm(order);
  };

  const confirmReceivedAction = async () => {
    if (!orderToConfirm) return;
    const order = orderToConfirm;
    setOrderToConfirm(null);

    setIsConfirming(true);
    const toastId = toast.loading(ordersConfig.modals.confirm.loading || "Mengonfirmasi penerimaan pesanan...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser?.id || currentUser?.uid;

      if (!userId) throw new Error(ordersConfig.toasts.unauthenticated || "Pengguna tidak terautentikasi.");

      const res = await fetch(getApiBaseUrl() + `/api/user/orders/${order.id}/confirm?userId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || ordersConfig.modals.confirm.error || "Gagal mengonfirmasi pesanan.");
      }

      toast.success(ordersConfig.modals.confirm.success || "Pesanan berhasil dikonfirmasi diterima.", { id: toastId });

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "delivered" } : o))
      );
    } catch (err) {
      console.error("Confirm Order Error:", err);
      toast.error(err.message || ordersConfig.modals.confirm.error || "Gagal mengonfirmasi pesanan.", { id: toastId });
    } finally {
      setIsConfirming(false);
    }
  };

  const openReviewModal = (order, item: any) => {
    setReviewModalOrder(order);
    setReviewTargetItem(item);
    setRating(5);
    setComment("");
    setReviewPhotoFile(null);
    setReviewPhotoPreview(null);
  };

  const closeReviewModal = () => {
    if (reviewPhotoPreview) {
      URL.revokeObjectURL(reviewPhotoPreview);
    }
    setReviewModalOrder(null);
    setReviewTargetItem(null);
    setRating(5);
    setComment("");
    setReviewPhotoFile(null);
    setReviewPhotoPreview(null);
  };

  const handleReviewPhotoChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(ordersConfig.toasts.invalidPhotoFormat || "Format foto harus JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(ordersConfig.toasts.photoMaxSize || "Ukuran foto maksimal 5 MB.");
      return;
    }

    setReviewPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setReviewPhotoPreview(previewUrl);
  };

  const handleRemoveReviewPhoto = () => {
    if (reviewPhotoPreview) {
      URL.revokeObjectURL(reviewPhotoPreview);
    }
    setReviewPhotoFile(null);
    setReviewPhotoPreview(null);
  };

  const handleReviewSubmit = async (e: any) => {
    e.preventDefault();
    if (
      !reviewModalOrder ||
      !reviewTargetItem ||
      !currentUser ||
      isSubmittingReview
    ) {
      return;
    }

    setIsSubmittingReview(true);
    const toastId = toast.loading(ordersConfig.toasts.submittingReview || "Mengirim ulasan Anda...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser.id || currentUser.uid;

      let reviewPhoto = null;
      if (reviewPhotoFile) {
        toast.loading(ordersConfig.toasts.uploadingReviewPhoto || "Mengunggah foto ulasan...", { id: toastId });
        const webpReviewFile = await convertToWebP(reviewPhotoFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
        const uploadData = new FormData();
        uploadData.append("file", webpReviewFile);
        uploadData.append("userId", userId);
        uploadData.append("folder", "reviews");

        const uploadRes = await fetch(getApiBaseUrl() + "/api/user/cloudinary", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: uploadData,
        });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          let errorMsg = uploadResult.error || ordersConfig.toasts.uploadPhotoError || "Gagal mengunggah foto ulasan.";
          if (errorMsg.toLowerCase().includes("cloudinary")) {
            errorMsg = ordersConfig.toasts.uploadPhotoError || "Gagal mengunggah foto. Silakan coba lagi nanti.";
          }
          throw new Error(errorMsg);
        }
        reviewPhoto = uploadResult.secure_url;
      }

      toast.loading(ordersConfig.toasts.savingReview || "Menyimpan ulasan...", { id: toastId });
      const res = await fetch(getApiBaseUrl() + "/api/user/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          userId,
          orderId: reviewModalOrder.id,
          productId:
            reviewTargetItem.product_id ||
            reviewTargetItem.productId ||
            reviewTargetItem.id ||
            reviewModalOrder.id,
          productName: reviewTargetItem.product_name || reviewTargetItem.name || reviewModalOrder.name,
          rating,
          comment,
          reviewPhoto,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || ordersConfig.toasts.reviewError || "Gagal mengirim ulasan.");
      }

      toast.success(ordersConfig.toasts.reviewSuccess || "Terima kasih! Ulasan Anda berhasil dikirim.", {
        id: toastId,
      });

      const targetItemId = String(reviewTargetItem.product_id || reviewTargetItem.productId || reviewTargetItem.id || "");

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === reviewModalOrder.id) {
            const updatedReviewedIds = [...(o.reviewedItemIds || []), targetItemId];
            return {
              ...o,
              reviewedItemIds: updatedReviewedIds,
              hasBeenReviewed: true,
            };
          }
          return o;
        })
      );

      closeReviewModal();
    } catch (error) {
      console.error("Gagal mengirim ulasan:", error);
      toast.error(error.message || ordersConfig.toasts.reviewError || "Gagal mengirim ulasan.", { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isItemReviewed = (order, item: any) => {
    const itemId = String(item.product_id || item.productId || item.id || "");
    if (order.reviewedItemIds && order.reviewedItemIds.length > 0) {
      return order.reviewedItemIds.includes(itemId);
    }
    return order.hasBeenReviewed;
  };

  const handleReturnPhotoChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(ordersConfig.modals.return.toasts.maxSize || "Ukuran foto maksimal 5 MB.");
        return;
      }
      setReturnEvidenceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReturnEvidencePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReturnPhoto = () => {
    setReturnEvidenceFile(null);
    setReturnEvidencePreview(null);
  };

  const openReturnModal = async (order: any) => {
    const toastId = toast.loading(ordersConfig.modals.return.bankCheckLoading || "Memeriksa kelengkapan profil...");
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(getApiBaseUrl() + "/api/user/profile", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        const p = data.profile;
        const bankName = p.bank_name || p.bankName;
        const bankAcc = p.bank_account_number || p.bankAccountNumber;
        const bankHolder = p.bank_account_name || p.bankAccountName;
        
        if (!bankName || !bankAcc || !bankHolder) {
          toast.dismiss(toastId);
          toast.error(ordersConfig.modals.return.bankRequired || "Silakan lengkapi informasi Rekening Bank di Pengaturan Profil terlebih dahulu untuk keperluan pencairan dana retur.", { duration: 5000 });
          return;
        }
      }
      toast.dismiss(toastId);
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
    }

    setReturnModalOrder(order);
    setReturnReason("");
    setReturnEvidenceFile(null);
    setReturnEvidencePreview(null);
  };

  const handleReturnSubmit = async (e: any) => {
    e.preventDefault();
    if (!returnModalOrder || !currentUser || isSubmittingReturn) return;

    setIsSubmittingReturn(true);
    const toastId = toast.loading(ordersConfig.modals.return.toasts.submitting || "Mengajukan return pesanan...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser.id || currentUser.uid;

      let evidenceUrl = null;
      if (returnEvidenceFile) {
        toast.loading(ordersConfig.toasts.uploadingReviewPhoto || "Mengunggah bukti foto...", { id: toastId });
        const webpEvidenceFile = await convertToWebP(returnEvidenceFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
        const uploadData = new FormData();
        uploadData.append("file", webpEvidenceFile);
        uploadData.append("userId", userId);
        uploadData.append("folder", "returns");

        const uploadRes = await fetch(getApiBaseUrl() + "/api/user/cloudinary", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: uploadData,
        });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          let errorMsg = uploadResult.error || ordersConfig.toasts.uploadPhotoError || "Gagal mengunggah foto bukti.";
          if (errorMsg.toLowerCase().includes("cloudinary")) {
            errorMsg = ordersConfig.toasts.uploadPhotoError || "Gagal mengunggah foto. Silakan coba lagi nanti.";
          }
          throw new Error(errorMsg);
        }
        evidenceUrl = uploadResult.secure_url;
      }

      toast.loading(ordersConfig.modals.return.submittingBtn || "Menyimpan pengajuan retur...", { id: toastId });
      const res = await fetch(getApiBaseUrl() + `/api/user/orders/${returnModalOrder.id}/return`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ userId, reason: returnReason, evidence: evidenceUrl }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || ordersConfig.modals.return.toasts.error || "Gagal mengajukan return pesanan.");
      }

      toast.success(ordersConfig.modals.return.toasts.success || "Pengajuan return berhasil dikirim.", { id: toastId });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === returnModalOrder.id ? { ...o, status: "return_requested" } : o
        )
      );

      setReturnModalOrder(null);
      setReturnReason("");
      setReturnEvidenceFile(null);
      setReturnEvidencePreview(null);
    } catch (error) {
      console.error("Gagal mengajukan return:", error);
      toast.error(error.message || ordersConfig.modals.return.toasts.error || "Gagal mengajukan return.", { id: toastId });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Header & Search */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerTopRow}>
          <div>
            <h3 className={styles.headerTitle}>{ordersConfig.header.title}</h3>
            <p className={styles.headerSubtitle}>
              {ordersConfig.header.subtitle}
            </p>
          </div>
          <div className={styles.searchBox}>
            <AppIcon
              name="search"
              size={16}
              strokeWidth={2}
              className={styles.searchIcon}
            />
            <input
              type="text"
              placeholder={ordersConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* Tab Navigasi Kategori Pesanan */}
        <div className={styles.filterGroup}>
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setFilter(tab.key);
                  setVisibleCount(5);
                  const url = tab.key === "all" ? "/dashboard?tab=orders" : `/dashboard?tab=orders&status=${tab.key}`;
                  router.replace(url);
                }}
                className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ""}`}
              >
                <div className={styles.filterIconWrapper}>
                  <AppIcon name={tab.icon} size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.count > 0 && (
                    <span className={styles.filterCount}>{tab.count}</span>
                  )}
                </div>
                <span className={styles.filterLabel}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tampilan Kondisional: Jika tab "return" diklik, tampilkan ReturnsCenter */}
      {filter === "return" ? (
        <ReturnsCenter onNavigateOrders={() => setFilter("all")} />
      ) : (
        /* Orders List Container */
        <div className={styles.ordersListContainer}>
          {loading ? (
            <OrdersSkeleton count={3} />
          ) : filteredOrders.length === 0 ? (
            <div className={`card ${styles.centerStateCard}`}>
              <AppIcon
                name="package"
                size={36}
                strokeWidth={1.5}
                className={styles.emptyPackageIcon}
              />
              <p className={styles.emptyText}>{ordersConfig.emptyText}</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isFinished = ["completed", "delivered"].includes(order.status);
              const isPending = ["pending", "unpaid"].includes(order.status);
              const isDelivered = ["shipping", "shipped", "delivered", "completed"].includes(order.status);

              // Cek masa garansi pengembalian (default 7 hari dari ordersConfig)
              const isReturnPeriodValid = () => {
                if (!isFinished) return true; // jika masih dikirim, masih valid
                const lastUpdate = new Date(order.updated_at || order.updatedAt || order.created_at || order.createdAt || Date.now());
                const now = new Date();
                const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
                const maxHours = (ordersConfig.returnPeriodDays || 7) * 24;
                return diffHours <= maxHours;
              };

              const returnStatus = order.return_status || "";
              const hasAnyReturn = returnStatus !== "";
              const canReturn = ["shipping", "shipped", "delivered", "completed"].includes(order.status) && !["return_requested", "returning", "returned", "return_rejected"].includes(order.status) && !hasAnyReturn && isReturnPeriodValid();

              // Override status badge if there's a return in progress
              let statusInfo = getStatusInfo(order.status);
              if (returnStatus === "pending") {
                statusInfo = { label: ordersConfig.returnStatus?.pending?.label || "⏳ Return Diproses", badgeClass: "statusReturn" };
              } else if (returnStatus === "approved") {
                statusInfo = { label: ordersConfig.returnStatus?.approved?.label || "✅ Return Disetujui", badgeClass: "statusCompleted" };
              } else if (returnStatus === "rejected") {
                statusInfo = { label: ordersConfig.returnStatus?.rejected?.label || "❌ Return Ditolak", badgeClass: "statusCancelled" };
              }
              const reviewableItems =
                order.items && order.items.length > 0
                  ? order.items
                  : [{ id: order.id, name: order.name }];

              return (
                <div key={order.id} className={`card ${styles.orderCard}`}>
                  <div className={styles.orderInfoCol}>
                    <div className={styles.orderIdRow}>
                      <span className={styles.orderIdText}>{order.order_number || order.id}</span>
                      <span
                        className={`${styles.statusBadge} ${styles[statusInfo.badgeClass]}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <h4 className={styles.orderName}>{order.name}</h4>
                    <p className={styles.orderSpec}>
                      {ordersConfig.card.specPrefix || "Spesifikasi: "}{order.concentration}
                    </p>
                    {Boolean(order.waybill_id || order.shipping_receipt_number || order.shipping_detail?.tracking_number || order.shippingDetail?.trackingNumber) && (
                      <p className={styles.resiSnippetRow}>
                        <span className={styles.resiSnippetLabel}>{ordersConfig.card.resiPrefix || "🚚 Resi: "}</span>
                        <code className={styles.resiSnippetCode}>
                          {order.waybill_id || order.shipping_receipt_number || order.shipping_detail?.tracking_number || order.shippingDetail?.trackingNumber}
                        </code>
                      </p>
                    )}
                    <p className={styles.orderNotes}>{ordersConfig.card.notesPrefix || "Catatan: "}{order.notes}</p>
                    <p className={styles.orderDate}>{ordersConfig.card.datePrefix || "Tanggal: "}{order.date}</p>

                    {/* Return Status Info */}
                    {order.return_status && (
                      <div className={`${styles.returnStatusBanner} ${
                        order.return_status === 'approved'
                          ? styles.returnStatusBannerApproved
                          : order.return_status === 'rejected'
                          ? styles.returnStatusBannerRejected
                          : styles.returnStatusBannerPending
                      }`}>
                        <strong>
                          {order.return_status === 'approved'
                            ? (ordersConfig.returnStatus?.approved?.banner || '✅ Return Disetujui')
                            : order.return_status === 'rejected'
                            ? (ordersConfig.returnStatus?.rejected?.banner || '❌ Return Ditolak')
                            : (ordersConfig.returnStatus?.pending?.banner || '⏳ Return Sedang Diproses')}
                        </strong>
                        {order.return_admin_note && (
                          <span className={styles.returnStatusNote}> — {order.return_admin_note}</span>
                        )}
                      </div>
                    )}

                    {isFinished && (
                      <div className={styles.perItemReviewRow}>
                        {reviewableItems.map((item, idx: any) => {
                          const reviewed = isItemReviewed(order, item);
                          return (
                            <button
                              key={idx}
                              onClick={() =>
                                !reviewed && openReviewModal(order, item)
                              }
                              disabled={reviewed}
                              className={
                                reviewed
                                  ? styles.reviewBtnDisabled
                                  : styles.reviewBtn
                              }
                            >
                              {reviewed
                                ? (ordersConfig.buttons.reviewedItem || "✓ {name} sudah diulas").replace("{name}", item.product_name || item.name)
                                : (ordersConfig.buttons.reviewItem || "Ulas {name}").replace("{name}", item.product_name || item.name)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className={styles.orderActionCol}>
                    <span className={styles.orderPrice}>{order.price}</span>
                    <div className={styles.buttonGroup}>
                      <button
                        onClick={() => handleOpenOrderDetail(order)}
                        className={styles.detailBtn}
                      >
                        {ordersConfig.buttons.details}
                      </button>
                      {isPending && (
                        <>
                          {isMidtransEnabled && !order.paymentMethod?.toLowerCase().includes("manual") && (
                            <button
                              onClick={() => handlePayOrder(order)}
                              disabled={isPayingId === order.id}
                              className={styles.payBtn}
                            >
                              <AppIcon name="creditcard" size={14} />
                              <span>{isPayingId === order.id ? (ordersConfig.buttons.loadingPay || "Memuat...") : (ordersConfig.buttons.payNow || "Bayar Sekarang")}</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelOrder(order)}
                            disabled={isCancelling}
                            className={styles.cancelBtn}
                          >
                            {ordersConfig.buttons.cancel || "Batalkan"}
                          </button>
                        </>
                      )}
                      {isDelivered && !isFinished && (
                        <button
                          onClick={() => handleConfirmReceived(order)}
                          disabled={isConfirming}
                          className={styles.confirmBtn}
                        >
                          {isConfirming ? (ordersConfig.buttons.processingConfirm || "Memproses...") : (ordersConfig.buttons.confirmReceived || "Konfirmasi Diterima")}
                        </button>
                      )}
                      {canReturn && (
                        <button
                          onClick={() => openReturnModal(order)}
                          className={styles.returnBtn}
                        >
                          {ordersConfig.buttons.applyReturn || "Ajukan Return"}
                        </button>
                      )}
                      {(hasAnyReturn || ["return_requested", "returning", "returned", "return_rejected"].includes(order.status)) && (
                        <button
                          onClick={() => {
                            setFilter("return");
                            router.replace("/dashboard?tab=orders&status=return");
                          }}
                          className={styles.trackReturnBtn}
                        >
                          <AppIcon name="rotate-ccw" size={14} />
                          <span>{ordersConfig.buttons.trackReturn || "Pantau Retur"}</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleReOrder(order)}
                        className={styles.reorderBtn}
                      >
                        {ordersConfig.buttons.reorder}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {visibleCount < filteredOrders.length && (
            <div className={styles.loadMoreContainer}>
              <button
                onClick={() => setVisibleCount((prev) => prev + 5)}
                className={styles.loadMoreBtn}
              >
                {ordersConfig.buttons.loadMore || "Muat Lebih Banyak"} <AppIcon name="chevron-down" size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL ULASAN PRODUK DENGAN UPLOAD GAMBAR CLOUDINARY --- */}
      {reviewModalOrder && reviewTargetItem && (
        <div
          className={styles.modalOverlay}
          onClick={closeReviewModal}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {ordersConfig.labels.reviewTitle}
              </h3>
              <button
                onClick={closeReviewModal}
                className={styles.modalCloseBtn}
                type="button"
              >
                <AppIcon name="x" size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className={styles.modalBody}>
              <div className={styles.modalProductCard}>
                <div className={styles.modalProductIconWrap}>
                  <AppIcon name="package" size={20} />
                </div>
                <div>
                  <span className={styles.modalFieldLabel}>
                    {ordersConfig.labels.product}
                  </span>
                  <strong className={styles.modalProductName}>{reviewTargetItem.product_name || reviewTargetItem.name}</strong>
                </div>
              </div>

              <div>
                <label className={styles.modalFieldLabel}>
                  {ordersConfig.labels.ratingLabel}
                </label>
                <div className={styles.starRatingGroup}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`${styles.starBtn} ${rating >= star ? styles.starBtnActive : ""}`}
                      title={`${star} Bintang`}
                    >
                      <AppIcon name="star" size={24} strokeWidth={rating >= star ? 2.5 : 1.5} />
                    </button>
                  ))}
                  <span className={styles.ratingTextLabel}>
                    {ordersConfig.ratingOptions.find((o) => o.value === rating)?.label || `${rating} / 5`}
                  </span>
                </div>
              </div>

              <div>
                <label className={styles.modalFieldLabel}>
                  {ordersConfig.labels.commentLabel}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={ordersConfig.labels.commentPlaceholder}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>

              <div>
                <label className={styles.modalFieldLabel}>
                  {ordersConfig.labels.uploadPhoto}
                </label>

                {reviewPhotoPreview ? (
                  <div className={styles.photoPreviewWrapper}>
                    <div className={styles.photoPreviewThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={reviewPhotoPreview}
                        alt="Preview foto ulasan"
                        className={styles.previewImg}
                      />
                    </div>
                    <div className={styles.photoPreviewMeta}>
                      <span className={styles.photoFileName}>{reviewPhotoFile?.name || "foto-ulasan.jpg"}</span>
                      <span className={styles.photoFileSize}>
                        {reviewPhotoFile ? `${(reviewPhotoFile.size / 1024).toFixed(1)} KB` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveReviewPhoto}
                        className={styles.removePhotoBtn}
                      >
                        <AppIcon name="trash" size={13} />
                        <span>Hapus Foto</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={styles.photoUploadDropzone}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleReviewPhotoChange}
                      className={styles.fileInputHidden}
                    />
                    <div className={styles.dropzoneIconCircle}>
                      <AppIcon name="camera" size={22} />
                    </div>
                    <div className={styles.dropzoneTextGroup}>
                      <span className={styles.dropzoneMainText}>
                        Pilih foto produk atau seret ke sini
                      </span>
                      <span className={styles.dropzoneSubText}>
                        Format JPG, PNG, WebP (Maksimal 5 MB)
                      </span>
                    </div>
                  </label>
                )}
              </div>

              <div className={styles.modalActionGroup}>
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className={styles.modalCancelActionBtn}
                  disabled={isSubmittingReview}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={styles.modalCloseActionBtn}
                  disabled={isSubmittingReview}
                >
                  {isSubmittingReview ? (
                    <>
                      <span className={styles.btnSpinner} />
                      <span>{ordersConfig.labels.submittingReview}</span>
                    </>
                  ) : (
                    <>
                      <AppIcon name="send" size={15} />
                      <span>{ordersConfig.labels.submitReview}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL RETURN / RETURN CENTER --- */}
      {returnModalOrder && (
        <div
          className={styles.modalOverlay}
          onClick={() => setReturnModalOrder(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{ordersConfig.modals.return.title || "Pengajuan Return Pesanan"}</h3>
              <button
                onClick={() => setReturnModalOrder(null)}
                className={styles.modalCloseBtn}
              >
                <AppIcon name="x" size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className={styles.modalBody}>
              <div>
                <span className={styles.modalFieldLabel}>{ordersConfig.modals.return.orderIdLabel || "ID Pesanan"}</span>
                <strong>{returnModalOrder.order_number || returnModalOrder.id}</strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>{ordersConfig.modals.return.productLabel || "Produk / Detail"}</span>
                <strong>{returnModalOrder.name}</strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>{ordersConfig.modals.return.reasonLabel || "Alasan Return"}</span>
                <textarea
                  rows={3}
                  required
                  placeholder={ordersConfig.modals.return.reasonPlaceholder || "Tuliskan alasan pengembalian/return produk secara detail..."}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              <div className={styles.photoUploadContainer}>
                <span className={styles.modalFieldLabel}>{ordersConfig.modals.return.evidenceLabel || "Foto Bukti Barang (Opsional namun sangat disarankan)"}</span>
                {returnEvidencePreview ? (
                  <div className={styles.photoPreviewWrapper}>
                    <img
                      src={returnEvidencePreview}
                      alt="Bukti Preview"
                      className={styles.photoPreviewImg}
                    />
                    <div className={styles.photoPreviewOverlay}>
                      <button
                        type="button"
                        onClick={handleRemoveReturnPhoto}
                        className={styles.removePhotoBtn}
                      >
                        <AppIcon name="trash" size={13} />
                        <span>{ordersConfig.modals.return.removePhoto || "Hapus Foto"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={styles.photoUploadDropzone}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleReturnPhotoChange}
                      className={styles.fileInputHidden}
                    />
                    <div className={styles.dropzoneIconCircle}>
                      <AppIcon name="camera" size={22} />
                    </div>
                    <div className={styles.dropzoneTextGroup}>
                      <span className={styles.dropzoneMainText}>
                        {ordersConfig.modals.return.dropzoneMain || "Pilih foto bukti barang atau seret ke sini"}
                      </span>
                      <span className={styles.dropzoneSubText}>
                        {ordersConfig.modals.return.dropzoneSub || "Format JPG, PNG, WebP (Maksimal 5 MB)"}
                      </span>
                    </div>
                  </label>
                )}
              </div>
              <button
                type="submit"
                className={styles.modalCloseActionBtn}
                disabled={isSubmittingReturn}
              >
                {isSubmittingReturn ? (ordersConfig.modals.return.submittingBtn || "Mengirim Pengajuan...") : (ordersConfig.modals.return.submitBtn || "Kirim Pengajuan Return")}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setSelectedOrderToCancel(null);
        }}
        onConfirm={confirmCancelOrder}
        title={ordersConfig.modals.cancel.title || "Batalkan Pesanan"}
        message={(ordersConfig.modals.cancel.messageTemplate || "Batalkan pesanan {orderNumber}? Tindakan ini tidak bisa dibatalkan.").replace(
          "{orderNumber}",
          (selectedOrderToCancel?.order_number || selectedOrderToCancel?.id || "").length === 36
            ? (selectedOrderToCancel?.order_number || selectedOrderToCancel?.id).split("-")[0].toUpperCase()
            : (selectedOrderToCancel?.order_number || selectedOrderToCancel?.id)
        )}
      />

      <ConfirmationModal
        isOpen={!!orderToConfirm}
        onClose={() => setOrderToConfirm(null)}
        onConfirm={confirmReceivedAction}
        title={ordersConfig.modals.confirm.title || "Konfirmasi Pesanan"}
        message={(ordersConfig.modals.confirm.messageTemplate || "Konfirmasi bahwa pesanan {orderNumber} sudah diterima?").replace(
          "{orderNumber}",
          (orderToConfirm?.order_number || orderToConfirm?.id || "").length === 36
            ? (orderToConfirm?.order_number || orderToConfirm?.id).split("-")[0].toUpperCase()
            : (orderToConfirm?.order_number || orderToConfirm?.id)
        )}
      />
    </div>
  );
}