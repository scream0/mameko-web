// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import styles from "./ReturnsCenter.module.css";
import returnsConfig from "@/data/ui/returnsConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import {
  SkeletonText,
  SkeletonLines,
} from "@/components/UI/Skeleton/Skeleton";
import { useRouter } from "next/navigation";

interface ReturnsCenterProps {
  onNavigateOrders?: () => void;
}

export default function ReturnsCenter({ onNavigateOrders }: ReturnsCenterProps) {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const lastUserIdRef = useRef(null);

  const loadReturns = useCallback(async (sessionToken?: string) => {
    try {
      const token =
        sessionToken ||
        (await auth.getSession()).data.session?.access_token;
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/returns",
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || returnsConfig.toasts.fetchError);
      }
      setRequests(data.returns || []);
    } catch (error: any) {
      toast.error(error.message || returnsConfig.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const {
        data: { session },
      } = await auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (session) {
        loadReturns(session.access_token);
      } else {
        setLoading(false);
      }

      const { data: authListener } = auth.onAuthStateChange(
        (_event, session) => {
          if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current))
            return;
          lastUserIdRef.current = session?.user?.id || null;
          if (session) {
            loadReturns(session.access_token);
          } else {
            setRequests([]);
            setLoading(false);
          }
        },
      );
      subscription = authListener?.subscription;
    };

    initAuth();

    const handleReturnSubmitted = () => {
      loadReturns();
    };

    window.addEventListener("return-submitted", handleReturnSubmitted);

    return () => {
      if (subscription) subscription.unsubscribe();
      window.removeEventListener("return-submitted", handleReturnSubmitted);
    };
  }, [loadReturns]);

  const handleGoToOrders = () => {
    if (onNavigateOrders) {
      onNavigateOrders();
    } else {
      router.push("/dashboard?tab=orders");
    }
  };

  const getStatusData = (statusKey: string) => {
    const statusMap = returnsConfig.status as Record<
      string,
      { label: string; classKey: string }
    >;
    return (
      statusMap[statusKey] || {
        label: statusKey,
        classKey: "default",
      }
    );
  };

  const getAdminNoteClass = (status: string) => {
    if (status === "approved") return styles.adminNoteApproved;
    if (status === "rejected") return styles.adminNoteRejected;
    return styles.adminNoteDefault;
  };

  return (
    <div className={styles.returnsContainer}>
      {/* 1. Header Hero Card */}
      <section className={styles.heroCard}>
        <p className={styles.eyebrow}>{returnsConfig.header.eyebrow}</p>
        <h2 className={styles.heroTitle}>{returnsConfig.header.title}</h2>
        <p className={styles.heroCopy}>{returnsConfig.header.description}</p>
      </section>

      {/* 2. Daftar Pengajuan Retur */}
      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <h3 className={styles.listTitle}>{returnsConfig.list.title}</h3>
        </div>

        {loading ? (
          <div className={styles.list}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`ret-skel-${i}`} className={styles.skeletonItem}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <SkeletonText width={130} height={18} />
                  <SkeletonText width={90} height={22} radius={20} />
                </div>
                <SkeletonLines lines={2} widths={["70%", "40%"]} />
              </div>
            ))}
          </div>
        ) : requests.length > 0 ? (
          <div className={styles.list}>
            {requests.map((item: any) => {
              const statusData = getStatusData(item.status);
              const orderDisplayId =
                item.orderNumber ||
                item.orderId?.slice(-8)?.toUpperCase() ||
                "—";
              const formattedDate = item.createdAt
                ? new Date(item.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <div key={item.id} className={styles.returnItem}>
                  <div className={styles.returnItemTop}>
                    <div className={styles.orderMeta}>
                      <div className={styles.orderNumberRow}>
                        <AppIcon name="package" size={16} />
                        <span className={styles.orderNumber}>
                          {returnsConfig.list.orderPrefix}
                          {orderDisplayId}
                        </span>
                      </div>
                      <span className={styles.returnReason}>
                        <strong>{returnsConfig.card.reasonLabel}</strong>{" "}
                        {item.reason}
                      </span>
                      {formattedDate && (
                        <span className={styles.returnDate}>
                          {returnsConfig.card.dateLabel} {formattedDate}
                        </span>
                      )}
                    </div>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[`status_${statusData.classKey}`] ||
                        styles.status_default
                      }`}
                    >
                      {statusData.label}
                    </span>
                  </div>

                  {item.evidence && (
                    <div className={styles.evidenceWrapper}>
                      <button
                        type="button"
                        className={styles.evidenceBtn}
                        onClick={() => setPreviewImage(item.evidence)}
                      >
                        <AppIcon name="image" size={15} />
                        <span>{returnsConfig.card.evidenceBtn}</span>
                      </button>
                    </div>
                  )}

                  {item.adminNote && (
                    <div
                      className={`${styles.adminNoteBox} ${getAdminNoteClass(
                        item.status,
                      )}`}
                    >
                      <span className={styles.adminNoteTitle}>
                        <AppIcon name="message-square" size={14} />
                        <span>{returnsConfig.card.adminNoteTitle}</span>
                      </span>
                      <p className={styles.adminNoteText}>{item.adminNote}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrapper}>
              <AppIcon name="rotate-ccw" size={32} />
            </div>
            <h4 className={styles.emptyTitle}>{returnsConfig.list.emptyTitle}</h4>
            <p className={styles.emptyText}>{returnsConfig.list.emptyDesc}</p>
            <button
              type="button"
              className={styles.ctaOrdersBtn}
              onClick={handleGoToOrders}
            >
              <AppIcon name="shopping-bag" size={16} />
              <span>{returnsConfig.list.ctaOrders}</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. Modal Pratinjau Foto Bukti (Lightbox) */}
      {previewImage && (
        <div
          className={styles.modalOverlay}
          onClick={() => setPreviewImage(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h4>{returnsConfig.card.evidenceModalTitle}</h4>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setPreviewImage(null)}
                aria-label={returnsConfig.card.closeModal}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Bukti Pengajuan Retur"
                className={styles.modalImg}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}