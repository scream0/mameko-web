import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { DeleteAccountClient } from "./DeleteAccountClient";
import styles from "./DeleteAccount.module.css";

export const metadata: Metadata = {
  title: "Permintaan Penghapusan Akun & Data | Mameko",
  description:
    "Formulir resmi permintaan penghapusan akun dan data pribadi pengguna platform Make Me Kool (Mameko) sesuai standar UU Pelindungan Data Pribadi (UU PDP No. 27 Tahun 2022).",
};

export default function DeleteAccountPage() {
  return (
    <div className={styles.pageContainer}>
      <Navbar />

      <header className={styles.headerSection}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.backLink}>
            <AppIcon name="arrow-left" size={16} />
            <span>Kembali ke Beranda</span>
          </Link>

          <div>
            <span className={styles.dangerBadge}>
              <AppIcon name="shield-check" size={14} />
              Kepatuhan Privasi &amp; UU PDP
            </span>
            <h1 className={styles.pageTitle}>Penghapusan Akun &amp; Data Pribadi</h1>
            <p className={styles.pageSubtitle}>
              Kami menghargai hak privasi Anda. Halaman ini disediakan bagi pengguna Make Me Kool untuk mengelola atau mengajukan penghapusan akun beserta data terkait secara mandiri.
            </p>
          </div>
        </div>
      </header>

      <main className={styles.mainSection}>
        <DeleteAccountClient />
      </main>

      <Footer />
    </div>
  );
}
