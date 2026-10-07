"use client";

import React, { useState, useEffect } from "react";
import { LegalLayout, TOCSection } from "@/components/Legal/LegalLayout";
import styles from "@/components/Legal/LegalLayout.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getPublicSettings } from "@/services/settingsService";

const baseSections: TOCSection[] = [
  { id: "pendahuluan", title: "1. Pendahuluan" },
  { id: "data-dikumpulkan", title: "2. Data yang Kami Kumpulkan" },
  { id: "tujuan-pemrosesan", title: "3. Tujuan Pemrosesan Data" },
  { id: "pihak-ketiga", title: "4. Pihak Ketiga & Integrasi" },
  { id: "keamanan-retensi", title: "5. Keamanan & Retensi Data" },
  { id: "hak-pengguna", title: "6. Hak Pemilik Data Pribadi" },
  { id: "cookie-pelacak", title: "7. Cookie & Teknologi Pelacak" },
  { id: "klausul-admin", title: "8. Ketentuan Tambahan Toko" },
  { id: "kontak", title: "9. Kontak & Pengaduan" },
];

export function PrivacyClient() {
  const [legalData, setLegalData] = useState<any>({
    title: "Kebijakan Privasi",
    subtitle: "Komitmen Make Me Kool dalam menjaga transparansi, privasi, dan keamanan data pribadi Anda di setiap interaksi.",
    lastUpdated: "7 Oktober 2026",
    summary: "Make Me Kool (Mameko) hanya mengumpulkan data yang esensial untuk memproses pesanan, memfasilitasi pengiriman, dan memberikan pengalaman berbelanja yang nyaman. Kami tidak memperjualbelikan data pribadi Anda ke pihak manapun dan selalu mematuhi Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27 Tahun 2022).",
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
      badge="Perlindungan Data"
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
          Pendahuluan
        </h2>
        <p className={styles.paragraph}>
          Selamat datang di platform digital <strong>Make Me Kool (&ldquo;Mameko&rdquo;, &ldquo;kami&rdquo;)</strong>. 
          Kebijakan Privasi ini menerangkan cara kami mengumpulkan, menggunakan, menyimpan, mengungkapkan, dan melindungi Data Pribadi pengguna (&ldquo;Anda&rdquo;) saat mengunjungi situs web, membuat akun, bertransaksi, atau berinteraksi dengan layanan kami.
        </p>
        <p className={styles.paragraph}>
          Dengan mengakses atau menggunakan layanan Mameko, Anda mengakui bahwa Anda telah membaca, memahami, dan menyetujui seluruh ketentuan yang tercantum dalam Kebijakan Privasi ini. Kebijakan ini disusun dengan mematuhi peraturan perundang-undangan Republik Indonesia, khususnya Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
        </p>
      </section>

      {/* 2. Data yang Dikumpulkan */}
      <section id="data-dikumpulkan" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>2</span>
          Data yang Kami Kumpulkan
        </h2>
        <p className={styles.paragraph}>
          Untuk memberikan pengalaman berbelanja yang optimal, kami mengumpulkan kategori data berikut:
        </p>

        <div className={styles.cardGrid}>
          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>
              <AppIcon name="user" size={16} />
              Identitas &amp; Akun
            </div>
            <p className={styles.subCardText}>
              Nama lengkap, alamat email, nomor telepon/WhatsApp, dan kredensial autentikasi yang dienkripsi secara aman melalui Supabase Auth.
            </p>
          </div>

          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>
              <AppIcon name="map-pin" size={16} />
              Pengiriman &amp; Alamat
            </div>
            <p className={styles.subCardText}>
              Nama penerima, nomor kontak penerima, alamat tujuan lengkap, kode pos, dan titik koordinat/area Biteship untuk kalkulasi kurir.
            </p>
          </div>

          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>
              <AppIcon name="credit-card" size={16} />
              Transaksi &amp; Pembayaran
            </div>
            <p className={styles.subCardText}>
              Nomor pesanan, rincian barang, total pembayaran, status transaksi Midtrans. <em>Kami tidak pernah menyimpan nomor kartu kredit atau PIN Anda.</em>
            </p>
          </div>

          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>
              <AppIcon name="settings" size={16} />
              Teknis &amp; Perangkat
            </div>
            <p className={styles.subCardText}>
              Alamat IP, tipe peramban (browser), sistem operasi, preferensi tema (Light/Dark), serta log diagnostik performa aplikasi.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Tujuan Pemrosesan Data */}
      <section id="tujuan-pemrosesan" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>3</span>
          Tujuan Pemrosesan Data
        </h2>
        <p className={styles.paragraph}>
          Data pribadi Anda dikumpulkan dan diproses secara sah berdasarkan persetujuan dan dasar hukum yang berlaku untuk keperluan:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Penyelesaian Transaksi:</strong> Memproses pembelian, mengonfirmasi pembayaran otomatis, dan menerbitkan struk atau bukti transaksi.
          </li>
          <li>
            <strong>Operasional Logistik:</strong> Meneruskan data pengiriman kepada mitra kurir logistik (melalui sistem integrasi Biteship) agar pesanan tiba dengan akurat.
          </li>
          <li>
            <strong>Layanan Pelanggan:</strong> Merespons pertanyaan, kendala pemesanan, atau memfasilitasi klaim garansi produk dan penukaran.
          </li>
          <li>
            <strong>Peningkatan Kualitas Layanan:</strong> Menganalisis preferensi pengguna untuk menghadirkan rekomendasi produk artisanal yang relevan dan meningkatkan kecepatan antarmuka web.
          </li>
          <li>
            <strong>Kepatuhan Hukum:</strong> Memenuhi kewajiban perpajakan, audit pencatatan komersial, dan peraturan perundang-undangan yang sah di Indonesia.
          </li>
        </ul>
      </section>

      {/* 4. Pihak Ketiga & Integrasi */}
      <section id="pihak-ketiga" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>4</span>
          Pihak Ketiga &amp; Integrasi Layanan
        </h2>
        <p className={styles.paragraph}>
          Dalam menjalankan operasional toko, kami bekerja sama dengan penyedia layanan teknologi terpercaya sebagai sub-prosesor data:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Supabase Inc:</strong> Menyediakan infrastruktur database PostgreSQL berstandar enterprise dengan Row-Level Security (RLS) dan manajemen sesi otentikasi JWT.
          </li>
          <li>
            <strong>PT Midtrans:</strong> Gerbang pembayaran resmi berizin Bank Indonesia yang memfasilitasi transaksi QRIS, Transfer Bank (Virtual Account), dan kartu secara terenkripsi (PCI-DSS Level 1 compliant).
          </li>
          <li>
            <strong>Biteship &amp; Mitra Ekspedisi (JNE, J&amp;T, SiCepat, dll.):</strong> Menerima data nama penerima, kontak, dan alamat untuk keperluan pengantaran paket pesanan.
          </li>
          <li>
            <strong>Cloudinary:</strong> Jaringan distribusi konten (CDN) untuk penyimpanan dan optimalisasi pengiriman gambar produk serta ulasan pelanggan.
          </li>
        </ul>
        <p className={styles.paragraph}>
          Kami mewajibkan setiap mitra pihak ketiga mematuhi standar perlindungan data yang ketat dan tidak diperbolehkan menggunakan data Anda selain untuk tujuan yang kami tentukan.
        </p>
      </section>

      {/* 5. Keamanan & Retensi */}
      <section id="keamanan-retensi" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>5</span>
          Keamanan &amp; Retensi Data
        </h2>
        <p className={styles.paragraph}>
          Kami menerapkan langkah-langkah teknis dan organisasional untuk melindungi integritas dan kerahasiaan data Anda:
        </p>
        <ul className={styles.list}>
          <li>Enkripsi data transit menggunakan protokol Transport Layer Security (TLS 1.3 / SSL).</li>
          <li>Infrastruktur API terlindungi di balik jaringan privat Cloudflare Tunnel dengan pembatasan IP dan otentikasi JWT ganda.</li>
          <li>Pemberlakuan hak akses terbatas (*Principle of Least Privilege*) pada database administratif.</li>
        </ul>
        <p className={styles.paragraph}>
          <strong>Periode Retensi:</strong> Kami menyimpan data transaksi selama minimal 5 (lima) tahun sesuai dengan regulasi pembukuan dan perpajakan di Indonesia. Data akun non-transaksional dapat disimpan selama akun Anda berstatus aktif atau hingga Anda mengajukan permintaan penghapusan akun.
        </p>
      </section>

      {/* 6. Hak Pemilik Data Pribadi */}
      <section id="hak-pengguna" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>6</span>
          Hak Pemilik Data Pribadi (UU PDP)
        </h2>
        <p className={styles.paragraph}>
          Sesuai dengan Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda memiliki hak-hak fundamental berikut:
        </p>
        <ul className={styles.list}>
          <li><strong>Hak Akses:</strong> Meminta konfirmasi dan salinan data pribadi Anda yang kami proses.</li>
          <li><strong>Hak Koreksi:</strong> Memperbarui atau membetulkan data pribadi yang tidak akurat melalui halaman profil akun atau bantuan admin.</li>
          <li><strong>Hak Penghapusan (Erasure):</strong> Meminta penghapusan akun dan data pribadi Anda sepanjang tidak bertentangan dengan kewajiban retensi hukum atau transaksi berjalan.</li>
          <li><strong>Hak Menarik Persetujuan:</strong> Menarik kembali persetujuan pemrosesan data untuk kepentingan pemasaran kapan saja.</li>
        </ul>

        <div className={styles.summaryCallout} style={{ marginTop: "1.5rem" }}>
          <h3>
            <AppIcon name="trash-2" size={18} />
            Pengajuan Permintaan Penghapusan Akun &amp; Data
          </h3>
          <p style={{ marginBottom: "0.85rem" }}>
            Anda dapat menghapus akun secara mandiri (jika sedang masuk) atau mengajukan permohonan verifikasi penghapusan data secara tertulis melalui portal resmi kami:
          </p>
          <a
            href="/delete-account"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 700,
              color: "var(--secondary)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
              fontSize: "0.9rem",
            }}
          >
            Buka Portal Permintaan Penghapusan Akun &amp; Data &rarr;
          </a>
        </div>
      </section>

      {/* 7. Cookie & Teknologi Pelacak */}
      <section id="cookie-pelacak" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>7</span>
          Cookie &amp; Teknologi Pelacak
        </h2>
        <p className={styles.paragraph}>
          Platform kami memanfaatkan cookie dan media penyimpanan lokal (*localStorage*) untuk:
        </p>
        <ul className={styles.list}>
          <li>Menjaga sesi masuk Anda tetap aman (*Strictly Necessary*).</li>
          <li>Menyimpan produk yang ada di keranjang belanja Anda saat berpindah halaman (*Strictly Necessary*).</li>
          <li>Mengingat preferensi tampilan seperti mode tema Gelap atau Terang (*Preferences*).</li>
          <li>Mengumpulkan statistik agregat anonim mengenai performa situs web (*Analytics*).</li>
        </ul>
        <p className={styles.paragraph}>
          Anda dapat mengatur preferensi cookie opsional kapan saja melalui banner Cookie Consent atau melalui tautan <strong>&ldquo;Pengaturan Cookie&rdquo;</strong> di bagian footer situs web ini.
        </p>
      </section>

      {/* 8. Klausul Tambahan Toko (Jika dikustomisasi oleh Admin) */}
      {legalData.content && (
        <section id="klausul-admin" className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNumber}>8</span>
            Ketentuan Tambahan Toko
          </h2>
          <div className={styles.summaryCallout} style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {legalData.content}
          </div>
        </section>
      )}

      {/* 9. Kontak */}
      <section id="kontak" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>{legalData.content ? "9" : "8"}</span>
          Kontak &amp; Pengaduan
        </h2>
        <p className={styles.paragraph}>
          Apabila Anda memiliki pertanyaan, keberatan, atau ingin menggunakan hak-hak pelindungan data Anda, silakan hubungi tim kami melalui:
        </p>
        <div className={styles.contactBanner}>
          <h4>Make Me Kool (Mameko) Customer Care &amp; Data Protection</h4>
          <p>Email: <strong>privacy@mameko.my.id</strong> atau <strong>support@mameko.my.id</strong></p>
          <p>Instagram: <strong>@xar.project</strong></p>
          <p>Jam Operasional: Setiap Hari, 18.00 &ndash; 21.00 WIB</p>
        </div>
      </section>
    </LegalLayout>
  );
}
