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
          aria-label={cookieConfig.banner.ariaLabel}
          role="region"
        >
          <div className={styles.bannerCard}>
            <div className={styles.bannerContent}>
              <div className={styles.cookieIconWrapper} aria-hidden="true">
                <AppIcon name="shield-check" size={22} />
              </div>
              <div className={styles.bannerText}>
                <h3 className={styles.bannerTitle}>{cookieConfig.banner.title}</h3>
                <p className={styles.bannerDescription}>
                  {cookieConfig.banner.description}
                  <Link href="/privacy" className={styles.privacyLink}>
                    {cookieConfig.banner.privacyLinkText}
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
                {cookieConfig.banner.buttons.preferences}
              </button>
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
                <AppIcon name="shield-check" size={20} className={styles.modalHeaderIcon} />
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
                <AppIcon name="x" size={20} />
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
                    <AppIcon name="shield-check" size={16} />
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
                    <AppIcon name="settings" size={16} />
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
                    <AppIcon name="trending-up" size={16} />
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
