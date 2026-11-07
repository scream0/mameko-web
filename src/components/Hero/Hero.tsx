"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getPublicSettings } from "@/services/settingsService";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./Hero.module.css";
import heroData from "@/data/ui/heroConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

export function Hero() {
  const [resolvedHero, setResolvedHero] = useState(heroData);
  const [isDimmed, setIsDimmed] = useState(false);
  const [isRevealed, setIsRevealed] = useState(true);
  const [showScroll, setShowScroll] = useState(true);
  const [statsVisible, setStatsVisible] = useState(false);

  const visualRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const statsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const sy = window.scrollY;
        if (visualRef.current) {
          visualRef.current.style.transform = `translateY(${sy * -0.03}px)`;
        }
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
              prefix: h.description?.prefix?.trim() ? h.description.prefix : heroData.description.prefix,
              italic: h.description?.italic?.trim() ? h.description.italic : heroData.description.italic,
              suffix: h.description?.suffix?.trim() ? h.description.suffix : heroData.description.suffix,
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
            stats: Array.isArray(h.stats) && h.stats.length > 0 ? h.stats : heroData.stats,
          });
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

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
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

  useEffect(() => {
    const section = document.querySelector(".content-section");
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsDimmed(entries[0].isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

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
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heroBackgroundImage =
    resolvedHero?.image && resolvedHero.image.trim() !== ""
      ? resolvedHero.image
      : "";
  const heroImageAlt =
    resolvedHero?.imageAlt && resolvedHero.imageAlt.trim() !== ""
      ? resolvedHero.imageAlt
      : heroData?.imageAlt;

  const stats = resolvedHero?.stats || heroData.stats || [];
  const fallback = heroData.fallbackVisual;

  return (
    <section id="home" className={`${styles.hero} ${isDimmed ? styles.dimmed : ""}`}>
      <div className={styles.heroGrain} aria-hidden="true" />
      <div className={styles.ambientBackdrop} aria-hidden="true" />

      <div className={styles.heroInner}>
        {/* Left Column: Unboxed Architectural Editorial Typography */}
        <main ref={contentRef} className={styles.content}>
          <h1
            className={`${styles.heroTitle} ${styles.reveal} ${styles.delay0} ${isRevealed ? styles.revealed : ""}`}
          >
            {resolvedHero?.title?.main}
            <br />
            <span className={styles.titleAccent}>{resolvedHero?.title?.highlight}</span>
          </h1>

          <p
            className={`${styles.heroDesc} ${styles.reveal} ${styles.delay1} ${isRevealed ? styles.revealed : ""}`}
          >
            {resolvedHero?.description?.prefix}
            <em>{resolvedHero?.description?.italic}</em>
            {resolvedHero?.description?.suffix}
          </p>

          <div
            className={`${styles.heroButtons} ${styles.reveal} ${styles.delay2} ${isRevealed ? styles.revealed : ""}`}
          >
            <a
              href={resolvedHero?.buttons?.primary?.href}
              className={styles.ctaPrimary}
            >
              <span>{resolvedHero?.buttons?.primary?.label}</span>
              <AppIcon name="arrow-right" size={15} className={styles.btnIcon} />
            </a>
            <a
              href={resolvedHero?.buttons?.secondary?.href}
              className={styles.ctaSecondary}
            >
              <span>{resolvedHero?.buttons?.secondary?.label}</span>
            </a>
          </div>

          {stats.length > 0 && (
            <div
              ref={statsRef}
              className={`${styles.statsRow} ${styles.reveal} ${styles.delay3} ${isRevealed ? styles.revealed : ""} ${statsVisible ? styles.statsVisible : ""}`}
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

        {/* Right Column: Quiet Gallery Plate / Lookbook Frame */}
        <div
          className={`${styles.heroVisualWrapper} ${styles.reveal} ${styles.delay1} ${isRevealed ? styles.revealed : ""}`}
        >
          <div ref={visualRef} className={styles.heroVisualFrame}>
            <div className={styles.galleryMat}>
              {heroBackgroundImage ? (
                <Image
                  src={optimizeCloudinaryUrl(heroBackgroundImage, IMAGE_PRESETS.HERO)}
                  alt={heroImageAlt}
                  className={styles.heroVisualImg}
                  width={640}
                  height={800}
                  priority
                  sizes="(max-width: 960px) 100vw, 44vw"
                />
              ) : (
                <div
                  className={styles.heroFallbackAtelier}
                  aria-label={fallback?.label}
                >
                  <div className={styles.atelierArch} aria-hidden="true">
                    <span className={styles.atelierMonogram}>
                      {fallback?.monogram}
                    </span>
                  </div>
                  <span className={styles.atelierCaption}>
                    {resolvedHero?.tagline}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.plateFooter}>
              <span className={styles.plateCode}>{heroData.plateNumber}</span>
              <span className={styles.plateNote}>{heroData.atelierNote}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Whisper-quiet Editorial Hairline Scroll Cue */}
      <div
        className={`${styles.scrollIndicator} ${showScroll ? styles.scrollVisible : ""}`}
        aria-hidden="true"
      >
        <span className={styles.scrollLabel}>
          {heroData.scrollIndicator?.label}
        </span>
        <span className={styles.scrollLine} />
      </div>
    </section>
  );
}
