// @ts-nocheck
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import styles from "./SettingsView.module.css";
import { auth } from "@/lib/supabaseClient";
import settingsConfig from "@/data/ui/settingsConfig.json";
import { shouldSkipAuthEvent, logoutUser } from "@/utils/authHelpers";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import {
  getAdminSettings,
  saveSettings,
} from "@/services/settingsService";
import { convertToWebP } from "@/utils/imageConverter";
import UserManagement from "./UserManagement";

const EMPTY = {
  store: {
    storeName: "",
    storeEmail: "",
    currency: "IDR",
    adminLocale: "id",
    lowStockThreshold: 10,
    storeCityId: "",
    storeCityName: "",
    enableMidtrans: true,
    enableManualTransfer: false,
    midtransIsProduction: false,
  },
  couriers: {
    activeCouriers: ["jne", "jnt", "sicepat", "anteraja"],
    biteshipIsProduction: false,
  },
  hero: {
    image: "",
    imageAlt: "",
    imagePublicId: "",
    tagline: "",
    title: { main: "", highlight: "" },
    description: { prefix: "", italic: "", suffix: "" },
    buttons: {
      primary: { label: "", href: "" },
      secondary: { label: "", href: "" },
    },
  },
  about: {
    image: "",
    imageAlt: "",
    imagePublicId: "",
    content: { tagline: "", heading: "", leadText: "", bodyText: "" },
    features: [{ number: "01", title: "", desc: "" }],
  },
  product: {
    header: { tagline: "", title: { main: "", highlight: "" } },
  },
  contact: {
    whatsappNumber: "",
    header: { tagline: "", title: { main: "", highlight: "" } },
    infoItems: [{ icon: "mail", title: "", value: "" }],
    headquarters: { title: "", address: [""], coordinates: "" },
    form: {
      title: "",
      fields: { name: "", email: "", phone: "", message: "" },
      submitText: "",
    },
  },
  footer: {
    branding: {
      logo: { text: "", subtext: "", href: "" },
      description: "",
      socials: [{ href: "", icon: "", label: "" }],
    },
    navigation: { title: "", links: [{ label: "", href: "" }] },
    payment: { title: "", subtitle: "", methods: [""] },
    copyright: { text: "" },
  },
};

const TAB_KEYS = [
  "store",
  "hero",
  "about",
  "product",
  "contact",
  "footer",
  "payment",
  "couriers",
  "whatsapp",
  "account",
];

