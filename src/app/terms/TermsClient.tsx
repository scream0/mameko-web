"use client";

import React, { useState, useEffect } from "react";
import { LegalLayout, TOCSection } from "@/components/Legal/LegalLayout";
import styles from "@/components/Legal/LegalLayout.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { getPublicSettings } from "@/services/settingsService";

const baseSections: TOCSection[] = [
  { id: "ketentuan-umum", title: "1. Ketentuan Umum & Akun" },
  { id: "produk-artisanal", title: "2. Karakteristik Produk Artisanal" },
  { id: "pemesanan-harga", title: "3. Pemesanan & Harga" },
  { id: "pembayaran", title: "4. Pembayaran & Batas Waktu" },
  { id: "pengiriman", title: "5. Pengiriman & Logistik" },
  { id: "kebijakan-retur", title: "6. Kebijakan Retur & Komplain" },
  { id: "hak-cipta", title: "7. Hak Kekayaan Intelektual" },
  { id: "klausul-admin", title: "8. Ketentuan Khusus Toko" },
  { id: "hukum-berlaku", title: "9. Batasan Tanggung Jawab & Hukum" },
];

export function TermsClient() {
  const [legalData, setLegalData] = useState<any>({
    title: "Syarat & Ketentuan",
    subtitle: "Panduan dan perjanjian hukum yang mengikat dalam setiap transaksi dan penggunaan platform Make Me Kool.",
    lastUpdated: "7 Oktober 2026",
    summary: "Dengan melakukan pemesanan atau menggunakan platform Make Me Kool (Mameko), Anda menyetujui seluruh ketentuan pemesanan, verifikasi pembayaran Midtrans, pengiriman logistik, serta kewajiban menyertakan video unboxing utuh untuk setiap klaim garansi produk.",
    content: "",
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

  const sections = legalData.content
    ? baseSections
    : baseSections.filter((s) => s.id !== "klausul-admin");

  return (
    <LegalLayout
      badge="Perjanjian Layanan"
      title={legalData.title}
      subtitle={legalData.subtitle}
      lastUpdated={legalData.lastUpdated}
      sections={sections}
      summary={legalData.summary}
    >
      {/* 1. Ketentuan Umum & Akun */}
      <section id="ketentuan-umum" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>1</span>
          Ketentuan Umum &amp; Akun
        </h2>
        <p className={styles.paragraph}>
          Syarat dan Ketentuan ini (&ldquo;Ketentuan&rdquo;) mengatur hak dan kewajiban antara pembeli (&ldquo;Pengguna&rdquo;, &ldquo;Anda&rdquo;) dan <strong>Make Me Kool (&ldquo;Mameko&rdquo;, &ldquo;kami&rdquo;)</strong> dalam penggunaan platform web dan pembelian barang.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Kelayakan Usia:</strong> Anda menyatakan telah berusia minimal 18 tahun atau memiliki kecakapan hukum untuk melakukan perikatan jual-beli yang sah berdasarkan hukum Republik Indonesia.
          </li>
          <li>
            <strong>Keamanan Akun:</strong> Anda bertanggung jawab penuh untuk menjaga kerahasiaan kata sandi akun, kode OTP, dan aktivitas yang terjadi di bawah akun Anda.
          </li>
          <li>
            <strong>Ketepatan Data:</strong> Anda wajib memberikan informasi alamat, email, dan nomor telepon yang akurat untuk kelancaran verifikasi dan pengantaran paket.
          </li>
        </ul>
      </section>

      {/* 2. Karakteristik Produk Artisanal */}
      <section id="produk-artisanal" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>2</span>
          Karakteristik Produk Artisanal
        </h2>
        <p className={styles.paragraph}>
          Produk yang ditawarkan oleh Mameko merupakan karya artisanal (*handcrafted/small-batch*):
        </p>
        <div className={styles.cardGrid}>
          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>
              <AppIcon name="package" size={16} />
              Variasi Alami
            </div>
            <p className={styles.subCardText}>
              Karena diracik dan dibuat secara cermat dalam kelompok kecil (*small batch*), sedikit perbedaan warna tekstur atau kemasan minor merupakan ciri otentik produk kerajinan tangan.
            </p>
          </div>

          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>
              <AppIcon name="image" size={16} />
              Akurasi Foto &amp; Layar
            </div>
            <p className={styles.subCardText}>
              Kami berupaya semaksimal mungkin menampilkan warna yang akurat. Namun, perbedaan kalibrasi layar monitor atau ponsel Anda dapat menimbulkan sedikit perbedaan persepsi visual.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Pemesanan & Harga */}
      <section id="pemesanan-harga" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>3</span>
          Pemesanan &amp; Harga
        </h2>
        <p className={styles.paragraph}>
          Ketentuan mengenai pemesanan produk dan penetapan harga:
        </p>
        <ul className={styles.list}>
          <li>
            Seluruh harga produk yang ditampilkan tercantum dalam mata uang <strong>Rupiah Indonesia (IDR)</strong> dan belum termasuk biaya ongkos kirim kecuali dinyatakan secara eksplisit melalui promo/voucher.
          </li>
          <li>
            Mameko berhak mengubah harga sewaktu-waktu tanpa pemberitahuan sebelumnya, namun perubahan tersebut tidak akan memengaruhi pesanan yang telah dibayar lunas.
          </li>
          <li>
            Kami berhak membatalkan pesanan secara sepihak jika terjadi kesalahan sistem penentuan harga (*pricing glitch*) atau kendala stok mendadak, dengan komitmen pengembalian dana 100% kepada pembeli.
          </li>
        </ul>
      </section>

      {/* 4. Pembayaran & Batas Waktu */}
      <section id="pembayaran" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>4</span>
          Pembayaran &amp; Batas Waktu Transaksi
        </h2>
        <p className={styles.paragraph}>
          Pembayaran dilakukan melalui portal gerbang pembayaran resmi <strong>Midtrans Snap</strong>:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Metode Pembayaran:</strong> Kami mendukung QRIS (GoPay, OVO, Dana, ShopeePay, BCA Mobile, dll.), Virtual Account Bank (BCA, Mandiri, BNI, BRI, Permata), dan kartu debit/kredit yang didukung.
          </li>
          <li>
            <strong>Batas Waktu Pembayaran (Expiry):</strong> Setiap nomor transaksi atau QRIS memiliki batas kedaluwarsa waktu. Apabila pembayaran tidak diselesaikan sebelum batas waktu berakhir, pesanan akan secara otomatis dibatalkan oleh sistem.
          </li>
          <li>
            <strong>Konfirmasi Otomatis:</strong> Pesanan akan segera masuk ke tahap proses pengemasan setelah sistem kami menerima notifikasi status <em>settlement</em> sukses dari Midtrans.
          </li>
        </ul>
      </section>

      {/* 5. Pengiriman & Logistik */}
      <section id="pengiriman" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>5</span>
          Pengiriman &amp; Logistik
        </h2>
        <p className={styles.paragraph}>
          Ketentuan terkait pengantaran pesanan fisik:
        </p>
        <ul className={styles.list}>
          <li>
            Pengiriman difasilitasi oleh agregator kurir <strong>Biteship</strong> dengan mitra ekspedisi terpercaya (JNE, J&amp;T, SiCepat, AnterAja, dan lainnya).
          </li>
          <li>
            <strong>Waktu Proses:</strong> Pesanan yang masuk akan diproses dan dikemas dalam waktu 1&ndash;2 hari kerja (tidak termasuk hari Minggu dan hari libur nasional).
          </li>
          <li>
            <strong>Estimasi Sampai:</strong> Estimasi lama pengiriman yang tercantum di halaman checkout merupakan perkiraan dari pihak ekspedisi dan dapat dipengaruhi oleh kondisi cuaca atau kendala operasional lapangan.
          </li>
          <li>
            <strong>Nomor Resi:</strong> Pelacakan resi akan diperbarui secara otomatis di halaman akun dan rincian pesanan Anda segera setelah paket diserahkan ke kurir.
          </li>
        </ul>
      </section>

      {/* 6. Kebijakan Retur & Komplain */}
      <section id="kebijakan-retur" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>6</span>
          Kebijakan Retur, Komplain, &amp; Refund
        </h2>
        <p className={styles.paragraph}>
          Kepuasan Anda adalah prioritas kami. Jika Anda menerima barang yang salah, kurang, atau rusak selama pengiriman:
        </p>

        <div className={styles.summaryCallout}>
          <h3>
            <AppIcon name="alert-triangle" size={18} />
            Syarat Mutlak: Video Unboxing Utuh
          </h3>
          <p>
            Komplain kerusakan atau kekurangan barang hanya dapat diproses apabila disertai rekaman video unboxing utuh tanpa jeda (tanpa cut/edit), mulai dari resi fisik masih utuh tertempel hingga produk dikeluarkan dari kemasan pembungkus.
          </p>
        </div>

        <ul className={styles.list}>
          <li>
            <strong>Batas Waktu Pengajuan:</strong> Komplain wajib diajukan maksimal <strong>2x24 jam</strong> sejak status resi dinyatakan &ldquo;Delivered&rdquo; oleh pihak kurir.
          </li>
          <li>
            <strong>Kondisi Barang:</strong> Barang yang diretur wajib berada dalam kondisi belum terpakai, belum dicuci, dan segel/label produk masih utuh.
          </li>
          <li>
            <strong>Solusi Komplain:</strong> Mameko akan memberikan solusi berupa pengiriman produk pengganti (dengan ongkir ditanggung pihak kami) atau pengembalian dana (*refund*) sesuai kesepakatan bersama.
          </li>
        </ul>
      </section>

      {/* 7. Hak Kekayaan Intelektual */}
      <section id="hak-cipta" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>7</span>
          Hak Kekayaan Intelektual
        </h2>
        <p className={styles.paragraph}>
          Seluruh konten yang terdapat di platform Mameko, termasuk namun tidak terbatas pada teks, logo merek &ldquo;Make Me Kool&rdquo; / &ldquo;Mameko&rdquo;, desain grafis, foto produk, tata letak antarmuka, dan kode sumber adalah milik eksklusif Make Me Kool yang dilindungi oleh undang-undang hak cipta dan merek dagang Republik Indonesia. Penggandaan, distribusi, atau modifikasi tanpa izin tertulis dari kami dilarang keras.
        </p>
      </section>

      {/* 8. Klausul Khusus Toko (Jika dikustomisasi oleh Admin) */}
      {legalData.content && (
        <section id="klausul-admin" className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNumber}>8</span>
            Ketentuan Khusus Toko
          </h2>
          <div className={styles.summaryCallout} style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {legalData.content}
          </div>
        </section>
      )}

      {/* 9. Batasan Tanggung Jawab & Hukum yang Berlaku */}
      <section id="hukum-berlaku" className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionNumber}>{legalData.content ? "9" : "8"}</span>
          Batasan Tanggung Jawab &amp; Hukum yang Berlaku
        </h2>
        <p className={styles.paragraph}>
          Mameko tidak bertanggung jawab atas kerugian tidak langsung atau keterlambatan pengiriman yang disebabkan oleh keadaan kahar (*Force Majeure*), termasuk namun tidak terbatas pada bencana alam, huru-hara, kebijakan lockdown pemerintah, atau gangguan massal jaringan telekomunikasi.
        </p>
        <p className={styles.paragraph}>
          Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Negara Republik Indonesia. Segala perselisihan yang timbul akan diselesaikan terlebih dahulu melalui musyawarah untuk mufakat dalam jangka waktu 30 hari sebelum dibawa ke jalur hukum di pengadilan negeri yurisdiksi domisili kami.
        </p>
      </section>
    </LegalLayout>
  );
}
