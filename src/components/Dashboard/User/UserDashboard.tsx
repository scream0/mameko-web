// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import styles from "./UserDashboard.module.css";
import { useUserDashboardData } from "@/hooks/useUserDashboardData";
import { auth } from "@/lib/supabaseClient";
import { logoutUser } from "@/utils/authHelpers";
import toast from "react-hot-toast";

import userConfig from "@/data/ui/userDashboardConfig.json";

import dynamic from "next/dynamic";

const OverviewSection = dynamic(
  () => import("@/components/Dashboard/User/Overview/OverviewUser"),
  { ssr: false }
);
const ProfileSection = dynamic(
  () => import("@/components/Dashboard/User/Profil/UserProfil"),
  { ssr: false }
);
const ShopPage = dynamic(
  () => import("@/components/Dashboard/User/Shop/Shop"),
  { ssr: false }
);
const NotificationsSection = dynamic(
  () => import("@/components/Dashboard/User/Notifications/NotificationsSection"),
  { ssr: false }
);
const OrdersSection = dynamic(
  () => import("@/components/Dashboard/User/Order/OrdersSection"),
  { ssr: false }
);
const CartSidebar = dynamic(
  () => import("@/components/UI/Sidebar/CartSidebar").then((mod) => mod.CartSidebar),
  { ssr: false }
);
const ProductModal = dynamic(
  () => import("@/components/UI/Modal/ProductModal").then((mod) => mod.Modal),
  { ssr: false }
);
const UserChatModal = dynamic(
  () => import("@/components/Dashboard/User/Chat/UserChatModal"),
  { ssr: false }
);
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { Logo } from "@/components/UI/Logo/logo";
import { UserDashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEFAULT_TAB = "shop";
const ALLOWED_TABS = ["shop", "overview", "orders", "notifications", "profile"];
const filteredNav = userConfig.nav.filter((item) => ALLOWED_TABS.includes(item.id));
const VALID_TABS = filteredNav.map((item) => item.id);

function getGreetingName(userName: any) {
  return userName || userConfig.defaultCustomer;
}

export default function UserDashboard({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userName, loading, error, retry } = useUserDashboardData();
  const [notificationCount, setNotificationCount] = useState(0);
  const { theme, toggleTheme, isThemeReady } = useTheme();

  const { isCartOpen, setIsCartOpen, cartQuantity, addToCart, rupiah } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const currentTabParam = searchParams.get("tab");
  
  // Tentukan active tab secara aman tanpa memicu redirect paksa di awal
  const activeTab = currentTabParam === "wallet"
    ? "profile"
    : currentTabParam === "returns"
    ? "orders"
    : VALID_TABS.includes(currentTabParam)
    ? currentTabParam
    : DEFAULT_TAB;

  useEffect(() => {
    if (currentTabParam === "wallet") {
      router.replace("/dashboard?tab=profile&subtab=wallet");
    } else if (currentTabParam === "returns") {
      router.replace("/dashboard?tab=orders&status=return");
    }
  }, [currentTabParam, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isDisposed = false;

    const loadNotificationCount = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        let result = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await res.text();
          try {
            result = text ? JSON.parse(text) : {};
          } catch (e) {
            console.error("Gagal parse JSON notifikasi:", e);
          }
        }

        if (!res.ok) {
          throw new Error(result.error || "Gagal memuat notifikasi.");
        }

        if (!isDisposed) {
          const unreadCount = (result.notifications || []).filter(
            (notification: any) => !notification.is_read
          ).length;
          setNotificationCount(unreadCount);
        }
      } catch {
        if (!isDisposed) {
          setNotificationCount(0);
        }
      }
    };

    loadNotificationCount();

    return () => {
      isDisposed = true;
    };
  }, [user]);

  const handleTabChange = (tabId: any) => {
    if (!VALID_TABS.includes(tabId)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tabId);
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const handleBukaDetail = (product: any) => {
    if (!product || !product.id) {
      toast.error(userConfig.toasts.invalidProduct || "Produk tidak valid.");
      return;
    }
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleLogout = async () => {
    toast.loading(userConfig.toasts.loggingOut || "Keluar dari sesi...", { id: "user-logout" });
    await logoutUser();
  };

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Desktop Sidebar */}
      <aside
        id="user-dashboard-navigation"
        className={styles.sidebar}
        aria-label={userConfig.aria.menuPanel}
      >
        <div className={styles.brandSection}>
          <div className={`${styles.brandLogo} ${styles.brandLogoWrap}`}>
            <div className={styles.brandLogoIcon}>
              <Logo />
            </div>
            <div className={styles.brandLogoText}>
              {userConfig.brand.name} <span>{userConfig.brand.suffix}</span>
            </div>
          </div>

          {/* User Greeting & Name inside Sidebar Header */}
          <div className={styles.sidebarUserGreeting}>
            <p className={styles.greetingEyebrow}>{userConfig.greeting.eyebrow}</p>
            <h2 className={styles.welcomeTitle}>
              {userConfig.greeting.prefix}, {getGreetingName(userName)} <span className={styles.greetingWave}>👋</span>
            </h2>
          </div>
        </div>

        <nav className={styles.navContainer}>
          <ul className={styles.navigationList}>
            {filteredNav.map((item) => {
              const isActive = activeTab === item.id;
              const badgeCount =
                item.id === "notifications" ? notificationCount : 0;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleTabChange(item.id)}
                    className={`${styles.navItem} ${
                      isActive ? styles.navItemActive : ""
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <AppIcon name={item.icon || "circle"} className={styles.navIcon} />
                    <span className={styles.navLabel}>{item.label}</span>
                    {badgeCount > 0 && (
                      <span className={styles.navBadge}>{badgeCount}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            onClick={handleLogout}
            className={styles.logoutBtn}
            aria-label={userConfig.aria.logout || userConfig.logoutText}
          >
            <AppIcon name="log-out" size={18} />
            <span>{userConfig.logoutText}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Navbar Atas Melayang */}
        <header className={styles.shopNavbar}>
          <div className={styles.navbarSearchWrapper}>
            <AppIcon name="search" className={styles.searchIcon} />
            <input
              type="text"
              placeholder={userConfig.navbar?.searchPlaceholder || "Cari parfum..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== "shop" && e.target.value.trim() !== "") {
                  handleTabChange("shop");
                }
              }}
              className={styles.searchInputNavbar}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery("")}
                aria-label={userConfig.navbar?.clearSearchAria || "Hapus pencarian"}
              >
                <AppIcon name="x" size={14} />
              </button>
            )}
          </div>
          <div className={styles.navbarActions}>
            {/* Theme Switcher Button */}
            <button
              type="button"
              className={styles.themeIconBtnNavbar}
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? userConfig.navbar?.themeToggle?.lightMode || "Ganti ke mode terang"
                  : userConfig.navbar?.themeToggle?.darkMode || "Ganti ke mode gelap"
              }
              title={
                theme === "dark"
                  ? userConfig.navbar?.themeToggle?.lightMode || "Ganti ke mode terang"
                  : userConfig.navbar?.themeToggle?.darkMode || "Ganti ke mode gelap"
              }
            >
              {isThemeReady ? (
                <AppIcon
                  name={theme === "dark" ? "sun" : "moon"}
                  className={styles.svgIcon}
                />
              ) : (
                <AppIcon name="sun" className={styles.svgIcon} />
              )}
            </button>

            {/* Chat Button */}
            <button
              type="button"
              className={styles.chatIconBtnNavbar}
              onClick={() => setIsChatOpen(true)}
              aria-label={userConfig.navbar?.chatAria || "Chat"}
              title={userConfig.navbar?.chatAria || "Chat"}
            >
              <AppIcon name="message-circle" className={styles.svgIcon} />
            </button>

            {/* Cart Button */}
            <button
              type="button"
              className={styles.cartIconBtnNavbar}
              onClick={() => setIsCartOpen(true)}
              aria-label={userConfig.navbar?.cartAria || userConfig.aria?.cart || "Keranjang"}
              title={userConfig.navbar?.cartAria || userConfig.aria?.cart || "Keranjang"}
            >
              <AppIcon name="shopping-cart" className={styles.svgIcon} />
              {cartQuantity > 0 && (
                <span className={styles.cartQuantityBadge}>
                  {cartQuantity}
                </span>
              )}
            </button>
          </div>
        </header>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <div>
              <strong>{userConfig.messages.loadUserError}</strong>
            </div>
            <button className={styles.errorRetryBtn} onClick={retry}>
              {userConfig.messages.retry}
            </button>
          </div>
        )}

        {/* Hapus key={activeTab} agar konten tidak ter-unmount ulang yang menyebabkan kedipan/refresh */}
        <div className={`${styles.viewWrapper} ${styles.viewWrapperAnimated}`}>
          {activeTab === "shop" && <ShopPage searchQuery={searchQuery} onBukaDetail={handleBukaDetail} />}
          {activeTab === "overview" && (
            <OverviewSection setActiveTab={handleTabChange} />
          )}
          {activeTab === "orders" && <OrdersSection />}
          <div className={activeTab === "notifications" ? styles.visibleNotificationView : styles.hiddenNotificationView}>
            <NotificationsSection onUnreadCountChange={setNotificationCount} />
          </div>
          {activeTab === "profile" && <ProfileSection />}
        </div>
      </main>

      {/* Mobile Floating Bottom Navigation (Android Style) */}
      <nav className={styles.mobileBottomNav} aria-label={userConfig.aria?.mobileNav || "Mobile Bottom Navigation"}>
        {filteredNav.map((item) => {
          const isActive = activeTab === item.id;
          const badgeCount =
            item.id === "notifications" ? notificationCount : 0;

          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`${styles.mobileBottomNavItem} ${
                isActive ? styles.mobileBottomNavItemActive : ""
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={styles.mobileNavIconWrapper}>
                <AppIcon name={item.icon || "circle"} className={styles.mobileNavSvg} />
                {badgeCount > 0 && (
                  <span className={styles.mobileNavBadge}>{badgeCount}</span>
                )}
              </div>
              <span className={styles.mobileNavLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Overlays */}
      {isChatOpen && (
        <UserChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          user={user}
        />
      )}
      
      {isCartOpen && <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />}

      {/* Modal Detail Produk */}
      {isProductModalOpen && selectedProduct && (
        <ProductModal
          isOpen={isProductModalOpen}
          item={selectedProduct}
          onClose={() => {
            setIsProductModalOpen(false);
            setSelectedProduct(null);
          }}
          onAddToCart={addToCart}
          rupiah={rupiah}
        />
      )}
    </div>
  );
}