export default function SettingsView() {
  const [settings, setSettings] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState("store");
  const [rawSettings, setRawSettings] = useState<any>(null);
  const lastUserIdRef = useRef(null);
  
  // State untuk file gambar About & Hero
  const [selectedAboutImageFile, setSelectedAboutImageFile] = useState(null);
  const [aboutImagePreviewUrl, setAboutImagePreviewUrl] = useState("");

  const [selectedHeroImageFile, setSelectedHeroImageFile] = useState(null);
  const [heroImagePreviewUrl, setHeroImagePreviewUrl] = useState("");

  const [currentSession, setCurrentSession] = useState(null);

  const cfg = settingsConfig;

  // Map dari settings DB ke state lokal bertab
  const mapSettingsToState = (data: any) => ({
    store: {
      storeName: data?.storeName || "",
      storeEmail: data?.storeEmail || "",
      currency: data?.currency || "IDR",
      adminLocale: data?.adminLocale || "id",
      lowStockThreshold: Number(data?.lowStockThreshold ?? 10),
      storeCityId: data?.storeCityId || "",
      storeCityName: data?.storeCityName || "",
      enableMidtrans: data?.enableMidtrans ?? true,
      enableManualTransfer: data?.enableManualTransfer ?? false,
      midtransIsProduction: data?.midtransIsProduction ?? false,
    },
    couriers: {
      activeCouriers: data?.activeCouriers || ["jne", "jnt", "sicepat", "anteraja"],
      biteshipIsProduction: data?.biteshipIsProduction ?? false,
      biteshipAutoOrder: data?.biteshipAutoOrder ?? false,
    },
    hero: {
      image: data?.hero?.image || "",
      imageAlt: data?.hero?.imageAlt || "",
      imagePublicId: data?.hero?.imagePublicId || "",
      tagline: data?.hero?.tagline || "",
      title: {
        main: data?.hero?.title?.main || "",
        highlight: data?.hero?.title?.highlight || "",
      },
      description: {
        prefix: data?.hero?.description?.prefix || "",
        italic: data?.hero?.description?.italic || "",
        suffix: data?.hero?.description?.suffix || "",
      },
      buttons: {
        primary: {
          label: data?.hero?.buttons?.primary?.label || "",
          href: data?.hero?.buttons?.primary?.href || "",
        },
        secondary: {
          label: data?.hero?.buttons?.secondary?.label || "",
          href: data?.hero?.buttons?.secondary?.href || "",
        },
      },
    },
    about: {
      image: data?.about?.image || "",
      imageAlt: data?.about?.imageAlt || "",
      imagePublicId: data?.about?.imagePublicId || "",
      content: {
        tagline: data?.about?.content?.tagline || "",
        heading: data?.about?.content?.heading || "",
        leadText: data?.about?.content?.leadText || "",
        bodyText: data?.about?.content?.bodyText || "",
      },
      features: data?.about?.features || [{ number: "01", title: "", desc: "" }],
    },
    product: {
      header: {
        tagline: data?.product?.header?.tagline || "",
        title: {
          main: data?.product?.header?.title?.main || "",
          highlight: data?.product?.header?.title?.highlight || "",
        },
      },
    },
    contact: {
      whatsappNumber: data?.contact?.whatsappNumber || "",
      header: {
        tagline: data?.contact?.header?.tagline || "",
        title: {
          main: data?.contact?.header?.title?.main || "",
          highlight: data?.contact?.header?.title?.highlight || "",
        },
      },
      infoItems: data?.contact?.infoItems || [
        { icon: "mail", title: "", value: "" },
      ],
      headquarters: {
        title: data?.contact?.headquarters?.title || "",
        address: data?.contact?.headquarters?.address || [""],
        coordinates: data?.contact?.headquarters?.coordinates || "",
      },
      form: {
        title: data?.contact?.form?.title || "",
        fields: {
          name: data?.contact?.form?.fields?.name || "",
          email: data?.contact?.form?.fields?.email || "",
          phone: data?.contact?.form?.fields?.phone || "",
          message: data?.contact?.form?.fields?.message || "",
        },
        submitText: data?.contact?.form?.submitText || "",
      },
      bankAccounts: data?.contact?.bankAccounts || [],
    },
    footer: {
      branding: {
        logo: {
          text: data?.footer?.branding?.logo?.text || "",
          subtext: data?.footer?.branding?.logo?.subtext || "",
          href: data?.footer?.branding?.logo?.href || "",
        },
        description: data?.footer?.branding?.description || "",
        socials: data?.footer?.branding?.socials || [
          { href: "", icon: "", label: "" },
        ],
      },
      navigation: {
        title: data?.footer?.navigation?.title || "",
        links: data?.footer?.navigation?.links || [{ label: "", href: "" }],
      },
      payment: {
        title: data?.footer?.payment?.title || "",
        subtitle: data?.footer?.payment?.subtitle || "",
        methods: data?.footer?.payment?.methods || [""],
      },
      copyright: { text: data?.footer?.copyright?.text || "" },
    },
  });

  useEffect(() => {
    let subscription = null;

    const initAuthAndFetch = async () => {
      try {
        const { data: { session } } = await auth.getSession();
        lastUserIdRef.current = session?.user?.id || null;
        setCurrentSession(session);

        if (!session) {
          toast.error(cfg.toast?.authRequired || "Authentication required.");
          setIsFetching(false);
          return;
        }

        const data = await getAdminSettings(session);
        setRawSettings(data);
        setSettings(mapSettingsToState(data));
        setAboutImagePreviewUrl(data?.about?.image || "");
        setHeroImagePreviewUrl(data?.hero?.image || "");

        if (typeof window !== "undefined" && data?.adminLocale) {
          const nextLocale = data.adminLocale === "en" ? "en" : "id";
          window.localStorage.setItem("adminLocale", nextLocale);
          window.dispatchEvent(
            new CustomEvent("admin-locale-change", {
              detail: { locale: nextLocale },
            }),
          );
        }
      } catch (error) {
        console.error("Fetch Settings Error:", error.message);
        toast.error(error.message);
      } finally {
        setIsFetching(false);
      }

      // Listener perubahan sesi Supabase
      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;
        
        setCurrentSession(session);
        if (session) {
          try {
            const data = await getAdminSettings(session);
            setRawSettings(data);
            setSettings(mapSettingsToState(data));
            setAboutImagePreviewUrl(data?.about?.image || "");
            setHeroImagePreviewUrl(data?.hero?.image || "");
          } catch (error) {
            console.error("Auth Change Fetch Error:", error.message);
          }
        }
      });
      subscription = authListener?.subscription;
    };

    initAuthAndFetch();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: any) => {
    e.preventDefault();
    const toastId = toast.loading(cfg.buttons?.saving || "Menyimpan...");
    setLoading(true);

    if (!currentSession) {
      toast.error(cfg.toast?.sessionExpired || "Sesi berakhir.", {
        id: toastId,
      });
      setLoading(false);
      return;
    }

    try {
      const payload = buildPayload();
      const user = currentSession.user;

      // 1. Unggah gambar Hero jika ada file baru (dikonversi ke WebP)
      if (selectedHeroImageFile) {
        setUploadingImage(true);
        const webpHeroFile = await convertToWebP(selectedHeroImageFile);
        const heroFormData = new FormData();
        heroFormData.append("file", webpHeroFile);
        heroFormData.append("userId", user.id);
        heroFormData.append("folder", "storefront");
        heroFormData.append("publicId", `storefront/hero-${user.id}`);
        heroFormData.append("oldPublicId", settings.hero.imagePublicId || "");
        heroFormData.append("oldUrl", settings.hero.image || "");

        const heroUploadRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: heroFormData,
        });
        const heroUploadResult = (heroUploadRes.headers?.get("content-type")?.includes("application/json") ? await heroUploadRes.json() : {});

        if (!heroUploadRes.ok) {
          throw new Error(heroUploadResult.error || "Gagal mengunggah gambar Hero.");
        }

        payload.hero.image = heroUploadResult.secure_url;
        payload.hero.imagePublicId = heroUploadResult.public_id;
        setHeroImagePreviewUrl(heroUploadResult.secure_url);
        setSelectedHeroImageFile(null);
      }

      // 2. Unggah gambar About jika ada file baru (dikonversi ke WebP)
      if (selectedAboutImageFile) {
        setUploadingImage(true);
        const webpAboutFile = await convertToWebP(selectedAboutImageFile);
        const aboutFormData = new FormData();
        aboutFormData.append("file", webpAboutFile);
        aboutFormData.append("userId", user.id);
        aboutFormData.append("folder", "storefront");
        aboutFormData.append("publicId", `storefront/about-${user.id}`);
        aboutFormData.append("oldPublicId", settings.about.imagePublicId || "");
        aboutFormData.append("oldUrl", settings.about.image || "");

        const aboutUploadRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: aboutFormData,
        });
        const aboutUploadResult = (aboutUploadRes.headers?.get("content-type")?.includes("application/json") ? await aboutUploadRes.json() : {});

        if (!aboutUploadRes.ok) {
          throw new Error(aboutUploadResult.error || "Gagal mengunggah gambar About.");
        }

        payload.about.image = aboutUploadResult.secure_url;
        payload.about.imagePublicId = aboutUploadResult.public_id;
        setAboutImagePreviewUrl(aboutUploadResult.secure_url);
        setSelectedAboutImageFile(null);
      }

      setUploadingImage(false);

      await saveSettings(payload, currentSession);

      const fresh = await getAdminSettings(currentSession);
      setSettings(mapSettingsToState(fresh));
      setAboutImagePreviewUrl(fresh?.about?.image || "");
      setHeroImagePreviewUrl(fresh?.hero?.image || "");

      if (typeof window !== "undefined") {
        const nextLocale = fresh?.adminLocale === "en" ? "en" : "id";
        window.localStorage.setItem("adminLocale", nextLocale);
        window.dispatchEvent(
          new CustomEvent("admin-locale-change", {
            detail: { locale: nextLocale },
          }),
        );
      }

      toast.success(cfg.toast?.success || "Pengaturan disimpan!", {
        id: toastId,
      });
    } catch (error) {
      console.error("Save Settings Error:", error.message);
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  // Susun payload dari state bertab
  const buildPayload = () => {
    const s = settings;
    const strictValue = (val: any) => (val === undefined ? "" : val);
    return {
      storeName: strictValue(s.store.storeName),
      storeEmail: strictValue(s.store.storeEmail),
      currency: s.store.currency,
      adminLocale: s.store.adminLocale === "en" ? "en" : "id",
      lowStockThreshold: Number(s.store.lowStockThreshold) || 10,
      storeCityId: strictValue(s.store.storeCityId),
      storeCityName: strictValue(s.store.storeCityName),
      enableMidtrans: Boolean(s.store.enableMidtrans),
      enableManualTransfer: Boolean(s.store.enableManualTransfer),
      midtransIsProduction: Boolean(s.store.midtransIsProduction),
      activeCouriers: s.couriers.activeCouriers || ["jne", "jnt", "sicepat"],
      biteshipIsProduction: Boolean(s.couriers.biteshipIsProduction),
      biteshipAutoOrder: Boolean(s.couriers.biteshipAutoOrder),
      hero: {
        image: strictValue(s.hero.image),
        imageAlt: strictValue(s.hero.imageAlt),
        imagePublicId: strictValue(s.hero.imagePublicId),
        tagline: strictValue(s.hero.tagline),
        title: {
          main: strictValue(s.hero.title?.main),
          highlight: strictValue(s.hero.title?.highlight),
        },
        description: {
          prefix: strictValue(s.hero.description?.prefix),
          italic: strictValue(s.hero.description?.italic),
          suffix: strictValue(s.hero.description?.suffix),
        },
        buttons: {
          primary: {
            label: strictValue(s.hero.buttons?.primary?.label),
            href: strictValue(s.hero.buttons?.primary?.href),
          },
          secondary: {
            label: strictValue(s.hero.buttons?.secondary?.label),
            href: strictValue(s.hero.buttons?.secondary?.href),
          },
        },
      },
      about: {
        image: strictValue(s.about.image),
        imageAlt: strictValue(s.about.imageAlt),
        imagePublicId: strictValue(s.about.imagePublicId),
        content: {
          tagline: strictValue(s.about.content?.tagline),
          heading: strictValue(s.about.content?.heading),
          leadText: strictValue(s.about.content?.leadText),
          bodyText: strictValue(s.about.content?.bodyText),
        },
        features: s.about.features || [],
      },
      product: {
        header: {
          tagline: strictValue(s.product?.header?.tagline),
          title: {
            main: strictValue(s.product?.header?.title?.main),
            highlight: strictValue(s.product?.header?.title?.highlight),
          },
        },
      },
      contact: {
        whatsappNumber: strictValue(s.contact.whatsappNumber),
        header: {
          tagline: strictValue(s.contact.header?.tagline),
          title: {
            main: strictValue(s.contact.header?.title?.main),
            highlight: strictValue(s.contact.header?.title?.highlight),
          },
        },
        infoItems: s.contact.infoItems || [],
        headquarters: {
          title: strictValue(s.contact.headquarters?.title),
          address: s.contact.headquarters?.address || [],
          coordinates: strictValue(s.contact.headquarters?.coordinates),
        },
        form: {
          title: strictValue(s.contact.form?.title),
          fields: {
            name: strictValue(s.contact.form?.fields?.name),
            email: strictValue(s.contact.form?.fields?.email),
            phone: strictValue(s.contact.form?.fields?.phone),
            message: strictValue(s.contact.form?.fields?.message),
          },
          submitText: strictValue(s.contact.form?.submitText),
        },
        bankAccounts: s.contact.bankAccounts || [],
      },
      footer: {
        branding: {
          logo: {
            text: strictValue(s.footer.branding?.logo?.text),
            subtext: strictValue(s.footer.branding?.logo?.subtext),
            href: strictValue(s.footer.branding?.logo?.href),
          },
          description: strictValue(s.footer.branding?.description),
          socials: s.footer.branding?.socials || [],
        },
        navigation: {
          title: strictValue(s.footer.navigation?.title),
          links: s.footer.navigation?.links || [],
        },
        payment: {
          title: strictValue(s.footer.payment?.title),
          subtitle: strictValue(s.footer.payment?.subtitle),
          methods: s.footer.payment?.methods || [],
        },
        copyright: { text: strictValue(s.footer.copyright?.text) },
      },
      ...(rawSettings?.promoBannerEnabled !== undefined
        ? {
            promoBannerEnabled: Boolean(rawSettings.promoBannerEnabled),
            promoBannerText: rawSettings.promoBannerText || "",
            promoDiscountType: rawSettings.promoDiscountType || "percentage",
            promoDiscountValue: Number(rawSettings.promoDiscountValue) || 0,
            promoStartDate: rawSettings.promoStartDate || "",
            promoEndDate: rawSettings.promoEndDate || "",
            promoCode: rawSettings.promoCode || "",
            promoDestination: rawSettings.promoDestination || "#product",
            promoTargetType: rawSettings.promoTargetType || "all",
            promoTargetVariants: rawSettings.promoTargetVariants || [],
          }
        : {}),
    };
  };

  const updateTab = (tab, patch: any) => {
    setSettings((prev) => ({ ...prev, [tab]: patch }));
  };

  const handleInputChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      store: {
        ...prev.store,
        [name]: type === "checkbox" ? checked : value,
      },
    }));
  };

  const handleHeroImageSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedHeroImageFile(file);
    setHeroImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleAboutImageSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedAboutImageFile(file);
    setAboutImagePreviewUrl(URL.createObjectURL(file));
  };

  if (isFetching) {
    return <p className={styles.loadingText}>{cfg.loading || "Memuat..."}</p>;
  }

  return (
    <div className={styles.settingsContainer}>
      <h3 className={styles.settingsTitle}>{cfg.title}</h3>

      {/* Tab navigasi */}
      <div className={styles.tabNav}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.tabBtn} ${
              activeTab === key ? styles.tabBtnActive : ""
            }`}
            onClick={() => setActiveTab(key)}
          >
            {cfg.tabs?.[key] || key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            toast.loading(cfg.account?.logoutLoading || "Keluar dari panel admin...", { id: "admin-logout" });
            logoutUser();
          }}
          className={styles.logoutTabBtn}
          aria-label={cfg.account?.logoutAria || "Keluar dari akun admin"}
          title={cfg.account?.logoutAria || "Keluar dari akun admin"}
        >
          <AppIcon name="log-out" size={14} />
          <span>{cfg.account?.logoutBtn || "Keluar Akun"}</span>
        </button>
      </div>

      <form onSubmit={handleSave}>
        {activeTab === "store" && (
          <StoreTab
            settings={settings.store}
            handleInputChange={handleInputChange}
            cfg={cfg}
          />
        )}

        {activeTab === "hero" && (
          <HeroTab
            settings={settings.hero}
            updateTab={updateTab}
            handleHeroImageSelect={handleHeroImageSelect}
            heroImagePreviewUrl={heroImagePreviewUrl}
            cfg={cfg}
          />
        )}

        {activeTab === "about" && (
          <AboutTab
            settings={settings.about}
            updateTab={updateTab}
            handleAboutImageSelect={handleAboutImageSelect}
            aboutImagePreviewUrl={aboutImagePreviewUrl}
            cfg={cfg}
          />
        )}

        {activeTab === "product" && (
          <ProductTab
            settings={settings.product}
            updateTab={updateTab}
            cfg={cfg}
          />
        )}

        {activeTab === "contact" && (
          <ContactTab
            settings={settings.contact}
            updateTab={updateTab}
            cfg={cfg}
          />
        )}

        {activeTab === "footer" && (
          <FooterTab
            settings={settings.footer}
            updateTab={updateTab}
            cfg={cfg}
          />
        )}

        {activeTab === "payment" && (
          <PaymentTab
            settings={settings.store}
            handleInputChange={handleInputChange}
            bankAccounts={settings.contact?.bankAccounts || []}
            updateBankAccounts={(accounts: any) => updateTab("contact", { ...settings.contact, bankAccounts: accounts })}
            cfg={cfg}
          />
        )}

        {activeTab === "couriers" && (
          <CouriersTab
            settings={settings.couriers}
            updateCouriers={(newCouriers: any) =>
              setSettings((prev) => ({
                ...prev,
                couriers: { ...prev.couriers, activeCouriers: newCouriers },
              }))
            }
            updateBiteshipMode={(isProduction: any) =>
              setSettings((prev) => ({
                ...prev,
                couriers: { ...prev.couriers, biteshipIsProduction: isProduction },
              }))
            }
            updateBiteshipAutoOrder={(autoOrder: any) =>
              setSettings((prev) => ({
                ...prev,
                couriers: { ...prev.couriers, biteshipAutoOrder: autoOrder },
              }))
            }
            cfg={cfg}
          />
        )}

        {activeTab === "whatsapp" && (
          <WhatsAppTab cfg={cfg} />
        )}

        {activeTab === "account" && (
          <div className={styles.tabContent}>
            <div className={styles.accountSectionHeader}>
              <h4 className={styles.sectionTitle}>{cfg.account?.title || "Manajemen Akun"}</h4>
              <p className={styles.helpText}>
                {cfg.account?.helpText || "Anda dapat mengelola pengguna admin di bagian bawah."}
              </p>
            </div>
            
            <div className={styles.accountDivider}>
              <UserManagement />
            </div>
          </div>
        )}

        {activeTab !== "whatsapp" && activeTab !== "account" && (
          <button
            type="submit"
            disabled={loading || uploadingImage}
            className={styles.saveBtn}
          >
            {loading || uploadingImage
              ? cfg.buttons?.saving || "Menyimpan..."
              : cfg.buttons?.save || "Simpan Perubahan"}
          </button>
        )}
      </form>
    </div>
  );
}

/* ============================================================
   TAB: STORE
   ============================================================ */
function StoreTab({ settings, handleInputChange, cfg }) {
  const [areaSearch, setAreaSearch] = useState("");
  const [areaOptions, setAreaOptions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);

  const handleAreaSearch = (e: any) => {
    const val = e.target.value;
    setAreaSearch(val);
    setShowDropdown(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.length < 3) {
      setAreaOptions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/biteship/areas?q=${encodeURIComponent(val)}`);
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        setAreaOptions(data.areas || []);
      } catch (err) {
        console.error("Area search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectArea = (area: any) => {
    const displayName = [area.name, area.administrative_division_level_2, area.administrative_division_level_1]
      .filter(Boolean)
      .join(", ");
    handleInputChange({ target: { name: "storeCityName", value: displayName } });
    handleInputChange({ target: { name: "storeCityId", value: area.id } });
    setAreaSearch("");
    setShowDropdown(false);
  };

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.store?.sectionTitle || "Informasi Toko"}
        </h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.store?.storeNameLabel || "Nama Toko"}
          </label>
          <input
            type="text"
            name="storeName"
            value={settings.storeName}
            onChange={handleInputChange}
            className={styles.inputField}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.store?.storeEmailLabel || "Email Kontak"}
          </label>
          <input
            type="email"
            name="storeEmail"
            value={settings.storeEmail}
            onChange={handleInputChange}
            className={styles.inputField}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.store?.currencyLabel || "Mata Uang"}
          </label>
          <select
            name="currency"
            value={settings.currency}
            onChange={handleInputChange}
            className={styles.selectField}
          >
            <option value="IDR">{cfg.store?.currencyIdr || "IDR (Indonesian Rupiah)"}</option>
            <option value="USD">{cfg.store?.currencyUsd || "USD (US Dollar)"}</option>
          </select>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.store?.adminLocaleLabel || "Bahasa Dashboard Admin"}
          </label>
          <select
            name="adminLocale"
            value={settings.adminLocale || "id"}
            onChange={handleInputChange}
            className={styles.selectField}
          >
            <option value="id">
              {cfg.store?.adminLocaleId || "Indonesia (ID)"}
            </option>
            <option value="en">
              {cfg.store?.adminLocaleEn || "English (EN)"}
            </option>
          </select>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.store?.lowStockLabel || "Batas Stok Menipis"}
          </label>
          <input
            type="number"
            name="lowStockThreshold"
            value={settings.lowStockThreshold}
            onChange={handleInputChange}
            className={styles.inputField}
            min="0"
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.store?.cityRegionLabel || "Kota / Wilayah Toko (Asal Pengiriman Biteship)"}
          </label>
          <div className={styles.citySelectRow}>
            <input
              type="text"
              name="storeCityName"
              value={settings.storeCityName || ""}
              readOnly
              className={`${styles.inputField} ${styles.cityInputReadOnly}`}
              placeholder={cfg.store?.cityPlaceholder || "Pilih wilayah melalui kolom pencarian di sebelah"}
            />
            <button 
              type="button" 
              onClick={() => handleInputChange({ target: { name: "storeCityName", value: "" } })}
              className={styles.cityResetBtn}
            >
              {cfg.store?.cityResetBtn || "Reset"}
            </button>
          </div>
          
          <div className={styles.areaSearchWrapper}>
            <input
              type="text"
              value={areaSearch}
              onChange={handleAreaSearch}
              onFocus={() => {
                if (areaSearch.length >= 3) setShowDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className={styles.inputField}
              placeholder={cfg.store?.citySearchPlaceholder || "Ketik minimal 3 huruf nama kota/kecamatan asal..."}
            />
            {isSearching && (
              <span className={styles.areaSearchingBadge}>
                {cfg.store?.searchingBadge || "Mencari..."}
              </span>
            )}
            {showDropdown && areaOptions.length > 0 && (
              <ul className={styles.areaDropdown}>
                {areaOptions.map((opt) => (
                  <li 
                    key={opt.id} 
                    onClick={() => handleSelectArea(opt)}
                    className={styles.areaOptionItem}
                  >
                    <strong>{opt.name}</strong>
                    {opt.administrative_division_level_2 ? `, ${opt.administrative_division_level_2}` : ''}
                    {opt.administrative_division_level_1 ? `, ${opt.administrative_division_level_1}` : ''}
                    <div className={styles.areaPostalCode}>
                      {cfg.store?.postalCodePrefix || "Kode Pos: "}{opt.postal_code || "-"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {showDropdown && areaSearch.length >= 3 && areaOptions.length === 0 && !isSearching && (
              <div className={styles.areaEmptyNotice}>
                {cfg.store?.areaNotFound || "Wilayah tidak ditemukan."}
              </div>
            )}
          </div>
          <small className={styles.fieldDesc}>
            {cfg.store?.areaSyncNotice || "Data wilayah ini tersinkronisasi otomatis dengan Biteship"} (Area ID: {settings.storeCityId || (cfg.store?.notSelected || "Belum dipilih")}).
          </small>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TAB: HERO
   ============================================================ */
function HeroTab({ settings, updateTab, handleHeroImageSelect, heroImagePreviewUrl, cfg }) {
  const s = settings;
  const set = (patch: any) => updateTab("hero", { ...s, ...patch });

  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.hero?.sectionTitle || cfg.sections?.hero || "Hero Section"}
      </h4>

      {/* Bagian Upload Gambar Hero */}
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.imageUrlLabel || "Hero Gambar URL"}</label>
          <input
            className={styles.inputField}
            value={s.image}
            onChange={(e) => set({ image: e.target.value })}
            placeholder={cfg.hero?.imageUrlPlaceholder || "https://..."}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.imageAltLabel || "Alt Gambar Hero"}</label>
          <input
            className={styles.inputField}
            value={s.imageAlt}
            onChange={(e) => set({ imageAlt: e.target.value })}
            placeholder={cfg.hero?.imageAltPlaceholder || "Deskripsi gambar..."}
          />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>
          {cfg.hero?.fileUploadLabel || "Unggah File Gambar Hero"}
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleHeroImageSelect}
          className={styles.fileInput}
        />
        <small className={styles.fieldDesc}>
          {cfg.hero?.fileUploadDesc || "Unggah gambar atau ilustrasi utama untuk Hero Section landing page."}
        </small>
      </div>

      {(heroImagePreviewUrl || s.image) && (
        <div className={styles.previewCard}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic blob & Cloudinary preview URLs require a plain <img>. */}
          <img
            src={heroImagePreviewUrl || s.image}
            alt={s.imageAlt || "Hero Preview"}
            className={styles.previewImage}
          />
        </div>
      )}

      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>{cfg.hero?.taglineLabel || "Tagline"}</label>
        <input
          className={styles.inputField}
          value={s.tagline}
          onChange={(e) => set({ tagline: e.target.value })}
        />
      </div>
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.mainTitleLabel || "Judul Utama"}</label>
          <input
            className={styles.inputField}
            value={s.title?.main}
            onChange={(e) =>
              set({ title: { ...s.title, main: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.highlightTitleLabel || "Judul Sorotan"}</label>
          <input
            className={styles.inputField}
            value={s.title?.highlight}
            onChange={(e) =>
              set({ title: { ...s.title, highlight: e.target.value } })
            }
          />
        </div>
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>{cfg.hero?.descPrefixLabel || "Deskripsi Awal"}</label>
        <input
          className={styles.inputField}
          value={s.description?.prefix}
          onChange={(e) =>
            set({ description: { ...s.description, prefix: e.target.value } })
          }
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>{cfg.hero?.descItalicLabel || "Kata Miring"}</label>
        <input
          className={styles.inputField}
          value={s.description?.italic}
          onChange={(e) =>
            set({ description: { ...s.description, italic: e.target.value } })
          }
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>{cfg.hero?.descSuffixLabel || "Deskripsi Akhir"}</label>
        <input
          className={styles.inputField}
          value={s.description?.suffix}
          onChange={(e) =>
            set({ description: { ...s.description, suffix: e.target.value } })
          }
        />
      </div>
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.btnPrimaryLabel || "Tombol Utama Label"}</label>
          <input
            className={styles.inputField}
            value={s.buttons?.primary?.label}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  primary: { ...s.buttons?.primary, label: e.target.value },
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.btnPrimaryHref || "Tombol Utama Href"}</label>
          <input
            className={styles.inputField}
            value={s.buttons?.primary?.href}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  primary: { ...s.buttons?.primary, href: e.target.value },
                },
              })
            }
          />
        </div>
      </div>
      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.btnSecondaryLabel || "Tombol Kedua Label"}</label>
          <input
            className={styles.inputField}
            value={s.buttons?.secondary?.label}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  secondary: { ...s.buttons?.secondary, label: e.target.value },
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.hero?.btnSecondaryHref || "Tombol Kedua Href"}</label>
          <input
            className={styles.inputField}
            value={s.buttons?.secondary?.href}
            onChange={(e) =>
              set({
                buttons: {
                  ...s.buttons,
                  secondary: { ...s.buttons?.secondary, href: e.target.value },
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: ABOUT
   ============================================================ */
function AboutTab({ settings, updateTab, handleAboutImageSelect, aboutImagePreviewUrl, cfg }) {
  const s = settings;
  const set = (patch: any) => updateTab("about", { ...s, ...patch });

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.about?.sectionTitle || cfg.sections?.about || "About Section"}
        </h4>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.about?.imageUrlLabel || "Gambar URL"}</label>
            <input
              className={styles.inputField}
              value={s.image}
              onChange={(e) => set({ image: e.target.value })}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.about?.imageAltLabel || "Alt Gambar"}</label>
            <input
              className={styles.inputField}
              value={s.imageAlt}
              onChange={(e) => set({ imageAlt: e.target.value })}
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.about?.fileUploadLabel || "Gambar Section About"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleAboutImageSelect}
            className={styles.fileInput}
          />
          <small className={styles.fieldDesc}>
            {cfg.about?.fileUploadDesc || "Unggah gambar untuk bagian About di landing page."}
          </small>
        </div>
        {(aboutImagePreviewUrl || s.image) && (
          <div className={styles.previewCard}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic blob & Cloudinary preview URLs require a plain <img>. */}
            <img
              src={aboutImagePreviewUrl || s.image}
              alt={s.imageAlt || "Preview"}
              className={styles.previewImage}
            />
          </div>
        )}
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.about?.taglineLabel || "Tagline"}</label>
          <input
            className={styles.inputField}
            value={s.content?.tagline}
            onChange={(e) =>
              set({ content: { ...s.content, tagline: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.about?.headingLabel || "Heading"}</label>
          <input
            className={styles.inputField}
            value={s.content?.heading}
            onChange={(e) =>
              set({ content: { ...s.content, heading: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.about?.leadTextLabel || "Lead Text"}</label>
          <textarea
            className={styles.textAreaField}
            value={s.content?.leadText}
            rows={2}
            onChange={(e) =>
              set({ content: { ...s.content, leadText: e.target.value } })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.about?.bodyTextLabel || "Body Text"}</label>
          <textarea
            className={styles.textAreaField}
            value={s.content?.bodyText}
            rows={3}
            onChange={(e) =>
              set({ content: { ...s.content, bodyText: e.target.value } })
            }
          />
        </div>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.about?.featuresTitle || "Fitur Unggulan"}</h4>
        {s.features?.map((feat, idx: any) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row2}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.about?.featureNumberLabel || "Nomor"}</label>
                <input
                  className={styles.inputField}
                  value={feat.number}
                  onChange={(e) =>
                    set({
                      features: s.features.map((f, i: any) =>
                        i === idx ? { ...f, number: e.target.value } : f,
                      ),
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.about?.featureTitleLabel || "Judul"}</label>
                <input
                  className={styles.inputField}
                  value={feat.title}
                  onChange={(e) =>
                    set({
                      features: s.features.map((f, i: any) =>
                        i === idx ? { ...f, title: e.target.value } : f,
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.fieldLabel}>{cfg.about?.featureDescLabel || "Deskripsi"}</label>
              <input
                className={styles.inputField}
                value={feat.desc}
                onChange={(e) =>
                  set({
                    features: s.features.map((f, i: any) =>
                      i === idx ? { ...f, desc: e.target.value } : f,
                    ),
                  })
                }
              />
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({
                  features: s.features.filter((_, i: any) => i !== idx),
                })
              }
            >
              {cfg.about?.removeFeatureBtn || "Hapus Fitur"}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({
              features: [
                ...s.features,
                {
                  number: String(s.features.length + 1).padStart(2, "0"),
                  title: "",
                  desc: "",
                },
              ],
            })
          }
        >
          {cfg.about?.addFeatureBtn || "+ Tambah Fitur"}
        </button>
      </div>
    </>
  );
}

/* ============================================================
   TAB: CONTACT
   ============================================================ */
function ContactTab({ settings, updateTab, cfg }) {
  const s = settings;
  const set = (patch: any) => updateTab("contact", { ...s, ...patch });

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.contact?.sectionTitle || cfg.sections?.contact || "Contact Section"}
        </h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.whatsappLabel || "Nomor WhatsApp"}</label>
          <input
            className={styles.inputField}
            value={s.whatsappNumber}
            onChange={(e) => set({ whatsappNumber: e.target.value })}
          />
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.headerTaglineLabel || "Header Tagline"}</label>
            <input
              className={styles.inputField}
              value={s.header?.tagline}
              onChange={(e) =>
                set({ header: { ...s.header, tagline: e.target.value } })
              }
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.mainTitleLabel || "Judul Utama"}</label>
            <input
              className={styles.inputField}
              value={s.header?.title?.main}
              onChange={(e) =>
                set({
                  header: {
                    ...s.header,
                    title: { ...s.header?.title, main: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.highlightTitleLabel || "Judul Sorotan"}</label>
            <input
              className={styles.inputField}
              value={s.header?.title?.highlight}
              onChange={(e) =>
                set({
                  header: {
                    ...s.header,
                    title: { ...s.header?.title, highlight: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.contact?.infoItemsTitle || "Info Items"}</h4>
        {s.infoItems?.map((item, idx: any) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row3}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.contact?.iconLabel || "Icon"}</label>
                <input
                  className={styles.inputField}
                  value={item.icon}
                  onChange={(e) =>
                    set({
                      infoItems: s.infoItems.map((it, i: any) =>
                        i === idx ? { ...it, icon: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.contact?.titleLabel || "Judul"}</label>
                <input
                  className={styles.inputField}
                  value={item.title}
                  onChange={(e) =>
                    set({
                      infoItems: s.infoItems.map((it, i: any) =>
                        i === idx ? { ...it, title: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.contact?.valueLabel || "Nilai"}</label>
                <input
                  className={styles.inputField}
                  value={item.value}
                  onChange={(e) =>
                    set({
                      infoItems: s.infoItems.map((it, i: any) =>
                        i === idx ? { ...it, value: e.target.value } : it,
                      ),
                    })
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({ infoItems: s.infoItems.filter((_, i: any) => i !== idx) })
              }
            >
              {cfg.contact?.removeInfoBtn || "Hapus"}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({ infoItems: [...s.infoItems, { icon: "mail", title: "", value: "" }] })
          }
        >
          {cfg.contact?.addInfoBtn || "+ Tambah Info"}
        </button>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.contact?.addressFormTitle || "Alamat & Form"}</h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.addressTitleLabel || "Judul Alamat"}</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.title}
            onChange={(e) =>
              set({
                headquarters: { ...s.headquarters, title: e.target.value },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.addressLine1Label || "Baris Alamat 1"}</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.address?.[0]}
            onChange={(e) =>
              set({
                headquarters: {
                  ...s.headquarters,
                  address: [e.target.value, s.headquarters?.address?.[1] || ""],
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.addressLine2Label || "Baris Alamat 2"}</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.address?.[1]}
            onChange={(e) =>
              set({
                headquarters: {
                  ...s.headquarters,
                  address: [s.headquarters?.address?.[0] || "", e.target.value],
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.coordinatesLabel || "Koordinat"}</label>
          <input
            className={styles.inputField}
            value={s.headquarters?.coordinates}
            onChange={(e) =>
              set({
                headquarters: {
                  ...s.headquarters,
                  coordinates: e.target.value,
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.formTitleLabel || "Judul Form"}</label>
          <input
            className={styles.inputField}
            value={s.form?.title}
            onChange={(e) => set({ form: { ...s.form, title: e.target.value } })}
          />
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.nameLabel || "Label Nama"}</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.name}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, name: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.emailLabel || "Label Email"}</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.email}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, email: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.phoneLabel || "Label Phone"}</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.phone}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, phone: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.contact?.messageLabel || "Label Pesan"}</label>
            <input
              className={styles.inputField}
              value={s.form?.fields?.message}
              onChange={(e) =>
                set({
                  form: {
                    ...s.form,
                    fields: { ...s.form?.fields, message: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.contact?.submitTextLabel || "Teks Tombol Kirim"}</label>
          <input
            className={styles.inputField}
            value={s.form?.submitText}
            onChange={(e) =>
              set({ form: { ...s.form, submitText: e.target.value } })
            }
          />
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TAB: FOOTER
   ============================================================ */
function FooterTab({ settings, updateTab, cfg }) {
  const s = settings;
  const set = (patch: any) => updateTab("footer", { ...s, ...patch });

  return (
    <>
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {cfg.footer?.sectionTitle || cfg.sections?.footer || "Footer"}
        </h4>
        <div className={styles.row3}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.footer?.logoTextLabel || "Logo Teks"}</label>
            <input
              className={styles.inputField}
              value={s.branding?.logo?.text}
              onChange={(e) =>
                set({
                  branding: {
                    ...s.branding,
                    logo: { ...s.branding?.logo, text: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.footer?.logoSubtextLabel || "Logo Subtext"}</label>
            <input
              className={styles.inputField}
              value={s.branding?.logo?.subtext}
              onChange={(e) =>
                set({
                  branding: {
                    ...s.branding,
                    logo: { ...s.branding?.logo, subtext: e.target.value },
                  },
                })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.footer?.logoHrefLabel || "Logo Href"}</label>
            <input
              className={styles.inputField}
              value={s.branding?.logo?.href}
              onChange={(e) =>
                set({
                  branding: {
                    ...s.branding,
                    logo: { ...s.branding?.logo, href: e.target.value },
                  },
                })
              }
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.footer?.descriptionLabel || "Deskripsi Branding"}</label>
          <textarea
            className={styles.textAreaField}
            value={s.branding?.description}
            rows={2}
            onChange={(e) =>
              set({ branding: { ...s.branding, description: e.target.value } })
            }
          />
        </div>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.footer?.socialSectionTitle || "Social Links"}</h4>
        {s.branding?.socials?.map((social, idx: any) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row3}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.footer?.socialIconLabel || "Icon"}</label>
                <input
                  className={styles.inputField}
                  value={social.icon}
                  onChange={(e) =>
                    set({
                      branding: {
                        ...s.branding,
                        socials: s.branding.socials.map((so, i: any) =>
                          i === idx ? { ...so, icon: e.target.value } : so,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.footer?.socialLabelLabel || "Label"}</label>
                <input
                  className={styles.inputField}
                  value={social.label}
                  onChange={(e) =>
                    set({
                      branding: {
                        ...s.branding,
                        socials: s.branding.socials.map((so, i: any) =>
                          i === idx ? { ...so, label: e.target.value } : so,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.footer?.socialHrefLabel || "Href"}</label>
                <input
                  className={styles.inputField}
                  value={social.href}
                  onChange={(e) =>
                    set({
                      branding: {
                        ...s.branding,
                        socials: s.branding.socials.map((so, i: any) =>
                          i === idx ? { ...so, href: e.target.value } : so,
                        ),
                      },
                    })
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({
                  branding: {
                    ...s.branding,
                    socials: s.branding.socials.filter((_, i: any) => i !== idx),
                  },
                })
              }
            >
              {cfg.footer?.removeSocialBtn || "Hapus"}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({
              branding: {
                ...s.branding,
                socials: [
                  ...(s.branding?.socials || []),
                  { href: "", icon: "", label: "" },
                ],
              },
            })
          }
        >
          {cfg.footer?.addSocialBtn || "+ Tambah Social"}
        </button>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.footer?.navSectionTitle || "Navigasi Footer"}</h4>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.footer?.navTitleLabel || "Judul Navigasi"}</label>
          <input
            className={styles.inputField}
            value={s.navigation?.title}
            onChange={(e) =>
              set({ navigation: { ...s.navigation, title: e.target.value } })
            }
          />
        </div>
        {s.navigation?.links?.map((link, idx: any) => (
          <div key={idx} className={styles.nestedCard}>
            <div className={styles.row2}>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.footer?.navLinkLabel || "Label"}</label>
                <input
                  className={styles.inputField}
                  value={link.label}
                  onChange={(e) =>
                    set({
                      navigation: {
                        ...s.navigation,
                        links: s.navigation.links.map((l, i: any) =>
                          i === idx ? { ...l, label: e.target.value } : l,
                        ),
                      },
                    })
                  }
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>{cfg.footer?.navLinkHref || "Href"}</label>
                <input
                  className={styles.inputField}
                  value={link.href}
                  onChange={(e) =>
                    set({
                      navigation: {
                        ...s.navigation,
                        links: s.navigation.links.map((l, i: any) =>
                          i === idx ? { ...l, href: e.target.value } : l,
                        ),
                      },
                    })
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                set({
                  navigation: {
                    ...s.navigation,
                    links: s.navigation.links.filter((_, i: any) => i !== idx),
                  },
                })
              }
            >
              {cfg.footer?.removeNavBtn || "Hapus link"}
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() =>
            set({
              navigation: {
                ...s.navigation,
                links: [...(s.navigation?.links || []), { label: "", href: "" }],
              },
            })
          }
        >
          {cfg.footer?.addNavBtn || "+ Tambah Link"}
        </button>
      </div>

      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.footer?.paymentSectionTitle || "Pembayaran & Copyright"}</h4>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.footer?.paymentTitleLabel || "Judul Pembayaran"}</label>
            <input
              className={styles.inputField}
              value={s.payment?.title}
              onChange={(e) =>
                set({ payment: { ...s.payment, title: e.target.value } })
              }
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{cfg.footer?.paymentSubtitleLabel || "Subtitle Pembayaran"}</label>
            <input
              className={styles.inputField}
              value={s.payment?.subtitle}
              onChange={(e) =>
                set({ payment: { ...s.payment, subtitle: e.target.value } })
              }
            />
          </div>
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.footer?.paymentMethodsLabel || "Metode (dipisah koma)"}</label>
          <input
            className={styles.inputField}
            value={(s.payment?.methods || []).join(", ")}
            onChange={(e) =>
              set({
                payment: {
                  ...s.payment,
                  methods: e.target.value.split(",").map((m) => m.trim()),
                },
              })
            }
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{cfg.footer?.copyrightLabel || "Teks Copyright"}</label>
          <input
            className={styles.inputField}
            value={s.copyright?.text}
            onChange={(e) =>
              set({ copyright: { ...s.copyright, text: e.target.value } })
            }
          />
        </div>
      </div>
    </>
  );
}

/* ============================================================
   TAB: PAYMENT
   ============================================================ */
function PaymentTab({ settings, handleInputChange, bankAccounts, updateBankAccounts, cfg }) {
  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.payment?.sectionTitle || "Gateway Pembayaran & Transfer"}
      </h4>
      <div className={styles.inputGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="enableMidtrans"
            checked={settings.enableMidtrans ?? true}
            onChange={(e) => {
              const syntheticEvent = {
                target: {
                  name: "enableMidtrans",
                  value: e.target.checked,
                },
              };
              handleInputChange(syntheticEvent);
            }}
            className={styles.checkboxInput}
          />
          {cfg.payment?.enableMidtransLabel || "Aktifkan Midtrans (Pembayaran Otomatis)"}
        </label>
        <p className={styles.checkboxDesc}>
          {cfg.payment?.enableMidtransDesc || "Pembayaran otomatis melalui Virtual Account, GoPay, QRIS, dsb. Pastikan Server Key & Client Key sudah diatur di file .env server Anda."}
        </p>
      </div>

      {settings.enableMidtrans && (
        <div className={styles.paymentSubCard}>
          <label className={styles.fieldLabel}>
            {cfg.payment?.midtransModeLabel || "Lingkungan Midtrans (Mode)"}
          </label>
          <select
            name="midtransIsProduction"
            value={settings.midtransIsProduction ? "true" : "false"}
            onChange={(e) => {
              const syntheticEvent = {
                target: {
                  name: "midtransIsProduction",
                  value: e.target.value === "true",
                },
              };
              handleInputChange(syntheticEvent);
            }}
            className={styles.inputField}
          >
            <option value="false">{cfg.payment?.midtransSandbox || "Sandbox (Mode Uji Coba)"}</option>
            <option value="true">{cfg.payment?.midtransProduction || "Production (Mode Live Asli)"}</option>
          </select>
          <small className={styles.fieldDesc}>
            {cfg.payment?.midtransEnvNotice || "Pastikan MIDTRANS_SERVER_KEY_SANDBOX dan MIDTRANS_SERVER_KEY_PRODUCTION sudah diatur di .env!"}
          </small>
        </div>
      )}

      <div className={styles.inputGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="enableManualTransfer"
            checked={settings.enableManualTransfer ?? false}
            onChange={(e) => {
              const syntheticEvent = {
                target: {
                  name: "enableManualTransfer",
                  value: e.target.checked,
                },
              };
              handleInputChange(syntheticEvent);
            }}
            className={styles.checkboxInput}
          />
          {cfg.payment?.enableManualTransferLabel || "Aktifkan Transfer Bank Manual"}
        </label>
        <p className={styles.checkboxDesc}>
          {cfg.payment?.enableManualTransferDesc || "Sistem akan menampilkan rekening bank kepada pelanggan saat checkout, lalu admin memverifikasi bukti bayar secara manual."}
        </p>
      </div>

      {settings.enableManualTransfer && (
        <div className={styles.paymentSubCard}>
          <h5 className={styles.paymentSubTitle}>
            {cfg.payment?.bankAccountsTitle || "Daftar Rekening Bank Toko"}
          </h5>
          {bankAccounts.map((account, idx: any) => (
            <div key={account.id || idx} className={styles.bankAccountCard}>
              <div className={styles.row2}>
                <div className={styles.inputGroup}>
                  <label className={styles.fieldLabel}>
                    {cfg.payment?.bankNameLabel || "Nama Bank"}
                  </label>
                  <input
                    className={styles.inputField}
                    value={account.bankName}
                    placeholder={cfg.payment?.bankNamePlaceholder || "BCA"}
                    onChange={(e) => {
                      const newAccs = [...bankAccounts];
                      newAccs[idx].bankName = e.target.value;
                      updateBankAccounts(newAccs);
                    }}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.fieldLabel}>
                    {cfg.payment?.accountNumberLabel || "No. Rekening"}
                  </label>
                  <input
                    className={styles.inputField}
                    value={account.accountNumber}
                    placeholder={cfg.payment?.accountNumberPlaceholder || "1234567890"}
                    onChange={(e) => {
                      const newAccs = [...bankAccounts];
                      newAccs[idx].accountNumber = e.target.value;
                      updateBankAccounts(newAccs);
                    }}
                  />
                </div>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.fieldLabel}>
                  {cfg.payment?.accountNameLabel || "Atas Nama"}
                </label>
                <input
                  className={styles.inputField}
                  value={account.accountName}
                  placeholder={cfg.payment?.accountNamePlaceholder || "PT Mameko Store"}
                  onChange={(e) => {
                    const newAccs = [...bankAccounts];
                    newAccs[idx].accountName = e.target.value;
                    updateBankAccounts(newAccs);
                  }}
                />
              </div>
              <button
                type="button"
                className={styles.bankAccountDeleteBtn}
                onClick={() => {
                  const newAccs = bankAccounts.filter((_, i: any) => i !== idx);
                  updateBankAccounts(newAccs);
                }}
              >
                {cfg.payment?.removeAccountBtn || "Hapus Rekening"}
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addRowBtn}
            onClick={() => {
              updateBankAccounts([
                ...bankAccounts,
                { id: Date.now().toString(), bankName: "", accountNumber: "", accountName: "" },
              ]);
            }}
          >
            {cfg.payment?.addAccountBtn || "+ Tambah Rekening"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: COURIERS — Biteship
   ============================================================ */
function CouriersTab({ settings, updateCouriers, updateBiteshipMode, updateBiteshipAutoOrder, cfg }) {
  const activeCouriers = settings.activeCouriers || [];
  const isProduction = settings.biteshipIsProduction ?? false;
  const isAutoOrder = settings.biteshipAutoOrder ?? false;
  const [courierList, setCourierList] = useState([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Fetch daftar kurir dari Biteship
  useEffect(() => {
    const fetchCouriers = async () => {
      setLoadingCouriers(true);
      setFetchError("");
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/biteship/couriers");
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        if (data.couriers && data.couriers.length > 0) {
          setCourierList(data.couriers);
        } else {
          // Fallback list jika API belum aktif
          setCourierList([
            { code: "jne", name: "JNE" },
            { code: "jnt", name: "J&T Express" },
            { code: "sicepat", name: "SiCepat" },
            { code: "anteraja", name: "AnterAja" },
            { code: "ninja", name: "Ninja Xpress" },
            { code: "pos", name: "POS Indonesia" },
            { code: "tiki", name: "TIKI" },
            { code: "wahana", name: "Wahana" },
            { code: "lion", name: "Lion Parcel" },
            { code: "ide", name: "ID Express" },
          ]);
        }
      } catch {
        setFetchError(cfg.couriers?.fetchError || "Gagal memuat daftar kurir dari Biteship.");
        setCourierList([
          { code: "jne", name: "JNE" },
          { code: "jnt", name: "J&T Express" },
          { code: "sicepat", name: "SiCepat" },
          { code: "anteraja", name: "AnterAja" },
          { code: "pos", name: "POS Indonesia" },
        ]);
      } finally {
        setLoadingCouriers(false);
      }
    };
    fetchCouriers();
  }, [cfg.couriers?.fetchError]);

  const handleToggle = (code: any) => {
    const next = activeCouriers.includes(code)
      ? activeCouriers.filter((c: any) => c !== code)
      : [...activeCouriers, code];
    updateCouriers(next);
  };

  const selectAll = () => updateCouriers(courierList.map((c: any) => c.code));
  const clearAll = () => updateCouriers([]);

  return (
    <>
      {/* Mode Biteship */}
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.couriers?.modeTitle || "Mode Biteship (Pengiriman)"}</h4>
        <p className={styles.couriersDesc}>
          {cfg.couriers?.modeDesc || "Pilih environment Biteship yang akan dipakai untuk kalkulasi ongkos kirim. Pastikan API key sudah diatur di .env."}
        </p>
        <select
          className={`${styles.inputField} ${styles.couriersEnvironmentSelect}`}
          value={isProduction ? "true" : "false"}
          onChange={(e) => updateBiteshipMode(e.target.value === "true")}
        >
          <option value="false">{cfg.couriers?.sandboxOption || "🧪 Sandbox (Testing)"}</option>
          <option value="true">{cfg.couriers?.productionOption || "🚀 Production (Live)"}</option>
        </select>
        <small className={styles.fieldDesc}>
          {cfg.couriers?.envNotice || "Sandbox → BITESHIP_API_KEY_SANDBOX | Production → BITESHIP_API_KEY_PRODUCTION"}
        </small>
      </div>

      {/* Auto Resi Biteship */}
      <div className={styles.formSection}>
        <div className={styles.autoAwbRow}>
          <div>
            <h4 className={`${styles.sectionTitle} ${styles.autoAwbTitle}`}>
              {cfg.couriers?.autoAwbTitle || "Sistem Resi Otomatis (Auto-AWB)"}
            </h4>
            <p className={styles.autoAwbDesc}>
              {cfg.couriers?.autoAwbDesc || "Jika diaktifkan, tombol 'Request Pickup (Biteship)' akan muncul di halaman kelola pesanan admin."}
            </p>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={isAutoOrder}
              onChange={(e) => updateBiteshipAutoOrder(e.target.checked)}
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      {/* Kurir Aktif */}
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>{cfg.couriers?.activeCouriersTitle || "Kurir Aktif untuk Checkout"}</h4>
        <p className={styles.couriersDesc}>
          {cfg.couriers?.activeCouriersDesc || "Centang kurir yang ingin ditampilkan kepada pelanggan saat checkout."}
          {fetchError && <span className={styles.courierErrorBadge}> ({fetchError})</span>}
        </p>
        <div className={styles.couriersActionBtnGroup}>
          <button type="button" className={styles.addRowBtn} onClick={selectAll}>
            {cfg.couriers?.selectAllBtn || "Pilih Semua"}
          </button>
          <button type="button" className={`${styles.addRowBtn} ${styles.courierClearBtn}`} onClick={clearAll}>
            {cfg.couriers?.clearAllBtn || "Hapus Semua"}
          </button>
        </div>
        {loadingCouriers ? (
          <p className={styles.couriersDesc}>{cfg.couriers?.loadingCouriers || "Memuat daftar kurir..."}</p>
        ) : (
          <div className={styles.couriersGrid}>
            {courierList.map((c: any) => (
              <label key={c.code} className={`${styles.toggleRow} ${styles.courierToggleLabel}`}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={activeCouriers.includes(c.code)}
                  onChange={() => handleToggle(c.code)}
                />
                <span className={styles.toggleLabel}>{c.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className={styles.courierActiveNotice}>
          {cfg.couriers?.activeCountPrefix || "Kurir aktif: "}{" "}
          <strong>{activeCouriers.length > 0 ? activeCouriers.join(", ") : (cfg.couriers?.noneActive || "Tidak ada")}</strong>
        </p>
      </div>
    </>
  );
}

/* ============================================================
   TAB: PRODUCT
   ============================================================ */
function ProductTab({ settings, updateTab, cfg }) {
  const s = settings || { header: { tagline: "", title: { main: "", highlight: "" } } };
  const set = (patch: any) => updateTab("product", { ...s, ...patch });

  return (
    <div className={styles.formSection}>
      <h4 className={styles.sectionTitle}>
        {cfg.product?.sectionTitle || cfg.sections?.product || "Katalog Produk (Landing Page)"}
      </h4>

      <div className={styles.inputGroup}>
        <label className={styles.fieldLabel}>
          {cfg.product?.taglineLabel || "Tagline (Teks Kecil Atas)"}
        </label>
        <input
          className={styles.inputField}
          value={s.header?.tagline || ""}
          onChange={(e) =>
            set({ header: { ...s.header, tagline: e.target.value } })
          }
          placeholder={cfg.product?.taglinePlaceholder || "our curated collection"}
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.product?.mainTitleLabel || "Judul Utama"}
          </label>
          <input
            className={styles.inputField}
            value={s.header?.title?.main || ""}
            onChange={(e) =>
              set({
                header: {
                  ...s.header,
                  title: { ...s.header?.title, main: e.target.value },
                },
              })
            }
            placeholder={cfg.product?.mainTitlePlaceholder || "Produk"}
          />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {cfg.product?.highlightTitleLabel || "Judul Sorotan (Highlight)"}
          </label>
          <input
            className={styles.inputField}
            value={s.header?.title?.highlight || ""}
            onChange={(e) =>
              set({
                header: {
                  ...s.header,
                  title: { ...s.header?.title, highlight: e.target.value },
                },
              })
            }
            placeholder={cfg.product?.highlightTitlePlaceholder || "Kami"}
          />
        </div>
      </div>

      {/* Live Preview Box */}
      <div className={styles.previewContainer}>
        <span className={styles.previewHeaderNotice}>
          {cfg.product?.previewNotice || "Preview Tampilan di Landing Page:"}
        </span>
        <div className={styles.previewInnerBox}>
          <p className={styles.previewTagline}>
            {s.header?.tagline || "our curated collection"}
          </p>
          <h2 className={styles.previewHeading}>
            {s.header?.title?.main || "Produk"}{" "}
            <span className={styles.previewHighlight}>
              {s.header?.title?.highlight || "Kami"}
            </span>
          </h2>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: WHATSAPP GATEWAY (120s QR Timer & Auto-Polling)
   ============================================================ */
function WhatsAppTab({ cfg }) {
  const waCfg = cfg.whatsapp || {};
  const [status, setStatus] = useState<any>({ connected: false, loggedIn: false });
  const [loadingStatus, setLoadingStatus] = useState(true);

  // QR Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [qrCountdown, setQrCountdown] = useState(120);
  const [loadingQr, setLoadingQr] = useState(false);

  // Test Message
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/whatsapp/status`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setStatus(json.data);
          return json.data;
        }
      }
    } catch (e) {
      console.error("Gagal memuat status WhatsApp:", e);
    } finally {
      setLoadingStatus(false);
    }
    return null;
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Handle open QR modal
  const handleOpenQR = async () => {
    setShowQrModal(true);
    setLoadingQr(true);
    setQrCountdown(120);
    try {
      const { data: { session } } = await auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/whatsapp/qr`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat QR code");
      setQrData(json.data);
      if (json.data?.seconds && json.data.seconds > 10) {
        setQrCountdown(json.data.seconds);
      } else {
        setQrCountdown(120);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat QR WhatsApp");
    } finally {
      setLoadingQr(false);
    }
  };

  // Countdown & auto-refresh for QR (120 detik)
  useEffect(() => {
    if (!showQrModal) return;
    if (qrCountdown <= 0) {
      handleOpenQR();
      return;
    }
    const timer = setInterval(() => {
      setQrCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [showQrModal, qrCountdown]);

  // Poll status while QR modal is open to detect scan/login success automatically
  useEffect(() => {
    if (!showQrModal) return;
    const pollTimer = setInterval(async () => {
      const current = await fetchStatus();
      if (current?.loggedIn && current?.connected) {
        setShowQrModal(false);
        toast.success("Selamat! WhatsApp Gateway berhasil terhubung.");
      }
    }, 3000);
    return () => clearInterval(pollTimer);
  }, [showQrModal, fetchStatus]);

  // Handle Logout / Disconnect
  const handleLogoutWA = async () => {
    if (!window.confirm(waCfg.logoutConfirm || "Apakah Anda yakin ingin memutuskan koneksi WhatsApp ini?")) {
      return;
    }
    const toastId = toast.loading("Memutuskan sesi WhatsApp...");
    try {
      const { data: { session } } = await auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/whatsapp/logout`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal logout WhatsApp");
      toast.success("Sesi WhatsApp berhasil diputuskan.", { id: toastId });
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Gagal logout", { id: toastId });
    }
  };

  // Handle Send Test
  const handleSendTest = async (e: any) => {
    e.preventDefault();
    if (!testPhone) {
      toast.error("Nomor tujuan wajib diisi.");
      return;
    }
    setIsSendingTest(true);
    const toastId = toast.loading("Mengirim pesan uji coba...");
    try {
      const { data: { session } } = await auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/whatsapp/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage || "Halo! Ini adalah pesan uji coba dari sistem Mameko WhatsApp Gateway.",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim pesan");
      toast.success(json.message || "Pesan uji coba terkirim!", { id: toastId });
      setTestMessage("");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim pesan", { id: toastId });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      {/* 1. Header & Status Section */}
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {waCfg.sectionTitle || "WhatsApp Gateway (whatsmeow)"}
        </h4>
        <p className={styles.couriersDesc}>
          {waCfg.sectionDesc || "Hubungkan nomor WhatsApp untuk pengiriman otomatis kode OTP verifikasi dan notifikasi pesanan pelanggan."}
        </p>

        <div className={styles.waStatusCard}>
          <div className={styles.waStatusRow}>
            <div>
              <strong>{waCfg.statusTitle || "Status Koneksi"}: </strong>
              {loadingStatus ? (
                <span>Memeriksa...</span>
              ) : status.connected && status.loggedIn ? (
                <span className={styles.waBadgeConnected}>
                  🟢 {waCfg.connectedBadge || "Terhubung"}
                </span>
              ) : (
                <span className={styles.waBadgeDisconnected}>
                  🔴 {waCfg.disconnectedBadge || "Terputus / Belum Login"}
                </span>
              )}
            </div>

            {status.connected && status.loggedIn ? (
              <button
                type="button"
                onClick={handleLogoutWA}
                className={styles.removeBtn}
              >
                {waCfg.logoutBtn || "Putuskan Koneksi (Logout)"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenQR}
                className={styles.addRowBtn}
              >
                {waCfg.pairBtn || "Tautkan WhatsApp (Scan QR)"}
              </button>
            )}
          </div>

          {status.loggedIn && status.phone && (
            <div>
              <small className={styles.fieldDesc}>
                {waCfg.connectedPhoneLabel || "Nomor WhatsApp Terhubung:"} <strong>+{status.phone}</strong>
              </small>
            </div>
          )}
        </div>
      </div>

      {/* 2. Test Message Section */}
      <div className={styles.formSection}>
        <h4 className={styles.sectionTitle}>
          {waCfg.testTitle || "Uji Coba Pengiriman Pesan"}
        </h4>
        <div className={styles.row2}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Nomor WhatsApp Tujuan</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder={waCfg.testPhonePlaceholder || "Contoh: 08123456789"}
              className={styles.inputField}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>Pesan Uji Coba</label>
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder={waCfg.testMsgPlaceholder || "Tulis pesan uji coba..."}
              className={styles.inputField}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleSendTest}
          disabled={isSendingTest || !status.connected || !status.loggedIn}
          className={styles.addRowBtn}
        >
          {isSendingTest ? "Mengirim..." : waCfg.testBtn || "Kirim Pesan Uji Coba"}
        </button>
        {(!status.connected || !status.loggedIn) && (
          <small className={styles.fieldDesc} style={{ display: "block", marginTop: "0.5rem", color: "var(--warning-color, #f59e0b)" }}>
            * Hubungkan WhatsApp terlebih dahulu sebelum dapat mengirim pesan uji coba.
          </small>
        )}
      </div>

      {/* 3. QR Code Modal (120 detik) */}
      {showQrModal && (
        <div className={styles.waQrModalOverlay} onClick={() => setShowQrModal(false)}>
          <div className={styles.waQrModalBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.sectionTitle} style={{ margin: "0 0 0.5rem 0" }}>
              {waCfg.qrModalTitle || "Scan QR Code WhatsApp"}
            </h3>
            <p className={styles.fieldDesc} style={{ marginBottom: "1rem" }}>
              {waCfg.qrModalDesc || "Buka aplikasi WhatsApp di HP Anda > Perangkat Tertaut > Tautkan Perangkat, lalu arahkan kamera ke kode QR di bawah ini."}
            </p>

            {loadingQr ? (
              <div style={{ padding: "3rem 0" }}>
                <div className={styles.loadingSpinner} style={{ margin: "0 auto 1rem auto" }}></div>
                <p className={styles.fieldDesc}>Membuat kode QR WhatsApp...</p>
              </div>
            ) : qrData?.qr ? (
              <>
                <div className={styles.waQrImageWrapper}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrData.qr}
                    alt="WhatsApp QR Code"
                    className={styles.waQrImage}
                  />
                </div>
                <p className={styles.waTimerText}>
                  {waCfg.qrTimerNotice || "QR Code diperbarui otomatis dalam"}{" "}
                  <span className={styles.waTimerHighlight}>{qrCountdown}</span> {waCfg.seconds || "detik"}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={handleOpenQR}
                    className={styles.addRowBtn}
                  >
                    {waCfg.refreshQrBtn || "Perbarui QR Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(false)}
                    className={styles.removeBtn}
                  >
                    Tutup
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p className={styles.fieldDesc} style={{ color: "var(--danger-color, #ef4444)" }}>
                  Gagal membuat QR Code WhatsApp. Pastikan server backend sedang aktif.
                </p>
                <button
                  type="button"
                  onClick={handleOpenQR}
                  className={styles.addRowBtn}
                  style={{ marginTop: "1rem" }}
                >
                  Coba Lagi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}