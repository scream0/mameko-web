"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LegalLayout, TOCSection } from "@/components/Legal/LegalLayout";
import styles from "@/components/Legal/LegalLayout.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getPublicSettings } from "@/services/settingsService";
import privacyConfig from "@/data/ui/privacyConfig.json";

const baseSections: TOCSection[] = [
  { id: "pendahuluan", title: privacyConfig.toc.intro },
  { id: "data-dikumpulkan", title: privacyConfig.toc.dataCollected },
  { id: "tujuan-pemrosesan", title: privacyConfig.toc.purposes },
  { id: "pihak-ketiga", title: privacyConfig.toc.thirdParties },
  { id: "keamanan-retensi", title: privacyConfig.toc.security },
  { id: "hak-pengguna", title: privacyConfig.toc.userRights },
  { id: "cookie-pelacak", title: privacyConfig.toc.cookies },
  { id: "klausul-admin", title: privacyConfig.toc.adminClause },
  { id: "kontak", title: privacyConfig.toc.contact },
];

export function PrivacyClient() {
  const [legalData, setLegalData] = useState<any>({
    title: privacyConfig.defaults.title,
    subtitle: privacyConfig.defaults.subtitle,
    lastUpdated: privacyConfig.defaults.lastUpdated,
    summary: privacyConfig.defaults.summary,
    content: "",
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        const p = data?.legal?.privacy;
        if (p && isMounted) {
          setLegalData((prev: any) => ({
            title: p.title?.trim() ? p.title : prev.title,
            subtitle: p.subtitle?.trim() ? p.subtitle : prev.subtitle,
            lastUpdated: p.lastUpdated?.trim() ? p.lastUpdated : prev.lastUpdated,
            summary: p.summary?.trim() ? p.summary : prev.summary,
            content: p.content?.trim() ? p.content : "",
          }));
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan legal privasi:", err);
      }
    };

    fetchSettings();

    const handleUpdate = () => fetchSettings();
    window.addEventListener("store-settings-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("store-settings-updated", handleUpdate);
    };
  }, []);

  const sections = legalData.content
    ? baseSections
    : baseSections.filter((s) => s.id !== "klausul-admin");

  return (
    <LegalLayout
      badge={privacyConfig.badge}
      title={legalData.title}
      subtitle={legalData.subtitle}
      lastUpdated={legalData.lastUpdated}
      sections={sections}
      summary={legalData.summary}
    >
      {/* 1. Pendahuluan */}
      <section id="pendahuluan" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>1</span>
          {privacyConfig.sections.intro.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.intro.p1}
        </p>
        <p className={styles.paragraph}>
          {privacyConfig.sections.intro.p2}
        </p>
      </section>

      {/* 2. Data yang Dikumpulkan */}
      <section id="data-dikumpulkan" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>2</span>
          {privacyConfig.sections.dataCollected.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.dataCollected.intro}
        </p>

        <div className={styles.cardGrid}>
          {privacyConfig.sections.dataCollected.cards.map((card, idx) => (
            <div key={idx} className={styles.subCard}>
              <div className={styles.subCardTitle}>
                <AppIcon name={card.icon} size={16} />
                {card.title}
              </div>
              <p className={styles.subCardText}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Tujuan Pemrosesan Data */}
      <section id="tujuan-pemrosesan" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>3</span>
          {privacyConfig.sections.purposes.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.purposes.intro}
        </p>
        <ul className={styles.list}>
          {privacyConfig.sections.purposes.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Pihak Ketiga & Integrasi */}
      <section id="pihak-ketiga" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>4</span>
          {privacyConfig.sections.thirdParties.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.thirdParties.intro}
        </p>
        <ul className={styles.list}>
          {privacyConfig.sections.thirdParties.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>
        <p className={styles.paragraph}>
          {privacyConfig.sections.thirdParties.footer}
        </p>
      </section>

      {/* 5. Keamanan & Retensi */}
      <section id="keamanan-retensi" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>5</span>
          {privacyConfig.sections.security.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.security.intro}
        </p>
        <ul className={styles.list}>
          {privacyConfig.sections.security.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
        <p className={styles.paragraph}>
          <strong>{privacyConfig.sections.security.retentionLabel}</strong> {privacyConfig.sections.security.retentionDesc}
        </p>
      </section>

      {/* 6. Hak Pemilik Data Pribadi */}
      <section id="hak-pengguna" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>6</span>
          {privacyConfig.sections.userRights.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.userRights.intro}
        </p>
        <ul className={styles.list}>
          {privacyConfig.sections.userRights.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>

        <div className={`${styles.summaryCallout} ${styles.summaryCalloutWithMargin}`}>
          <h3>
            <AppIcon name="trash-2" size={18} />
            {privacyConfig.sections.userRights.deletionCallout.title}
          </h3>
          <p className={styles.calloutDesc}>
            {privacyConfig.sections.userRights.deletionCallout.description}
          </p>
          <Link
            href={privacyConfig.sections.userRights.deletionCallout.href}
            className={styles.summaryLink}
          >
            {privacyConfig.sections.userRights.deletionCallout.buttonText}
          </Link>
        </div>
      </section>

      {/* 7. Cookie & Teknologi Pelacak */}
      <section id="cookie-pelacak" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>7</span>
          {privacyConfig.sections.cookies.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.cookies.intro}
        </p>
        <ul className={styles.list}>
          {privacyConfig.sections.cookies.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
        <p className={styles.paragraph}>
          {privacyConfig.sections.cookies.footer}
        </p>
      </section>

      {/* 8. Klausul Tambahan Toko (Jika dikustomisasi oleh Admin) */}
      {legalData.content && (
        <section id="klausul-admin" className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNumber}>8</span>
            {privacyConfig.sections.adminClause.title}
          </h2>
          <div className={`${styles.summaryCallout} ${styles.adminClauseText}`}>
            {legalData.content}
          </div>
        </section>
      )}

      {/* 9. Kontak */}
      <section id="kontak" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>{legalData.content ? "9" : "8"}</span>
          {privacyConfig.sections.contact.title}
        </h2>
        <p className={styles.paragraph}>
          {privacyConfig.sections.contact.intro}
        </p>
        <div className={styles.contactBanner}>
          <h4>{privacyConfig.sections.contact.bannerTitle}</h4>
          <p>{privacyConfig.sections.contact.email}</p>
          <p>{privacyConfig.sections.contact.instagram}</p>
          <p>{privacyConfig.sections.contact.hours}</p>
        </div>
      </section>
    </LegalLayout>
  );
}
