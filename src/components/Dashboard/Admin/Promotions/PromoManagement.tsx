// @ts-nocheck
"use client";
import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import { getAdminSettings, saveSettings } from "@/services/settingsService";
import { isPromoActive, getDiscountedPrice, formatRupiah } from "@/utils/promo";
import promoConfig from "@/data/ui/promoManagementConfig.json";
import styles from "./PromoManagement.module.css";
import {
  Ticket,
  Percent,
  Truck,
  Plus,
  Trash2,
  Calendar,
  Scissors,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Power,
  Users,
  Search,
  CheckSquare,
  Square,
  Package,
  Pencil,
  X,
} from "lucide-react";

export default function PromoManagement() {
  const [activeTab, setActiveTab] = useState("promo_toko"); // "promo_toko" | "vouchers"
  const [loading, setLoading] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);

  // Full settings dari database (store_config)
  const [rawSettings, setRawSettings] = useState<any>(null);

  // Form State untuk Promo Diskon Toko
  const [promoForm, setPromoForm] = useState({
    promoBannerEnabled: false,
    promoBannerText: "",
    promoDiscountType: "percentage",
    promoDiscountValue: 0,
    promoStartDate: "",
    promoEndDate: "",
    promoCode: "",
    promoDestination: "#product",
    promoTargetType: "all", // "all" | "specific_variants"
    promoTargetVariants: [] as string[],
  });

  // State produk & varian untuk aksi massal / pemilihan spesifik
  const [productsList, setProductsList] = useState<any[]>([]);
  const [variantSearch, setVariantSearch] = useState("");

  // Data & Form State untuk Voucher Kupon
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherFilter, setVoucherFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [savingVoucher, setSavingVoucher] = useState(false);

  const [voucherForm, setVoucherForm] = useState({
    code: "",
    title: "",
    type: "percentage",
    discount_amount: 0,
    min_purchase: 0,
    valid_until: "",
    usage_limit: 50,
  });

  const getSupabaseTokenAndSession = async () => {
    const {
      data: { session },
    } = await auth.getSession();
    return { session, token: session?.access_token || null };
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const { session, token } = await getSupabaseTokenAndSession();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Ambil pengaturan toko (termasuk promo)
      let settingsData = null;
      if (session) {
        try {
          settingsData = await getAdminSettings(session);
          setRawSettings(settingsData);
          if (settingsData) {
            let targetVariants: string[] = [];
            if (Array.isArray(settingsData.promoTargetVariants)) {
              targetVariants = settingsData.promoTargetVariants;
            } else if (typeof settingsData.promoTargetVariants === "string") {
              try {
                targetVariants = JSON.parse(settingsData.promoTargetVariants);
              } catch {
                targetVariants = [];
              }
            }

            setPromoForm({
              promoBannerEnabled: Boolean(settingsData.promoBannerEnabled),
              promoBannerText: settingsData.promoBannerText || "",
              promoDiscountType: settingsData.promoDiscountType || "percentage",
              promoDiscountValue: Number(settingsData.promoDiscountValue) || 0,
              promoStartDate: settingsData.promoStartDate
                ? String(settingsData.promoStartDate).slice(0, 10)
                : "",
              promoEndDate: settingsData.promoEndDate
                ? String(settingsData.promoEndDate).slice(0, 10)
                : "",
              promoCode: settingsData.promoCode || "",
              promoDestination: settingsData.promoDestination || "#product",
              promoTargetType: settingsData.promoTargetType || "all",
              promoTargetVariants: targetVariants,
            });
          }
        } catch (sErr) {
          console.error("Gagal memuat settings promo:", sErr);
        }
      }

      // 2. Ambil daftar produk & variannya
      try {
        const prodRes = await fetch(
          (process.env.NEXT_PUBLIC_API_URL || "") + "/api/products?limit=200"
        );
        if (prodRes.ok) {
          const pData = await prodRes.json();
          setProductsList(pData.data || pData.products || []);
        }
      } catch (pErr) {
        console.error("Gagal memuat daftar produk:", pErr);
      }

      // 3. Ambil daftar voucher
      const vouchersRes = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/vouchers",
        { headers }
      );
      if (vouchersRes.ok) {
        const vData = vouchersRes.headers
          ?.get("content-type")
          ?.includes("application/json")
          ? await vouchersRes.json()
          : {};
        setVouchers(vData.vouchers || []);
      }
    } catch (error) {
      console.error("Error loading promo & voucher data:", error);
      toast.error(promoConfig.messages.loading);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ── Simpan Pengaturan Promo Toko Otomatis ──
  const handleSavePromo = async (e?: any) => {
    if (e) e.preventDefault();
    setSavingPromo(true);
    const toastId = toast.loading(promoConfig.messages.savePromoLoading);

    try {
      const { session } = await getSupabaseTokenAndSession();
      if (!session) {
        throw new Error(promoConfig.messages.authError);
      }

      // Ambil fresh settings dari server sebelum merge
      const freshSettings = await getAdminSettings(session).catch(() => rawSettings || {});

      // Gabungkan pengaturan promo dengan pengaturan toko yang sudah ada agar tidak menimpa data lain
      const payload = {
        ...(freshSettings || {}),
        promoBannerEnabled: Boolean(promoForm.promoBannerEnabled),
        promoBannerText: promoForm.promoBannerText || "",
        promoDiscountType: promoForm.promoDiscountType || "percentage",
        promoDiscountValue: Number(promoForm.promoDiscountValue) || 0,
        promoStartDate: promoForm.promoStartDate || "",
        promoEndDate: promoForm.promoEndDate || "",
        promoCode: promoForm.promoCode || "",
        promoDestination: promoForm.promoDestination || "#product",
        promoTargetType: promoForm.promoTargetType || "all",
        promoTargetVariants: promoForm.promoTargetVariants || [],
      };

      await saveSettings(payload, session);
      setRawSettings(payload);

      // Trigger event agar StoreContext langsung mendengarkan dan update secara real-time
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("promo-settings-updated"));
      }

      toast.success(promoConfig.messages.savePromoSuccess, {
        id: toastId,
      });
    } catch (err: any) {
      console.error("Gagal simpan promo:", err);
      toast.error(err.message || promoConfig.messages.savePromoError, { id: toastId });
    } finally {
      setSavingPromo(false);
    }
  };

  // ── Helper & Bulk Actions Varian ──
  const allAvailableVariants = useMemo(() => {
    const list: {
      key: string;
      productId: string;
      productName: string;
      productImg: string;
      size: string;
      price: number;
      stock: number;
      category: string;
    }[] = [];

    productsList.forEach((prod) => {
      const vars =
        Array.isArray(prod.variants) && prod.variants.length > 0
          ? prod.variants
          : [{ size: promoConfig.variantSelection.standardVariantLabel, price: prod.price || 0, stock: prod.stock || 0 }];

      vars.forEach((v: any) => {
        const sizeStr = String(v.size || promoConfig.variantSelection.standardVariantLabel).trim();
        list.push({
          key: `${prod.id}::${sizeStr}`,
          productId: prod.id,
          productName: prod.name,
          productImg: prod.image_url || prod.imageUrl || "",
          size: sizeStr,
          price: Number(v.price || 0),
          stock: Number(v.stock || 0),
          category: prod.category || promoConfig.variantSelection.defaultCategory || "Produk",
        });
      });
    });

    return list;
  }, [productsList]);

  // Varian terfilter input search
  const filteredAvailableVariants = useMemo(() => {
    if (!variantSearch.trim()) return allAvailableVariants;
    const q = variantSearch.toLowerCase();
    return allAvailableVariants.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allAvailableVariants, variantSearch]);

  // Kelompokkan varian berdasarkan produk untuk tampilan terstruktur
  const groupedProductsWithVariants = useMemo(() => {
    const map = new Map<string, { product: any; variants: typeof allAvailableVariants }>();

    filteredAvailableVariants.forEach((v) => {
      if (!map.has(v.productId)) {
        const prod = productsList.find((p) => p.id === v.productId) || {
          id: v.productId,
          name: v.productName,
          image_url: v.productImg,
          category: v.category,
        };
        map.set(v.productId, { product: prod, variants: [] });
      }
      map.get(v.productId)!.variants.push(v);
    });

    return Array.from(map.values());
  }, [filteredAvailableVariants, productsList]);

  // Bulk: Pilih semua varian
  const handleSelectAllVariants = () => {
    const allKeys = allAvailableVariants.map((v) => v.key);
    setPromoForm((prev) => ({
      ...prev,
      promoTargetVariants: allKeys,
    }));
    toast.success(
      promoConfig.promoToko.selectAllToast.replace("{count}", String(allKeys.length))
    );
  };

  // Bulk: Batal pilih semua varian
  const handleDeselectAllVariants = () => {
    setPromoForm((prev) => ({
      ...prev,
      promoTargetVariants: [],
    }));
    toast.success(promoConfig.promoToko.deselectAllToast);
  };

  // Toggle satu varian
  const handleToggleSingleVariant = (key: string) => {
    setPromoForm((prev) => {
      const current = prev.promoTargetVariants || [];
      const exists = current.includes(key);
      const next = exists
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, promoTargetVariants: next };
    });
  };

  // Bulk toggle per produk
  const handleToggleProductVariants = (productId: string) => {
    const productVariantKeys = allAvailableVariants
      .filter((v) => v.productId === productId)
      .map((v) => v.key);

    setPromoForm((prev) => {
      const current = prev.promoTargetVariants || [];
      const allSelected = productVariantKeys.every((k) => current.includes(k));

      let next: string[];
      if (allSelected) {
        next = current.filter((k) => !productVariantKeys.includes(k));
      } else {
        const set = new Set([...current, ...productVariantKeys]);
        next = Array.from(set);
      }
      return { ...prev, promoTargetVariants: next };
    });
  };

  // ── Simpan & Edit Voucher Kupon ──
  const handleStartEditVoucher = (v: any) => {
    setEditingVoucherId(v.id);
    setVoucherForm({
      code: v.code || "",
      title: v.title || "",
      type: v.type || "percentage",
      discount_amount: Number(v.discount_amount) || 0,
      min_purchase: Number(v.min_purchase) || 0,
      valid_until: v.valid_until ? String(v.valid_until).slice(0, 10) : "",
      usage_limit: Number(v.usage_limit) || 0,
    });
  };

  const handleCancelEdit = () => {
    setEditingVoucherId(null);
    setVoucherForm({
      code: "",
      title: "",
      type: "percentage",
      discount_amount: 0,
      min_purchase: 0,
      valid_until: "",
      usage_limit: 50,
    });
  };

  const handleSaveVoucher = async (e: any) => {
    e.preventDefault();
    if (!voucherForm.code.trim() || !voucherForm.title.trim()) {
      return toast.error(promoConfig.messages.validationCodeTitle);
    }
    if (voucherForm.discount_amount <= 0 && voucherForm.type !== "shipping") {
      return toast.error(promoConfig.messages.validationDiscount);
    }

    const isEdit = Boolean(editingVoucherId);
    setSavingVoucher(true);
    const toastId = toast.loading(
      isEdit
        ? promoConfig.messages.updateVoucherLoading
        : promoConfig.messages.saveVoucherLoading
    );

    try {
      const { token } = await getSupabaseTokenAndSession();
      const url = (process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/vouchers";
      const method = isEdit ? "PUT" : "POST";
      const payload: any = {
        code: voucherForm.code.toUpperCase().trim(),
        title: voucherForm.title.trim(),
        type: voucherForm.type,
        discount_amount: Number(voucherForm.discount_amount),
        min_purchase: Number(voucherForm.min_purchase),
        valid_until: voucherForm.valid_until
          ? new Date(voucherForm.valid_until).toISOString()
          : null,
        usage_limit: Number(voucherForm.usage_limit) || 0,
      };

      if (isEdit) {
        payload.id = editingVoucherId;
      } else {
        payload.is_active = true;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });

      const data = res.headers?.get("content-type")?.includes("application/json")
        ? await res.json()
        : {};
      if (!res.ok) {
        throw new Error(
          data.error || (isEdit ? promoConfig.messages.updateVoucherError : promoConfig.messages.createVoucherError)
        );
      }

      if (isEdit) {
        const updatedVoucher = data.voucher || { ...payload, id: editingVoucherId };
        setVouchers((prev) =>
          prev.map((v) => (String(v.id) === String(editingVoucherId) ? { ...v, ...updatedVoucher } : v))
        );
        toast.success(promoConfig.messages.updateVoucherSuccess, { id: toastId });
        handleCancelEdit();
      } else {
        const newVoucher = data.voucher || payload;
        setVouchers((prev) => [newVoucher, ...prev]);
        toast.success(promoConfig.messages.createVoucherSuccess, { id: toastId });
        setVoucherForm({
          code: "",
          title: "",
          type: "percentage",
          discount_amount: 0,
          min_purchase: 0,
          valid_until: "",
          usage_limit: 50,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("vouchers-updated"));
      }
    } catch (err: any) {
      toast.error(
        err.message || (isEdit ? promoConfig.messages.updateVoucherError : promoConfig.messages.createVoucherError),
        { id: toastId }
      );
    } finally {
      setSavingVoucher(false);
    }
  };

  const handleToggleVoucherActive = async (id: string, currentStatus: boolean) => {
    try {
      const { token } = await getSupabaseTokenAndSession();
      const nextStatus = !currentStatus;
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/vouchers",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ id, is_active: nextStatus }),
        }
      );
      const data = res.headers?.get("content-type")?.includes("application/json")
        ? await res.json()
        : {};
      if (!res.ok) throw new Error(data.error || promoConfig.messages.toggleStatusError);

      setVouchers((prev) =>
        prev.map((v) => (String(v.id) === String(id) ? { ...v, is_active: nextStatus } : v))
      );
      toast.success(
        promoConfig.messages.toggleStatusSuccess.replace(
          "{status}",
          nextStatus ? promoConfig.vouchers.statusActive : promoConfig.vouchers.statusInactive
        )
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("vouchers-updated"));
      }
    } catch (err: any) {
      toast.error(err.message || promoConfig.messages.toggleStatusError);
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    if (!confirm(promoConfig.vouchers.deleteConfirm)) return;
    try {
      const { token } = await getSupabaseTokenAndSession();
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/vouchers?id=${id}`,
        {
          method: "DELETE",
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        }
      );
      const data = res.headers?.get("content-type")?.includes("application/json")
        ? await res.json()
        : {};
      if (!res.ok) throw new Error(data.error || promoConfig.messages.deleteVoucherError);

      setVouchers((prev) => prev.filter((v) => String(v.id) !== String(id)));
      if (editingVoucherId === id) {
        handleCancelEdit();
      }
      toast.success(promoConfig.messages.deleteVoucherSuccess);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("vouchers-updated"));
      }
    } catch (err: any) {
      toast.error(err.message || promoConfig.messages.deleteVoucherError);
    }
  };

  // ── Cek Status Promo & Voucher ──
  const isCurrentlyActive = useMemo(() => isPromoActive(promoForm), [promoForm]);

  const activeVouchersCount = useMemo(() => {
    return vouchers.filter((v) => {
      const isExp = v.valid_until && new Date(v.valid_until).getTime() < Date.now();
      const isFull = v.usage_limit > 0 && (v.used_count || 0) >= v.usage_limit;
      return v.is_active !== false && !isExp && !isFull;
    }).length;
  }, [vouchers]);

  const isVoucherExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil).getTime() < Date.now();
  };

  // Filter & Search Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const isExp = isVoucherExpired(v.valid_until);
      const isFull = v.usage_limit > 0 && (v.used_count || 0) >= v.usage_limit;

      // Status Filter
      if (voucherFilter === "active") {
        if (v.is_active === false || isExp || isFull) return false;
      } else if (voucherFilter === "inactive") {
        if (v.is_active !== false) return false;
      } else if (voucherFilter === "expired") {
        if (!isExp) return false;
      }

      // Search Query Filter
      if (voucherSearch.trim()) {
        const q = voucherSearch.toLowerCase().trim();
        const matchCode = (v.code || "").toLowerCase().includes(q);
        const matchTitle = (v.title || "").toLowerCase().includes(q);
        if (!matchCode && !matchTitle) return false;
      }

      return true;
    });
  }, [vouchers, voucherFilter, voucherSearch]);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>{promoConfig.messages.loading}</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── HEADER HERO & STATS ── */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroSubtitle}>{promoConfig.hero.subtitle}</p>
          <h2 className={styles.heroTitle}>{promoConfig.hero.title}</h2>
          <p className={styles.heroDescription}>{promoConfig.hero.description}</p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{promoConfig.hero.stats.promoLabel}</span>
            {isCurrentlyActive ? (
              <span className={styles.statBadgeActive}>
                <CheckCircle2 size={14} /> {promoConfig.hero.stats.promoLive}
              </span>
            ) : (
              <span className={styles.statBadgeInactive}>
                <AlertCircle size={14} /> {promoConfig.hero.stats.promoInactive}
              </span>
            )}
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{promoConfig.hero.stats.totalVouchersLabel}</span>
            <span className={styles.statValue}>{vouchers.length}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{promoConfig.hero.stats.activeVouchersLabel}</span>
            <span className={styles.statValueActive}>{activeVouchersCount}</span>
          </div>
        </div>
      </header>

      {/* ── NAVIGASI SUB-TAB ── */}
      <nav className={styles.tabNav}>
        <button
          type="button"
          className={`${styles.tabBtn} ${
            activeTab === "promo_toko" ? styles.tabBtnActive : ""
          }`}
          onClick={() => setActiveTab("promo_toko")}
        >
          <Sparkles size={18} />
          <span>{promoConfig.tabs.promoToko.label}</span>
          {isCurrentlyActive && <span className={styles.tabBadge}>{promoConfig.tabs.promoToko.liveBadge}</span>}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${
            activeTab === "vouchers" ? styles.tabBtnActive : ""
          }`}
          onClick={() => setActiveTab("vouchers")}
        >
          <Ticket size={18} />
          <span>{promoConfig.tabs.vouchers.label}</span>
          <span className={styles.tabBadge}>
            {activeVouchersCount}/{vouchers.length}
          </span>
        </button>
      </nav>

      {/* ── KONTEN TAB 1: PROMO DISKON TOKO & BANNER ── */}
      {activeTab === "promo_toko" && (
        <div className={styles.promoTokoWrapper}>
          {/* Form Konfigurasi Promo Toko (Clean & Focused) */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>{promoConfig.promoToko.header.title}</h3>
              <p>{promoConfig.promoToko.header.subtitle}</p>
            </div>

            <div className={styles.formGrid}>
              {/* Switch Toggle Aktifkan Promo */}
              <div className={styles.switchCard}>
                <div className={styles.switchInfo}>
                  <h4>{promoConfig.promoToko.switch.title}</h4>
                  <p>{promoConfig.promoToko.switch.description}</p>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={promoForm.promoBannerEnabled}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        promoBannerEnabled: e.target.checked,
                      })
                    }
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              {/* Teks Banner Pengumuman */}
              <div className={styles.inputGroup}>
                <label>{promoConfig.promoToko.banner.label}</label>
                <div className={styles.inputWrapper}>
                  <Megaphone className={styles.inputIcon} size={16} />
                  <input
                    placeholder={promoConfig.promoToko.banner.placeholder}
                    value={promoForm.promoBannerText}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        promoBannerText: e.target.value,
                      })
                    }
                  />
                </div>
                <span className={styles.inputHint}>{promoConfig.promoToko.banner.hint}</span>
              </div>

              {/* Tipe Diskon & Nilai */}
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>{promoConfig.promoToko.discountType.label}</label>
                  <select
                    value={promoForm.promoDiscountType}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        promoDiscountType: e.target.value,
                      })
                    }
                  >
                    <option value="percentage">{promoConfig.promoToko.discountType.percentage}</option>
                    <option value="fixed">{promoConfig.promoToko.discountType.fixed}</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>
                    {promoForm.promoDiscountType === "percentage"
                      ? `${promoConfig.promoToko.discountValue.label} (%)`
                      : `${promoConfig.promoToko.discountValue.label} (Rp)`}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder={
                      promoForm.promoDiscountType === "percentage"
                        ? promoConfig.promoToko.discountValue.placeholderPercentage
                        : promoConfig.promoToko.discountValue.placeholderFixed
                    }
                    value={promoForm.promoDiscountValue || ""}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        promoDiscountValue: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              {/* Masa Berlaku Promo */}
              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>{promoConfig.promoToko.dates.startLabel}</label>
                  <div className={styles.inputWrapper}>
                    <Calendar className={styles.inputIcon} size={16} />
                    <input
                      type="date"
                      value={promoForm.promoStartDate}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          promoStartDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label>{promoConfig.promoToko.dates.endLabel}</label>
                  <div className={styles.inputWrapper}>
                    <Calendar className={styles.inputIcon} size={16} />
                    <input
                      type="date"
                      value={promoForm.promoEndDate}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          promoEndDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Cakupan Target Promo */}
              <div className={styles.inputGroup}>
                <label>{promoConfig.promoToko.targetScope.label}</label>
                <div className={styles.scopeSelector}>
                  <button
                    type="button"
                    className={`${styles.scopeOption} ${
                      promoForm.promoTargetType === "all"
                        ? styles.scopeOptionActive
                        : ""
                    }`}
                    onClick={() =>
                      setPromoForm({ ...promoForm, promoTargetType: "all" })
                    }
                  >
                    <span className={styles.scopeOptionTitle}>
                      <Sparkles size={16} /> {promoConfig.promoToko.targetScope.all}
                    </span>
                    <span className={styles.scopeOptionDesc}>
                      {promoConfig.promoToko.targetScope.allDesc}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.scopeOption} ${
                      promoForm.promoTargetType === "specific_variants"
                        ? styles.scopeOptionActive
                        : ""
                    }`}
                    onClick={() =>
                      setPromoForm({
                        ...promoForm,
                        promoTargetType: "specific_variants",
                      })
                    }
                  >
                    <span className={styles.scopeOptionTitle}>
                      <Package size={16} /> {promoConfig.promoToko.targetScope.specific}
                    </span>
                    <span className={styles.scopeOptionDesc}>
                      {promoConfig.promoToko.targetScope.specificDesc}{" "}
                      {promoConfig.promoToko.targetScope.selectedCountTemplate
                        ? promoConfig.promoToko.targetScope.selectedCountTemplate.replace(
                            "{count}",
                            String(promoForm.promoTargetVariants?.length || 0)
                          )
                        : `(${promoForm.promoTargetVariants?.length || 0} dipilih)`}
                      .
                    </span>
                  </button>
                </div>

                {/* Panel Seleksi Varian Spesifik & Bulk Action Terintegrasi */}
                {promoForm.promoTargetType === "specific_variants" && (
                  <div className={styles.embeddedVariantSection}>
                    <div className={styles.embeddedVariantHeader}>
                      <div>
                        <h4>
                          <Package size={18} className={styles.sectionIcon} />
                          {promoConfig.variantSelection.title}
                        </h4>
                        <p>{promoConfig.variantSelection.description}</p>
                      </div>
                      <span className={styles.selectedCounterBadge}>
                        <CheckCircle2 size={14} />
                        {promoConfig.variantSelection.selectedCounterTemplate.replace(
                          "{count}",
                          String(promoForm.promoTargetVariants?.length || 0)
                        )}{" "}
                        {promoConfig.variantSelection.totalVariantsTemplate.replace(
                          "{count}",
                          String(allAvailableVariants.length)
                        )}
                      </span>
                    </div>

                    {/* Bulk Action Toolbar */}
                    <div className={styles.bulkActionBar}>
                      <div className={styles.bulkSearchWrapper}>
                        <Search size={15} className={styles.bulkSearchIcon} />
                        <input
                          type="text"
                          placeholder={promoConfig.variantSelection.searchPlaceholder}
                          value={variantSearch}
                          onChange={(e) => setVariantSearch(e.target.value)}
                        />
                      </div>

                      <div className={styles.bulkActionButtons}>
                        <button
                          type="button"
                          className={`${styles.bulkBtn} ${styles.bulkBtnPrimary}`}
                          onClick={handleSelectAllVariants}
                          title={promoConfig.variantSelection.selectAllTooltip}
                        >
                          <CheckSquare size={14} /> {promoConfig.variantSelection.selectAllBtn}
                        </button>
                        <button
                          type="button"
                          className={styles.bulkBtn}
                          onClick={handleDeselectAllVariants}
                          title={promoConfig.variantSelection.deselectAllTooltip}
                        >
                          <Square size={14} /> {promoConfig.variantSelection.deselectAllBtn}
                        </button>
                      </div>
                    </div>

                    {/* List Grup Produk & Varian */}
                    <div className={styles.productGroupList}>
                      {groupedProductsWithVariants.map(({ product, variants }) => {
                        const prodKeys = variants.map((v) => v.key);
                        const allSelected = prodKeys.every((k) =>
                          promoForm.promoTargetVariants?.includes(k)
                        );

                        return (
                          <div className={styles.productGroupCard} key={product.id}>
                            <div className={styles.productGroupHeader}>
                              <div className={styles.productHeaderLeft}>
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className={styles.productThumb}
                                  />
                                ) : (
                                  <div className={styles.productThumbPlaceholder}>
                                    <Package size={18} />
                                  </div>
                                )}
                                <div>
                                  <h4 className={styles.productTitleText}>{product.name}</h4>
                                  <p className={styles.productCategoryText}>
                                    {product.category || promoConfig.variantSelection.defaultCategory || "Produk"}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                className={styles.productSelectAllBtn}
                                onClick={() => handleToggleProductVariants(product.id)}
                              >
                                {allSelected ? <Square size={13} /> : <CheckSquare size={13} />}
                                <span>
                                  {allSelected
                                    ? promoConfig.variantSelection.productDeselectAll
                                    : promoConfig.variantSelection.productSelectAll}
                                </span>
                              </button>
                            </div>

                            <div className={styles.variantGrid}>
                              {variants.map((v) => {
                                const isSelected = promoForm.promoTargetVariants?.includes(
                                  v.key
                                );
                                const discounted = getDiscountedPrice(v.price, promoForm);

                                return (
                                  <div
                                    key={v.key}
                                    className={`${styles.variantRow} ${
                                      isSelected ? styles.variantRowActive : ""
                                    }`}
                                    onClick={() => handleToggleSingleVariant(v.key)}
                                  >
                                    <div className={styles.variantRowLeft}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(isSelected)}
                                        onChange={() => {}} // handled by row click
                                        className={styles.variantCheckbox}
                                      />
                                      <span className={styles.variantSizeBadge}>
                                        {v.size}
                                      </span>
                                      <span className={styles.variantStockText}>
                                        {promoConfig.variantSelection.stockTemplate.replace(
                                          "{count}",
                                          String(v.stock)
                                        )}
                                      </span>
                                    </div>

                                    <div className={styles.variantRowRight}>
                                      <div className={styles.variantPriceCol}>
                                        {isSelected &&
                                        isCurrentlyActive &&
                                        discounted.hasDiscount ? (
                                          <>
                                            <span className={styles.variantOriginalPrice}>
                                              {formatRupiah(v.price)}
                                            </span>
                                            <span className={styles.variantPromoPrice}>
                                              {formatRupiah(discounted.price)}
                                            </span>
                                            <span className={styles.variantSavingsTag}>
                                              {promoConfig.variantSelection.savingsTemplate.replace(
                                                "{amount}",
                                                formatRupiah(discounted.savings)
                                              )}
                                            </span>
                                          </>
                                        ) : (
                                          <span className={styles.variantNormalPrice}>
                                            {formatRupiah(v.price)}
                                          </span>
                                        )}
                                      </div>

                                      {isSelected ? (
                                        <span className={styles.variantActiveBadge}>
                                          <CheckCircle2 size={12} />
                                          {promoConfig.variantSelection.promoActiveBadge}
                                        </span>
                                      ) : (
                                        <span className={styles.variantInactiveBadge}>
                                          {promoConfig.variantSelection.normalPriceBadge}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {groupedProductsWithVariants.length === 0 && (
                        <div className={styles.emptyState}>
                          <Package size={36} className={styles.emptyIcon} />
                          <h4>{promoConfig.variantSelection.emptySearch}</h4>
                          <p>{promoConfig.variantSelection.emptySearchHint}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Unified Save Area (Hanya 1 Tombol Simpan di Bawah Form) */}
              <div className={styles.unifiedSaveArea}>
                {promoForm.promoTargetType === "specific_variants" && (
                  <div className={styles.saveSummaryText}>
                    <CheckCircle2 size={15} />
                    <span>
                      {promoConfig.variantSelection.selectedCounterTemplate.replace(
                        "{count}",
                        String(promoForm.promoTargetVariants?.length || 0)
                      )}{" "}
                      {promoConfig.variantSelection.selectedSuffix}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={handleSavePromo}
                  disabled={savingPromo}
                >
                  <Sparkles size={18} />
                  {savingPromo
                    ? promoConfig.promoToko.saveBtn.loading
                    : promoConfig.promoToko.saveBtn.idle}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── KONTEN TAB 2: KUPON VOUCHER BELANJA ── */}
      {activeTab === "vouchers" && (
        <div className={styles.mainGrid}>
          {/* Form Buat / Edit Voucher */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>
                {editingVoucherId
                  ? promoConfig.vouchers.modal.editTitle
                  : promoConfig.vouchers.modal.createTitle}
              </h3>
              <p>
                {editingVoucherId
                  ? promoConfig.vouchers.modal.editSubtitle
                  : promoConfig.vouchers.headerSubtitle}
              </p>
            </div>

            <div className={styles.formGrid}>
              {/* Edit Mode Banner */}
              {editingVoucherId && (
                <div className={styles.editModeBanner}>
                  <div className={styles.editModeText}>
                    <Pencil size={15} />
                    <span>{promoConfig.vouchers.modal.editModeBadge}: {voucherForm.code}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.cancelEditBtn}
                    onClick={handleCancelEdit}
                  >
                    <X size={12} className={styles.cancelEditIcon} />
                    {promoConfig.vouchers.modal.cancelEditBtn}
                  </button>
                </div>
              )}

              <div className={styles.inputGroup}>
                <label>{promoConfig.vouchers.modal.codeLabel}</label>
                <div className={styles.inputWrapper}>
                  <Scissors className={styles.inputIcon} size={16} />
                  <input
                    placeholder={promoConfig.vouchers.modal.codePlaceholder}
                    value={voucherForm.code}
                    onChange={(e) =>
                      setVoucherForm({
                        ...voucherForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{promoConfig.vouchers.modal.titleLabel}</label>
                <input
                  placeholder={promoConfig.vouchers.modal.titlePlaceholder}
                  value={voucherForm.title}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, title: e.target.value })
                  }
                />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>{promoConfig.vouchers.modal.typeLabel}</label>
                  <select
                    value={voucherForm.type}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, type: e.target.value })
                    }
                  >
                    <option value="percentage">{promoConfig.vouchers.modal.typePercentage}</option>
                    <option value="fixed">{promoConfig.vouchers.modal.typeFixed}</option>
                    <option value="shipping">{promoConfig.vouchers.modal.typeShipping}</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>
                    {voucherForm.type === "percentage"
                      ? `${promoConfig.vouchers.modal.valueLabel} (%)`
                      : `${promoConfig.vouchers.modal.valueLabel} (Rp)`}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder={promoConfig.vouchers.modal.discountPlaceholder}
                    value={voucherForm.discount_amount || ""}
                    onChange={(e) =>
                      setVoucherForm({
                        ...voucherForm,
                        discount_amount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>{promoConfig.vouchers.modal.minSpendLabel}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={promoConfig.vouchers.modal.minSpendPlaceholder}
                    value={voucherForm.min_purchase || ""}
                    onChange={(e) =>
                      setVoucherForm({
                        ...voucherForm,
                        min_purchase: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>{promoConfig.vouchers.modal.quotaLabel}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={promoConfig.vouchers.modal.quotaPlaceholder}
                    value={voucherForm.usage_limit || ""}
                    onChange={(e) =>
                      setVoucherForm({
                        ...voucherForm,
                        usage_limit: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>{promoConfig.vouchers.modal.validUntilLabel}</label>
                <div className={styles.inputWrapper}>
                  <Calendar className={styles.inputIcon} size={16} />
                  <input
                    type="date"
                    value={voucherForm.valid_until}
                    onChange={(e) =>
                      setVoucherForm({
                        ...voucherForm,
                        valid_until: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSaveVoucher}
                disabled={savingVoucher}
              >
                {editingVoucherId ? <Pencil size={17} /> : <Plus size={18} />}
                {savingVoucher
                  ? promoConfig.vouchers.modal.savingBtn
                  : editingVoucherId
                  ? promoConfig.vouchers.modal.updateBtn
                  : promoConfig.vouchers.modal.saveBtn}
              </button>
            </div>
          </section>

          {/* Daftar Voucher dengan Search & Filter Toolbar */}
          <section className={styles.voucherListSection}>
            <div className={styles.listHeader}>
              <div>
                <h3>{promoConfig.vouchers.headerTitle}</h3>
                <p>{promoConfig.vouchers.headerSubtitle}</p>
              </div>
            </div>

            {/* Toolbar Pencarian & Filter Status */}
            <div className={styles.voucherToolbar}>
              <div className={styles.voucherSearchWrapper}>
                <Search size={15} className={styles.voucherSearchIcon} />
                <input
                  type="text"
                  placeholder={promoConfig.vouchers.searchPlaceholder}
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  className={styles.voucherSearchInput}
                />
              </div>

              <div className={styles.voucherFiltersRow}>
                <div className={styles.voucherFilters}>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${
                      voucherFilter === "all" ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setVoucherFilter("all")}
                  >
                    {promoConfig.vouchers.filterAll}{" "}
                    {promoConfig.vouchers.filterBadgeTemplate?.replace(
                      "{count}",
                      String(vouchers.length)
                    ) || `(${vouchers.length})`}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${
                      voucherFilter === "active" ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setVoucherFilter("active")}
                  >
                    {promoConfig.vouchers.filterActive}{" "}
                    {promoConfig.vouchers.filterBadgeTemplate?.replace(
                      "{count}",
                      String(activeVouchersCount)
                    ) || `(${activeVouchersCount})`}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${
                      voucherFilter === "inactive" ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setVoucherFilter("inactive")}
                  >
                    {promoConfig.vouchers.filterInactive}
                  </button>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${
                      voucherFilter === "expired" ? styles.filterBtnActive : ""
                    }`}
                    onClick={() => setVoucherFilter("expired")}
                  >
                    {promoConfig.vouchers.filterExpired}
                  </button>
                </div>

                <span className={styles.filterCountText}>
                  {promoConfig.vouchers.filterCountTemplate.replace(
                    "{count}",
                    String(filteredVouchers.length)
                  )}
                </span>
              </div>
            </div>

            <div className={styles.voucherGrid}>
              {filteredVouchers.map((v) => {
                const expired = isVoucherExpired(v.valid_until);
                const isQuotaFull =
                  v.usage_limit > 0 && (v.used_count || 0) >= v.usage_limit;

                return (
                  <div className={styles.voucherCard} key={v.id}>
                    <div className={styles.voucherIcon}>
                      {v.type === "shipping" ? (
                        <Truck size={24} />
                      ) : v.type === "percentage" ? (
                        <Percent size={24} />
                      ) : (
                        <Ticket size={24} />
                      )}
                    </div>
                    <div className={styles.voucherContent}>
                      <div className={styles.voucherTop}>
                        <span className={styles.voucherCode}>{v.code}</span>
                        <div className={styles.voucherActions}>
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => handleStartEditVoucher(v)}
                            title={promoConfig.vouchers.editBtn}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.toggleBtn} ${
                              v.is_active
                                ? styles.toggleBtnActive
                                : styles.toggleBtnInactive
                            }`}
                            onClick={() =>
                              handleToggleVoucherActive(v.id, v.is_active)
                            }
                            title={
                              v.is_active
                                ? promoConfig.vouchers.toggleInactiveTitle
                                : promoConfig.vouchers.toggleActiveTitle
                            }
                          >
                            <Power size={12} />
                            <span>{v.is_active ? promoConfig.vouchers.statusActive : promoConfig.vouchers.statusInactive}</span>
                          </button>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteVoucher(v.id)}
                            title={promoConfig.vouchers.deleteBtn}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <h4 className={styles.voucherTitle}>{v.title}</h4>
                      <p className={styles.voucherDetail}>
                        <strong>
                          {v.type === "shipping"
                            ? promoConfig.vouchers.modal.typeShipping
                            : v.type === "percentage"
                            ? `${v.discount_amount}%`
                            : formatRupiah(v.discount_amount)}
                        </strong>{" "}
                        {promoConfig.vouchers.offLabel}
                        {v.min_purchase > 0 && (
                          <span>
                            {" "}· {promoConfig.vouchers.minPurchaseTemplate.replace(
                              "{amount}",
                              formatRupiah(v.min_purchase)
                            )}
                          </span>
                        )}
                      </p>

                      <div className={styles.voucherQuota}>
                        <Users size={13} />
                        <span>
                          {promoConfig.vouchers.quotaTemplate
                            .replace("{used}", String(v.used_count || 0))
                            .replace(
                              "{limit}",
                              v.usage_limit > 0
                                ? String(v.usage_limit)
                                : promoConfig.vouchers.unlimited
                            )}
                        </span>
                      </div>

                      <div className={styles.voucherFooter}>
                        {v.valid_until ? (
                          <div className={styles.voucherExpiry}>
                            <Calendar size={12} />
                            <span>
                              {promoConfig.vouchers.expPrefix}
                              {new Date(v.valid_until).toLocaleDateString("id-ID")}
                            </span>
                          </div>
                        ) : (
                          <span className={styles.voucherExpiry}>{promoConfig.vouchers.noExpiry}</span>
                        )}

                        {v.is_active === false ? (
                          <span className={styles.badgeInactive}>{promoConfig.vouchers.badgeInactive}</span>
                        ) : expired ? (
                          <span className={styles.badgeExpired}>{promoConfig.vouchers.badgeExpired}</span>
                        ) : isQuotaFull ? (
                          <span className={styles.badgeQuotaFull}>{promoConfig.vouchers.badgeQuotaFull}</span>
                        ) : (
                          <span className={styles.badgeActive}>{promoConfig.vouchers.badgeActive}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!vouchers.length && (
                <div className={styles.emptyState}>
                  <Ticket size={48} className={styles.emptyIcon} />
                  <h4>{promoConfig.vouchers.emptyList}</h4>
                  <p>{promoConfig.vouchers.emptyListHint}</p>
                </div>
              )}

              {vouchers.length > 0 && filteredVouchers.length === 0 && (
                <div className={styles.emptyState}>
                  <Search size={44} className={styles.emptyIcon} />
                  <h4>{promoConfig.vouchers.emptySearch}</h4>
                  <p>{promoConfig.vouchers.emptySearchHint}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}