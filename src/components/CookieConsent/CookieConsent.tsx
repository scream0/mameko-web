"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./CookieConsent.module.css";

const STORAGE_KEY = "mameko_cookie_consent";
const CURRENT_VERSION = "1.0";

export interface CookiePreferences {
  necessary: boolean;
  preferences: boolean;
  analytics: boolean;
  timestamp: string;
  version: string;
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState({
    preferences: true,
    analytics: true,
  });

  const saveConsent = useCallback((prefs: { preferences: boolean; analytics: boolean }) => {
    const payload: CookiePreferences = {
      necessary: true,
      preferences: prefs.preferences,
      analytics: prefs.analytics,
      timestamp: new Date().toISOString(),
      version: CURRENT_VERSION,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore localStorage errors (e.g. private browsing restrictions)
    }

    setShowBanner(false);
    setShowModal(false);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CookiePreferences = JSON.parse(stored);
        if (parsed.version === CURRENT_VERSION) {
          setPreferences({
            preferences: parsed.preferences ?? true,
            analytics: parsed.analytics ?? true,
          });
          setShowBanner(false);
        } else {
          // Version updated, show banner again
          setShowBanner(true);
        }
      } else {
        // Delay showing banner slightly for smooth initial page load
        const timer = setTimeout(() => setShowBanner(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  // Listen for open-cookie-settings event (from footer or elsewhere)
  useEffect(() => {
    const handleOpenSettings = () => {
      setShowModal(true);
    };

    window.addEventListener("open-cookie-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("open-cookie-settings", handleOpenSettings);
    };
  }, []);

  const handleAcceptAll = () => {
    saveConsent({ preferences: true, analytics: true });
  };

  const handleAcceptNecessary = () => {
    saveConsent({ preferences: false, analytics: false });
  };

  const handleSaveCustom = () => {
    saveConsent(preferences);
  };

  if (!showBanner && !showModal) {
    return null;
  }

  return (
    <>
      {/* FLOATING BANNER */}
      {showBanner && !showModal && (
        <aside
          className={styles.bannerOverlay}
          aria-label="Pemberitahuan Persetujuan Cookie"
          role="region"
        >
          <div className={styles.bannerCard}>
            <div className={styles.bannerContent}>
              <div className={styles.cookieIconWrapper} aria-hidden="true">
                <AppIcon name="shield-check" size={22} />
              </div>
              <div className={styles.bannerText}>
                <h3 className={styles.bannerTitle}>Privasi &amp; Penggunaan Cookie</h3>
                <p className={styles.bannerDescription}>
                  Kami menggunakan cookie untuk memastikan keamanan transaksi, mengingat preferensi tema, dan mengoptimalkan performa platform Mameko. Baca selengkapnya di{" "}
                  <Link href="/privacy" className={styles.privacyLink}>
                    Kebijakan Privasi
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className={styles.bannerActions}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setShowModal(true)}
              >
                Atur Preferensi
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleAcceptNecessary}
              >
                Hanya Wajib
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleAcceptAll}
              >
                Terima Semua
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* MODAL PREFERENSI */}
      {showModal && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          onClick={() => setShowModal(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <AppIcon name="shield-check" size={20} className="text-amber-500" />
                <h2 id="cookie-modal-title" className={styles.modalTitle}>
                  Preferensi Cookie
                </h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowModal(false)}
                aria-label="Tutup Pengaturan"
              >
                <AppIcon name="x" size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalIntro}>
                Anda dapat memilih jenis cookie yang diizinkan untuk aktif saat menjelajahi platform Make Me Kool. Cookie wajib tidak dapat dimatikan karena diperlukan demi kelancaran fungsi dasar transaksi.
              </p>

              {/* 1. Necessary */}
              <div className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <div className={styles.categoryTitleGroup}>
                    <AppIcon name="shield-check" size={16} />
                    <h3 className={styles.categoryTitle}>Cookie Wajib (Esensial)</h3>
                  </div>
                  <span className={styles.alwaysActiveBadge}>Selalu Aktif</span>
                </div>
                <p className={styles.categoryDesc}>
                  Dibutuhkan untuk keamanan autentikasi akun Supabase, integritas keranjang belanja, dan kelancaran pembayaran Midtrans.
                </p>
              </div>

              {/* 2. Preferences */}
              <div className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <div className={styles.categoryTitleGroup}>
                    <AppIcon name="settings" size={16} />
                    <h3 className={styles.categoryTitle}>Preferensi &amp; Fungsi</h3>
                  </div>
                  <label className={styles.switchLabel}>
                    <input
                      type="checkbox"
                      className={styles.switchInput}
                      checked={preferences.preferences}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          preferences: e.target.checked,
                        }))
                      }
                    />
                    <span className={styles.switchSlider} />
                  </label>
                </div>
                <p className={styles.categoryDesc}>
                  Memungkinkan situs mengingat preferensi antarmuka Anda seperti mode tema Gelap/Terang dan status tampilan navigasi.
                </p>
              </div>

              {/* 3. Analytics */}
              <div className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <div className={styles.categoryTitleGroup}>
                    <AppIcon name="trending-up" size={16} />
                    <h3 className={styles.categoryTitle}>Analisis Performa</h3>
                  </div>
                  <label className={styles.switchLabel}>
                    <input
                      type="checkbox"
                      className={styles.switchInput}
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          analytics: e.target.checked,
                        }))
                      }
                    />
                    <span className={styles.switchSlider} />
                  </label>
                </div>
                <p className={styles.categoryDesc}>
                  Membantu kami memahami interaksi pengunjung secara anonim untuk mempercepat pemuatan halaman dan meningkatkan kegunaan produk.
                </p>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSaveCustom}
              >
                Simpan Pilihan
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleAcceptAll}
              >
                Terima Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
