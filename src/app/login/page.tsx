"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import LoginForm from "@/features/components/LoginForm";
import InteractiveBackground from "./InteractiveBackground";
import styles from "./login.module.css";
import config from "@/data/ui/loginConfig.json";
import { LoginSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { Logo } from "@/components/UI/Logo/logo";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export default function LoginPage() {
  const brandName = config?.brand?.name || "MAKE ME KOOL";
  const brandSubtitle = config?.brand?.subtitle || "ANTARA AROMA DAN RASA";
  const backHref = config?.content?.backLinkHref || "/";
  const backLabel = config?.content?.backLinkLabel || "Kembali ke Beranda";

  return (
    <main className={styles.pageContainer}>
      <InteractiveBackground />
      <div className={styles.loginWrapper}>
        {/* Brand Section */}
        <header className={styles.brandHeader}>
          <Link
            href={backHref}
            className={styles.brandLinkWrapper}
            aria-label={brandName}
          >
            <Logo width={34} height={24} className={styles.brandLogo} />
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
            <AppIcon name="arrow-left" size={14} className={styles.backIcon} />
            <span>{backLabel}</span>
          </Link>
        </footer>
      </div>
    </main>
  );
}
