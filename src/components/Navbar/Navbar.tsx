"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { SearchForm } from "./SearchForm";
import styles from "./Navbar.module.css";
import config from "@/data/ui/navbarConfig.json";
import { Logo } from "@/components/UI/Logo/logo";
import { PromoBannerBar } from "@/components/UI/PromoBannerBar/PromoBannerBar";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { useScrollLock } from "@/hooks/useScrollLock";
import { optimizeCloudinaryUrl, IMAGE_PRESETS } from "@/utils/imageOptimizer";

const CartSidebar = dynamic(
  () => import("../UI/Sidebar/CartSidebar").then((mod) => mod.CartSidebar),
  { ssr: false }
);

const Modal = dynamic(
  () => import("../UI/Modal/ProductModal").then((mod) => mod.Modal),
  { ssr: false }
);

export function Navbar() {
  const [activePanel, setActivePanel] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [animate, setAnimate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeHash, setActiveHash] = useState("");

  const {
    products,
    addToCart,
    rupiah,
    cartQuantity,
    user,
    logout,
    isCartOpen,
    setIsCartOpen,
  } = useStore();

  const pathname = usePathname();

  const authItems = config?.authSection?.auth?.authenticated || [];
  const unauthItem = config?.authSection?.auth?.unauthenticated?.[0];

  const userMenuRef = useRef<any>(null);
  const lastScrollY = useRef<number>(0);

  useScrollLock(
    activePanel === "navbar" || activePanel === "search" || isCartOpen
  );

  // Pastikan navbar selalu terlihat saat ada panel/menu yang sedang terbuka
  useEffect(() => {
    if (activePanel || isUserMenuOpen || isCartOpen) {
      setIsHidden(false);
    }
  }, [activePanel, isUserMenuOpen, isCartOpen]);

  // Smart Scroll Listener: Sembunyikan saat scroll ke bawah, tampilkan saat scroll ke atas
  useEffect(() => {
    let rafId: number | null = null;
    lastScrollY.current = Math.max(0, window.scrollY);

    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const currentScrollY = Math.max(0, window.scrollY);
        const delta = currentScrollY - lastScrollY.current;

        setIsScrolled(currentScrollY > 24);

        if (currentScrollY <= 64) {
          setIsHidden(false);
          lastScrollY.current = currentScrollY;
        } else if (Math.abs(delta) >= 6) {
          if (delta > 0 && currentScrollY > 80) {
            if (!activePanel && !isUserMenuOpen && !isCartOpen) {
              setIsHidden(true);
            }
          } else if (delta < 0) {
            setIsHidden(false);
          }
          lastScrollY.current = currentScrollY;
        }

        rafId = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [activePanel, isUserMenuOpen, isCartOpen]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (cartQuantity > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
  }, [cartQuantity]);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.key !== "Escape") return;
      if (isUserMenuOpen) setIsUserMenuOpen(false);
      if (activePanel) setActivePanel(null);
      if (isCartOpen) setIsCartOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isUserMenuOpen, activePanel, isCartOpen, setIsCartOpen]);

  useEffect(() => {
    const updateHash = () => setActiveHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  const handleNavClick = (e: any, href: any) => {
    setActivePanel(null);

    if (href && href.includes("#")) {
      e.preventDefault();

      const hashPart = href.split("#")[1];
      const isHome = window.location.pathname === "/";

      if (isHome) {
        const targetElement =
          document.getElementById(hashPart) ||
          document.querySelector(`#${hashPart}`);

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
          window.history.pushState(null, "", `#${hashPart}`);
          setActiveHash(`#${hashPart}`);
        } else {
          window.location.hash = hashPart;
        }
      } else {
        window.location.href = `/#${hashPart}`;
      }
    }
  };

  const isLinkActive = (href: any) => {
    if (!href) return false;
    if (href.includes("#")) {
      const hashPart = href.split("#")[1];
      return activeHash === `#${hashPart}`;
    }
    return pathname === href;
  };

  const productList = Array.isArray(products) ? products : products?.data || [];

  const filtered = useMemo(() => {
    if (activePanel !== "search") return [];
    return productList.filter((p: any) =>
      p?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [productList, searchQuery, activePanel]);

  const togglePanel = (panelName: any) => {
    setActivePanel((prev: any) => (prev === panelName ? null : panelName));
    setIsCartOpen(false);
  };

  const handleToggleCart = () => {
    setIsCartOpen((prev: any) => !prev);
    setActivePanel(null);
  };

  const userAvatar = user?.photoURL || user?.photo_url;
  const userName =
    user?.full_name ||
    user?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    config.authSection.defaultUserName;

  const isDrawerOpen = activePanel === "navbar";
  const isSearchOpen = activePanel === "search";

  return (
    <>
      <PromoBannerBar />
      <nav
        className={`${styles.navbar} ${isScrolled ? styles.scrolled : ""} ${
          isHidden && !isDrawerOpen && !isSearchOpen ? styles.navbarHidden : ""
        }`}
      >
        <Link href={config.logo.href} className={styles.logo}>
          <Logo className={styles.logoSvg} width={30} height={21} />
          {config.logo.text}
          <span>{config.logo.subtext}</span>.
        </Link>

        <div
          className={`${styles.navbarNav} ${isDrawerOpen ? styles.active : ""}`}
        >
          <div className={styles.mobileDrawerHeader}>
            <Link
              href={config.logo.href}
              className={styles.mobileDrawerLogo}
              onClick={() => setActivePanel(null)}
            >
              <Logo className={styles.mobileLogoSvg} width={28} height={20} />
              {config.logo.text}
              <span>{config.logo.subtext}</span>.
            </Link>
            <button
              type="button"
              className={styles.mobileCloseBtn}
              onClick={() => setActivePanel(null)}
              aria-label={config.features.mobileDrawer.closeAriaLabel}
            >
              <AppIcon
                name={config.features.mobileDrawer.iconClose}
                className={styles.closeIconSvg}
              />
            </button>
          </div>

          {config.menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className={`${styles.navLink} ${
                isLinkActive(item.href) ? styles.navLinkActive : ""
              }`}
              aria-current={isLinkActive(item.href) ? "page" : undefined}
            >
              <span>{item.label}</span>
              <AppIcon
                name={config.features.mobileDrawer.navLinkIcon}
                className={styles.arrowIconSvg}
              />
            </Link>
          ))}

          <div className={styles.mobileAuthSection}>
            {user ? (
              <>
                <div className={styles.mobileUserInfo}>
                  {userAvatar && !imageError ? (
                    <img
                      src={optimizeCloudinaryUrl(
                        userAvatar,
                        IMAGE_PRESETS.THUMBNAIL_SM
                      )}
                      alt={config.authSection.avatarAlt}
                      className={styles.avatarImgMobile}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholderMobile}>
                      <AppIcon name="user" className={styles.svgIcon} />
                    </div>
                  )}
                  <div className={styles.mobileUserDetails}>
                    <span className={styles.mobileUserName}>{userName}</span>
                    {user.email && (
                      <span className={styles.mobileUserEmail}>
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
                {authItems.map((item, index) =>
                  item.type === "link" ? (
                    <Link
                      key={index}
                      href={item.href}
                      className={styles.mobileAuthLink}
                      onClick={() => setActivePanel(null)}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        logout();
                        setActivePanel(null);
                      }}
                      className={`${styles.mobileAuthLink} ${styles.mobileLogoutBtn}`}
                    >
                      {item.label}
                    </button>
                  )
                )}
              </>
            ) : (
              unauthItem && (
                <Link
                  href={unauthItem.href}
                  className={styles.mobileLoginBtn}
                  onClick={() => setActivePanel(null)}
                >
                  {unauthItem.label}
                </Link>
              )
            )}
          </div>
        </div>

        <SearchForm
          isActive={isSearchOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredProdukItems={filtered}
          rupiah={rupiah}
          onResultClick={(item: any) => {
            setSelectedProduct(item);
            setIsModalOpen(true);
            setActivePanel(null);
            setSearchQuery("");
          }}
        />

        <div className={styles.navbarExtra}>
          <button
            type="button"
            className={`${styles.iconActionBtn} ${
              isSearchOpen ? styles.iconActionBtnActive : ""
            }`}
            onClick={() => togglePanel("search")}
            aria-label={config.features.search.ariaLabel}
            aria-expanded={isSearchOpen}
          >
            <AppIcon
              name={config.features.search.icon}
              className={styles.svgIcon}
            />
          </button>

          <button
            type="button"
            className={`${styles.iconActionBtn} ${styles.cartButton}`}
            onClick={handleToggleCart}
            aria-label={config.features.cart.ariaLabel}
          >
            <AppIcon
              name={config.features.cart.icon}
              className={`${styles.svgIcon} ${animate ? styles.cartBounce : ""}`}
            />
            {isClient && cartQuantity > 0 && (
              <span
                className={`${styles.quantityBadge} ${
                  animate ? styles.quantityPulse : ""
                }`}
              >
                {cartQuantity}
                {animate && (
                  <span className={styles.pulseRing} aria-hidden="true" />
                )}
              </span>
            )}
          </button>

          {user ? (
            <div className={styles.userMenu} ref={userMenuRef}>
              <button
                type="button"
                className={styles.userAvatarBtn}
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-label={config.authSection.userMenuAriaLabel}
                aria-expanded={isUserMenuOpen}
              >
                {userAvatar && !imageError ? (
                  <img
                    src={optimizeCloudinaryUrl(
                      userAvatar,
                      IMAGE_PRESETS.THUMBNAIL_SM
                    )}
                    alt={config.authSection.avatarAlt}
                    className={styles.avatarImg}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <AppIcon name="user" className={styles.svgIcon} />
                )}
              </button>
              {isUserMenuOpen && (
                <div className={styles.userDropdown}>
                  <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownUserName}>{userName}</span>
                    <span className={styles.dropdownUserEmail}>
                      {user.email}
                    </span>
                  </div>
                  {authItems.map((item, index) =>
                    item.type === "link" ? (
                      <Link
                        key={index}
                        href={item.href}
                        className={styles.dropdownItem}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className={`${styles.dropdownItem} ${styles.logoutBtn}`}
                      >
                        {item.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            unauthItem && (
              <Link href={unauthItem.href} className={styles.loginBtn}>
                {unauthItem.label}
              </Link>
            )
          )}

          <button
            type="button"
            onClick={() => togglePanel("navbar")}
            className={`${styles.iconActionBtn} ${styles.hamburger}`}
            aria-label={config.features.hamburger.ariaLabel}
            aria-expanded={isDrawerOpen}
          >
            <AppIcon
              name={
                isDrawerOpen
                  ? config.features.hamburger.iconClose
                  : config.features.hamburger.iconOpen
              }
              className={styles.svgIcon}
            />
          </button>
        </div>
      </nav>

      <CartSidebar />

      {isModalOpen && selectedProduct && (
        <Modal
          isOpen={isModalOpen}
          item={selectedProduct}
          rupiah={rupiah}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={(product: any, variant: any, quantity: any) => {
            addToCart(product, variant, quantity);
            setIsModalOpen(false);
          }}
        />
      )}
    </>
  );
}
