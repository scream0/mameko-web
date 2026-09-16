// @ts-nocheck
"use client";
import { getApiBaseUrl } from "@/lib/apiClient";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import { normalizeAddress } from "@/utils/address";
import MyVouchers from "@/components/Dashboard/User/Vouchers/MyVouchers";
import { AddressFormModal } from "@/components/Dashboard/User/Profil/ProfileModals";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { DEFAULT_ACTIVE_COURIERS, DEFAULT_ORIGIN_AREA_ID } from "@/config/shipping";
import Link from "next/link";
import styles from "./checkout.module.css";
import checkoutConfig from "@/data/ui/checkoutConfig.json";
import { getDiscountedPrice } from "@/utils/promo";
import { loadMidtransSnap } from "@/lib/midtrans";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

// ID area Biteship untuk kota asal toko (di-resolve via nama kota di admin).
const ORIGIN_AREA_FALLBACK = DEFAULT_ORIGIN_AREA_ID;
const MAX_APPLIED_VOUCHERS = 2;

const emptyAddressForm = (displayName = "", phone = "") => ({
  label: checkoutConfig.address.defaultLabelName || "Rumah",
  recipientName: displayName || "",
  recipientPhone: phone || "",
  street: "",
  district: "",
  province: "",
  city: "",
  postalCode: "",
  biteshipAreaId: "",
  notes: "",
});

