import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar/Navbar";
import { Footer } from "@/components/Footer/Footer";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { DeleteAccountClient } from "./DeleteAccountClient";
import styles from "./DeleteAccount.module.css";
import deleteConfig from "@/data/ui/deleteAccountConfig.json";

export const metadata: Metadata = {
  title: deleteConfig.metadata.title,
  description: deleteConfig.metadata.description,
};

export default function DeleteAccountPage() {
  return (
    <div className={styles.pageContainer}>
      <Navbar />

      <header className={styles.headerSection}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.backLink}>
            <AppIcon name="arrow-left" size={16} />
            <span>{deleteConfig.header.backLink}</span>
          </Link>

          <div>
            <span className={styles.dangerBadge}>
              <AppIcon name="shield-check" size={14} />
              {deleteConfig.header.badge}
            </span>
            <h1 className={styles.pageTitle}>{deleteConfig.header.title}</h1>
            <p className={styles.pageSubtitle}>
              {deleteConfig.header.subtitle}
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
