"use client";

import { useEffect } from "react";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import errorConfig from "@/data/ui/errorConfig.json";
import styles from "./error.module.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootGlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Mameko Root Layout Global Error Caught]:", error);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0 }}>
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <div className={styles.iconWrapper}>
              <AppIcon name="alert-triangle" size={28} />
            </div>

            <h1 className={styles.errorCode}>{errorConfig.content.errorCode}</h1>
            <h2 className={styles.errorTitle}>{errorConfig.content.title}</h2>
            <p className={styles.errorSubtitle}>{errorConfig.content.subtitle}</p>
            <p className={styles.errorDesc}>{errorConfig.content.description}</p>

            <div className={styles.actionGroup}>
              <button
                type="button"
                onClick={() => reset()}
                className={styles.btnPrimary}
              >
                <AppIcon name="refresh-cw" size={16} />
                <span>{errorConfig.buttons.retry}</span>
              </button>

              <a href={errorConfig.buttons.homeHref} className={styles.btnSecondary}>
                <AppIcon name="home" size={16} />
                <span>{errorConfig.buttons.backHome}</span>
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

