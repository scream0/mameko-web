// @ts-nocheck
"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import styles from "./NotificationsSection.module.css";
import notificationsConfig from "@/data/ui/notificationsConfig.json";
import { NotificationsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getApiBaseUrl } from "@/lib/apiClient";

// Format waktu menjadi "Baru saja", "5 menit lalu", dst.
function timeAgo(dateString: any) {
  if (!dateString) return notificationsConfig.timeAgo.justNow;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return notificationsConfig.timeAgo.justNow;

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return notificationsConfig.timeAgo.justNow;
  if (minutes < 60) return `${minutes} ${notificationsConfig.timeAgo.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${notificationsConfig.timeAgo.hoursAgo}`;
  const days = Math.floor(hours / 24);
  return `${days} ${notificationsConfig.timeAgo.daysAgo}`;
}

const capitalize = (s: any) => {
  if (typeof s !== "string" || !s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Smart heuristic matching sesuai standar InAppNotification Android
function isOrderNotification(n: any): boolean {
  const t = (n.type || "").toLowerCase();
  const l = (n.link || "").toLowerCase();
  const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
  return (
    t.startsWith("order") ||
    t === "return" ||
    t === "retur" ||
    l.includes("order") ||
    text.includes("pesanan") ||
    text.includes("pengiriman") ||
    text.includes("dikirim") ||
    text.includes("sampai di tujuan") ||
    text.includes("resi") ||
    text.includes("retur")
  );
}

function isPaymentNotification(n: any): boolean {
  const t = (n.type || "").toLowerCase();
  const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
  return (
    t.startsWith("payment") ||
    t.includes("bayar") ||
    t === "qris" ||
    t === "midtrans" ||
    text.includes("pembayaran") ||
    text.includes("tagihan") ||
    text.includes("transfer") ||
    text.includes("menunggu pembayaran") ||
    text.includes("lunas") ||
    text.includes("rekening") ||
    text.includes("virtual account")
  );
}

function isPromoNotification(n: any): boolean {
  const t = (n.type || "").toLowerCase();
  const l = (n.link || "").toLowerCase();
  const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
  return (
    t.startsWith("promo") ||
    t.includes("voucher") ||
    t.includes("diskon") ||
    l.includes("voucher") ||
    l.includes("promo") ||
    text.includes("promo") ||
    text.includes("voucher") ||
    text.includes("diskon") ||
    text.includes("cashback") ||
    text.includes("potongan") ||
    text.includes("flash sale") ||
    text.includes("gratis ongkir")
  );
}

function isSystemNotification(n: any): boolean {
  const t = (n.type || "").toLowerCase();
  return (
    t.startsWith("system") ||
    t.startsWith("info") ||
    t.startsWith("chat") ||
    t.startsWith("broadcast") ||
    !t ||
    (!isOrderNotification(n) && !isPromoNotification(n) && !isPaymentNotification(n))
  );
}

function getNotificationCategory(n: any): "order" | "payment" | "promo" | "system" {
  if (isOrderNotification(n)) return "order";
  if (isPaymentNotification(n)) return "payment";
  if (isPromoNotification(n)) return "promo";
  return "system";
}

const TYPE_ICON: Record<string, JSX.Element> = {
  order: <AppIcon name="package" size={18} />,
  payment: <AppIcon name="creditcard" size={18} />,
  promo: <AppIcon name="gift" size={18} />,
  system: <AppIcon name="bell" size={18} />,
};

export default function NotificationsSection({ onUnreadCountChange }: any) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittingMarkAllRead, setSubmittingMarkAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [submittingDeleteAll, setSubmittingDeleteAll] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const lastUserIdRef = useRef(null);

  const loadNotifications = useCallback(async (session: any) => {
    try {
      setLoading(true);
      const token = session?.access_token;
      
      const res = await fetch(getApiBaseUrl() + "/api/user/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      let result = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const text = await res.text();
        try {
          result = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error("Gagal parse JSON:", e);
        }
      }
      if (!res.ok) throw new Error(result.error || notificationsConfig.toasts.fetchError);
      
      // Map dari struktur database ke frontend (camelCase)
      const mappedNotifications = (result.notifications || []).map((n: any) => ({
        ...n,
        createdAt: n.created_at,
        isRead: n.is_read,
      }));
      setNotifications(mappedNotifications);
    } catch (err) {
      console.error("Gagal memuat notifikasi:", err);
      toast.error(notificationsConfig.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      if (!supabase?.auth) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setCurrentSession(session);
      lastUserIdRef.current = session?.user?.id || null;

      if (session) {
        await loadNotifications(session);
      } else {
        setLoading(false);
      }

      // Listener perubahan sesi Supabase
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;
        
        setCurrentSession(session);
        if (session) {
          await loadNotifications(session);
        } else {
          setNotifications([]);
          setLoading(false);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    // Real-time subscription for user notifications
    const realtimeChannel = supabase
      .channel("user_notifications_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const userId = lastUserIdRef.current;
          
          if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
            return;
          }

          if (
            payload.new &&
            (payload.new.audience === "user" ||
             payload.new.audience === "all" ||
             payload.new.user_id === userId)
          ) {
            const mapped = {
              ...payload.new,
              createdAt: payload.new.created_at,
              isRead: payload.new.is_read || false,
            };

            if (payload.eventType === "INSERT") {
              setNotifications((prev) => {
                if (prev.some((n) => n.id === mapped.id)) return prev;
                return [mapped, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              });
            } else if (payload.eventType === "UPDATE") {
              setNotifications((prev) =>
                prev.map((n) => {
                  if (n.id === mapped.id) {
                    return { ...n, ...mapped };
                  }
                  return n;
                })
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      supabase.removeChannel(realtimeChannel);
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
    try {
      setSubmittingMarkAllRead(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(getApiBaseUrl() + "/api/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) throw new Error(notificationsConfig.toasts.updateError);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success(notificationsConfig.toasts.markAllReadSuccess);
    } catch (err: any) {
      console.error("Gagal tandai semua dibaca:", err);
      toast.error(err.message || notificationsConfig.toasts.updateError);
    } finally {
      setSubmittingMarkAllRead(false);
    }
  };

  const markRead = async (notification: any) => {
    if (notification.isRead) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await fetch(getApiBaseUrl() + "/api/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ notificationId: notification.id, isRead: true }),
      });
    } catch (err) {
      console.error("Gagal menandai notifikasi:", err);
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    );
  };

  const resolveNotificationLink = (rawLink: string, n?: any) => {
    if (!rawLink) {
      if (n) {
        if (isPromoNotification(n)) return "/dashboard?tab=vouchers";
        if (isOrderNotification(n) || isPaymentNotification(n)) return "/dashboard?tab=orders";
      }
      return "";
    }
    const link = rawLink.trim();
    if (link.startsWith("/admin/orders")) {
      const queryIdx = link.indexOf("?");
      const query = queryIdx !== -1 ? link.substring(queryIdx + 1) : "";
      const params = new URLSearchParams(query);
      const subtab = params.get("tab") || params.get("subtab") || "orders";
      return `/dashboard?tab=orders&subtab=${subtab}`;
    }
    if (link === "/dashboard/orders" || link === "/orders") {
      return "/dashboard?tab=orders";
    }
    if (link === "/dashboard/wallet" || link === "/wallet") {
      return "/dashboard?tab=profile";
    }
    if (link === "/dashboard/vouchers" || link === "/vouchers" || link.includes("voucher")) {
      return "/dashboard?tab=vouchers";
    }
    return link;
  };

  const handleNotificationClick = (notification: any) => {
    markRead(notification);
    const targetLink = resolveNotificationLink(notification.link, notification);
    if (targetLink) {
      router.push(targetLink);
    }
  };

  const deleteNotification = (notification: any) => {
    setNotificationToDelete(notification);
  };

  const confirmDeleteAllNotifications = async () => {
    setShowDeleteAllModal(false);
    try {
      setSubmittingDeleteAll(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(getApiBaseUrl() + "/api/user/notifications?id=all", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || notificationsConfig.toasts.deleteAllError);
      }
      setNotifications([]);
      toast.success(notificationsConfig.toasts.deleteAllSuccess);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err: any) {
      console.error("Gagal menghapus semua notifikasi:", err);
      toast.error(err.message || notificationsConfig.toasts.deleteAllError);
    } finally {
      setSubmittingDeleteAll(false);
    }
  };

  const confirmDeleteNotification = async () => {
    if (!notificationToDelete) return;
    const notification = notificationToDelete;
    setNotificationToDelete(null);

    try {
      setDeletingId(notification.id);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(getApiBaseUrl() + `/api/user/notifications?id=${notification.id}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || notificationsConfig.toasts.deleteError);
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      toast.success(notificationsConfig.toasts.deleteSuccess);
    } catch (err: any) {
      console.error("Gagal menghapus notifikasi:", err);
      toast.error(err.message || notificationsConfig.toasts.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  // Smart categorization mirroring Android InAppNotification
  const filteredNotifications = useMemo(() => {
    let result = notifications;
    if (filter === "unread") {
      result = result.filter((n) => !n.isRead);
    } else if (filter === "order") {
      result = result.filter(isOrderNotification);
    } else if (filter === "payment") {
      result = result.filter(isPaymentNotification);
    } else if (filter === "promo") {
      result = result.filter(isPromoNotification);
    } else if (filter === "system") {
      result = result.filter(isSystemNotification);
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(query) ||
          (n.message || "").toLowerCase().includes(query),
      );
    }
    return result;
  }, [notifications, filter, searchQuery]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (typeof onUnreadCountChange === "function") {
      onUnreadCountChange(unreadCount);
    }
  }, [onUnreadCountChange, unreadCount]);

  const getEmptyStateMessage = () => {
    if (filter === "unread") return notificationsConfig.emptyUnread;
    if (notificationsConfig.emptyCategories?.[filter]) {
      return notificationsConfig.emptyCategories[filter];
    }
    return notificationsConfig.emptyText;
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Header */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerTopRow}>
          <div>
            <h3 className={styles.headerTitle}>
              {notificationsConfig.header.title}
              {unreadCount > 0 && (
                <span className={styles.unreadBadge}>{unreadCount}</span>
              )}
            </h3>
            <p className={styles.headerSubtitle}>
              {notificationsConfig.header.subtitle}
            </p>
          </div>
          <div className={styles.headerActions}>
            <input
              type="text"
              placeholder={notificationsConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <button
              onClick={markAllRead}
              className={styles.markReadBtn}
              disabled={submittingMarkAllRead}
            >
              {submittingMarkAllRead
                ? notificationsConfig.buttons.markingAllRead
                : notificationsConfig.buttons.markAllRead}
            </button>
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className={styles.deleteAllBtn}
                disabled={submittingDeleteAll || notifications.length === 0}
                title={notificationsConfig.buttons.deleteAll}
              >
                <AppIcon name="trash" size={15} />
                <span>
                  {submittingDeleteAll
                    ? notificationsConfig.buttons.deletingAll
                    : notificationsConfig.buttons.deleteAll}
                </span>
              </button>
          </div>
        </div>

        <div className={styles.filterGroup}>
          {Object.entries(notificationsConfig.tabs).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`${styles.filterBtn} ${
                filter === key ? styles.filterBtnActive : ""
              }`}
            >
              {label}
              {key === "unread" && unreadCount > 0 && (
                <span className={styles.filterCount}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      <div className={styles.notificationsList}>
        {loading ? (
          <NotificationsSkeleton count={5} />
        ) : filteredNotifications.length === 0 ? (
          <div className={`card ${styles.centerStateCard}`}>
            <div className={styles.emptyIcon}>🔔</div>
            <p className={styles.emptyTitle}>
              {notificationsConfig.emptyTitle}
            </p>
            <p className={styles.emptyText}>
              {getEmptyStateMessage()}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const isUnread = !notification.isRead;
            const category = getNotificationCategory(notification);
            const categoryLabel = notificationsConfig.typeLabels[category] || "Sistem";

            return (
              <div
                key={notification.id}
                className={`${styles.notificationItem} ${
                  isUnread ? styles.notificationUnread : ""
                } ${notification.link ? styles.clickable : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div
                  className={`${styles.notificationIcon} ${
                    styles[`icon${capitalize(category)}`] ||
                    styles.iconSystem
                  }`}
                >
                  {TYPE_ICON[category] || <AppIcon name="bell" size={18} />}
                </div>
                <div className={styles.notificationContent}>
                  <div className={styles.notificationTitleRow}>
                    <span className={styles.notificationTitle}>
                      {notification.title}
                    </span>
                    {isUnread && <span className={styles.unreadDot} />}
                  </div>
                  <p className={styles.notificationMessage}>
                    {notification.message}
                  </p>
                  <div className={styles.notificationMeta}>
                    <span className={`${styles.typeBadge} ${styles[`badge_${category}`]}`}>
                      {categoryLabel}
                    </span>
                    <span className={styles.timeAgo}>
                      {timeAgo(notification.createdAt)}
                    </span>
                    {notification.link && (
                      <span className={styles.linkIndicator}>
                        {notificationsConfig.linkIndicator}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  className={styles.deleteBtn}
                  aria-label={notificationsConfig.buttons.deleteAria}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification);
                  }}
                  disabled={deletingId === notification.id}
                >
                  {deletingId === notification.id ? (
                    <span className={styles.btnSpinner} />
                  ) : (
                    <AppIcon name="trash" size={16} />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {notificationToDelete && (
        <ConfirmationModal
          isOpen={!!notificationToDelete}
          title={notificationsConfig.deleteModal.title}
          message={notificationsConfig.deleteModal.message}
          onConfirm={confirmDeleteNotification}
          onCancel={() => setNotificationToDelete(null)}
        />
      )}

      {/* Confirmation Modal for Delete All */}
      {showDeleteAllModal && (
        <ConfirmationModal
          isOpen={showDeleteAllModal}
          title={notificationsConfig.deleteAllModal.title}
          message={notificationsConfig.deleteAllModal.message}
          onConfirm={confirmDeleteAllNotifications}
          onCancel={() => setShowDeleteAllModal(false)}
        />
      )}
    </div>
  );
}
