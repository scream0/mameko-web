"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import errorConfig from "@/data/ui/errorConfig.json";
import styles from "./error.module.css";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log di console untuk developer debugging
    console.error("[Mameko App Router Boundary Caught Error]:", error);
  }, [error]);

  return (
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

          <Link href={errorConfig.buttons.homeHref} className={styles.btnSecondary}>
            <AppIcon name="home" size={16} />
            <span>{errorConfig.buttons.backHome}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

