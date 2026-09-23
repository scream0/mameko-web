"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import styles from "./PromoBannerBar.module.css";

export function PromoBannerBar() {
  const { activePromo } = useStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("mameko_promo_bar_dismissed");
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  // Countdown timer calculation if promoEndDate is provided
  useEffect(() => {
    if (!activePromo?.promoEndDate) {
      setTimeLeft("");
      return;
    }

    const calculateRemaining = () => {
      try {
        const endStr = activePromo.promoEndDate;
        const target =
          endStr.length === 10
            ? new Date(endStr + "T23:59:59").getTime()
            : new Date(endStr).getTime();
        const diff = target - Date.now();

        if (diff <= 0) {
          setTimeLeft("");
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        if (days > 0) {
          setTimeLeft(`${days}h ${hours}j ${minutes}m`);
        } else {
          const hh = String(hours).padStart(2, "0");
          const mm = String(minutes).padStart(2, "0");
          const ss = String(seconds).padStart(2, "0");
          setTimeLeft(`${hh}:${mm}:${ss}`);
        }
      } catch {
        setTimeLeft("");
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activePromo?.promoEndDate]);

  if (!activePromo || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("mameko_promo_bar_dismissed", "true");
    } catch {
      // Ignore storage errors
    }
  };

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Kode voucher ${code} berhasil disalin!`, {
      icon: "🏷️",
      duration: 3000,
    });
  };

  const discText =
    activePromo.promoDiscountType === "percentage"
      ? `${activePromo.promoDiscountValue}%`
      : `Rp ${Number(activePromo.promoDiscountValue).toLocaleString("id-ID")}`;

  const title = activePromo.promoBannerText || "Promo Spesial Mameko";

  return (
    <aside className={styles.bar} role="region" aria-label="Pengumuman Promosi Toko">
      <div className={styles.content}>
        <span className={styles.badge}>PROMO TOKO</span>
        <span className={styles.title}>
          {title} • Diskon {discText}
        </span>

        {activePromo.promoCode && (
          <button
            type="button"
            className={styles.couponPill}
            onClick={() => handleCopyCode(activePromo.promoCode)}
            title="Klik untuk menyalin kode"
          >
            <span>
              KODE: <strong>{activePromo.promoCode}</strong>
            </span>
            <span className={styles.copyHint}>Salin</span>
          </button>
        )}

        {timeLeft && (
          <span className={styles.timerBadge}>
            ⏱️ {timeLeft}
          </span>
        )}
      </div>

      <button
        type="button"
        className={styles.closeBtn}
        onClick={handleDismiss}
        aria-label="Tutup Pengumuman"
      >
        <X size={14} />
      </button>
    </aside>
  );
}
