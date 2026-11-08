"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Particles } from "./404Particles";
import { Logo } from "@/components/UI/Logo/logo";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import notFoundConfig from "@/data/ui/notFoundConfig.json";
import styles from "./not-found.module.css";

export default function NotFound() {
  const [quote, setQuote] = useState(
    notFoundConfig?.quotes?.[0] || "Aroma adalah kenangan yang tak bisa diucapkan."
  );

  useEffect(() => {
    const quotesArray = notFoundConfig?.quotes || [];
    if (quotesArray.length > 0) {
      try {
        const lastIndex = window.sessionStorage.getItem("lastQuoteIndex");
        let randomIndex = Math.floor(Math.random() * quotesArray.length);

        if (quotesArray.length > 1 && lastIndex !== null) {
          while (randomIndex === Number.parseInt(lastIndex, 10)) {
            randomIndex = Math.floor(Math.random() * quotesArray.length);
          }
        }

        window.sessionStorage.setItem("lastQuoteIndex", randomIndex.toString());
        setQuote(quotesArray[randomIndex]);
      } catch {
        // Fallback jika sessionStorage dinonaktifkan
        setQuote(quotesArray[0]);
      }
    }
  }, []);

  return (
    <main className={styles.notFoundContainer}>
      <Particles />

      <section className={styles.notFoundContent}>
        {/* Brand Logo */}
        <div className={styles.brandLogoWrap}>
          <Logo />
        </div>

        {/* Status Badge */}
        <div className={styles.badgePill}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span>{notFoundConfig.badge}</span>
        </div>

        {/* Error Code & Titles */}
        <h1 className={styles.errorCode}>
          {notFoundConfig.content.errorCode}
        </h1>

        <h2 className={styles.errorTitle}>
          {notFoundConfig.content.title}
        </h2>

        <p className={styles.errorQuote}>
          <q>{quote}</q>
        </p>

        <p className={styles.errorDesc}>
          {notFoundConfig.content.description}
        </p>

        {/* Action CTAs */}
        <div className={styles.actionGroup}>
          <Link
            href={notFoundConfig.buttons.homeHref}
            className={styles.btnPrimary}
          >
            <AppIcon name="home" size={16} />
            <span>{notFoundConfig.buttons.backHome}</span>
          </Link>

          <Link
            href={notFoundConfig.buttons.exploreHref}
            className={styles.btnSecondary}
          >
            <AppIcon name="shopping-bag" size={16} />
            <span>{notFoundConfig.buttons.exploreProducts}</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
