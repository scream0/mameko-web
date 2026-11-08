"use client";
import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./About.module.css";
import aboutData from "@/data/ui/aboutConfig.json";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

interface FeatureItemProps {
  number: string;
  title: string;
  desc: string;
}

const FeatureItem = ({ number, title, desc }: FeatureItemProps) => (
  <div className={styles.featureItem}>
    <span className={styles.featureNumber}>{number}</span>
    <div className={styles.featureText}>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </div>
  </div>
);

export function About() {
  const [aboutImage, setAboutImage] = useState(aboutData?.image?.src || "");
  const [aboutImageAlt, setAboutImageAlt] = useState(
    aboutData?.image?.alt || ""
  );
  const [aboutContent, setAboutContent] = useState<any>(
    aboutData?.content || {}
  );
  const [aboutFeatures, setAboutFeatures] = useState(
    aboutData?.features || []
  );
  const [aboutImgSrc, setAboutImgSrc] = useState(
    aboutData?.image?.src
      ? optimizeCloudinaryUrl(aboutData.image.src, IMAGE_PRESETS.ABOUT)
      : ""
  );

  useEffect(() => {
    if (aboutImage && aboutImage.trim() !== "") {
      setAboutImgSrc(
        optimizeCloudinaryUrl(aboutImage, IMAGE_PRESETS.ABOUT) || aboutImage
      );
    } else {
      setAboutImgSrc("");
    }
  }, [aboutImage]);

  const aboutRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (aboutRef.current) {
      observer.observe(aboutRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchAbout = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data || !isMounted) return;

        if (data?.about?.image && data.about.image.trim() !== "") {
          setAboutImage(data.about.image);
        } else {
          setAboutImage("");
        }
        if (data?.about?.imageAlt && data.about.imageAlt.trim() !== "") {
          setAboutImageAlt(data.about.imageAlt);
        }

        if (data?.about?.content) {
          const c = data.about.content;
          setAboutContent({
            heading: c.heading?.trim()
              ? c.heading
              : aboutData?.content?.heading || "",
            leadText: c.leadText?.trim()
              ? c.leadText
              : aboutData?.content?.leadText || "",
            bodyText: c.bodyText?.trim()
              ? c.bodyText
              : aboutData?.content?.bodyText || "",
          });
        }

        if (
          Array.isArray(data?.about?.features) &&
          data.about.features.length > 0
        ) {
          setAboutFeatures(data.about.features);
        }
      } catch (error) {
        console.error("Failed to load about settings", error);
      }
    };

    fetchAbout();

    const handleSettingsUpdate = () => {
      fetchAbout();
    };
    window.addEventListener("store-settings-updated", handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener(
        "store-settings-updated",
        handleSettingsUpdate
      );
    };
  }, []);

  return (
    <section
      id="about"
      className={`${styles.about} ${isVisible ? styles.visible : ""}`}
      ref={aboutRef}
    >
      <div
        className={`${styles.aboutRow} ${!aboutImgSrc ? styles.noVisual : ""}`}
      >
        {aboutImgSrc && (
          <div className={styles.aboutImgWrapper}>
            <div className={styles.imgContainer}>
              <Image
                src={aboutImgSrc}
                alt={aboutImageAlt}
                className={styles.aboutImg}
                width={600}
                height={750}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 50vw"
                onError={() => setAboutImgSrc("")}
              />
            </div>
          </div>
        )}

        <div className={styles.aboutContent}>
          <h2 className={styles.aboutHeading}>{aboutContent?.heading}</h2>

          <p className={styles.aboutLead}>{aboutContent?.leadText}</p>
          <p className={styles.aboutBody}>{aboutContent?.bodyText}</p>

          {aboutFeatures?.length > 0 && (
            <div className={styles.aboutFeatures}>
              {aboutFeatures.map((feature: any, index: number) => (
                <FeatureItem
                  key={index}
                  number={feature.number}
                  title={feature.title}
                  desc={feature.desc}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
