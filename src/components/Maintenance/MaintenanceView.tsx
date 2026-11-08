"use client";

import { Logo } from "@/components/UI/Logo/logo";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import maintenanceConfig from "@/data/ui/maintenanceConfig.json";
import styles from "./MaintenanceView.module.css";

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
}

export function MaintenanceView({
  countdown,
  isChecking,
  onCheckNow,
  details,
}: MaintenanceViewProps) {
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
      </div>
    </div>
  );
}

