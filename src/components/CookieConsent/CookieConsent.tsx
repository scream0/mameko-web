"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import cookieConfig from "@/data/ui/cookieConsentConfig.json";
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
      // Abaikan error pada browser dengan private mode / disabled storage
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
          return;
        }
      }
      setShowBanner(true);
    } catch {
      setShowBanner(true);
    }
  }, []);

  // Listen for open-cookie-settings event (from footer or legal links)
  useEffect(() => {
    const handleOpenSettings = () => {
      setShowModal(true);
    };

    window.addEventListener("open-cookie-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("open-cookie-settings", handleOpenSettings);
    };
  }, []);

  // Escape key handler for modal
  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

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
      {/* MODERN FLOATING BANNER (< 15% viewport height on mobile, non-modal) */}
      {showBanner && !showModal && (
        <aside
          className={styles.bannerOverlay}
          aria-label={cookieConfig.banner.ariaLabel}
          role="region"
        >
          <div className={styles.bannerCard}>
            <div className={styles.bannerContent}>
              <div className={styles.cookieIconWrapper} aria-hidden="true">
                <AppIcon name="shield-check" size={16} />
              </div>
              <p className={styles.bannerText}>
                <span className={styles.bannerTitle}>{cookieConfig.banner.title} — </span>
                {cookieConfig.banner.description}{" "}
                <Link href="/privacy" className={styles.privacyLink}>
                  {cookieConfig.banner.privacyLinkText}
                </Link>
              </p>
            </div>

            <div className={styles.bannerActions}>
              <button
                type="button"
                className={styles.btnPreferences}
                onClick={() => setShowModal(true)}
                aria-label={cookieConfig.banner.buttons.preferences}
              >
                <AppIcon name="settings" size={13} />
                <span>{cookieConfig.banner.buttons.preferences}</span>
              </button>
              <div className={styles.mainButtonsGroup}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleAcceptNecessary}
                >
                  {cookieConfig.banner.buttons.necessaryOnly}
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleAcceptAll}
                >
                  {cookieConfig.banner.buttons.acceptAll}
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* PREFERENCES MODAL */}
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
                <AppIcon name="shield-check" size={18} className={styles.modalHeaderIcon} />
                <h2 id="cookie-modal-title" className={styles.modalTitle}>
                  {cookieConfig.modal.title}
                </h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowModal(false)}
                aria-label={cookieConfig.modal.closeAriaLabel}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalIntro}>
                {cookieConfig.modal.intro}
              </p>

              {/* 1. Necessary */}
              <div className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <div className={styles.categoryTitleGroup}>
                    <AppIcon name="shield-check" size={15} />
                    <h3 className={styles.categoryTitle}>
                      {cookieConfig.modal.categories.necessary.title}
                    </h3>
                  </div>
                  <span className={styles.alwaysActiveBadge}>
                    {cookieConfig.modal.categories.necessary.badge}
                  </span>
                </div>
                <p className={styles.categoryDesc}>
                  {cookieConfig.modal.categories.necessary.description}
                </p>
              </div>

              {/* 2. Preferences */}
              <div className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <div className={styles.categoryTitleGroup}>
                    <AppIcon name="settings" size={15} />
                    <h3 className={styles.categoryTitle}>
                      {cookieConfig.modal.categories.preferences.title}
                    </h3>
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
                  {cookieConfig.modal.categories.preferences.description}
                </p>
              </div>

              {/* 3. Analytics */}
              <div className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <div className={styles.categoryTitleGroup}>
                    <AppIcon name="trending-up" size={15} />
                    <h3 className={styles.categoryTitle}>
                      {cookieConfig.modal.categories.analytics.title}
                    </h3>
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
                  {cookieConfig.modal.categories.analytics.description}
                </p>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleSaveCustom}
              >
                {cookieConfig.modal.buttons.saveCustom}
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleAcceptAll}
              >
                {cookieConfig.modal.buttons.acceptAll}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
