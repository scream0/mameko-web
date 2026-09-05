// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth, db } from "@/lib/supabaseClient";
import styles from "./OrdersManagement.module.css";
import { Logo } from "@/components/UI/Logo/logo";
import AdminReturns from "./AdminReturns";
import AdminWithdrawals from "./AdminWithdrawals";
import adminOrdersConfig from "@/data/ui/adminOrdersConfig.json";

const money = (value: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const orderValue = (order: any) => Number(order.amount || order.total_amount || order.total || 0);

export default function OrdersManagement({ onOrderUpdate }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalOrders: 0 });
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [adminTab, setAdminTab] = useState('orders'); // 'orders', 'returns', 'withdrawals'
  const [shippingDraft, setShippingDraft] = useState({ courierName: "", serviceType: "", trackingNumber: "" });
  const [shippingMode, setShippingMode] = useState("auto"); // "auto" | "manual"
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState("processing");
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [printType, setPrintType] = useState("slip");
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);

  const fetchReturnsCount = async () => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/returns", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (data.returns) {
        const count = data.returns.filter((r: any) => r.status === 'return_requested' || r.status === 'pending').length;
        setPendingReturnsCount(count);
      }
    } catch (error) {
      console.error("Failed to fetch returns count", error);
    }
  };

  useEffect(() => {
    fetchReturnsCount();
  }, []);

  const getAddressStr = (addr: any) => {
    if (!addr) return "Alamat tidak tersedia";
    if (typeof addr === "string") return addr;
    if (addr.address) return addr.address;
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.province) parts.push(addr.province);
    if (addr.postalCode) parts.push(addr.postalCode);
    return parts.join(", ") || "Alamat tidak tersedia";
  };

  // Helper untuk mendapatkan token Supabase yang sedang aktif
  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  const loadOrders = async (targetPage = page, targetStatus = statusFilter, targetSearch = searchTerm) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(targetPage), limit: "10" });
      if (targetStatus && targetStatus !== "all") params.set("status", targetStatus);
      if (targetSearch.trim()) params.set("search", targetSearch.trim());

      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Unable to load orders");
      setOrders(data.orders || []);
      setPagination(data.pagination || { currentPage: 1, totalPages: 1, totalOrders: 0 });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders(1, statusFilter, searchTerm);

    const loadSettings = async () => {
      try {
        const { getPublicSettings } = await import("@/services/settingsService");
        const settings = await getPublicSettings();
        setStoreSettings(settings);
      } catch (e) {
        console.error("Failed to load settings in OrdersManagement", e);
      }
    };
    loadSettings();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    // Subscribe to realtime updates for ALL orders (Admin Dashboard)
    const channel = db.channel('admin-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('[Supabase Realtime Admin] Tabel orders berubah:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            
            // Update orders list in-place (Anti-DDOS)
            setOrders(prevOrders => prevOrders.map(o => 
              (o.id === updated.id || o.orderId === updated.id) 
                ? { 
                    ...o, 
                    status: updated.status, 
                    tracking_history: updated.tracking_history, 
                    status_history: updated.status_history,
                    waybill_id: updated.waybill_id || o.waybill_id,
                    shipping_receipt_number: updated.shipping_receipt_number || o.shipping_receipt_number,
                    courier_tracking_link: updated.courier_tracking_link || o.courier_tracking_link,
                    shipping_detail: updated.shipping_detail || o.shipping_detail
                  } 
                : o
            ));
            
            // Auto update drawer if activeOrder is the one changed
            setActiveOrder(prevActive => {
              if (prevActive && (prevActive.id === updated.id || prevActive.orderId === updated.id)) {
                const merged = { 
                  ...prevActive, 
                  ...updated,
                  tracking_history: updated.tracking_history || prevActive.tracking_history,
                  status_history: updated.status_history || prevActive.status_history,
                };
                
                // Also update shipping draft trackingNumber if empty or updated
                if (updated.waybill_id || updated.shipping_receipt_number) {
                  setShippingDraft(draft => ({
                    ...draft,
                    trackingNumber: updated.waybill_id || updated.shipping_receipt_number || draft.trackingNumber
                  }));
                }
                
                return merged;
              }
              return prevActive;
            });

            const orderLabel = updated.order_number || (updated.id ? updated.id.substring(0,8) : "");
            toast.success(`Riwayat pengiriman pesanan ${orderLabel} diperbarui secara realtime!`, { id: `rt-admin-track-${updated.id}` });
          } else {
            // For new order inserts, refresh current view
            loadOrders(page, statusFilter, searchTerm);
            fetchReturnsCount();
          }
          // Always refresh returns count on any order change (in case status changed to/from return_requested)
          if (payload.eventType === 'UPDATE') {
            fetchReturnsCount();
          }
        }

      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [page, statusFilter, searchTerm]);

  useEffect(() => {
    const currentOrderId = activeOrder?.id || activeOrder?.orderId;
    if (!currentOrderId) return;

    // Dedicated realtime subscription for the currently open order drawer
    const activeOrderChannel = db.channel(`admin-active-order-${currentOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${currentOrderId}`
        },
        (payload) => {
          console.log('[Supabase Realtime Admin Active Order] Perubahan:', payload);
          if (payload.new) {
            const updated = payload.new;
            setActiveOrder(prev => ({
              ...prev,
              ...updated,
              tracking_history: updated.tracking_history || prev?.tracking_history || [],
              status_history: updated.status_history || prev?.status_history || [],
              waybill_id: updated.waybill_id || prev?.waybill_id,
              shipping_receipt_number: updated.shipping_receipt_number || prev?.shipping_receipt_number,
              courier_tracking_link: updated.courier_tracking_link || prev?.courier_tracking_link,
              shipping_detail: updated.shipping_detail || prev?.shipping_detail,
            }));

            if (updated.waybill_id || updated.shipping_receipt_number) {
              setShippingDraft(draft => ({
                ...draft,
                trackingNumber: updated.waybill_id || updated.shipping_receipt_number || draft.trackingNumber
              }));
            }

            toast.success("Riwayat pengiriman pesanan aktif diperbarui realtime!", { id: `rt-active-${currentOrderId}` });
          }
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(activeOrderChannel);
    };
  }, [activeOrder?.id, activeOrder?.orderId]);

  const handleSearch = (event: any) => {
    event.preventDefault();
    loadOrders(1, statusFilter, searchTerm);
    setPage(1);
  };

  const openOrderDetails = async (order: any) => {
    try {
      const orderId = order.id || order.orderId;
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});

      const activeData = (res.ok && data.order) ? data.order : order;
      setActiveOrder(activeData);

      const shippingInfo = data.shipping || activeData.shipping_detail || activeData.shippingDetail || activeData.shipping_details?.[0] || {};
      
      const resiValue =
        activeData.waybill_id ||
        activeData.shipping_receipt_number ||
        shippingInfo.tracking_number ||
        shippingInfo.trackingNumber ||
        shippingInfo.waybill_id ||
        activeData.waybillId ||
        activeData.shippingReceiptNumber ||
        "";

      const courierVal =
        shippingInfo.courier_name ||
        shippingInfo.courierName ||
        activeData.courier_name ||
        activeData.courier ||
        "";

      const serviceVal =
        shippingInfo.service_type ||
        shippingInfo.serviceType ||
        activeData.courier_service ||
        "";

      setShippingDraft({
        courierName: courierVal,
        serviceType: serviceVal,
        trackingNumber: resiValue,
      });

      if (activeData.biteship_order_id || (activeData.waybill_id && !activeData.shipping_receipt_number)) {
        setShippingMode("auto");
      } else if (activeData.shipping_receipt_number) {
        setShippingMode("manual");
      } else {
        setShippingMode(storeSettings?.biteshipAutoOrder ? "auto" : "manual");
      }
    } catch (e) {
      setActiveOrder(order);
      const shippingInfo = order.shipping_detail || order.shippingDetail || {};
      const resiValue = order.waybill_id || order.shipping_receipt_number || shippingInfo.tracking_number || shippingInfo.trackingNumber || "";
      setShippingDraft({
        courierName: shippingInfo.courier_name || order.courier_name || "",
        serviceType: shippingInfo.service_type || order.courier_service || "",
        trackingNumber: resiValue,
      });
    }
  };

  const updateOrderStatusAdmin = async (orderId: any, targetStatus, note: any) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          status: targetStatus,
          notes: note || `Status diubah menjadi ${targetStatus} oleh admin`,
        }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");

      toast.success(`Status pesanan berhasil diubah menjadi ${targetStatus}.`);
      
      setOrders((items) => items.map((item) => {
        if (item.id === orderId || item.orderId === orderId) {
          return { ...item, status: targetStatus };
        }
        return item;
      }));

      if (activeOrder && (activeOrder.id === orderId || activeOrder.orderId === orderId)) {
        setActiveOrder((prev) => ({ ...prev, status: targetStatus }));
      }

      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Gagal mengubah status pesanan.");
    } finally {
      setUpdatingId(null);
    }
  };

  const saveShipping = async (order: any) => {
    const orderId = order.id || order.orderId;
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/shipping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          courierName: shippingDraft.courierName,
          serviceType: shippingDraft.serviceType,
          trackingNumber: shippingDraft.trackingNumber,
          shippingAddress: order.shipping_address || order.shippingAddress || null,
          recipientName: order.customerName || order.customer_name || null,
          phoneNumber: order.customerPhone || order.customer_phone || order.phone || null,
          status: "shipped",
        }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan informasi pengiriman");
      const updatedOrderData = { 
        ...order, 
        status: "shipped", 
        waybill_id: shippingDraft.trackingNumber || order.waybill_id || null,
        shipping_receipt_number: shippingDraft.trackingNumber || order.shipping_receipt_number || null,
        courier_name: shippingDraft.courierName || order.courier_name || null,
        courier_service: shippingDraft.serviceType || order.courier_service || null,
        shipping_detail: { 
          ...(order.shipping_detail || order.shippingDetail || {}), 
          courier_name: shippingDraft.courierName || null, 
          service_type: shippingDraft.serviceType || null, 
          tracking_number: shippingDraft.trackingNumber || null 
        } 
      };
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? updatedOrderData : item)));
      setActiveOrder(updatedOrderData);
      toast.success("Informasi pengiriman berhasil disimpan.");
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to save shipping info.");
    } finally {
      setUpdatingId(null);
    }
  };

  const requestBiteshipPickup = async (orderId: any) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/biteship/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ orderId }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal request pickup Biteship");
      
      toast.success(data.message || "Pickup berhasil di-request dan resi telah keluar.");
      
      // Update local state
      const bID = data.data?.biteshipOrderId || data.id || data.biteship_order_id || "";
      const waybill = data.data?.waybillId || data.waybill_id || data.tracking_number || "";
      const trackLink = data.data?.trackingLink || data.courier_tracking_link || "";

      const updatedOrderData = {
        ...activeOrder,
        status: "shipped",
        biteship_order_id: bID,
        waybill_id: waybill,
        courier_tracking_link: trackLink,
        shipping_detail: {
          ...(activeOrder.shipping_detail || {}),
          tracking_number: waybill,
        }
      };
      
      setShippingDraft((prev) => ({
        ...prev,
        trackingNumber: waybill
      }));

      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? updatedOrderData : item)));
      setActiveOrder(updatedOrderData);
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to request pickup.");
    } finally {
      setUpdatingId(null);
    }
  };

  const syncMidtransStatus = async (orderId: any) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/sync`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal sinkronisasi status pembayaran");
      
      toast.success(data.message || "Status Midtrans berhasil di-sinkron.");
      
      // Update local state by forcing a reload to get fresh data
      loadOrders(page, statusFilter, searchTerm);
      
      // Attempt to immediately update modal
      if (data.status && activeOrder) {
        const updatedOrderData = {
          ...activeOrder,
          status: data.status
        };
        setActiveOrder(updatedOrderData);
      }
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to sync payment status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const syncBiteshipStatus = async (orderId: any) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/tracking/sync`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal sinkronisasi status");
      
      toast.success(data.message || "Status berhasil disinkronkan.");
      
      const newStatus = data.data?.status || data.status || activeOrder?.status || "shipped";
      const newTrackingHistory = data.data?.trackingHistory || data.data?.tracking_history || activeOrder?.tracking_history || [];
      const newStatusHistory = data.data?.statusHistory || data.data?.status_history || activeOrder?.status_history || [];
      const newWaybill = data.data?.waybillId || activeOrder?.waybill_id || "";

      // Update local state
      const updatedOrderData = {
        ...activeOrder,
        status: newStatus,
        tracking_history: newTrackingHistory,
        status_history: newStatusHistory,
        waybill_id: newWaybill || activeOrder?.waybill_id,
        shipping_detail: {
          ...(activeOrder?.shipping_detail || {}),
          tracking_number: newWaybill || activeOrder?.shipping_detail?.tracking_number,
        }
      };
      
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? updatedOrderData : item)));
      setActiveOrder(updatedOrderData);
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to sync status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleOrderSelection = (orderId: any) => {
    setSelectedOrders((items) => (items.includes(orderId) ? items.filter((item) => item !== orderId) : [...items, orderId]));
  };

  const openPrintView = (type: any) => {
    if (!selectedOrders.length) {
      toast.error("Pilih setidaknya satu pesanan untuk mencetak.");
      return;
    }

    setPrintType(type);
    const printItems = orders.filter((order) => selectedOrders.includes(order.id || order.orderId));
    setPrintOrders(printItems);
  };

  const applyBulkStatus = async () => {
    if (!selectedOrders.length) {
      toast.error("Pilih setidaknya satu pesanan terlebih dahulu.");
      return;
    }

    setBulkUpdating(true);
    const toastId = toast.loading("Memperbarui status pesanan terpilih...");

    try {
      const token = await getSupabaseToken();
      const promises = selectedOrders.map(async (orderId) => {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ status: bulkStatus, changedBy: "admin" }),
        });
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");
        return orderId;
      });

      await Promise.all(promises);
      setOrders((items) => items.map((item) => {
        const orderId = item.id || item.orderId;
        return selectedOrders.includes(orderId) ? { ...item, status: bulkStatus } : item;
      }));
      setSelectedOrders([]);
      toast.success("Status pesanan massal berhasil diperbarui.", { id: toastId });
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update selected orders.", { id: toastId });
    } finally {
      setBulkUpdating(false);
    }
  };

  const updateStatus = async (orderId: any, nextStatus: any) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ status: nextStatus, changedBy: "admin" }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? { ...item, status: nextStatus } : item)));
      toast.success("Status pesanan berhasil diperbarui.");
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const [runningAutomation, setRunningAutomation] = useState(false);

  const handleRunAutomation = async () => {
    try {
      setRunningAutomation(true);
      const token = await getSupabaseToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/orders/run-automation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Otomasi pesanan berhasil dijalankan!");
        loadOrders();
      } else {
        toast.error(data.error || "Gagal menjalankan otomasi pesanan.");
      }
    } catch (err) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setRunningAutomation(false);
    }
  };

  return (
    <section className={styles.wrapper}>
      <div className={`${styles.header} ${styles.headerTop}`}>
        <div>
          <p className={styles.eyebrow}>{adminOrdersConfig.header.eyebrow}</p>
          <h2 className={styles.title}>{adminOrdersConfig.header.title}</h2>
        </div>
        <button
          onClick={handleRunAutomation}
          disabled={runningAutomation}
          className={styles.automationBtn}
          title={adminOrdersConfig.automation.title}
        >
          <span>{runningAutomation ? adminOrdersConfig.automation.processing : adminOrdersConfig.automation.label}</span>
        </button>
      </div>
      
      <div className={styles.adminTabs}>
        <button 
          className={`${styles.tabBtn} ${adminTab === 'orders' ? styles.activeTab : ''}`}
          onClick={() => setAdminTab('orders')}
        >
          {adminOrdersConfig.tabs.orders}
        </button>
        <button 
          className={`${styles.tabBtn} ${adminTab === 'returns' ? styles.activeTab : ''} ${styles.tabBtnRelative}`}
          onClick={() => setAdminTab('returns')}
        >
          {adminOrdersConfig.tabs.returns}
          {pendingReturnsCount > 0 && (
            <span className={styles.tabBadge}>{pendingReturnsCount}</span>
          )}
        </button>
        <button 
          className={`${styles.tabBtn} ${adminTab === 'withdrawals' ? styles.activeTab : ''}`}
          onClick={() => setAdminTab('withdrawals')}
        >
          {adminOrdersConfig.tabs.withdrawals}
        </button>
      </div>

      {adminTab === 'orders' && (
        <>
          <div className={styles.controls}>
            <form onSubmit={handleSearch} className={styles.searchForm}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={adminOrdersConfig.search.placeholder}
                aria-label="Search orders"
              />
              <button className={styles.searchButton} type="submit">{adminOrdersConfig.search.button}</button>
            </form>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={styles.filterSelect}>
              {(adminOrdersConfig?.statusOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button className={styles.refreshButton} onClick={() => loadOrders(page, statusFilter, searchTerm)}>
              {adminOrdersConfig?.search?.refresh || "Segarkan"}
            </button>
          </div>

      <div className={styles.summaryBar}>
        <span>{pagination.totalOrders} {adminOrdersConfig?.summary?.ordersCount || "pesanan"}</span>
        <span>{adminOrdersConfig?.summary?.pagePrefix || "Halaman"} {pagination.currentPage} {adminOrdersConfig?.summary?.pageMiddle || "dari"} {pagination.totalPages}</span>
      </div>

      <div className={styles.bulkBar}>
        <label className={styles.bulkLabel}>
          <input type="checkbox" checked={selectedOrders.length > 0 && selectedOrders.length === orders.length} onChange={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((order) => order.id || order.orderId))} />
          {adminOrdersConfig?.bulk?.selectAll || "Pilih semua"}
        </label>
        <select className={styles.statusSelect} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
          {(adminOrdersConfig?.statusOptions || []).filter((o) => o.value !== "all").map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button className={styles.refreshButton} onClick={applyBulkStatus} disabled={!selectedOrders.length || bulkUpdating}>
          {bulkUpdating ? (adminOrdersConfig?.bulk?.updating || "Memperbarui...") : (adminOrdersConfig?.bulk?.apply || "Terapkan status massal")}
        </button>
        <button className={styles.secondaryButton} onClick={() => openPrintView("slip")} disabled={!selectedOrders.length}>{adminOrdersConfig?.bulk?.printSlip || "Cetak Slip Pengiriman"}</button>
        <button className={styles.secondaryButton} onClick={() => openPrintView("invoice")} disabled={!selectedOrders.length}>{adminOrdersConfig?.bulk?.printInvoice || "Cetak Faktur"}</button>
      </div>

      {loading ? (
        <p className={styles.empty}>{adminOrdersConfig.empty.loading}</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>{adminOrdersConfig.empty.noOrders}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selectedOrders.length > 0 && selectedOrders.length === orders.length} onChange={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((order) => order.id || order.orderId))} /></th>
                <th>{adminOrdersConfig.tableHeaders.order}</th>
                <th>{adminOrdersConfig.tableHeaders.customer}</th>
                <th>{adminOrdersConfig.tableHeaders.total}</th>
                <th>{adminOrdersConfig.tableHeaders.status}</th>
                <th>{adminOrdersConfig.tableHeaders.shipping}</th>
                <th>{adminOrdersConfig.tableHeaders.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shipping_detail || order.shippingDetail || order.shipping_details?.[0] || {};
                return (
                  <tr key={orderId}>
                    <td>
                      <input type="checkbox" checked={selectedOrders.includes(orderId)} onChange={() => toggleOrderSelection(orderId)} />
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <button className={styles.linkButton} onClick={() => openOrderDetails(order)}>
                          <strong>
                            {order.order_number || order.orderId || orderId}
                            {["verifying", "pending", "paid"].includes(order.status) && <span className={styles.actionDot} title="Menunggu Proses / Konfirmasi"></span>}
                          </strong>
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <strong>{order.customer_name || order.shipping_address?.recipientName || "Pelanggan"}</strong>
                        <small>{order.customer_email || adminOrdersConfig.drawer.customerInfo.noEmail}</small>
                      </div>
                    </td>
                    <td>{money(orderValue(order))}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={order.status || "pending"}
                        onChange={(event) => updateOrderStatusAdmin(orderId, event.target.value)}
                        disabled={updatingId === orderId || bulkUpdating}
                      >
                        {(adminOrdersConfig?.statusOptions || []).filter((o) => o.value !== "all").map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <strong>{shippingInfo.courier_name || shippingInfo.courierName || order.courier_name || order.courier || "—"}</strong>
                        <small>{order.waybill_id || shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || adminOrdersConfig.drawer.shipping.noWaybill}</small>
                      </div>
                    </td>
                    <td>{new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => { const nextPage = page - 1; setPage(nextPage); loadOrders(nextPage, statusFilter, searchTerm); }}>
          {adminOrdersConfig.pagination.previous}
        </button>
        <span>{adminOrdersConfig.pagination.page} {page}</span>
        <button disabled={page >= pagination.totalPages} onClick={() => { const nextPage = page + 1; setPage(nextPage); loadOrders(nextPage, statusFilter, searchTerm); }}>
          {adminOrdersConfig.pagination.next}
        </button>
      </div>

      {printOrders.length > 0 && (
        <div className={styles.drawerBackdrop} onClick={() => setPrintOrders([])}>
          <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>{adminOrdersConfig.print.eyebrow}</p>
                <h3>{printType === "slip" ? adminOrdersConfig.print.slipTitle : adminOrdersConfig.print.invoiceTitle}</h3>
              </div>
              <div className={styles.printHeaderActions}>
                <button className={styles.refreshButton} onClick={() => window.print()}>{adminOrdersConfig.print.printBtn}</button>
                <button className={styles.closeButton} onClick={() => setPrintOrders([])}>{adminOrdersConfig.print.closeBtn}</button>
              </div>
            </div>
            <div className={styles.printPreview}>
              {printOrders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shipping_detail || order.shippingDetail || order.shipping_details?.[0] || {};
                const alamat = order.shipping_address || order.shippingAddress;
                
                return (
                  <div key={orderId} className={styles.printCard}>
                    <div className={styles.printBrand}>
                      <div className={styles.printBrandLogo}>
                        <Logo />
                      </div>
                      <h1 className={styles.printBrandTitle}>make me kool</h1>
                    </div>
                    {printType === "invoice" ? (
                      <div className={styles.printContainerRelative}>
                        {["paid", "processing", "shipped", "delivered"].includes(order.status) && (
                          <div className={styles.invoicePaidStamp}>
                            {adminOrdersConfig.print.paidStamp}
                          </div>
                        )}
                        <div className={styles.printHeader}>
                          <div>
                            <strong>{adminOrdersConfig.print.invoiceHeading}</strong>
                            <p className={styles.printOrderNumber}>No. Pesanan: {order.order_number || order.orderId || orderId}</p>
                            <p>Tanggal: {new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID")}</p>
                          </div>
                          <div className={`${styles.printMeta} ${styles.printMetaRight}`}>
                            <strong>{adminOrdersConfig.print.billedTo}</strong>
                            <p>{order.customer_name || alamat?.recipientName || "Pelanggan"}</p>
                            <p>{order.customer_email || "-"}</p>
                            <p>{alamat?.phone || order.customerPhone || order.customer_phone || order.phone || "-"}</p>
                          </div>
                        </div>
                        <div className={`${styles.printBody} ${styles.printBodyWrap}`}>
                          <p><b>{adminOrdersConfig.print.shippingAddress}</b> {getAddressStr(alamat)}</p>
                          <p><b>{adminOrdersConfig.print.paymentMethod}</b> {order.payment_method || order.paymentMethod || "Transfer / VA"}</p>
                        </div>
                        <table className={styles.printTable}>
                          <thead>
                            <tr className={styles.printTableHeaderRow}>
                              <th className={styles.printTableThLeft}>{adminOrdersConfig.print.table.product}</th>
                              <th className={styles.printTableThCenter}>{adminOrdersConfig.print.table.qty}</th>
                              <th className={styles.printTableThRight}>{adminOrdersConfig.print.table.unitPrice}</th>
                              <th className={styles.printTableThRight}>{adminOrdersConfig.print.table.total}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(order.items || []).map((item, index: any) => {
                              const itemPrice = Number(item.price_at_purchase || item.price) || 0;
                              const itemQty = Number(item.quantity || item.qty) || 1;
                              return (
                                <tr key={`${item.name}-${index}`} className={styles.printTableRow}>
                                  <td className={styles.printTableTdItem}>{item.name || item.product_name || "Produk"} {item.variant_name || item.size ? `(${item.variant_name || item.size})` : ""}</td>
                                  <td className={styles.printTableTdCenter}>{itemQty}</td>
                                  <td className={styles.printTableTdRight}>{money(itemPrice)}</td>
                                  <td className={styles.printTableTdRight}>{money(itemPrice * itemQty)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className={styles.printBillSummaryWrap}>
                          <div className={styles.printBillSummaryBox}>
                            {(() => {
                              const subtotal = (order.items || []).reduce((sum, item: any) => sum + (Number(item.price_at_purchase || item.price) || 0) * (Number(item.quantity || item.qty) || 1), 0) || orderValue(order);
                              const grandTotal = orderValue(order);
                              const discount = Number(order.discount_amount || 0);
                              let shipping = Number(order.shipping_cost || order.shipping_fee || order.shippingFee || 0);
                              
                              if (shipping === 0 && grandTotal > (subtotal - discount)) {
                                shipping = grandTotal - subtotal + discount;
                              }

                              return (
                                <>
                                  <div className={styles.printBillRow}>
                                    <span>{adminOrdersConfig.print.summary.subtotal}</span>
                                    <strong>{money(subtotal)}</strong>
                                  </div>
                                  <div className={styles.printBillRow}>
                                    <span>{adminOrdersConfig.print.summary.shipping}</span>
                                    <strong>{money(shipping)}</strong>
                                  </div>
                                  {discount > 0 && (
                                    <div className={styles.printBillDiscountRow}>
                                      <span>{adminOrdersConfig.print.summary.discount}</span>
                                      <strong>-{money(discount)}</strong>
                                    </div>
                                  )}
                                  <div className={styles.printBillTotalRow}>
                                    <strong>{adminOrdersConfig.print.summary.grandTotal}</strong>
                                    <strong>{money(grandTotal)}</strong>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.printHeader}>
                          <div>
                            <strong>{order.order_number || order.orderId || orderId}</strong>
                            <p>{order.customer_name || alamat?.recipientName || "Pelanggan"}</p>
                          </div>
                          <div className={styles.printMeta}>
                            <span>{new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID")}</span>
                          </div>
                        </div>
                        <div className={styles.printBody}>
                          <p><b>{adminOrdersConfig.print.recipient}</b> {alamat?.recipientName || order.customer_name || "Pelanggan"}</p>
                          <p><b>{adminOrdersConfig.print.phone}</b> {alamat?.phone || order.customerPhone || order.customer_phone || order.phone || "-"}</p>
                          <p><b>{adminOrdersConfig.print.address}</b> {getAddressStr(alamat)}</p>
                          <p><b>{adminOrdersConfig.print.courier}</b> {shippingInfo.courier_name || shippingInfo.courierName || order.courier_name || order.courier || "—"} ({shippingInfo.service_type || shippingInfo.serviceType || order.courier_service || "-"})</p>
                          <p><b>{adminOrdersConfig.print.waybill}</b> {order.waybill_id || shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || adminOrdersConfig.drawer.shipping.noWaybill}</p>
                        </div>
                        <div className={styles.printItems}>
                          {(order.items || []).map((item, index: any) => (
                            <div key={`${item.name}-${index}`} className={styles.itemRow}>
                              <span>{item.name || item.product_name || "Produk"} {item.variant_name || item.size ? `(${item.variant_name || item.size})` : ""}</span>
                              <strong>{item.quantity || item.qty || 1} pcs</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeOrder && (() => {
        const orderStatus = String(activeOrder.status || "pending").toLowerCase();
        const isPaidOrProcessing = ["paid", "capture", "settlement", "processing", "shipped", "delivered", "completed"].includes(orderStatus);
        const isPending = ["pending", "unpaid"].includes(orderStatus);
        const isVerifying = orderStatus === "verifying";
        const isCancelled = ["cancelled", "canceled"].includes(orderStatus);
        
        const rawMethod = String(
          activeOrder.payment_method ||
          activeOrder.payment_type ||
          activeOrder.paymentMethod ||
          activeOrder.paymentType ||
          activeOrder.shipping_detail?.payment_method ||
          activeOrder.shippingDetail?.paymentMethod ||
          ""
        ).toLowerCase().trim();

        const hasPaymentProof = Boolean(
          activeOrder.shipping_detail?.payment_proof_url ||
          activeOrder.shippingDetail?.payment_proof_url ||
          activeOrder.payment_proof_url
        );

        // Deteksi dinamis: Transfer Manual hanya jika payment method secara spesifik adalah 'manual'
        const isManualPayment = rawMethod === "manual";

        const isMidtransGateway = !isManualPayment;

        const chosenCourier =
          activeOrder.courier_name ||
          activeOrder.courier ||
          activeOrder.shipping_detail?.courier_name ||
          activeOrder.shippingDetail?.courierName ||
          "";
        const chosenService =
          activeOrder.courier_service ||
          activeOrder.shipping_detail?.service_type ||
          activeOrder.shippingDetail?.serviceType ||
          "";
        const shippingCost =
          activeOrder.shipping_cost ||
          activeOrder.shippingCost ||
          activeOrder.shipping_detail?.shipping_cost ||
          activeOrder.shippingDetail?.shippingCost ||
          0;

        return (
        <div className={styles.drawerBackdrop} onClick={() => setActiveOrder(null)}>
          <div className={`${styles.drawer} ${styles.orderDrawer}`} onClick={(event) => event.stopPropagation()}>
            {/* 1. DRAWER HEADER */}
            <div className={`${styles.drawerHeader} ${styles.orderDrawerHeader}`}>
              <div>
                <p className={`${styles.eyebrow} ${styles.orderDrawerEyebrow}`}>
                  {adminOrdersConfig.drawer.eyebrow}
                </p>
                <h3 className={styles.orderDrawerTitle}>
                  {activeOrder.order_number || activeOrder.orderId || activeOrder.id}
                </h3>
                <span className={styles.orderDrawerDate}>
                  {new Date(activeOrder.createdAt || activeOrder.created_at || Date.now()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <button className={styles.closeButton} onClick={() => setActiveOrder(null)}>✕</button>
            </div>

            {/* 2. PROMINENT STATUS BAR */}
            <div className={styles.statusBanner}>
              <div>
                <span className={styles.statusBannerLabel}>{adminOrdersConfig.drawer.statusLabel}</span>
                <strong className={`${styles.statusBannerValue} ${
                  isCancelled ? styles.statusBannerCancelled : (orderStatus === "delivered" || isPaidOrProcessing ? styles.statusBannerSuccess : (orderStatus === "shipped" ? styles.statusBannerShipped : styles.statusBannerDefault))
                }`}>
                  {isCancelled && adminOrdersConfig.drawer.statusTexts.cancelled}
                  {isVerifying && adminOrdersConfig.drawer.statusTexts.verifying}
                  {isPending && adminOrdersConfig.drawer.statusTexts.pending}
                  {["paid", "processing"].includes(orderStatus) && adminOrdersConfig.drawer.statusTexts.paid}
                  {orderStatus === "shipped" && adminOrdersConfig.drawer.statusTexts.shipped}
                  {orderStatus === "delivered" && adminOrdersConfig.drawer.statusTexts.delivered}
                  {!["cancelled", "verifying", "pending", "paid", "processing", "shipped", "delivered"].includes(orderStatus) && activeOrder.status}
                </strong>
              </div>
            </div>

            {/* 3. CONTEXTUAL E-COMMERCE ACTION BOX */}
            <div className={styles.actionBox}>
              <h4 className={styles.actionBoxHeader}>
                <span>⚡</span> {adminOrdersConfig.drawer.operationalActions}
              </h4>

              {/* TAHAP A: BELUM BAYAR / VERIFIKASI */}
              {(isPending || isVerifying) && (
                <div>
                  {isManualPayment ? (
                    <>
                      <p className={styles.actionBoxDesc}>
                        {adminOrdersConfig.drawer.verification.manualTransferDesc}
                      </p>
                      <div className={styles.actionButtonRow}>
                        <button
                          type="button"
                          onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "paid", "Pembayaran dikonfirmasi lunas oleh admin")}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId) || isPending}
                          className={`${styles.btnActionSuccess} ${isPending ? styles.btnActionDisabled : ''}`}
                          title={isPending ? "Menunggu pembeli mengunggah bukti transfer" : ""}
                        >
                          {adminOrdersConfig.drawer.verification.confirmPaid}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "cancelled", "Pesanan dibatalkan oleh admin")}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                          className={styles.btnActionDanger}
                        >
                          {adminOrdersConfig.drawer.verification.cancelOrder}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={styles.actionBoxDesc}>
                        {adminOrdersConfig.drawer.verification.midtransDesc}
                      </p>
                      <div className={styles.actionButtonRow}>
                        <button
                          type="button"
                          onClick={() => syncMidtransStatus(activeOrder.id || activeOrder.orderId)}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                          className={`${styles.btnActionOutline} ${styles.btnActionBlue}`}
                        >
                          {updatingId === (activeOrder.id || activeOrder.orderId) ? "Loading..." : adminOrdersConfig.drawer.verification.checkMidtrans}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "cancelled", "Pesanan dibatalkan oleh admin")}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                          className={styles.btnActionDanger}
                        >
                          {adminOrdersConfig.drawer.verification.cancelOrder}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAHAP B: PERLU DIKIRIM (LUNAS / PROCESSING) */}
              {["paid", "processing"].includes(orderStatus) && (
                <div>
                  <p className={styles.actionBoxDesc}>
                    {adminOrdersConfig.drawer.shipping.title}
                  </p>

                  <div className={styles.actionGrid}>
                    {/* Opsi 1: Biteship Auto Pickup */}
                    {storeSettings?.biteshipAutoOrder && (
                      <div className={`${styles.actionOptionCard} ${styles.actionOptionFlex}`}>
                        <div>
                          <strong className={styles.actionOptionTitle}>{adminOrdersConfig.drawer.shipping.option1Title}</strong>
                          <span className={styles.actionOptionSub}>{adminOrdersConfig.drawer.shipping.option1Desc}</span>
                        </div>
                        <button
                          type="button"
                          className={styles.btnActionPrimary}
                          onClick={() => requestBiteshipPickup(activeOrder.id || activeOrder.orderId)}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId) || Boolean(activeOrder.biteship_order_id)}
                        >
                          {updatingId === (activeOrder.id || activeOrder.orderId) ? "Memproses..." : adminOrdersConfig.drawer.shipping.requestPickupBtn}
                        </button>
                      </div>
                    )}

                    {/* Opsi 2: Drop Outlet / Resi Manual */}
                    <div className={styles.actionOptionCard}>
                      <strong className={styles.actionOptionTitleBlock}>
                        {storeSettings?.biteshipAutoOrder ? adminOrdersConfig.drawer.shipping.option2TitleAuto : adminOrdersConfig.drawer.shipping.option2TitleManual}
                      </strong>
                      <span className={styles.actionOptionDescBlock}>
                        {storeSettings?.biteshipAutoOrder 
                          ? adminOrdersConfig.drawer.shipping.option2DescAuto 
                          : adminOrdersConfig.drawer.shipping.option2DescManual}
                      </span>
                      <div className={styles.shippingInputRow}>
                        <input
                          value={shippingDraft.trackingNumber}
                          onChange={(e) => setShippingDraft(prev => ({ ...prev, trackingNumber: e.target.value }))}
                          placeholder={adminOrdersConfig.drawer.shipping.resiPlaceholder}
                          className={`${styles.drawerInput} ${styles.shippingInputFlex}`}
                        />
                        <button
                          type="button"
                          className={styles.btnActionSuccess}
                          onClick={() => saveShipping(activeOrder)}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId) || !shippingDraft.trackingNumber?.trim()}
                        >
                          {updatingId === (activeOrder.id || activeOrder.orderId) ? "Menyimpan..." : adminOrdersConfig.drawer.shipping.sendBtn}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAHAP C: SEDANG DIKIRIM (SHIPPED) */}
              {orderStatus === "shipped" && (
                <div>
                  <div className={`${styles.actionOptionCard} ${styles.trackingCardRow}`}>
                    <div>
                      <span className={styles.trackingLabel}>{adminOrdersConfig.drawer.shipping.waybillLabel}</span>
                      <strong className={styles.trackingNumber}>{activeOrder.waybill_id || activeOrder.shipping_receipt_number || shippingDraft.trackingNumber || adminOrdersConfig.drawer.shipping.noWaybill}</strong>
                    </div>
                    {activeOrder.courier_tracking_link && (
                      <a
                        href={activeOrder.courier_tracking_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.trackingLink}
                      >
                        {adminOrdersConfig.drawer.shipping.trackPackage}
                      </a>
                    )}
                  </div>
                  <div className={styles.actionButtonRow}>
                    {activeOrder.biteship_order_id && (
                      <button
                        type="button"
                        className={styles.btnActionOutline}
                        onClick={() => syncBiteshipStatus(activeOrder.id || activeOrder.orderId)}
                        disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                      >
                        {updatingId === (activeOrder.id || activeOrder.orderId) ? "Menyinkronkan..." : adminOrdersConfig.drawer.shipping.syncCourier}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.btnActionSuccess}
                      onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "delivered", "Pesanan ditandai selesai oleh admin")}
                      disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                    >
                      {adminOrdersConfig.drawer.shipping.markDelivered}
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP D: FINAL (DELIVERED / CANCELLED) */}
              {["delivered", "cancelled", "returned"].includes(orderStatus) && (
                <p className={`${styles.actionBoxDesc} ${styles.actionBoxDescMuted}`}>
                  Pesanan telah berada pada status final ({orderStatus === "delivered" ? "Selesai" : "Dibatalkan"}). Tidak diperlukan tindakan operasional lebih lanjut.
                </p>
              )}
            </div>

            {/* 4. INFORMASI PENGIRIMAN & ALAMAT */}
            <div className={`${styles.drawerCard} ${styles.drawerCardMargin}`}>
              <div className={styles.drawerCardHeaderFlex}>
                <h4 className={styles.drawerCardH4}>{adminOrdersConfig.drawer.customerInfo.heading}</h4>
                <span className={styles.courierBadge}>
                  {(chosenCourier || "Kurir").toUpperCase()} {chosenService ? `(${chosenService})` : ""}
                </span>
              </div>
              <p className={styles.customerName}>{activeOrder.customer_name || "Pelanggan"}</p>
              <p className={styles.customerContact}>
                {activeOrder.customer_phone ? `📞 ${activeOrder.customer_phone} • ` : ""}{activeOrder.customer_email || adminOrdersConfig.drawer.customerInfo.noEmail}
              </p>
              {(activeOrder.shipping_address || activeOrder.shippingAddress) && (
                <div className={styles.addressBox}>
                  📍 {getAddressStr(activeOrder.shipping_address || activeOrder.shippingAddress)}
                </div>
              )}
            </div>

            {/* 5. RINCIAN PRODUK & PEMBAYARAN */}
            <div className={styles.drawerCard}>
              <h4 className={styles.drawerH4Bottom}>{adminOrdersConfig.drawer.items.heading}</h4>
              
              {/* Item List */}
              {activeOrder.items && activeOrder.items.length > 0 && (
                <div className={styles.drawerItemList}>
                  {activeOrder.items.map((item, index: any) => (
                    <div key={`${item.name}-${index}`} className={`${styles.itemRow} ${styles.drawerItemRow}`}>
                      <span className={styles.itemTextPrimary}>{item.name || item.product_name || "Produk"} {item.variant_name ? `(${item.variant_name})` : ""}</span>
                      <strong className={styles.itemTextPrimary}>{item.quantity || item.qty || 1} × {money(item.price || item.price_at_purchase || 0)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Rincian Biaya */}
              <div className={styles.costBreakdown}>
                <div className={styles.costRowSecondary}>
                  <span>{adminOrdersConfig.drawer.items.shippingCost}:</span>
                  <span className={styles.itemTextPrimary}>{shippingCost > 0 ? money(shippingCost) : adminOrdersConfig.drawer.items.freeShipping}</span>
                </div>
                {activeOrder.discount_amount > 0 && (
                  <div className={styles.costRowDiscount}>
                    <span>{adminOrdersConfig.drawer.items.discount}:</span>
                    <span>- {money(activeOrder.discount_amount)}</span>
                  </div>
                )}
                <div className={styles.costRowGrandTotal}>
                  <span>{adminOrdersConfig.drawer.items.totalPayment}:</span>
                  <span className={styles.itemTextPrimary}>{money(orderValue(activeOrder))}</span>
                </div>
                <div className={styles.paymentMethodRow}>
                  <span>{adminOrdersConfig.drawer.items.method}: <strong className={styles.itemTextPrimary}>{isManualPayment ? adminOrdersConfig.drawer.items.manualTransferMethod : (activeOrder.payment_method || activeOrder.payment_type || adminOrdersConfig.drawer.items.midtransMethod)}</strong></span>
                  {hasPaymentProof && (
                    <a
                      href={activeOrder.shipping_detail?.payment_proof_url || activeOrder.shippingDetail?.payment_proof_url || activeOrder.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btnActionOutline} ${styles.paymentProofLink}`}
                    >
                      {adminOrdersConfig.drawer.items.viewReceipt}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* 6. RIWAYAT LOG STATUS / TRACKING */}
            {(() => {
              if (!activeOrder) return null;
              const history = [];

              if (activeOrder.status_history && Array.isArray(activeOrder.status_history)) {
                activeOrder.status_history.forEach((sh, index: any) => {
                  const changedAt = sh.created_at || sh.createdAt || sh.timestamp || sh.updated_at || new Date().toISOString();
                  history.push({
                    key: `status-${changedAt}-${index}`,
                    timestamp: new Date(changedAt).getTime(),
                    timestampStr: new Date(changedAt).toLocaleString("id-ID"),
                    label: sh.status,
                    note: sh.note || sh.notes || adminOrdersConfig.drawer.history.systemUpdate,
                    isWebhook: false
                  });
                });
              }

              if (activeOrder.tracking_history && Array.isArray(activeOrder.tracking_history)) {
                activeOrder.tracking_history.forEach((th, index: any) => {
                  const changedAt = th.timestamp || th.updated_at || th.created_at || new Date().toISOString();
                  history.push({
                    key: `track-${changedAt}-${index}`,
                    timestamp: new Date(changedAt).getTime(),
                    timestampStr: new Date(changedAt).toLocaleString("id-ID"),
                    label: th.status || th.event || "Update Kurir",
                    note: th.note || th.details?.history?.[0]?.note || adminOrdersConfig.drawer.history.courierUpdate,
                    isWebhook: true
                  });
                });
              }

              history.sort((a, b) => b.timestamp - a.timestamp);

              if (history.length === 0) return null;

              return (
                <div className={`${styles.drawerCard} ${styles.timelineCardTop}`}>
                  <h4 className={styles.drawerH4Bottom}>{adminOrdersConfig.drawer.history.heading}</h4>
                  <div className={styles.timeline}>
                    {history.map((item) => (
                      <div key={item.key} className={styles.timelineItem}>
                        <div className={styles.timelineMarker}>
                          <span 
                            className={`${styles.timelineDot} ${item.isWebhook ? styles.timelineDotWebhook : ''}`} 
                          />
                        </div>
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineTitleRow}>
                            <h4 className={`${styles.timelineStatusTitle} ${item.isWebhook ? styles.timelineTitleWebhook : ''}`}>
                              {item.label}
                            </h4>
                            <span className={styles.timelineTime}>{item.timestampStr}</span>
                          </div>
                          <p className={styles.timelineNote}>{item.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      );
    })()}
        </>
      )}

      {adminTab === 'returns' && (
        <AdminReturns />
      )}

      {adminTab === 'withdrawals' && (
        <AdminWithdrawals />
      )}
    </section>
  );
}