"use client";

import React, { useState, useEffect } from "react";
import { LegalLayout, TOCSection } from "@/components/Legal/LegalLayout";
import styles from "@/components/Legal/LegalLayout.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getPublicSettings } from "@/services/settingsService";
import termsConfig from "@/data/ui/termsConfig.json";

const baseSections: TOCSection[] = [
  { id: "ketentuan-umum", title: termsConfig.toc.general },
  { id: "produk-artisanal", title: termsConfig.toc.artisanal },
  { id: "pemesanan-harga", title: termsConfig.toc.orders },
  { id: "pembayaran", title: termsConfig.toc.payment },
  { id: "pengiriman", title: termsConfig.toc.shipping },
  { id: "kebijakan-retur", title: termsConfig.toc.returns },
  { id: "hak-cipta", title: termsConfig.toc.ip },
  { id: "klausul-admin", title: termsConfig.toc.adminClause },
  { id: "hukum-berlaku", title: termsConfig.toc.liability },
];

export function TermsClient() {
  const [legalData, setLegalData] = useState<any>({
    title: termsConfig.defaults.title,
    subtitle: termsConfig.defaults.subtitle,
    lastUpdated: termsConfig.defaults.lastUpdated,
    summary: termsConfig.defaults.summary,
    content: "",
    sections: [],
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        const t = data?.legal?.terms;
        if (t && isMounted) {
          setLegalData((prev: any) => ({
            title: t.title?.trim() ? t.title : prev.title,
            subtitle: t.subtitle?.trim() ? t.subtitle : prev.subtitle,
            lastUpdated: t.lastUpdated?.trim() ? t.lastUpdated : prev.lastUpdated,
            summary: t.summary?.trim() ? t.summary : prev.summary,
            content: t.content?.trim() ? t.content : "",
            sections: Array.isArray(t.sections) && t.sections.length > 0 ? t.sections : [],
          }));
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan legal terms:", err);
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

  const hasCustomSections = Array.isArray(legalData.sections) && legalData.sections.length > 0;

  const sections: TOCSection[] = hasCustomSections
    ? [
        ...legalData.sections.map((sec: any, idx: number) => ({
          id: sec.id || `pasal-${idx + 1}`,
          title: sec.title || `Pasal ${idx + 1}`,
        })),
        ...(legalData.content
          ? [{ id: "klausul-admin", title: termsConfig.toc.adminClause }]
          : []),
      ]
    : legalData.content
    ? baseSections
    : baseSections.filter((s) => s.id !== "klausul-admin");

  return (
    <LegalLayout
      badge={termsConfig.badge}
      title={legalData.title}
      subtitle={legalData.subtitle}
      lastUpdated={legalData.lastUpdated}
      sections={sections}
      summary={legalData.summary}
    >
      {hasCustomSections ? (
        <>
          {legalData.sections.map((sec: any, idx: number) => {
            const secId = sec.id || `pasal-${idx + 1}`;

            return (
              <section key={secId} id={secId} className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionNumber}>{idx + 1}</span>
                  {sec.title}
                </h2>
                <div className={`${styles.paragraph} ${styles.adminClauseText}`}>
                  {sec.content}
                </div>
              </section>
            );
          })}

          {legalData.content && (
            <section id="klausul-admin" className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNumber}>{legalData.sections.length + 1}</span>
                {termsConfig.sections.adminClause.title}
              </h2>
              <div className={`${styles.summaryCallout} ${styles.adminClauseText}`}>
                {legalData.content}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* 1. Ketentuan Umum & Akun */}
      <section id="ketentuan-umum" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>1</span>
          {termsConfig.sections.general.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.general.p1}
        </p>
        <ul className={styles.list}>
          {termsConfig.sections.general.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Karakteristik Produk Artisanal */}
      <section id="produk-artisanal" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>2</span>
          {termsConfig.sections.artisanal.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.artisanal.intro}
        </p>
        <div className={styles.cardGrid}>
          {termsConfig.sections.artisanal.cards.map((card, idx) => (
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

      {/* 3. Pemesanan & Harga */}
      <section id="pemesanan-harga" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>3</span>
          {termsConfig.sections.orders.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.orders.intro}
        </p>
        <ul className={styles.list}>
          {termsConfig.sections.orders.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      {/* 4. Pembayaran & Batas Waktu */}
      <section id="pembayaran" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>4</span>
          {termsConfig.sections.payment.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.payment.intro}
        </p>
        <ul className={styles.list}>
          {termsConfig.sections.payment.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Pengiriman & Logistik */}
      <section id="pengiriman" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>5</span>
          {termsConfig.sections.shipping.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.shipping.intro}
        </p>
        <ul className={styles.list}>
          {termsConfig.sections.shipping.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>
      </section>

      {/* 6. Kebijakan Retur & Komplain */}
      <section id="kebijakan-retur" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>6</span>
          {termsConfig.sections.returns.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.returns.intro}
        </p>

        <div className={styles.summaryCallout}>
          <h3>
            <AppIcon name="alert-triangle" size={18} />
            {termsConfig.sections.returns.unboxingCallout.title}
          </h3>
          <p>
            {termsConfig.sections.returns.unboxingCallout.desc}
          </p>
        </div>

        <ul className={styles.list}>
          {termsConfig.sections.returns.items.map((item, idx) => (
            <li key={idx}>
              <strong>{item.label}</strong> {item.desc}
            </li>
          ))}
        </ul>
      </section>

      {/* 7. Hak Kekayaan Intelektual */}
      <section id="hak-cipta" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>7</span>
          {termsConfig.sections.ip.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.ip.content}
        </p>
      </section>

      {/* 8. Klausul Khusus Toko (Jika dikustomisasi oleh Admin) */}
      {legalData.content && (
        <section id="klausul-admin" className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNumber}>8</span>
            {termsConfig.sections.adminClause.title}
          </h2>
          <div className={`${styles.summaryCallout} ${styles.adminClauseText}`}>
            {legalData.content}
          </div>
        </section>
      )}

      {/* 9. Batasan Tanggung Jawab & Hukum yang Berlaku */}
      <section id="hukum-berlaku" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>{legalData.content ? "9" : "8"}</span>
          {termsConfig.sections.liability.title}
        </h2>
        <p className={styles.paragraph}>
          {termsConfig.sections.liability.p1}
        </p>
        <p className={styles.paragraph}>
          {termsConfig.sections.liability.p2}
        </p>
      </section>
        </>
      )}
    </LegalLayout>
  );
}
