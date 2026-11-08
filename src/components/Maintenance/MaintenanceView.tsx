"use client";

import { useState } from "react";
import { Logo } from "@/components/UI/Logo/logo";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import maintenanceConfig from "@/data/ui/maintenanceConfig.json";
import styles from "./MaintenanceView.module.css";
import { mamekoClient } from "@/lib/mamekoClient";
import toast from "react-hot-toast";

export interface MaintenanceServerDetails {
  title?: string;
  message?: string;
  estimatedEndTime?: string;
}

interface MaintenanceViewProps {
  countdown: number;
  isChecking: boolean;
  onCheckNow: () => void;
  details?: MaintenanceServerDetails | null;
  onAdminBypassSuccess?: () => void;
}

export function MaintenanceView({
  countdown,
  isChecking,
  onCheckNow,
  details,
  onAdminBypassSuccess,
}: MaintenanceViewProps) {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");

  const cfgAdmin = (maintenanceConfig as any).adminPortal || {
    trigger: "Akses Pengelola Toko",
    modalTitle: "Login Administrator",
    modalSubtitle: "Masuk untuk mengelola sistem dan menonaktifkan mode pemeliharaan.",
    emailLabel: "Email Administrator",
    emailPlaceholder: "admin@mameko.my.id",
    passwordLabel: "Kata Sandi",
    passwordPlaceholder: "Masukkan kata sandi...",
    submitBtn: "Masuk & Akses Dashboard",
    submitting: "Memverifikasi...",
    cancelBtn: "Batal",
    notAdminError: "Akses ditolak. Akun ini tidak memiliki hak akses Administrator toko.",
    loginSuccess: "Login Administrator berhasil. Akses sistem dibuka.",
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAdminError("Silakan isi email dan kata sandi administrator.");
      return;
    }

    try {
      setIsSubmittingAdmin(true);
      const { data, error } = await mamekoClient.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword,
      });

      if (error) {
        setAdminError(error.message || "Gagal masuk. Periksa kembali kredensial Anda.");
        return;
      }

      const role =
        data.user?.role ||
        data.user?.user_metadata?.role ||
        data.user?.app_metadata?.role;

      const isAdmin = ["admin", "superadmin"].includes(String(role).toLowerCase());

      if (isAdmin) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("mameko_admin_bypass", "true");
        }
        toast.success(cfgAdmin.loginSuccess);
        setShowAdminModal(false);
        if (onAdminBypassSuccess) {
          onAdminBypassSuccess();
        }
        window.location.replace("/dashboard");
      } else {
        await mamekoClient.auth.signOut();
        setAdminError(cfgAdmin.notAdminError);
      }
    } catch (err: any) {
      setAdminError(err?.message || "Terjadi kesalahan saat memverifikasi akses.");
    } finally {
      setIsSubmittingAdmin(false);
    }
  };
  const displayTitle = details?.title?.trim() || maintenanceConfig.title;
  const displayDesc = details?.message?.trim() || maintenanceConfig.description;
  const estimatedEndTime = details?.estimatedEndTime?.trim();

  const countdownText = isChecking
    ? maintenanceConfig.timer.checkingText
    : maintenanceConfig.timer.countdownTemplate.replace(
        "{seconds}",
        String(countdown)
      );

  return (
    <div
      className={styles.maintenanceOverlay}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      aria-describedby="maintenance-desc"
    >
      <div className={styles.maintenanceCard}>
        {/* Brand Logo */}
        <div className={styles.brandLogoWrapper}>
          <Logo />
        </div>

        {/* Pulsing Status Badge */}
        <div className={styles.badgePill}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span>{maintenanceConfig.badge}</span>
        </div>

        {/* Headings & Description */}
        <h1 id="maintenance-title" className={styles.title}>
          {displayTitle}
        </h1>
        <p className={styles.subtitle}>{maintenanceConfig.subtitle}</p>
        <p id="maintenance-desc" className={styles.description}>
          {displayDesc}
        </p>

        {estimatedEndTime && (
          <div className={styles.estimatedBox}>
            <span className={styles.estimatedIcon} aria-hidden="true">
              <AppIcon name="clock" size={14} />
            </span>
            <span>Estimasi Selesai: {estimatedEndTime}</span>
          </div>
        )}

        {/* Telemetry / Auto-Recovery Card */}
        <div className={styles.telemetryBox}>
          <div className={styles.telemetryInfo}>
            <span className={styles.telemetryIcon} aria-hidden="true">
              <AppIcon name="clock" size={16} />
            </span>
            <span>{countdownText}</span>
          </div>

          <button
            type="button"
            className={styles.retryBtn}
            onClick={onCheckNow}
            disabled={isChecking}
            aria-label={maintenanceConfig.buttons.checkStatus}
          >
            {isChecking ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span>{maintenanceConfig.buttons.checking}</span>
              </>
            ) : (
              <>
                <AppIcon name="refresh-cw" size={14} />
                <span>{maintenanceConfig.buttons.checkStatus}</span>
              </>
            )}
          </button>
        </div>

        {/* Customer Support & Emergency Contact */}
        <div className={styles.supportSection}>
          <p className={styles.supportTitle}>{maintenanceConfig.support.title}</p>
          <div className={styles.supportLinksRow}>
            <a
              href={maintenanceConfig.support.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.supportPill}
              aria-label={maintenanceConfig.support.whatsappLabel}
            >
              <AppIcon name="message-circle" size={15} />
              <span>{maintenanceConfig.support.whatsappNumber}</span>
            </a>

            <a
              href={maintenanceConfig.support.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.supportPill}
              aria-label={maintenanceConfig.support.instagramLabel}
            >
              <AppIcon name="instagram" size={15} />
              <span>{maintenanceConfig.support.instagramLabel}</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className={styles.footerNote}>{maintenanceConfig.footer}</p>

        {/* Discreet Admin Portal Trigger */}
        <div className={styles.adminPortalTriggerRow}>
          <button
            type="button"
            className={styles.adminPortalTriggerBtn}
            onClick={() => {
              setAdminError("");
              setShowAdminModal(true);
            }}
            title={cfgAdmin.trigger}
          >
            <AppIcon name="shield" size={13} />
            <span>{cfgAdmin.trigger}</span>
          </button>
        </div>
      </div>

      {/* Admin Bypass Login Modal */}
      {showAdminModal && (
        <div
          className={styles.adminModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-modal-title"
        >
          <div className={styles.adminModalCard}>
            <div className={styles.adminModalHeader}>
              <div className={styles.adminModalIcon}>
                <AppIcon name="shield" size={22} />
              </div>
              <h2 id="admin-modal-title" className={styles.adminModalTitle}>
                {cfgAdmin.modalTitle}
              </h2>
              <p className={styles.adminModalSubtitle}>{cfgAdmin.modalSubtitle}</p>
            </div>

            <form onSubmit={handleAdminLoginSubmit} className={styles.adminForm}>
              {adminError && (
                <div className={styles.errorBanner} role="alert">
                  {adminError}
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.inputLabel} htmlFor="admin-email">
                  {cfgAdmin.emailLabel}
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={cfgAdmin.emailPlaceholder}
                  className={styles.textInput}
                  disabled={isSubmittingAdmin}
                  autoComplete="email"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel} htmlFor="admin-password">
                  {cfgAdmin.passwordLabel}
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={cfgAdmin.passwordPlaceholder}
                  className={styles.textInput}
                  disabled={isSubmittingAdmin}
                  autoComplete="current-password"
                />
              </div>

              <div className={styles.adminModalActions}>
                <button
                  type="button"
                  className={styles.cancelModalBtn}
                  onClick={() => setShowAdminModal(false)}
                  disabled={isSubmittingAdmin}
                >
                  {cfgAdmin.cancelBtn}
                </button>
                <button
                  type="submit"
                  className={styles.submitModalBtn}
                  disabled={isSubmittingAdmin}
                >
                  {isSubmittingAdmin ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      <span>{cfgAdmin.submitting}</span>
                    </>
                  ) : (
                    <>
                      <AppIcon name="log-in" size={15} />
                      <span>{cfgAdmin.submitBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

