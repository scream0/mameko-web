"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./LegalLayout.module.css";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import legalConfig from "@/data/ui/legalLayoutConfig.json";

export interface TOCSection {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  badge: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: TOCSection[];
  summary: string;
  children: React.ReactNode;
}

export function LegalLayout({
  badge,
  title,
  subtitle,
  lastUpdated,
  sections,
  summary,
  children,
}: LegalLayoutProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (sections.length > 0) {
      setActiveId(sections[0].id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className={styles.legalPage}>
      <Navbar />

      <header className={styles.legalHeader}>
        <div className={styles.headerContainer}>
          <Link href="/" className={styles.backLink}>
            <AppIcon name="arrow-left" size={16} />
            <span>{legalConfig.backToHome}</span>
          </Link>

          <div>
            <span className={styles.badge}>
              <AppIcon name="shield-check" size={14} />
              {badge}
            </span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>

            <div className={styles.metaInfo}>
              <span className={styles.metaItem}>
                <AppIcon name="clock" size={14} />
                {legalConfig.lastUpdatedPrefix}{lastUpdated}
              </span>
              <span className={styles.metaItem}>
                <AppIcon name="file-text" size={14} />
                {legalConfig.officialDocLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>
          {/* Sticky Table of Contents */}
          <aside className={styles.sidebar} aria-label={legalConfig.tocAriaLabel}>
            <div className={styles.tocTitle}>{legalConfig.tocTitle}</div>
            <nav>
              <ul className={styles.tocList}>
                {sections.map(({ id, title }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`${styles.tocItem} ${
                        activeId === id ? styles.tocItemActive : ""
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        const target = document.getElementById(id);
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth" });
                          setActiveId(id);
                        }
                      }}
                    >
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main Article */}
          <article className={styles.article}>
            {summary && (
              <div className={styles.summaryCallout}>
                <h3>
                  <AppIcon name="shield-check" size={18} />
                  {legalConfig.quickSummaryTitle}
                </h3>
                <p>{summary}</p>
              </div>
            )}

            {children}
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
