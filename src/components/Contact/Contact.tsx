// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Contact.module.css";
import contactData from "@/data/ui/contactConfig.json"; // Fallback default JSON
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  // State resolved dari DB (fallback ke JSON)
  const [contactInfo, setContactInfo] = useState(contactData);

  const contactRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (contactRef.current) {
      observer.observe(contactRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchContact = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data?.contact || !isMounted) return;
        const c = data.contact;
        setContactInfo({
          ...contactData,
          ...c,
          whatsappNumber: c.whatsappNumber?.trim() ? c.whatsappNumber : contactData.whatsappNumber,
          header: {
            tagline: c.header?.tagline?.trim() ? c.header.tagline : contactData.header.tagline,
            title: {
              main: c.header?.title?.main?.trim() ? c.header.title.main : contactData.header.title.main,
              highlight: c.header?.title?.highlight?.trim() ? c.header.title.highlight : contactData.header.title.highlight,
            },
          },
          infoItems:
            Array.isArray(c.infoItems) &&
            c.infoItems.length > 0 &&
            c.infoItems.some((i: any) => (i.title && i.title.trim()) || (i.value && i.value.trim()))
              ? c.infoItems
              : contactData?.infoItems || [],
          headquarters: {
            title: c.headquarters?.title?.trim() ? c.headquarters.title : contactData.headquarters.title,
            address:
              Array.isArray(c.headquarters?.address) &&
              c.headquarters.address.length > 0 &&
              c.headquarters.address.some((a: any) => typeof a === "string" && a.trim())
                ? c.headquarters.address
                : contactData.headquarters.address,
            coordinates: c.headquarters?.coordinates?.trim() ? c.headquarters.coordinates : contactData.headquarters.coordinates,
          },
          form: {
            title: c.form?.title?.trim() ? c.form.title : contactData.form.title,
            fields: {
              name: c.form?.fields?.name?.trim() ? c.form.fields.name : contactData.form.fields.name,
              email: c.form?.fields?.email?.trim() ? c.form.fields.email : contactData.form.fields.email,
              phone: c.form?.fields?.phone?.trim() ? c.form.fields.phone : contactData.form.fields.phone,
              message: c.form?.fields?.message?.trim() ? c.form.fields.message : contactData.form.fields.message,
            },
            submitText: c.form?.submitText?.trim() ? c.form.submitText : contactData.form.submitText,
          },
        });
      } catch (error) {
        console.error("Failed to load contact settings", error);
      }
    };

    fetchContact();

    const handleSettingsUpdate = () => {
      fetchContact();
    };
    window.addEventListener("store-settings-updated", handleSettingsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("store-settings-updated", handleSettingsUpdate);
    };
  }, []);

  const handleInputChange = (e: any) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id.replace("input-", "")]: value }));
  };

  const kirimPesanKontak = (e: any) => {
    e.preventDefault();
    const teksPesan = `*📩 PESAN BARU - KONTAK KAMI*\n--------------------------------------------\n• *Nama* : ${formData.name}\n• *Email* : ${formData.email}\n• *No HP* : ${formData.phone}\n--------------------------------------------\n*💬 ISI PESAN:*\n"${formData.message}"`;

    // Mengambil nomor WA dinamis dari settings DB / JSON
    const waNumber =
      contactInfo?.whatsappNumber || contactData?.whatsappNumber || "6281234567890";

    window.open(
      `https://wa.me/${waNumber}?text=${encodeURIComponent(teksPesan)}`,
      "_blank",
    );

    setFormData({ name: "", email: "", phone: "", message: "" });
  };

  return (
    <section id="contact" className={`${styles.contact} ${isVisible ? styles.visible : ""}`} ref={contactRef}>
      <div className={styles.contactContainer}>
        {/* Sisi Kiri: Informasi */}
        <div className={styles.contactInfoCard}>
          <div className={styles.infoHeader}>
            <p className={styles.contactTagline}>{contactInfo?.header?.tagline}</p>
            <h2>
              {contactInfo?.header?.title?.main} <br />
              <span>{contactInfo?.header?.title?.highlight}</span>
            </h2>
          </div>

          <div className={styles.infoDetailsList}>
            {contactInfo?.infoItems?.map((item, index) => (
              <InfoItem
                key={index}
                icon={item.icon}
                title={item.title}
                value={item.value}
              />
            ))}
          </div>

          <div className={styles.addressBox}>
            <h3>{contactInfo?.headquarters?.title}</h3>
            <p>
              {contactInfo?.headquarters?.address?.[0]}
              <br />
              {contactInfo?.headquarters?.address?.[1]}
            </p>
            <span className={styles.coordinates}>
              {contactInfo?.headquarters?.coordinates}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: Form */}
        <div className={styles.contactFormWrapper}>
          <form onSubmit={kirimPesanKontak} className={styles.contactForm}>
            <h3>{contactInfo?.form?.title}</h3>

            <InputBox
              id="input-name"
              label={contactInfo?.form?.fields?.name}
              value={formData.name}
              onChange={handleInputChange}
            />
            <InputBox
              id="input-email"
              label={contactInfo?.form?.fields?.email}
              type="email"
              value={formData.email}
              onChange={handleInputChange}
            />
            <InputBox
              id="input-phone"
              label={contactInfo?.form?.fields?.phone}
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
            />

            <div className={styles.inputBox}>
              <textarea
                required
                value={formData.message}
                onChange={handleInputChange}
                placeholder=" "
                id="input-message"
              ></textarea>
              <label htmlFor="input-message">
                {contactInfo?.form?.fields?.message}
              </label>
            </div>

            <button type="submit" className={styles.btnSubmit}>
              {contactInfo?.form?.submitText}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

// Sub-komponen
function InfoItem({ icon, title, value }) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoIcon}>
        <AppIcon name={icon} className={styles.feather} />
      </div>
      <div className={styles.infoText}>
        <span className={styles.infoTitle}>{title}</span>
        <p>{value}</p>
      </div>
    </div>
  );
}

function InputBox({ id, label, type = "text", value, onChange }) {
  return (
    <div className={styles.inputBox}>
      <input
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder=" "
        id={id}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
