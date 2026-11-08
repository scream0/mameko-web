"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getPublicSettings } from "@/services/settingsService";
import { useTheme } from "@/context/ThemeContext";
import styles from "./Footer.module.css";
import footerData from "@/data/ui/footerConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { Logo } from "@/components/UI/Logo/logo";

interface SocialItem {
  href: string;
  icon: string;
  label: string;
}

interface NavLinkItem {
  label: string;
  href: string;
}

interface FooterConfigState {
  branding: {
    logo: {
      text: string;
      subtext?: string;
      href: string;
    };
    description: string;
    socials: SocialItem[];
  };
  navigation: {
    title: string;
    links: NavLinkItem[];
  };
  legal: {
    title: string;
    privacy: string;
    terms: string;
    deleteAccount: string;
    cookieSettings: string;
    themeLight: string;
    themeDark: string;
    links: NavLinkItem[];
  };
  payment: {
    title: string;
    subtitle: string;
    methods: string[];
  };
  copyright: {
    text: string;
  };
}

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [footerInfo, setFooterInfo] = useState<FooterConfigState>(footerData);
  const footerRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { theme, setTheme, isThemeReady } = useTheme();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchFooter = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data?.footer || !isMounted) return;
        const f = data.footer;
        setFooterInfo({
          ...footerData,
          ...f,
          branding: {
            ...(footerData?.branding || {}),
            ...(f?.branding || {}),
            logo: {
              text: f?.branding?.logo?.text?.trim()
                ? f.branding.logo.text
                : footerData.branding.logo.text,
              subtext: f?.branding?.logo?.subtext?.trim()
                ? f.branding.logo.subtext
                : footerData.branding.logo.subtext,
              href: f?.branding?.logo?.href?.trim()
                ? f.branding.logo.href
                : footerData.branding.logo.href,
            },
            description: f?.branding?.description?.trim()
              ? f.branding.description
              : footerData.branding.description,
            socials:
              Array.isArray(f?.branding?.socials) &&
              f.branding.socials.length > 0 &&
              f.branding.socials.some((s: any) => s?.label || s?.href)
                ? f.branding.socials
                : Array.isArray(f?.socials) &&
                  f.socials.length > 0 &&
                  f.socials.some((s: any) => s?.label || s?.href)
                ? f.socials
                : footerData?.branding?.socials || [],
          },
          navigation: {
            title: f?.navigation?.title?.trim()
              ? f.navigation.title
              : footerData.navigation.title,
            links:
              Array.isArray(f?.navigation?.links) &&
              f.navigation.links.length > 0 &&
              f.navigation.links.some((l: any) => l?.label || l?.href)
                ? f.navigation.links
                : footerData?.navigation?.links || [],
          },
          legal: {
            title: f?.legal?.title?.trim()
              ? f.legal.title
              : footerData?.legal?.title || "Legalitas",
            privacy: footerData.legal.privacy,
            terms: footerData.legal.terms,
            deleteAccount: footerData.legal.deleteAccount,
            cookieSettings: footerData.legal.cookieSettings,
            themeLight: footerData.legal.themeLight,
            themeDark: footerData.legal.themeDark,
            links:
              Array.isArray(f?.legal?.links) &&
              f.legal.links.length > 0 &&
              f.legal.links.some((l: any) => l?.label || l?.href)
                ? f.legal.links
                : footerData?.legal?.links || [],
          },
          payment: {
            title: f?.payment?.title?.trim()
              ? f.payment.title
              : footerData.payment.title,
            subtitle: f?.payment?.subtitle?.trim()
              ? f.payment.subtitle
              : footerData.payment.subtitle,
            methods:
              Array.isArray(f?.payment?.methods) &&
              f.payment.methods.length > 0 &&
              f.payment.methods.some((m: any) =>
                typeof m === "string" ? m.trim() : m
              )
                ? f.payment.methods
                : footerData?.payment?.methods || [],
          },
          copyright: {
            text: f?.copyright?.text?.trim()
              ? f.copyright.text
              : footerData.copyright.text,
          },
        });
      } catch (error) {
        console.error("Failed to load footer settings", error);
      }
    };

    fetchFooter();

    const handleSettingsUpdate = () => {
      fetchFooter();
    };
    window.addEventListener("store-settings-updated", handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("store-settings-updated", handleSettingsUpdate);
    };
  }, []);

  const brandDisplayName = [
    footerInfo?.branding?.logo?.text,
    footerInfo?.branding?.logo?.subtext,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || footerData.branding.logo.text;

  return (
    <footer
      className={`${styles.siteFooter} ${isVisible ? styles.visible : ""}`}
      ref={footerRef}
    >
      {/* Decorative ambient subtle aura */}
      <div className={styles.footerGlowBlob} aria-hidden="true" />

      <div className={styles.footerContainer}>
        {/* KOLOM 1: BRANDING & SOSIAL MEDIA */}
        <div className={`${styles.footerBox} ${styles.footerBranding}`}>
          <Link
            href={footerInfo?.branding?.logo?.href || "/"}
            className={styles.footerLogo}
            aria-label={brandDisplayName}
          >
            <Logo width={28} height={20} className={styles.footerLogoSvg} />
            <span className={styles.footerLogoText}>{brandDisplayName}</span>
          </Link>
          <p className={styles.footerDesc}>
            {footerInfo?.branding?.description}
          </p>
          <div className={styles.footerSocial}>
            {footerInfo?.branding?.socials?.map((social, index) => (
              <SocialLink
                key={`${social.label}-${index}`}
                href={social.href}
                icon={social.icon}
                label={social.label}
              />
            ))}
          </div>
        </div>

        {/* KOLOM 2: NAVIGASI */}
        <div className={`${styles.footerBox} ${styles.footerNav}`}>
          <h3 className={styles.columnTitle}>{footerInfo?.navigation?.title}</h3>
          <ul className={styles.linksList}>
            {footerInfo?.navigation?.links?.map((link, index) => (
              <li key={`${link.label}-${index}`}>
                <Link href={link.href} className={styles.footerNavLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* KOLOM 3: LEGALITAS & KEBIJAKAN */}
        <div className={`${styles.footerBox} ${styles.footerLegal}`}>
          <h3 className={styles.columnTitle}>{footerInfo?.legal?.title}</h3>
          <ul className={styles.linksList}>
            {footerInfo?.legal?.links?.map((link, index) => (
              <li key={`${link.label}-${index}`}>
                <Link href={link.href} className={styles.footerNavLink}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                className={styles.cookieInlineBtn}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("open-cookie-settings"));
                  }
                }}
              >
                {footerInfo?.legal?.cookieSettings || footerData.legal.cookieSettings}
              </button>
            </li>
          </ul>
        </div>

        {/* KOLOM 4: KEAMANAN & PEMBAYARAN */}
        <div className={`${styles.footerBox} ${styles.footerPayment}`}>
          <h3 className={styles.columnTitle}>{footerInfo?.payment?.title}</h3>
          <p className={styles.paymentSubtitle}>{footerInfo?.payment?.subtitle}</p>
          <div className={styles.paymentBadges}>
            {footerInfo?.payment?.methods?.map((method, index) => (
              <span key={`${method}-${index}`} className={styles.badgePayment}>
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER BOTTOM BAR */}
      <div className={styles.footerBottom}>
        <div className={styles.footerBottomWrapper}>
          <p className={styles.copyrightText}>
            &copy; {currentYear} {footerInfo?.copyright?.text}
          </p>

          <div className={styles.themeSwitcher}>
            <button
              type="button"
              className={`${styles.themeBtn} ${
                isThemeReady && theme === "light" ? styles.active : ""
              }`}
              onClick={() => setTheme("light")}
              aria-label={
                footerInfo?.legal?.themeLight || footerData.legal.themeLight
              }
            >
              <AppIcon name="sun" className={styles.themeIcon} />
              <span className={styles.themeLabel}>
                {footerInfo?.legal?.themeLight || footerData.legal.themeLight}
              </span>
            </button>
            <button
              type="button"
              className={`${styles.themeBtn} ${
                !isThemeReady || theme === "dark" ? styles.active : ""
              }`}
              onClick={() => setTheme("dark")}
              aria-label={
                footerInfo?.legal?.themeDark || footerData.legal.themeDark
              }
            >
              <AppIcon name="moon" className={styles.themeIcon} />
              <span className={styles.themeLabel}>
                {footerInfo?.legal?.themeDark || footerData.legal.themeDark}
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Sub-komponen SocialLink
function SocialLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  const isHash = href.startsWith("#");

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHash) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target={isHash ? "_self" : "_blank"}
      rel={isHash ? undefined : "noopener noreferrer"}
      aria-label={label}
      title={label}
      className={styles.socialLinkBtn}
    >
      <AppIcon name={icon} className={styles.socialIcon} />
    </a>
  );
}