// ─── HELPERS ────────────────────────────────────────────────
const rupiah = (n: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const getVoucherCategory = (voucher: any) =>
  voucher?.type === "shipping" ? "shipping" : "discount";

const COURIER_PROFILES = {
  jne: { name: "JNE", service: "REG", desc: "Layanan Reguler", offset: 0, etd: "1-3" },
  jnt: { name: "J&T Express", service: "EZ", desc: "Express Service", offset: 2000, etd: "1-2" },
  sicepat: { name: "SiCepat", service: "SIUNT", desc: "SiUntung", offset: 1000, etd: "1-2" },
  anteraja: { name: "AnterAja", service: "REG", desc: "Regular Service", offset: 1500, etd: "1-2" },
  ninja: { name: "Ninja Xpress", service: "STANDARD", desc: "Standard Service", offset: 2500, etd: "1-3" },
  pos: { name: "POS Indonesia", service: "POSREG", desc: "Pos Reguler", offset: -1000, etd: "2-4" },
  tiki: { name: "TIKI", service: "REG", desc: "Regular Service", offset: 500, etd: "1-3" },
  wahana: { name: "Wahana", service: "DES", desc: "Domestik Ekspres", offset: -3000, etd: "2-5" },
  lion: { name: "Lion Parcel", service: "REGPACK", desc: "Regular Package", offset: 1000, etd: "1-3" },
  ide: { name: "ID Express", service: "STD", desc: "Standard Service", offset: 1000, etd: "1-2" },
  sap: { name: "SAP Express", service: "UDR", desc: "UDR Reguler", offset: 1500, etd: "1-3" },
  rpx: { name: "RPX", service: "RGP", desc: "Regular Package", offset: 2000, etd: "1-3" },
};

const buildLocalCourierOptions = (courierList = [], weight = 0) => {
  const kg = Math.max(1, Math.ceil((Number(weight) || 0) / 1000));
  const base = Math.max(12000, 8000 + kg * 3500);

  const targets = (courierList && courierList.length > 0)
    ? courierList
    : ["jne", "jnt", "sicepat", "anteraja"];

  return targets.map((c) => {
    const code = String(c || "").toLowerCase();
    const profile = (COURIER_PROFILES as any)[code] || {
      name: code.toUpperCase(),
      service: "REG",
      desc: "Layanan Reguler",
      offset: 0,
      etd: "1-3",
    };
    return {
      courier: code,
      courierName: profile.name,
      service: profile.service,
      description: profile.desc,
      cost: Math.max(8000, base + (profile.offset || 0)),
      etd: profile.etd,
      key: `${code}-${profile.service}`,
      estimated: true,
    };
  });
};

// ─── CHECKOUT PAGE ──────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    products,
    processPayment,
    isProcessing: isStoreProcessing,
    activePromo,
    discountedCartTotal,
    cartTotal,
    promoSavings,
  } = useStore();


  // ── Auth ──
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  // ── Voucher State ──
  const [claimedVouchers, setClaimedVouchers] = useState<any[]>([]);
  const [appliedVouchers, setAppliedVouchers] = useState<any[]>([]);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  // ── Store Settings ──
  const [activeCouriers, setActiveCouriers] = useState<any[]>(["jne", "jnt", "sicepat"]);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("midtrans");
  const [originAreaId, setOriginAreaId] = useState(ORIGIN_AREA_FALLBACK);

  const fetchUserClaimedVouchers = async (userId: any, token: any) => {
    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [profileRes, vouchersRes] = await Promise.all([
        token
          ? fetch(getApiBaseUrl() + "/api/user/profile", { headers, cache: "no-store" })
          : Promise.resolve(null),
        fetch(getApiBaseUrl() + "/api/vouchers/public", { cache: "no-store" }),
      ]);

      let publicVouchers = [];
      if (vouchersRes && vouchersRes.ok) {
        const vData = await vouchersRes.json();
        const rawList = vData.data || vData.vouchers || [];
        publicVouchers = rawList.map((v: any) => ({
          ...v,
          id: String(v.id),
          status: "active",
          vouchers: v,
        }));
      }

      let userVouchers = [];
      if (profileRes && profileRes.ok) {
        const pData = await profileRes.json();
        if (pData.exists && pData.data?.user_vouchers) {
          userVouchers = pData.data.user_vouchers;
        }
      }

      const combined = [...userVouchers];
      for (const pv of publicVouchers) {
        const alreadyExists = combined.some(
          (cv) => String(cv.voucher_id || cv.vouchers?.id || cv.id) === String(pv.id),
        );
        if (!alreadyExists) {
          combined.push(pv);
        }
      }

      setClaimedVouchers(combined);
    } catch (err) {
      console.error("Gagal memuat voucher checkout:", err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      const user = session?.user || null;
      setCurrentUser(user);
      setPageLoading(false);

      if (!user) {
        router.push("/login?callbackUrl=/checkout");
      } else {
        fetchUserClaimedVouchers(user.id, session?.access_token);
      }
    };

    initAuth();

    // Fetch store settings for couriers and payment methods
    fetch(getApiBaseUrl() + "/api/settings?public=true")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setStoreSettings(data);
          if (data.activeCouriers) {
            setActiveCouriers(data.activeCouriers);
          }
          // Resolve origin area dari nama kota toko
          if (data.storeCityName) {
            fetch(getApiBaseUrl() + `/api/biteship/areas?q=${encodeURIComponent(data.storeCityName)}`)
              .then((r) => r.json())
              .then((d) => { if (d.areas?.[0]?.id) setOriginAreaId(d.areas[0].id); })
              .catch(() => { });
          }
          // Default payment method logic
          if (data.enableMidtrans && !data.enableManualTransfer) {
            setPaymentMethod("midtrans");
          } else if (!data.enableMidtrans && data.enableManualTransfer) {
            setPaymentMethod("manual");
          } else {
            setPaymentMethod("midtrans"); // default if both active
          }
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (shouldSkipAuthEvent(event, session, lastUserIdRef.current)) return;
      lastUserIdRef.current = session?.user?.id || null;

      const user = session?.user || null;
      setCurrentUser(user);
      if (event === 'SIGNED_OUT' || !user) {
        router.push("/login?callbackUrl=/checkout");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  // ── Scroll Lock Fix ──
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverflowY = document.body.style.overflowY;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousHtmlTouchAction = document.documentElement.style.touchAction;
    const previousBodyOverscrollBehaviorY = document.body.style.overscrollBehaviorY;
    const previousHtmlOverscrollBehaviorY = document.documentElement.style.overscrollBehaviorY;

    document.body.style.overflow = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.touchAction = "pan-y";
    document.body.style.overscrollBehaviorY = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.overflowY = "auto";
    document.documentElement.style.touchAction = "pan-y";
    document.documentElement.style.overscrollBehaviorY = "auto";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowY = previousBodyOverflowY;
      document.body.style.touchAction = previousBodyTouchAction;
      document.body.style.overscrollBehaviorY = previousBodyOverscrollBehaviorY;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overflowY = previousHtmlOverflowY;
      document.documentElement.style.touchAction = previousHtmlTouchAction;
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscrollBehaviorY;
    };
  }, []);

  // Preload Midtrans Snap script khusus halaman checkout sesuai environment toko
  useEffect(() => {
    if (storeSettings) {
      const isProd = Boolean(storeSettings.midtransIsProduction);
      const clientKey = isProd
        ? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_PRODUCTION
        : process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX;
      loadMidtransSnap(clientKey, isProd).catch(() => {});
    }
  }, [storeSettings]);

  // ── Address ──
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);

  // ── Address Modal ──
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddressForm());
  const [savingAddress, setSavingAddress] = useState(false);
  const [userProfilePhone, setUserProfilePhone] = useState("");

  useEffect(() => {
    if (!currentUser) return;

    // Prefill phone from current auth user if available
    const authPhone = currentUser.phone || currentUser.user_metadata?.phone || "";
    if (authPhone) setUserProfilePhone(authPhone);

    const loadAddressesAndProfile = async () => {
      setAddressLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiBase = getApiBaseUrl();
        const headers = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};

        const [rAddresses, rProfile] = await Promise.all([
          fetch(`${apiBase}/api/user/addresses`, { headers, cache: "no-store" }),
          fetch(`${apiBase}/api/user/profile`, { headers, cache: "no-store" }),
        ]);

        if (rAddresses.ok) {
          const result = await rAddresses.json();
          const addrs = (result.data || result || []).map((addr: any) => normalizeAddress(addr));
          setAddresses(addrs);
        }

        if (rProfile.ok) {
          const pResult = await rProfile.json();
          const prof = pResult.data || pResult;
          if (prof?.phone) {
            setUserProfilePhone(prof.phone);
          }
        }
      } catch {
        toast.error(checkoutConfig.toasts.fetchAddressError);
      } finally {
        setAddressLoading(false);
      }
    };

    void loadAddressesAndProfile();
  }, [currentUser]);

  // ── Courier ──
  const [courierOptions, setCourierOptions] = useState([]);
  const [selectedCourierKey, setSelectedCourierKey] = useState(null);
  const [courierLoading, setCourierLoading] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingMeta, setShippingMeta] = useState({ kind: "", message: "" });
  const selectedCourierKeyRef = useRef(null);

  useEffect(() => {
    selectedCourierKeyRef.current = selectedCourierKey;
  }, [selectedCourierKey]);

  useEffect(() => {
    if (!addresses.length) return;
    const existingSelection = addresses.find((addr) => addr.id === selectedAddressId);
    if (existingSelection) return;

    const bestAddress = addresses.find((addr) => addr.isPrimary)
      || addresses.find((addr) => addr.cityId || addr.postalCode)
      || addresses[0];

    if (bestAddress && selectedAddressId !== bestAddress.id) {
      setSelectedAddressId(bestAddress.id);
    }
  }, [addresses, selectedAddressId]);

  const handleSaveAddress = async (e: any) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!addressForm.province || !addressForm.city || !addressForm.street || !addressForm.recipientName || !addressForm.postalCode || !addressForm.recipientPhone) {
      toast.error(checkoutConfig.toasts.addressFieldsRequired || "Semua kolom alamat & nomor telepon penerima wajib diisi.");
      return;
    }

    if (addressForm.recipientPhone.replace(/\D/g, "").length < 8) {
      toast.error("Nomor telepon penerima minimal 8 digit angka.");
      return;
    }

    const isEditing = !!addressForm.id && addresses.some((a) => a.id === addressForm.id);
    if (!isEditing && addresses.length >= 3) {
      toast.error(checkoutConfig.toasts.maxAddressesReached);
      return;
    }

    setSavingAddress(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isPrimary = addressForm.isPrimary || addresses.length === 0;
      const payload = {
        recipientName: addressForm.recipientName,
        recipientPhone: addressForm.recipientPhone,
        street: addressForm.street,
        city: addressForm.city,
        cityId: addressForm.cityId || addressForm.biteshipAreaId || "",
        province: addressForm.province,
        postalCode: addressForm.postalCode,
        label: addressForm.label || checkoutConfig.address.defaultLabelName || "Rumah",
        isPrimary,
      };

      const apiBase = getApiBaseUrl();
      const headers = {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };

      let res;
      if (isEditing) {
        res = await fetch(`${apiBase}/api/user/addresses/${addressForm.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${apiBase}/api/user/addresses`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || checkoutConfig.toasts.addressSaveFailed);

      // Auto-sync nomor HP ke profil pengguna jika profil belum memiliki nomor HP
      if (addressForm.recipientPhone && (!userProfilePhone || userProfilePhone.trim() === "")) {
        fetch(`${apiBase}/api/user/profile`, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: addressForm.recipientPhone }),
        }).then(() => {
          setUserProfilePhone(addressForm.recipientPhone);
        }).catch(() => {});
      }

      // Reload from server to get canonical data
      const reloadRes = await fetch(`${apiBase}/api/user/addresses`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: "no-store",
      });
      if (reloadRes.ok) {
        const reloadResult = await reloadRes.json();
        const addrs = (reloadResult.data || reloadResult || []).map((addr: any) => normalizeAddress(addr));
        setAddresses(addrs);
        const saved = result.data || result;
        if (saved?.id) setSelectedAddressId(saved.id);
        else if (addrs.length) setSelectedAddressId(addrs[addrs.length - 1].id);
      }

      setShowAddressModal(false);
      setAddressForm(emptyAddressForm(currentUser?.user_metadata?.name || currentUser?.displayName, userProfilePhone || addressForm.recipientPhone));
      toast.success(checkoutConfig.toasts.addressSaveSuccess);
    } catch (err) {
      toast.error(err.message || checkoutConfig.toasts.addressSaveFailed);
    } finally {
      setSavingAddress(false);
    }
  };

  const totalWeight = useMemo(() => {
    let w = 0;
    for (const item of cart.items || []) {
      const prod = (products || []).find((p: any) => String(p.id) === String(item.id));
      const itemWeight = Number(prod?.weight) || 250;
      w += itemWeight * (Number(item.quantity) || 1);
    }
    return w;
  }, [cart.items, products]);

  // Real-time stock validation for cart items against products catalog
  const stockValidation = useMemo(() => {
    let hasInsufficient = false;
    const itemsMap: Record<string, { requested: number; available: number; isExceeded: boolean }> = {};

    for (const item of cart.items || []) {
      const prod = (products || []).find((p: any) => String(p.id) === String(item.id || item.productId));
      let availableStock = 0;
      if (prod) {
        if (prod.variants && Array.isArray(prod.variants) && prod.variants.length > 0) {
          const matchedVariant = prod.variants.find(
            (v: any) => String(v.size || "").trim().toLowerCase() === String(item.size || "").trim().toLowerCase()
          );
          availableStock = matchedVariant ? Number(matchedVariant.stock || 0) : 0;
        } else {
          availableStock = Number(prod.stock || 0);
        }
      }
      const requested = Number(item.quantity || 1);
      const isExceeded = requested > availableStock;
      if (isExceeded) {
        hasInsufficient = true;
      }
      itemsMap[item.cartId || `${item.id}-${item.size}`] = {
        requested,
        available: availableStock,
        isExceeded,
      };
    }

    return {
      hasInsufficient,
      itemsMap,
    };
  }, [cart.items, products]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId),
    [addresses, selectedAddressId],
  );


  const shippingReadiness = useMemo(() => {
    if (!selectedAddress) {
      return {
        tone: "warning",
        title: checkoutConfig.shippingReadiness.chooseAddress,
        detail: checkoutConfig.shippingReadiness.chooseAddressDesc,
      };
    }

    if (selectedAddress.city && (selectedAddress.district || selectedAddress.postalCode)) {
      const areaDesc = [selectedAddress.district ? `${checkoutConfig.address.districtPrefix || "Kec. "}${selectedAddress.district}` : "", selectedAddress.city].filter(Boolean).join(", ");
      return {
        tone: "success",
        title: checkoutConfig.shippingReadiness.areaServed,
        detail: `${areaDesc} ${checkoutConfig.shippingReadiness.areaServedDesc}`,
      };
    }

    if (selectedAddress.city || selectedAddress.postalCode) {
      return {
        tone: "info",
        title: checkoutConfig.shippingReadiness.detectingArea,
        detail: checkoutConfig.shippingReadiness.detectingAreaDesc,
      };
    }

    return {
      tone: "warning",
      title: checkoutConfig.shippingReadiness.addressIncomplete,
      detail: checkoutConfig.shippingReadiness.addressIncompleteDesc,
    };
  }, [selectedAddress]);

  const fetchCourierCosts = useCallback(async () => {
    if (!totalWeight) {
      setCourierOptions([]);
      setSelectedCourierKey(null);
      setShippingCost(0);
      return;
    }

    setCourierLoading(true);
    setCourierOptions([]);
    setShippingCost(0);
    setShippingMeta({ kind: "", message: "" });

    const safeFallbackOptions = buildLocalCourierOptions(activeCouriers, totalWeight);

    try {
      // Resolve destination area ID via Ongkir
      const searchTarget = [selectedAddress?.district, selectedAddress?.city].filter(Boolean).join(" ") || selectedAddress?.province || "";
      const postalCodeParam = selectedAddress?.postalCode || "";
      let destinationAreaId = "";
      const usingFallbackDestination = !searchTarget;

      if (searchTarget) {
        try {
          const areaUrl = `/api/biteship/areas?q=${encodeURIComponent(searchTarget)}&postalCode=${encodeURIComponent(postalCodeParam)}`;
          const areaRes = await fetch(areaUrl);
          const areaData = await areaRes.json();
          destinationAreaId = areaData.areas?.[0]?.id || "";
        } catch {
          destinationAreaId = "";
        }
      }

      if (!destinationAreaId) {
        // Tidak bisa resolve area → langsung fallback
        setCourierOptions(safeFallbackOptions);
        setSelectedCourierKey(safeFallbackOptions[0]?.key || null);
        setShippingCost(safeFallbackOptions[0]?.cost || 0);
        setShippingMeta({
          kind: "estimated",
          message: usingFallbackDestination
            ? checkoutConfig.courier.fallbackMessageIncomplete
            : checkoutConfig.courier.fallbackMessageUndetected,
        });
        return;
      }

      // Satu request ke Ongkir dengan semua kurir aktif dari database/admin
      const couriersParam = (activeCouriers && activeCouriers.length > 0 ? activeCouriers : DEFAULT_ACTIVE_COURIERS).join(",");
      const ongkirUrl = `/api/ongkir?originAreaId=${encodeURIComponent(originAreaId || "")}&destinationAreaId=${encodeURIComponent(destinationAreaId)}&weight=${totalWeight}&couriers=${encodeURIComponent(couriersParam)}`;
      const ongkirRes = await fetch(ongkirUrl);
      const ongkirData = await ongkirRes.json();

      let fallbackMessage = ongkirData.fallback ? (ongkirData.warning || "") : "";
      const allCosts = [];

      const lowerActiveCouriers = (activeCouriers || []).map((c) => String(c).toLowerCase());
      for (const courier of ongkirData.costs || []) {
        const courierCode = String(courier.courier || "").toLowerCase();
        if (lowerActiveCouriers.length > 0 && !lowerActiveCouriers.includes(courierCode)) continue;
        for (const svc of courier.services || []) {
          allCosts.push({
            courier: courier.courier,
            courierName: courier.courierName,
            service: svc.service,
            description: svc.description,
            cost: svc.cost,
            etd: svc.etd,
            key: `${courier.courier}-${svc.service}`,
            estimated: Boolean(ongkirData.fallback),
          });
        }
      }

      const uniqueCosts = Array.from(
        new Map(allCosts.map((option) => [option.key, option])).values(),
      );

      if (uniqueCosts.length === 0) {
        setCourierOptions(safeFallbackOptions);
        setSelectedCourierKey(safeFallbackOptions[0]?.key || null);
        setShippingCost(safeFallbackOptions[0]?.cost || 0);
        setShippingMeta({
          kind: "estimated",
          message: fallbackMessage || checkoutConfig.courier.fallbackMessageGeneric,
        });
        return;
      }

      uniqueCosts.sort((a, b) => {
        if (a.estimated !== b.estimated) return a.estimated ? 1 : -1;
        if (a.cost !== b.cost) return a.cost - b.cost;
        const etdA = Number(String(a.etd || "0").split("-")[0]) || 999;
        const etdB = Number(String(b.etd || "0").split("-")[0]) || 999;
        return etdA !== etdB ? etdA - etdB : a.courierName.localeCompare(b.courierName);
      });

      setCourierOptions(uniqueCosts);

      if (fallbackMessage) {
        setShippingMeta({ kind: "estimated", message: fallbackMessage });
      }

      const preferredKey =
        uniqueCosts.find((option) => option.key === selectedCourierKeyRef.current)?.key
        || uniqueCosts[0].key;
      const preferredOption = uniqueCosts.find((option) => option.key === preferredKey) || uniqueCosts[0];

      setSelectedCourierKey(preferredOption.key);
      setShippingCost(preferredOption.cost);
    } catch (err) {
      console.error("Gagal ambil ongkir:", err);
      setCourierOptions(safeFallbackOptions);
      const fallbackOption = safeFallbackOptions[0];
      setSelectedCourierKey(fallbackOption?.key || null);
      setShippingCost(fallbackOption?.cost || 0);
      setShippingMeta({
        kind: "estimated",
        message: checkoutConfig.courier.fallbackMessageError,
      });
    } finally {
      setCourierLoading(false);
    }
  }, [selectedAddress, totalWeight, activeCouriers, originAreaId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCourierCosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCourierCosts]);

  const handleSelectCourier = (key, cost: any) => {
    setSelectedCourierKey(key);
    setShippingCost(cost);
  };

  // ── Pilihan Voucher ──
  const subtotal = activePromo ? discountedCartTotal : cartTotal;

  const shippingVoucher = useMemo(
    () => appliedVouchers.find((v) => getVoucherCategory(v) === "shipping") || null,
    [appliedVouchers],
  );
  const discountVoucher = useMemo(
    () => appliedVouchers.find((v) => getVoucherCategory(v) === "discount") || null,
    [appliedVouchers],
  );

  const handleSelectVoucherFromModal = (claimedVoucherEntry: any) => {
    const voucherDetail = claimedVoucherEntry.vouchers || claimedVoucherEntry;

    if (voucherDetail.min_purchase && subtotal < voucherDetail.min_purchase) {
      toast.error(checkoutConfig.toasts.minPurchaseRequired.replace("{amount}", rupiah(voucherDetail.min_purchase)));
      return;
    }

    const category = getVoucherCategory(voucherDetail);
    const alreadyHasSameCategory = appliedVouchers.some(
      (v) => getVoucherCategory(v) === category,
    );

    if (alreadyHasSameCategory) {
      toast.error(
        category === "shipping"
          ? checkoutConfig.toasts.shippingVoucherAlreadyApplied
          : checkoutConfig.toasts.discountVoucherAlreadyApplied,
      );
      return;
    }

    if (appliedVouchers.length >= MAX_APPLIED_VOUCHERS) {
      toast.error(checkoutConfig.toasts.maxVouchersReached.replace("{max}", String(MAX_APPLIED_VOUCHERS)));
      return;
    }

    setAppliedVouchers((prev) => [
      ...prev,
      {
        ...voucherDetail,
        claimId: claimedVoucherEntry.id,
      },
    ]);
    setShowVoucherModal(false);
    toast.success(checkoutConfig.toasts.voucherApplied.replace("{code}", voucherDetail.code));
  };

  const [voucherCodeInput, setVoucherCodeInput] = useState("");

  const handleApplyVoucherCode = (inputCode: any) => {
    const codeToFind = (inputCode || voucherCodeInput).trim().toUpperCase();
    if (!codeToFind) {
      toast.error(checkoutConfig.toasts.voucherCodeRequired);
      return;
    }

    const matched = claimedVouchers.find((cv) => {
      const v = cv.vouchers || cv;
      return (v.code || "").trim().toUpperCase() === codeToFind;
    });

    if (!matched) {
      toast.error(checkoutConfig.toasts.voucherNotFound);
      return;
    }

    handleSelectVoucherFromModal(matched);
    setVoucherCodeInput("");
  };

  const handleRemoveVoucher = (claimId: any) => {
    setAppliedVouchers((prev) => prev.filter((v) => v.claimId !== claimId));
    toast.success(checkoutConfig.toasts.voucherRemoved);
  };

  const shippingVoucherDiscount = useMemo(() => {
    if (!shippingVoucher) return 0;
    return Math.min(shippingCost, Number(shippingVoucher.discount_amount || 0));
  }, [shippingVoucher, shippingCost]);

  const subtotalVoucherDiscount = useMemo(() => {
    if (!discountVoucher) return 0;
    if (discountVoucher.type === "percentage") {
      return (subtotal * Number(discountVoucher.discount_amount || 0)) / 100;
    }
    return Number(discountVoucher.discount_amount || 0);
  }, [discountVoucher, subtotal]);

  const totalVoucherDiscount = shippingVoucherDiscount + subtotalVoucherDiscount;
  const finalShippingCost = Math.max(0, shippingCost - shippingVoucherDiscount);
  const finalSubtotalDiscount = subtotalVoucherDiscount;
  const grandTotal = Math.max(0, subtotal - finalSubtotalDiscount) + finalShippingCost;

  // ── Handle payment ──
  const handlePay = async () => {
    if (stockValidation.hasInsufficient) {
      toast.error(checkoutConfig.stockValidation?.insufficientDesc || "Stok produk tidak mencukupi");
      return;
    }
    if (!selectedAddress) {
      toast.error(checkoutConfig.toasts.selectAddressPrompt);
      return;
    }
    if (!selectedCourierKey) {
      toast.error(checkoutConfig.toasts.selectCourierPrompt);
      return;
    }

    const selectedCourierInfo = courierOptions.find((c) => c.key === selectedCourierKey);

    localStorage.setItem(
      "checkout_shipping",
      JSON.stringify({
        addressId: selectedAddress.id,
        address: selectedAddress,
        courierKey: selectedCourierKey,
        courierName: selectedCourierInfo?.courierName || "",
        courierService: selectedCourierInfo?.service || "",
        courierEtd: selectedCourierInfo?.etd || "",
        shippingCost: finalShippingCost,
        appliedVoucherId: discountVoucher?.id || shippingVoucher?.id || null,
        voucherClaimId: discountVoucher?.claimId || shippingVoucher?.claimId || null,
        appliedVouchers: appliedVouchers.map((v) => ({
          voucherId: v.id,
          claimId: v.claimId,
          type: v.type,
          code: v.code,
        })),
        voucherDiscount: totalVoucherDiscount,
        shippingVoucherDiscount,
        subtotalVoucherDiscount,
      }),
    );

    await processPayment({
      amount: subtotal,
      discountAmount: finalSubtotalDiscount,
      shippingCost: finalShippingCost,
      shippingAddress: selectedAddress,
      shippingDetail: {
        courierName: selectedCourierInfo?.courierName || "",
        courierService: selectedCourierInfo?.service || "",
        courierEtd: selectedCourierInfo?.etd || "",
      },
      shippingVoucherId: shippingVoucher?.id || null,
      shippingVoucherClaimId: shippingVoucher?.claimId || null,
      discountVoucherId: discountVoucher?.id || null,
      discountVoucherClaimId: discountVoucher?.claimId || null,
      paymentMethod,
    });
  };

  const selectedCourierInfo = useMemo(
    () => courierOptions.find((c) => c.key === selectedCourierKey),
    [courierOptions, selectedCourierKey],
  );

  if (!pageLoading && (!cart.items || cart.items.length === 0)) {
    return (
      <div className={styles.checkoutPage}>
        <div className={styles.emptyCart}>
          <div className={styles.emptyCartIcon}>🛒</div>
          <h2 className={styles.emptyCartTitle}>{checkoutConfig.emptyCart.title}</h2>
          <p className={styles.emptyCartDesc}>
            {checkoutConfig.emptyCart.desc}
          </p>
          <Link href="/dashboard?tab=shop" className={styles.emptyCartBtn}>
            {checkoutConfig.emptyCart.shopNowBtn}
          </Link>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>{checkoutConfig.loading.text}</p>
      </div>
    );
  }

  return (
    <div className={styles.checkoutPage}>
      {/* ─── HEADER ─── */}
      <header className={styles.checkoutHeader}>
        <Link href="/dashboard?tab=shop" className={styles.checkoutBackLink}>
          {checkoutConfig.header.backToShop}
        </Link>
        <h1 className={styles.checkoutTitle}>{checkoutConfig.header.title}</h1>
        <div className={styles.checkoutSteps}>
          <div className={styles.stepItemActive}>
            <span className={styles.stepDotActive}></span>
            <span>{checkoutConfig.steps.address}</span>
          </div>
          <div className={styles.stepDivider}></div>
          <div className={styles.stepItem}>
            <span className={styles.stepDot}></span>
            <span>{checkoutConfig.steps.payment}</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN LAYOUT ─── */}
      <div className={styles.checkoutLayout}>
        {/* ─── LEFT COLUMN ─── */}
        <div className={styles.leftColumn}>

          {/* ====== 1. ALAMAT PENGIRIMAN ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>1</span>
                {checkoutConfig.address.title}
              </h2>
              <button
                className={styles.sectionAction}
                onClick={() => {
                  setAddressForm(emptyAddressForm(currentUser?.user_metadata?.name || currentUser?.displayName, userProfilePhone));
                  setShowAddressModal(true);
                }}
              >
                {checkoutConfig.address.addNew}
              </button>
            </div>

            {addressLoading ? (
              <p className={styles.addressLoadingText}>{checkoutConfig.address.loading}</p>
            ) : addresses.length === 0 ? (
              <div className={styles.addressEmptyWrapper}>
                <p className={styles.addressEmptyDesc}>
                  {checkoutConfig.address.empty}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAddressForm(emptyAddressForm(currentUser?.user_metadata?.name || currentUser?.displayName, userProfilePhone));
                    setShowAddressModal(true);
                  }}
                  className={styles.sectionAction}
                  style={{ display: "inline-block" }}
                >
                  {checkoutConfig.address.addNow}
                </button>
              </div>
            ) : (
              <div>
                <div className={styles.addressList}>
                  {addresses.map((addr) => {
                    const hasFullArea = Boolean(addr.city && (addr.district || addr.postalCode));

                    return (
                      <div
                        key={addr.id}
                        className={`${styles.addressCard} ${selectedAddressId === addr.id ? styles.addressCardSelected : ""
                          }`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div className={styles.addressContent}>
                          <span className={`${styles.addressLabel} ${styles.addressLabelHeader}`}>
                            <span>
                              {addr.label || checkoutConfig.address.defaultLabel}
                              {addr.isPrimary && <span className={styles.primaryBadge}>{checkoutConfig.address.primaryBadge}</span>}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddressForm(addr);
                                setShowAddressModal(true);
                              }}
                              className={styles.addressEditBtn}
                            >
                              {checkoutConfig.address.editBtn}
                            </button>
                          </span>
                          <p className={styles.addressName}>{addr.recipientName}</p>
                          <p className={styles.addressPhone}>{addr.recipientPhone}</p>
                          <p className={styles.addressFull}>
                            {addr.street}, {addr.district ? `${checkoutConfig.address.districtPrefix || "Kec. "}${addr.district}, ` : ""}{addr.city}, {addr.province} {addr.postalCode ? ` - ${addr.postalCode}` : ""}
                          </p>
                          {addr.notes && (
                            <p className={styles.addressNotesText}>
                              {checkoutConfig.address.notesPrefix}{addr.notes}
                            </p>
                          )}
                          {!hasFullArea && (
                            <span className={`${styles.addressPill} ${styles.addressPillNeutral}`}>
                              {checkoutConfig.address.incompleteWarning}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ====== 2. KURIR PENGIRIMAN ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>2</span>
                {checkoutConfig.courier.title}
              </h2>
            </div>

            {!selectedAddress ? (
              <p className={styles.addressLoadingText}>
                {checkoutConfig.courier.selectAddressFirst}
              </p>
            ) : (
              <>
                {(shippingReadiness.tone !== "success" || shippingMeta.kind === "estimated") && (
                  <div className={`${styles.shippingStatus} ${styles[`shippingStatus${shippingMeta.kind === "estimated" ? "Warning" : shippingReadiness.tone === "info" ? "Info" : "Warning"}`]}`}>
                    <div>
                      <p className={styles.shippingStatusTitle}>
                        {shippingMeta.kind === "estimated" ? checkoutConfig.courier.warningTitle : shippingReadiness.title}
                      </p>
                      <p className={styles.shippingStatusDetail}>
                        {shippingMeta.message || shippingReadiness.detail}
                      </p>
                    </div>
                    <div className={styles.shippingStatusActions}>
                      {shippingMeta.kind === "estimated" && (
                        <span className={styles.shippingStatusBadge}>{checkoutConfig.courier.estimatedBadge}</span>
                      )}
                    </div>
                  </div>
                )}

                {courierLoading ? (
                  <div className={styles.courierLoading}>
                    <div className={styles.loadingSpinner} style={{ width: 24, height: 24, margin: "0 auto 0.5rem" }}></div>
                    {checkoutConfig.courier.calculating}
                  </div>
                ) : courierOptions.length === 0 ? (
                  <div className={styles.courierEmpty}>
                    <p>{checkoutConfig.courier.empty}</p>
                  </div>
                ) : (
                  <div className={styles.courierGrid}>
                    {courierOptions.map((option) => (
                      <div
                        key={option.key}
                        className={`${styles.courierCard} ${selectedCourierKey === option.key ? styles.courierCardSelected : ""
                          }`}
                        onClick={() => handleSelectCourier(option.key, option.cost)}
                      >
                        <input
                          type="radio"
                          className={styles.courierRadio}
                          checked={selectedCourierKey === option.key}
                          onChange={() => handleSelectCourier(option.key, option.cost)}
                        />
                        <div className={styles.courierInfo}>
                          <div className={styles.courierHeaderRow}>
                            <p className={styles.courierName}>
                              {option.courierName.toUpperCase()} — {option.service}
                            </p>
                          </div>
                          <p className={styles.courierService}>{option.description}</p>
                          {option.etd && option.etd !== "-" && (
                            <p className={styles.courierEtd}>
                              {checkoutConfig.courier.etdTemplate.replace("{etd}", option.etd)}
                            </p>
                          )}
                        </div>
                        <div className={styles.courierPriceBox}>
                          <span className={styles.courierCost}>{rupiah(option.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ====== 3. VOUCHER & PROMO ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>3</span>
                {checkoutConfig.voucher.title}
              </h2>
              <span className={styles.voucherSlotCounter}>
                {checkoutConfig.voucher.counterTemplate
                  .replace("{used}", String(appliedVouchers.length))
                  .replace("{max}", String(MAX_APPLIED_VOUCHERS))}
              </span>
            </div>

            {/* Input Kode Promo Manual */}
            <div className={styles.voucherInputGroup}>
              <input
                type="text"
                placeholder={checkoutConfig.voucher.inputPlaceholder}
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyVoucherCode();
                  }
                }}
                className={styles.voucherInput}
              />
              <button
                type="button"
                onClick={() => handleApplyVoucherCode()}
                className={styles.promoApplyBtn}
                aria-label={checkoutConfig.voucher.applyAria}
              >
                {checkoutConfig.voucher.applyBtn}
              </button>
            </div>

            {/* List Voucher yang sedang diterapkan */}
            {appliedVouchers.length > 0 && (
              <div className={styles.appliedVouchersList}>
                {discountVoucher && (
                  <div className={styles.promoApplied}>
                    <div className={styles.promoAppliedItem}>
                      <span className={styles.promoBadgeText}>
                        {checkoutConfig.voucher.discountBadge}
                      </span>
                      <span className={styles.promoCodeText}>
                        <strong>{discountVoucher.code}</strong> ({discountVoucher.title})
                        {subtotalVoucherDiscount > 0 && ` • ${checkoutConfig.voucher.savingsPrefix}${rupiah(subtotalVoucherDiscount)}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.promoRemoveBtn}
                      onClick={() => handleRemoveVoucher(discountVoucher.claimId)}
                    >
                      {checkoutConfig.voucher.removeBtn}
                    </button>
                  </div>
                )}

                {shippingVoucher && (
                  <div className={styles.promoApplied}>
                    <div className={styles.promoAppliedItem}>
                      <span className={styles.promoBadgeText}>
                        {checkoutConfig.voucher.shippingBadge}
                      </span>
                      <span className={styles.promoCodeText}>
                        <strong>{shippingVoucher.code}</strong> ({shippingVoucher.title})
                        {shippingVoucherDiscount > 0 && ` • ${checkoutConfig.voucher.savingsPrefix}${rupiah(shippingVoucherDiscount)}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.promoRemoveBtn}
                      onClick={() => handleRemoveVoucher(shippingVoucher.claimId)}
                    >
                      {checkoutConfig.voucher.removeBtn}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tombol Pemilih Voucher Terpadu */}
            {appliedVouchers.length < MAX_APPLIED_VOUCHERS ? (
              <button
                type="button"
                onClick={() => setShowVoucherModal(true)}
                className={styles.voucherPickerBtn}
                aria-label={checkoutConfig.voucher.pickerAria}
              >
                <div className={styles.voucherPickerLabel}>
                  <span className={styles.voucherPickerIcon}>🎟️</span>
                  <span>
                    {appliedVouchers.length === 0
                      ? checkoutConfig.voucher.selectBtn
                      : checkoutConfig.voucher.addAnotherBtn}
                  </span>
                </div>
                <span className={styles.voucherPickerBadge}>
                  {checkoutConfig.voucher.availableBadgeTemplate.replace(
                    "{count}",
                    String(claimedVouchers.filter(v => v.status === "active").length)
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowVoucherModal(true)}
                className={styles.sectionAction}
                style={{ marginTop: "4px", fontSize: "0.8rem" }}
              >
                {checkoutConfig.voucher.changeBtn}
              </button>
            )}
          </section>

          {/* ─── PAYMENT METHOD SECTION ─── */}
          {(!storeSettings || storeSettings.enableMidtrans !== false || storeSettings.enableManualTransfer !== false) && (
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionStep}>4</span>
                  {checkoutConfig.payment.title}
                </h2>
              </div>
              <div className={styles.paymentMethodList}>
                {(!storeSettings || storeSettings.enableMidtrans !== false) && (
                  <label className={`${styles.paymentMethodCard} ${paymentMethod === "midtrans" ? styles.paymentMethodCardSelected : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="midtrans"
                      checked={paymentMethod === "midtrans"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className={styles.paymentMethodRadio}
                    />
                    <div className={styles.paymentMethodInfo}>
                      <div className={styles.paymentMethodTitle}>{checkoutConfig.payment.midtransTitle}</div>
                      <div className={styles.paymentMethodDesc}>{checkoutConfig.payment.midtransDesc}</div>
                    </div>
                  </label>
                )}

                {(!storeSettings || storeSettings.enableManualTransfer !== false) && (
                  <label className={`${styles.paymentMethodCard} ${paymentMethod === "manual" ? styles.paymentMethodCardSelected : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="manual"
                      checked={paymentMethod === "manual"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className={styles.paymentMethodRadio}
                    />
                    <div className={styles.paymentMethodInfo}>
                      <div className={styles.paymentMethodTitle}>{checkoutConfig.payment.manualTitle}</div>
                      <div className={styles.paymentMethodDesc}>{checkoutConfig.payment.manualDesc}</div>
                    </div>
                  </label>
                )}
              </div>
            </section>
          )}

        </div>

        {/* ─── RIGHT COLUMN — RINGKASAN ─── */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <h3 className={styles.summaryTitle}>{checkoutConfig.summary.title}</h3>
          </div>

          <div className={styles.summaryItems}>
            {(cart.items || []).map((item: any) => {
              const prod = (products || []).find((p: any) => String(p.id) === String(item.id));
              const imgSrc = item.image || prod?.image_url || prod?.imageUrl || "/placeholder.jpg";
              const disc = activePromo
                ? getDiscountedPrice(item.price, activePromo, {
                    productId: item.productId || item.id,
                    size: item.size,
                  })
                : null;
              const hasDiscount = Boolean(disc && disc.hasDiscount);
              const originalItemTotal = Number(item.price) * Number(item.quantity);
              const finalItemTotal = (hasDiscount ? disc.price : Number(item.price)) * Number(item.quantity);

              return (
                <div key={item.cartId} className={styles.summaryItem}>
                  <div className={styles.summaryItemImg}>
                    <img src={optimizeCloudinaryUrl(imgSrc, IMAGE_PRESETS.THUMBNAIL)} alt={item.name} />
                  </div>
                  <div className={styles.summaryItemInfo}>
                    <p className={styles.summaryItemName}>{item.name}</p>
                    <p className={styles.summaryItemVariant}>{item.size}</p>
                    <p className={styles.summaryItemQty}>x{item.quantity}</p>
                    {(() => {
                      const itemStock = stockValidation.itemsMap[item.cartId || `${item.id}-${item.size}`];
                      if (!itemStock?.isExceeded) return null;
                      return (
                        <span className={styles.stockExceededBadge}>
                          ⚠️ {itemStock.available <= 0
                            ? checkoutConfig.stockValidation?.outOfStockBadge || "Stok Habis"
                            : (checkoutConfig.stockValidation?.remainingStockTemplate || "Sisa stok: {count}").replace("{count}", String(itemStock.available))}
                        </span>
                      );
                    })()}
                  </div>
                  <div className={styles.summaryItemPriceBox}>
                    {hasDiscount && (
                      <span className={styles.summaryItemOriginalPrice}>
                        {rupiah(originalItemTotal)}
                      </span>
                    )}
                    <span className={styles.summaryItemPrice}>
                      {rupiah(finalItemTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.summaryLine}>
            <span>{checkoutConfig.summary.subtotalLabel}</span>
            <span>{rupiah(activePromo && promoSavings > 0 ? cartTotal : subtotal)}</span>
          </div>

          {activePromo && promoSavings > 0 && (
            <div className={`${styles.summaryLine} ${styles.summaryLineDiscount}`}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                🏷️ {checkoutConfig.summary.storeDiscountLabel}
                {activePromo.promoName && (
                  <span className={styles.summaryPromoBadge}>
                    {activePromo.promoName}
                  </span>
                )}
              </span>
              <span>-{rupiah(promoSavings)}</span>
            </div>
          )}

          {discountVoucher && subtotalVoucherDiscount > 0 && (
            <div className={`${styles.summaryLine} ${styles.summaryLineDiscount}`}>
              <span>🎟️ {checkoutConfig.summary.discountLabel}</span>
              <span>-{rupiah(subtotalVoucherDiscount)}</span>
            </div>
          )}

          <div className={styles.summaryLine}>
            <span>{checkoutConfig.summary.shippingLabel}</span>
            <span className={styles.summaryLineShipping}>
              {selectedCourierInfo ? (
                shippingVoucher && shippingVoucherDiscount > 0 ? (
                  <span>
                    <span className={styles.strikethroughText}>
                      {rupiah(shippingCost)}
                    </span>
                    {rupiah(finalShippingCost)}
                  </span>
                ) : (
                  rupiah(shippingCost)
                )
              ) : "—"}
            </span>
          </div>

          <div className={`${styles.summaryLine} ${styles.summaryLineTotal}`}>
            <span>{checkoutConfig.summary.totalLabel}</span>
            <span>{rupiah(grandTotal)}</span>
          </div>

          {stockValidation.hasInsufficient && (
            <div className={styles.stockAlertBanner}>
              <div className={styles.stockAlertHeader}>
                <span className={styles.stockAlertIcon}>⚠️</span>
                <strong>{checkoutConfig.stockValidation?.insufficientTitle || "Stok Tidak Mencukupi"}</strong>
              </div>
              <p className={styles.stockAlertDesc}>
                {checkoutConfig.stockValidation?.insufficientDesc}
              </p>
              <Link href="/dashboard?tab=shop" className={styles.adjustCartLink}>
                {checkoutConfig.stockValidation?.adjustCartBtn || "Sesuaikan Keranjang"}
              </Link>
            </div>
          )}

          {checkoutConfig.summary.nonRefundableNotice && (
            <div className={styles.nonRefundableNotice}>
              <AppIcon name="alert-triangle" size={15} />
              <span>{checkoutConfig.summary.nonRefundableNotice}</span>
            </div>
          )}

          <button
            className={styles.payButton}
            onClick={handlePay}
            disabled={isStoreProcessing || !selectedAddress || !selectedCourierKey || stockValidation.hasInsufficient}
          >
            <span className={styles.payButtonMain}>
              {isStoreProcessing ? checkoutConfig.summary.processingBtn : `${checkoutConfig.summary.payNowPrefix}${rupiah(grandTotal)}`}
            </span>
            {(!selectedAddress || !selectedCourierKey || stockValidation.hasInsufficient) && (
              <span className={styles.payButtonSub}>
                {stockValidation.hasInsufficient
                  ? checkoutConfig.stockValidation?.insufficientTitle
                  : !selectedAddress
                  ? checkoutConfig.summary.selectAddressSub
                  : checkoutConfig.summary.selectCourierSub}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── MODAL PILIH VOUCHER SAYA ─── */}
      {showVoucherModal && (
        <div className={styles.modalOverlay} onClick={() => setShowVoucherModal(false)}>
          <div className={`${styles.modalContent} ${styles.voucherModalContent}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{checkoutConfig.voucher.modalTitle}</h2>
                <p className={styles.voucherModalSub}>
                  {checkoutConfig.voucher.modalHint}
                </p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowVoucherModal(false)}>&times;</button>
            </div>

            <div className={styles.voucherModalList}>
              <MyVouchers
                claimedVouchers={claimedVouchers}
                isCheckoutMode={true}
                onSelectVoucher={handleSelectVoucherFromModal}
                appliedClaimIds={appliedVouchers.map((v) => v.claimId)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL TAMBAH / EDIT ALAMAT ─── */}
      <AddressFormModal
        isOpen={showAddressModal}
        onClose={() => {
          setShowAddressModal(false);
          setAddressForm(emptyAddressForm(currentUser?.user_metadata?.name || currentUser?.displayName, userProfilePhone));
        }}
        currentAddress={addressForm}
        setCurrentAddress={setAddressForm}
        handleSaveAddress={handleSaveAddress}
        profileConfig={profileConfig}
        loading={savingAddress}
      />
    </div>
  );
}