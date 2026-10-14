// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { HeroParticles } from "@/components/UI/HeroParticles/HeroParticles";
import { getPublicSettings } from "@/services/settingsService";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./Hero.module.css";
import heroData from "@/data/ui/heroConfig.json"; // Fallback default JSON
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

export function Hero() {
  // 1. Definisikan state
  const [resolvedHero, setResolvedHero] = useState(heroData);
  const [isDimmed, setIsDimmed] = useState(false);
  const [isRevealed, setIsRevealed] = useState(true);
  const [showScroll, setShowScroll] = useState(true);
  const [statsVisible, setStatsVisible] = useState(false);

  // Refs untuk visual transform & spotlight tanpa trigger re-render React
  const visualRef = useRef(null);
  const contentRef = useRef(null);
  const spotlightRef = useRef(null);
  const statsRef = useRef(null);

  // Parallax scroll effect yang efisien (Direct DOM RAF update)
  useEffect(() => {
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const sy = window.scrollY;
        if (visualRef.current) {
          visualRef.current.style.transform = `translateY(${sy * -0.05}px)`;
        }
        if (contentRef.current) {
          contentRef.current.style.transform = `translateY(${sy * -0.15}px)`;
        }
        // Sembunyikan scroll indicator setelah user scroll sedikit
        setShowScroll(sy < 60);
        rafId = null;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // 2. Efek untuk melacak mouse (throttled via requestAnimationFrame, pakai CSS var)
  useEffect(() => {
    let rafId = null;

    const handleMouseMove = (e: any) => {
      if (rafId) return; // sudah ada frame pending, skip
      rafId = requestAnimationFrame(() => {
        if (spotlightRef.current) {
          spotlightRef.current.style.setProperty("--spotlight-x", `${e.clientX}px`);
          spotlightRef.current.style.setProperty("--spotlight-y", `${e.clientY}px`);
        }
        rafId = null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // 3. Muat settings publik (hero) via service layer
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data || !isMounted) return;

        if (data?.hero) {
          const h = data.hero;
          setResolvedHero({
            ...heroData,
            ...h,
            tagline: h.tagline?.trim() ? h.tagline : heroData.tagline,
            badge: h.badge?.trim() ? h.badge : heroData.badge,
            image: h.image?.trim() ? h.image : "",
            imageAlt: h.imageAlt?.trim() ? h.imageAlt : (heroData.imageAlt || "Hero Visual"),
            title: {
              main: h.title?.main?.trim() ? h.title.main : heroData.title.main,
              highlight: h.title?.highlight?.trim() ? h.title.highlight : heroData.title.highlight,
            },
            description: {
              prefix: (h.description?.prefix && h.description.prefix.trim() !== "") ? h.description.prefix : heroData.description.prefix,
              italic: (h.description?.italic && h.description.italic.trim() !== "") ? h.description.italic : heroData.description.italic,
              suffix: (h.description?.suffix && h.description.suffix.trim() !== "") ? h.description.suffix : heroData.description.suffix,
            },
            buttons: {
              primary: {
                label: h.buttons?.primary?.label?.trim() ? h.buttons.primary.label : heroData.buttons.primary.label,
                href: h.buttons?.primary?.href?.trim() ? h.buttons.primary.href : heroData.buttons.primary.href,
              },
              secondary: {
                label: h.buttons?.secondary?.label?.trim() ? h.buttons.secondary.label : heroData.buttons.secondary.label,
                href: h.buttons?.secondary?.href?.trim() ? h.buttons.secondary.href : heroData.buttons.secondary.href,
              },
            },
            trustPills: Array.isArray(h.trustPills) && h.trustPills.length > 0 ? h.trustPills : heroData.trustPills,
            stats: Array.isArray(h.stats) && h.stats.length > 0 ? h.stats : heroData.stats,
          });

          if (spotlightRef.current) {
            const sc = data.hero?.effects?.spotlightColor || heroData.effects?.spotlightColor || "rgba(229, 228, 226, 0.1)";
            spotlightRef.current.style.setProperty("--spotlight-color", sc);
          }
        }
      } catch (error) {
        console.error("Failed to load hero settings", error);
      }
    };

    loadSettings();

    const handleSettingsUpdate = () => {
      loadSettings();
    };
    window.addEventListener("store-settings-updated", handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("store-settings-updated", handleSettingsUpdate);
    };
  }, []);

  // 4. Trigger reveal animation setelah mount
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setIsRevealed(true);
      return;
    }

    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsRevealed(true));
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // 5. Observer buat dimming background pas section berikutnya keliatan
  useEffect(() => {
    const section = document.querySelector(".content-section");
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsDimmed(entries[0].isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // 6. IntersectionObserver untuk animasi stats count-up
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ambil URL gambar latar belakang dari resolvedHero (hanya jika ada data dari DB)
  const heroBackgroundImage =
    (resolvedHero?.image && resolvedHero.image.trim() !== "")
      ? resolvedHero.image
      : "";
  const heroImageAlt =
    (resolvedHero?.imageAlt && resolvedHero.imageAlt.trim() !== "")
      ? resolvedHero.imageAlt
      : (heroData?.imageAlt || "Hero Visual");

  const trustPills = resolvedHero?.trustPills || heroData.trustPills || [];
  const stats = resolvedHero?.stats || heroData.stats || [];
  const fallback = heroData.fallbackVisual;

  return (
    <section id="home" className={`${styles.hero} ${isDimmed ? styles.dimmed : ""}`}>
      {/* Grain texture overlay untuk luxury feel */}
      <div className={styles.heroGrain} aria-hidden="true" />

      {/* Aurora Background Mesh */}
      <div className={styles.auroraBg}></div>

      <div
        ref={spotlightRef}
        className={styles.heroSpotlight}
      ></div>

      <div className={styles.heroOverlay}></div>
      <div className={styles.heroParticlesContainer}>
        <HeroParticles />
      </div>

      <div className={`${styles.heroInner} ${!heroBackgroundImage ? styles.noVisual : ""}`}>
        {/* Left Side: Glassmorphism Content */}
        <main
          ref={contentRef}
          className={styles.content}
        >
          <div className={styles.contentGlow} aria-hidden="true" />

          {/* Badge pill urgency */}
          {resolvedHero?.badge && (
            <div
              className={`${styles.heroBadge} ${styles.reveal} ${styles.delay0} ${isRevealed ? styles.revealed : ""}`}
            >
              {resolvedHero.badge}
            </div>
          )}

          <p
            className={`${styles.heroTagline} ${styles.reveal} ${styles.delay0} ${isRevealed ? styles.revealed : ""}`}
          >
            {resolvedHero?.tagline}
          </p>
          <h1
            className={`${styles.heroTitle} ${styles.reveal} ${styles.delay1} ${isRevealed ? styles.revealed : ""}`}
          >
            {resolvedHero?.title?.main} <br />
            <span>{resolvedHero?.title?.highlight}</span>
          </h1>
          <p
            className={`${styles.heroDesc} ${styles.reveal} ${styles.delay2} ${isRevealed ? styles.revealed : ""}`}
          >
            {resolvedHero?.description?.prefix}
            <em>{resolvedHero?.description?.italic}</em>
            {resolvedHero?.description?.suffix}
          </p>

          {/* Trust Pills */}
          {trustPills.length > 0 && (
            <div
              className={`${styles.trustPills} ${styles.reveal} ${styles.delay2} ${isRevealed ? styles.revealed : ""}`}
              aria-label="Keunggulan produk"
            >
              {trustPills.map((pill: any, i: number) => (
                <span key={i} className={styles.trustPill}>
                  <AppIcon name={pill.icon} size={12} className={styles.pillIcon} />
                  {pill.label}
                </span>
              ))}
            </div>
          )}

          <div
            className={`${styles.heroButtons} ${styles.reveal} ${styles.delay3} ${isRevealed ? styles.revealed : ""}`}
          >
            <a
              href={resolvedHero?.buttons?.primary?.href}
              className={styles.ctaPrimary}
            >
              {resolvedHero?.buttons?.primary?.label}
              <AppIcon name="shopping-bag" size={16} className={styles.btnIcon} />
            </a>
            <a
              href={resolvedHero?.buttons?.secondary?.href}
              className={styles.ctaSecondary}
            >
              {resolvedHero?.buttons?.secondary?.label}
              <AppIcon name="arrow-right" size={14} className={styles.btnIconSecondary} />
            </a>
          </div>

          {/* Stats Row */}
          {stats.length > 0 && (
            <div
              ref={statsRef}
              className={`${styles.statsRow} ${styles.reveal} ${styles.delay3} ${isRevealed ? styles.revealed : ""} ${statsVisible ? styles.statsVisible : ""}`}
              aria-label="Statistik brand"
            >
              {stats.map((stat: any, i: number) => (
                <div key={i} className={styles.statItem}>
                  <span className={styles.statValue}>{stat.value}</span>
                  <span className={styles.statLabel}>{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Right Side: Floating Visual atau Fallback Card */}
        {heroBackgroundImage ? (
          <div className={styles.heroVisualWrapper}>
            <div
              ref={visualRef}
              className={styles.heroVisual}
            >
              <div className={styles.heroVisualGlow}></div>
              <Image
                src={optimizeCloudinaryUrl(heroBackgroundImage, IMAGE_PRESETS.HERO)}
                alt={heroImageAlt}
                className={styles.heroVisualImg}
                width={600}
                height={700}
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>
        ) : (
          /* Fallback glassmorphism product card saat tidak ada gambar */
          <div className={`${styles.heroVisualWrapper} ${styles.reveal} ${styles.delay1} ${isRevealed ? styles.revealed : ""}`} aria-hidden="true">
            <div ref={visualRef} className={`${styles.heroVisual} ${styles.heroFallbackCard}`}>
              <div className={styles.heroVisualGlow}></div>
              <div className={styles.fallbackInner}>
                <span className={styles.fallbackEyebrow}>{fallback?.eyebrow}</span>
                <div className={styles.fallbackBottle}>
                  <div className={styles.bottleShape} />
                  <div className={styles.bottleReflect} />
                  <div className={styles.bottleShimmer} />
                </div>
                <div className={styles.fallbackMeta}>
                  <p className={styles.fallbackProductName}>{fallback?.productName}</p>
                  <p className={styles.fallbackNote}>{fallback?.productNote}</p>
                  <p className={styles.fallbackTagline}>{fallback?.tagline}</p>
                </div>
                <span className={styles.fallbackBadge}>{fallback?.badge}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll Down Indicator */}
      <div className={`${styles.scrollIndicator} ${showScroll ? styles.scrollVisible : ""}`} aria-hidden="true">
        <div className={styles.scrollMouse}>
          <div className={styles.scrollWheel} />
        </div>
        <span className={styles.scrollLabel}>{heroData.scrollIndicator?.label}</span>
      </div>
    </section>
  );
}