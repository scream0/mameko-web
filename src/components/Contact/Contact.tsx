"use client";
import React, { useState, useEffect, useRef } from "react";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Contact.module.css";
import contactData from "@/data/ui/contactConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

interface InfoItemData {
  icon: string;
  title: string;
  value: string;
}

interface ContactConfigState {
  whatsappNumber: string;
  header: {
    tagline: string;
    title: {
      main: string;
      highlight: string;
    };
  };
  infoItems: InfoItemData[];
  headquarters: {
    title: string;
    address: string[];
    coordinates: string;
  };
  form: {
    title: string;
    fields: {
      name: string;
      email: string;
      phone: string;
      message: string;
    };
    submitText: string;
  };
}

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [contactInfo, setContactInfo] = useState<ContactConfigState>(contactData);

  const contactRef = useRef<HTMLElement | null>(null);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id.replace("input-", "")]: value }));
  };

  const kirimPesanKontak = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWa = (contactInfo?.whatsappNumber || contactData?.whatsappNumber || "6285171723607").replace(/[^0-9]/g, "");
    const teksPesan = `*📩 PESAN BARU - KONTAK KAMI*\n--------------------------------------------\n• *Nama* : ${formData.name}\n• *Email* : ${formData.email}\n• *No HP* : ${formData.phone}\n--------------------------------------------\n*💬 ISI PESAN:*\n"${formData.message}"`;

    window.open(
      `https://wa.me/${cleanWa}?text=${encodeURIComponent(teksPesan)}`,
      "_blank",
      "noopener,noreferrer"
    );

    setFormData({ name: "", email: "", phone: "", message: "" });
  };

  const sectionHeading = [
    contactInfo?.header?.title?.main,
    contactInfo?.header?.title?.highlight,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || contactData.header.title.main;

  return (
    <section
      id="contact"
      className={`${styles.contact} ${isVisible ? styles.visible : ""}`}
      ref={contactRef}
    >
      <div className={styles.contactContainer}>
        {/* Sisi Kiri: Informasi */}
        <div className={styles.contactInfoCard}>
          <div className={styles.infoHeader}>
            <h2 className={styles.contactTitle}>{sectionHeading}</h2>
          </div>

          <div className={styles.infoDetailsList}>
            {contactInfo?.infoItems?.map((item, index) => (
              <InfoItem
                key={`${item.title}-${index}`}
                icon={item.icon}
                title={item.title}
                value={item.value}
              />
            ))}
          </div>

          <div className={styles.addressBox}>
            <h3 className={styles.addressTitle}>{contactInfo?.headquarters?.title}</h3>
            <p className={styles.addressText}>
              {contactInfo?.headquarters?.address?.[0]}
              {contactInfo?.headquarters?.address?.[1] && (
                <>
                  <br />
                  {contactInfo.headquarters.address[1]}
                </>
              )}
            </p>
            {contactInfo?.headquarters?.coordinates && (
              <span className={styles.coordinates}>
                {contactInfo.headquarters.coordinates}
              </span>
            )}
          </div>
        </div>

        {/* Sisi Kanan: Form WhatsApp */}
        <div className={styles.contactFormWrapper}>
          <form onSubmit={kirimPesanKontak} className={styles.contactForm}>
            <div className={styles.formHeader}>
              <h3 className={styles.formTitle}>{contactInfo?.form?.title}</h3>
            </div>

            <div className={styles.formFields}>
              <InputBox
                id="input-name"
                label={contactInfo?.form?.fields?.name || "Nama Lengkap"}
                value={formData.name}
                onChange={handleInputChange}
                autoComplete="name"
              />
              <InputBox
                id="input-email"
                label={contactInfo?.form?.fields?.email || "Alamat Email"}
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
              />
              <InputBox
                id="input-phone"
                label={contactInfo?.form?.fields?.phone || "Nomor WhatsApp"}
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                autoComplete="tel"
              />

              <div className={styles.inputGroup}>
                <label htmlFor="input-message" className={styles.inputLabel}>
                  {contactInfo?.form?.fields?.message || "Pesan"}
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder={contactInfo?.form?.fields?.message || "Tulis Pesan Anda..."}
                  id="input-message"
                  className={styles.textAreaField}
                />
              </div>
            </div>

            <button type="submit" className={styles.btnSubmit}>
              <AppIcon name="message-circle" className={styles.btnIcon} />
              <span>{contactInfo?.form?.submitText || "Kirim via WhatsApp"}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

// Sub-komponen Info Item
function InfoItem({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  const isEmail = icon === "mail" || value.includes("@");

  return (
    <div className={styles.infoItem}>
      <div className={styles.infoIconWrapper}>
        <AppIcon name={icon} className={styles.infoIcon} />
      </div>
      <div className={styles.infoText}>
        <span className={styles.infoTitle}>{title}</span>
        {isEmail ? (
          <a href={`mailto:${value}`} className={styles.infoLink}>
            {value}
          </a>
        ) : (
          <p className={styles.infoValue}>{value}</p>
        )}
      </div>
    </div>
  );
}

// Sub-komponen Input Box
interface InputBoxProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  autoComplete?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function InputBox({
  id,
  label,
  type = "text",
  value,
  autoComplete,
  onChange,
}: InputBoxProps) {
  return (
    <div className={styles.inputGroup}>
      <label htmlFor={id} className={styles.inputLabel}>
        {label}
      </label>
      <input
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder={label}
        id={id}
        autoComplete={autoComplete}
        className={styles.inputField}
      />
    </div>
  );
}
