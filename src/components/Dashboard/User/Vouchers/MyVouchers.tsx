// @ts-nocheck
"use client";
import React, { useState, useMemo } from "react";
import styles from "./MyVouchers.module.css";
import VoucherCard from "@/components/Voucher/VoucherCard";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import vouchersConfig from "@/data/ui/vouchersConfig.json";

const TABS = vouchersConfig.tabs;
const statusTextMap = vouchersConfig.status;

const MyVouchers = ({
  availableVouchers = [],
  claimedVouchers = [],
  refreshProfile,
  isCheckoutMode = false,
  onSelectVoucher,
  appliedClaimIds = [], // <-- Diterima dari CheckoutPage
}) => {
  const [claimingId, setClaimingId] = useState(null);
  const [optimisticClaimed, setOptimisticClaimed] = useState(new Set());
  const [activeTab, setActiveTab] = useState("all");

  const claimedVoucherIds = useMemo(() => {
    const ids = claimedVouchers.map((cv) => String(cv.voucher_id || cv.vouchers?.id || cv.id));
    return new Set([...ids, ...optimisticClaimed]);
  }, [claimedVouchers, optimisticClaimed]);

  const sortedClaimedVouchers = useMemo(() => {
    return [...claimedVouchers].sort((a, b) => {
      const aExpiry = a.vouchers?.valid_until ? new Date(a.vouchers.valid_until) : null;
      const bExpiry = b.vouchers?.valid_until ? new Date(b.vouchers.valid_until) : null;

      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;

      if (aExpiry && bExpiry) return aExpiry - bExpiry;
      return 0;
    });
  }, [claimedVouchers]);

  const filteredClaimedVouchers = useMemo(() => {
    if (activeTab === "all") return sortedClaimedVouchers;
    return sortedClaimedVouchers.filter((cv) => {
      const status = cv.status || "active";
      return status === activeTab;
    });
  }, [sortedClaimedVouchers, activeTab]);

  const tabCounts = useMemo(() => {
    return {
      all: claimedVouchers.length,
      active: claimedVouchers.filter((cv) => (cv.status || "active") === "active").length,
      used: claimedVouchers.filter((cv) => cv.status === "used").length,
      expired: claimedVouchers.filter((cv) => cv.status === "expired").length,
    };
  }, [claimedVouchers]);

  // Mode checkout hanya boleh nampilin voucher aktif — gak bisa pilih yang sudah dipakai/kadaluarsa
  const displayVouchers = isCheckoutMode
    ? sortedClaimedVouchers.filter((cv) => {
        const v = cv.vouchers || cv;
        const isNotExpired = !v.valid_until || new Date(v.valid_until) >= new Date();
        const isActive = cv.status ? cv.status === "active" : (v.is_active !== false);
        return isActive && isNotExpired;
      })
    : filteredClaimedVouchers;

  const handleClaimVoucher = async (voucherId: any) => {
    setClaimingId(voucherId);
    const toastId = toast.loading(vouchersConfig.toasts.claiming);

    try {
      const { data: { session } } = await auth.getSession();
      if (!session) {
        toast.error(vouchersConfig.toasts.requireLogin, { id: toastId });
        setClaimingId(null);
        return;
      }

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/vouchers/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ voucher_id: String(voucherId) }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || vouchersConfig.toasts.claimSuccess, { id: toastId });
        setOptimisticClaimed((prev) => new Set(prev).add(String(voucherId)));
        if (refreshProfile) refreshProfile();
      } else {
        throw new Error(data.error || vouchersConfig.toasts.claimFailed);
      }
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className={styles.myVouchersSection}>
      {!isCheckoutMode && (
        <div className={styles.sectionGroup}>
          <h2 className={styles.sectionTitle}>{vouchersConfig.headings.availableTitle}</h2>
          <div className={styles.availableVouchersList}>
            {availableVouchers.length > 0 ? (
              availableVouchers.map((voucher) => {
                const isClaimed = claimedVoucherIds.has(String(voucher.id));
                const isClaiming = claimingId === voucher.id;

                return (
                  <VoucherCard
                    key={voucher.id}
                    voucher={voucher}
                    disabled={isClaimed || isClaiming}
                    buttonText={isClaiming ? vouchersConfig.actions.claiming : isClaimed ? vouchersConfig.actions.claimed : vouchersConfig.actions.claim}
                    onActionClick={() => !isClaimed && handleClaimVoucher(voucher.id)}
                  />
                );
              })
            ) : (
              <p className={styles.emptyState}>{vouchersConfig.emptyStates.noAvailable}</p>
            )}
          </div>
        </div>
      )}

      <div className={`${styles.sectionGroup} ${!isCheckoutMode ? styles.sectionGroupSpaced : ""}`}>
        {!isCheckoutMode && <h2 className={styles.sectionTitle}>{vouchersConfig.headings.myVouchersTitle}</h2>}

        {!isCheckoutMode && (
          <div
            className={styles.tabBar}
            role="tablist"
            aria-label={vouchersConfig.aria?.tabList || vouchersConfig.headings.myVouchersTitle}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key] || 0;
              const ariaLabel = vouchersConfig.aria?.tabAriaTemplate
                ? vouchersConfig.aria.tabAriaTemplate
                    .replace("{label}", tab.label)
                    .replace("{count}", String(count))
                : `${tab.label} (${count})`;

              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={ariaLabel}
                  className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span>{tab.label}</span>
                  {count > 0 && <span className={styles.tabCount}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.claimedVouchersList}>
          {displayVouchers.length > 0 ? (
            displayVouchers.map((cv) => {
              const claimId = cv.id; // ID baris user_vouchers
              const isApplied = appliedClaimIds.includes(claimId);

              return (
                <VoucherCard
                  key={claimId || cv.voucher_id}
                  voucher={cv}
                  statusText={statusTextMap[cv.status] || vouchersConfig.fallbacks?.claimed || vouchersConfig.status.claimed}
                  disabled={isCheckoutMode && isApplied}
                  onActionClick={isCheckoutMode && !isApplied ? () => onSelectVoucher(cv) : undefined}
                  buttonText={isCheckoutMode && isApplied ? vouchersConfig.actions.used : vouchersConfig.actions.useVoucher}
                />
              );
            })
          ) : (
            <p className={styles.emptyState}>
              {isCheckoutMode
                ? vouchersConfig.emptyStates.noActiveCheckout
                : activeTab === "all"
                  ? vouchersConfig.emptyStates.noClaimed
                  : vouchersConfig.emptyStates.noCategoryTemplate.replace("{category}", TABS.find((t) => t.key === activeTab)?.label.toLowerCase() || "")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyVouchers;