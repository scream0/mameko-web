"use client";

import { useState, useEffect } from "react";
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
  const [adminStep, setAdminStep] = useState<"email" | "otp">("email");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");

  const cfgAdmin = (maintenanceConfig as any).adminPortal || {
    trigger: "Akses Pengelola Toko",
    modalTitle: "Login Administrator",
    modalSubtitle: "Masuk menggunakan verifikasi email OTP resmi untuk mengelola toko.",
    emailLabel: "Email Administrator",
    emailPlaceholder: "admin@mameko.my.id",
    sendOtpBtn: "Kirim Kode OTP Masuk",
    sendingOtp: "Mengirim kode OTP...",
    otpLabel: "Kode Verifikasi OTP (6-Digit)",
    otpPlaceholder: "Masukkan 6 digit angka...",
    verifyBtn: "Verifikasi & Akses Dashboard",
    verifying: "Memverifikasi kode...",
    resendBtn: "Kirim Ulang Kode",
    resendCooldown: "Kirim ulang dalam {seconds}d",
    changeEmailBtn: "Ganti Email",
    cancelBtn: "Batal",
    otpSentSuccess: "Kode OTP 6-digit telah dikirim ke {email}. Silakan periksa inbox email Anda.",
    notAdminError: "Akses ditolak. Email ini tidak memiliki hak akses Administrator toko.",
    loginSuccess: "Login Administrator berhasil. Akses sistem dibuka.",
  };

  // Resend Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0 && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Step 1: Request Email OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminError("");

    const cleanEmail = adminEmail.trim();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setAdminError("Silakan masukkan alamat email administrator yang valid.");
      return;
    }

    try {
      setIsSubmittingAdmin(true);
      const { error } = await mamekoClient.auth.signInWithOtp({ email: cleanEmail });

      if (error) {
        setAdminError(error.message || "Gagal mengirim kode OTP ke email administrator.");
        return;
      }

      setAdminStep("otp");
      setResendTimer(120);
      toast.success(cfgAdmin.otpSentSuccess.replace("{email}", cleanEmail));
    } catch (err: any) {
      setAdminError(err?.message || "Terjadi kesalahan saat mengirim OTP.");
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");

    const cleanOtp = adminOtp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setAdminError("Silakan masukkan 6 digit kode OTP yang diterima di email.");
      return;
    }

    try {
      setIsSubmittingAdmin(true);
      const { data, error } = await mamekoClient.auth.verifyOtp({
        email: adminEmail.trim(),
        token: cleanOtp,
      });

      if (error || !data.user) {
        setAdminError(error?.message || "Kode OTP tidak valid atau telah kedaluwarsa.");
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
      setAdminError(err?.message || "Terjadi kesalahan saat memverifikasi kode OTP.");
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

            {adminStep === "email" ? (
              <form onSubmit={handleSendOtp} className={styles.adminForm}>
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
                    autoFocus
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
                        <span>{cfgAdmin.sendingOtp}</span>
                      </>
                    ) : (
                      <>
                        <AppIcon name="send" size={14} />
                        <span>{cfgAdmin.sendOtpBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className={styles.adminForm}>
                {adminError && (
                  <div className={styles.errorBanner} role="alert">
                    {adminError}
                  </div>
                )}

                <div className={styles.otpNotice}>
                  Kode OTP 6-digit telah dikirim ke <strong>{adminEmail}</strong>.
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.inputLabel} htmlFor="admin-otp">
                    {cfgAdmin.otpLabel}
                  </label>
                  <input
                    id="admin-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={adminOtp}
                    onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className={`${styles.textInput} ${styles.otpInput}`}
                    disabled={isSubmittingAdmin}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>

                <div className={styles.resendRow}>
                  <button
                    type="button"
                    className={styles.backEmailBtn}
                    onClick={() => {
                      setAdminStep("email");
                      setAdminOtp("");
                      setAdminError("");
                    }}
                    disabled={isSubmittingAdmin}
                  >
                    <AppIcon name="arrow-left" size={13} />
                    <span>{cfgAdmin.changeEmailBtn}</span>
                  </button>

                  <button
                    type="button"
                    className={styles.resendLinkBtn}
                    onClick={() => handleSendOtp()}
                    disabled={isSubmittingAdmin || resendTimer > 0}
                  >
                    {resendTimer > 0
                      ? cfgAdmin.resendCooldown.replace("{seconds}", String(resendTimer))
                      : cfgAdmin.resendBtn}
                  </button>
                </div>

                <div className={styles.adminModalActions}>
                  <button
                    type="button"
                    className={styles.cancelModalBtn}
                    onClick={() => {
                      setShowAdminModal(false);
                      setAdminStep("email");
                      setAdminOtp("");
                    }}
                    disabled={isSubmittingAdmin}
                  >
                    {cfgAdmin.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    className={styles.submitModalBtn}
                    disabled={isSubmittingAdmin || adminOtp.length < 6}
                  >
                    {isSubmittingAdmin ? (
                      <>
                        <span className={styles.spinner} aria-hidden="true" />
                        <span>{cfgAdmin.verifying}</span>
                      </>
                    ) : (
                      <>
                        <AppIcon name="check-circle" size={15} />
                        <span>{cfgAdmin.verifyBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

