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

  // Refs untuk visual transform & spotlight tanpa trigger re-render React
  const visualRef = useRef(null);
  const contentRef = useRef(null);
  const spotlightRef = useRef(null);

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
          setResolvedHero({
            ...heroData,
            ...data.hero,
            title: {
              ...(heroData?.title || {}),
              ...(data.hero?.title || {}),
            },
            description: {
              ...(heroData?.description || {}),
              ...(data.hero?.description || {}),
            },
            buttons: {
              ...(heroData?.buttons || {}),
              ...(data.hero?.buttons || {}),
              primary: {
                ...(heroData?.buttons?.primary || {}),
                ...(data.hero?.buttons?.primary || {}),
              },
              secondary: {
                ...(heroData?.buttons?.secondary || {}),
                ...(data.hero?.buttons?.secondary || {}),
              },
            },
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

  // Ambil URL gambar latar belakang dari resolvedHero (jika ada) dengan fallback default
  const heroBackgroundImage =
    resolvedHero?.image || heroData?.image || "/assets/images/hero-perfume.webp";
  const heroImageAlt =
    resolvedHero?.imageAlt || heroData?.imageAlt || "Hero Visual";

  return (
    <section id="home" className={`${styles.hero} ${isDimmed ? styles.dimmed : ""}`}>
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

      <div className={styles.heroInner}>
        {/* Left Side: Glassmorphism Content */}
        <main
          ref={contentRef}
          className={styles.content}
        >
          <div className={styles.contentGlow} aria-hidden="true" />
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
            </a>
          </div>
        </main>

        {/* Right Side: Floating Visual */}
        {heroBackgroundImage && (
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
        )}
      </div>
    </section>
  );
}