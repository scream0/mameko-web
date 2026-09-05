"use client";
import LoginForm from "@/features/components/LoginForm";
import InteractiveBackground from "./InteractiveBackground";
import styles from "./login.module.css";
import config from "@/data/ui/loginConfig.json";
import { Suspense } from "react";
import { LoginSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import Link from "next/link";

export default function LoginPage() {
  const brandName = config?.brand?.name || "MAKE ME KOOL";
  const brandSubtitle = config?.brand?.subtitle || "ANTARA AROMA DAN RASA";
  const backHref = config?.content?.backLinkHref || "/";
  const backLabel = config?.content?.backLinkLabel || "Back to Home";

  return (
    <main className={styles.pageContainer}>
      <InteractiveBackground />
      <div className={styles.loginWrapper}>

        {/* Brand Section */}
        <header className={styles.brandHeader}>
          <Link href={backHref} className={styles.brandLinkWrapper} aria-label={brandName}>
            <h1 className={styles.brandTitle}>{brandName}</h1>
          </Link>
          {brandSubtitle && <p className={styles.brandSub}>{brandSubtitle}</p>}
        </header>

        {/* Form Section */}
        <section className={styles.formContainer} aria-label="Form Login">
          <Suspense fallback={<LoginSkeleton />}>
            <LoginForm />
          </Suspense>
        </section>

        {/* Back Link */}
        <footer className={styles.footerLink}>
          <Link href={backHref} className={styles.backLink}>
            {backLabel}
          </Link>
        </footer>
      </div>
    </main>
  );
}
