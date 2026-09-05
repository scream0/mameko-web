// @ts-nocheck
"use client";

import { useState } from "react";
import styles from "./UserSettings.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { logoutUser } from "@/utils/authHelpers";
import userSettingsConfig from "@/data/ui/userSettingsConfig.json";

interface UserSettingsProps {
  profile?: any;
  addresses?: any[];
  deletingAccount?: boolean;
  onBackToProfile?: () => void;
  onOpenProfileModal?: () => void;
  onOpenManageAddressModal?: () => void;
  onOpenLogoutModal?: () => void;
  onDeleteAccount?: () => void;
}

export default function UserSettings({
  profile,
  addresses,
  deletingAccount,
  onBackToProfile,
  onOpenProfileModal,
  onOpenManageAddressModal,
  onOpenLogoutModal,
  onDeleteAccount,
}: UserSettingsProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const primaryAddress =
    addresses?.find((addr: any) => addr.isPrimary) ||
    (addresses && addresses.length > 0 ? addresses[0] : null);

  const fallbackInitial = (
    profile?.fullName ||
    profile?.username ||
    "U"
  )
    .charAt(0)
    .toUpperCase();

  return (
    <div className={styles.settingsContainer}>
      {/* 1. Header Pengaturan dengan Tombol Kembali */}
      <div className={styles.settingsHeader}>
        <button
          onClick={onBackToProfile}
          className={styles.backBtn}
          type="button"
        >
          <AppIcon name="arrow-left" size={16} />
          <span>{userSettingsConfig.header.backBtn}</span>
        </button>
        <div className={styles.headerTitleWrapper}>
          <h3 className={styles.settingsTitle}>{userSettingsConfig.header.title}</h3>
          <p className={styles.settingsSubtitle}>
            {userSettingsConfig.header.subtitle}
          </p>
        </div>
      </div>

      {/* 2. Profil Singkat Pengguna */}
      <div className={styles.profileSummaryBox}>
        <div className={styles.profileAvatar}>
          {profile?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.photoURL}
              alt={userSettingsConfig.summary.avatarAlt}
              className={styles.avatarImg}
            />
          ) : (
            <span className={styles.avatarInitials}>{fallbackInitial}</span>
          )}
        </div>
        <div className={styles.profileSummaryInfo}>
          <h4 className={styles.profileName}>
            {profile?.fullName ||
              profile?.username ||
              userSettingsConfig.summary.defaultName}
          </h4>
          <p className={styles.profileEmail}>
            {profile?.email || userSettingsConfig.summary.defaultEmail}
          </p>
          {profile?.phone && (
            <p className={styles.profilePhone}>{profile.phone}</p>
          )}
        </div>
      </div>

      {/* 3. Kelompok Pengaturan */}
      <div className={styles.settingsSectionsWrapper}>
        {/* GRUP 1: INFORMASI AKUN & PENGIRIMAN */}
        <div className={styles.sectionGroup}>
          <h4 className={styles.groupLabel}>
            {userSettingsConfig.groups.account}
          </h4>
          <div className={styles.settingsGrid}>
            {/* Menu 1: Edit Informasi Profil */}
            <div
              className={styles.settingItem}
              onClick={onOpenProfileModal}
              role="button"
              tabIndex={0}
            >
              <div className={styles.settingLeft}>
                <div className={styles.iconBox}>
                  <AppIcon name="user" size={20} />
                </div>
                <div className={styles.settingInfo}>
                  <h4>{userSettingsConfig.items.profile.title}</h4>
                  <p>{userSettingsConfig.items.profile.desc}</p>
                </div>
              </div>
              <div className={styles.settingRight}>
                <span className={styles.actionText}>
                  {userSettingsConfig.items.profile.action}
                </span>
                <span className={styles.chevronIcon}>›</span>
              </div>
            </div>

            {/* Menu 2: Buku Alamat Pengiriman */}
            <div
              className={styles.settingItem}
              onClick={onOpenManageAddressModal}
              role="button"
              tabIndex={0}
            >
              <div className={styles.settingLeft}>
                <div className={styles.iconBox}>
                  <AppIcon name="map-pin" size={20} />
                </div>
                <div className={styles.settingInfo}>
                  <h4>
                    {userSettingsConfig.items.address.title}{" "}
                    <span className={styles.addressCountBadge}>
                      ({addresses?.length || 0}
                      {userSettingsConfig.items.address.limitSuffix})
                    </span>
                  </h4>
                  {primaryAddress ? (
                    <div className={styles.addressSummary}>
                      <span className={styles.addressSummaryLabel}>
                        {userSettingsConfig.items.address.primaryLabel}
                      </span>
                      <span className={styles.addressSummaryText}>
                        {primaryAddress.recipientName} - {primaryAddress.street}
                      </span>
                    </div>
                  ) : (
                    <p>{userSettingsConfig.items.address.emptyDesc}</p>
                  )}
                </div>
              </div>
              <div className={styles.settingRight}>
                <span className={styles.actionText}>
                  {userSettingsConfig.items.address.action}
                </span>
                <span className={styles.chevronIcon}>›</span>
              </div>
            </div>
          </div>
        </div>

        {/* GRUP 2: ZONA BAHAYA / SESI */}
        <div className={styles.sectionGroup}>
          <h4 className={styles.dangerGroupLabel}>
            {userSettingsConfig.groups.danger}
          </h4>
          <div className={styles.dangerActionsGrid}>
            <button
              type="button"
              onClick={async () => {
                if (onOpenLogoutModal) {
                  onOpenLogoutModal();
                } else {
                  await logoutUser();
                }
              }}
              className={styles.dangerCardBtn}
              aria-label={userSettingsConfig.items.logout.ariaLabel}
            >
              <div className={styles.dangerCardLeft}>
                <AppIcon name="log-out" size={18} />
                <span>{userSettingsConfig.items.logout.label}</span>
              </div>
              <span className={styles.chevronIcon}>›</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={deletingAccount}
              className={`${styles.dangerCardBtn} ${styles.deleteCardBtn}`}
            >
              <div className={styles.dangerCardLeft}>
                <AppIcon name="trash-2" size={18} />
                <span>
                  {deletingAccount
                    ? userSettingsConfig.items.deleteAccount.deleting
                    : userSettingsConfig.items.deleteAccount.label}
                </span>
              </div>
              <span className={styles.chevronIcon}>›</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. MODAL KONFIRMASI HAPUS AKUN */}
      {isDeleteModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => !deletingAccount && setIsDeleteModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteIconWrapper}>
              <AppIcon name="alert-triangle" size={26} strokeWidth={2} />
            </div>

            <div className={styles.deleteContentText}>
              <h3>{userSettingsConfig.modals.deleteAccount.title}</h3>
              <p>{userSettingsConfig.modals.deleteAccount.message}</p>
            </div>

            <div className={styles.deleteActions}>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingAccount}
                className={styles.modalCancelBtn}
              >
                {userSettingsConfig.modals.deleteAccount.cancelBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteAccount) {
                    onDeleteAccount();
                  }
                }}
                disabled={deletingAccount}
                className={styles.modalConfirmDeleteBtn}
              >
                {deletingAccount
                  ? userSettingsConfig.modals.deleteAccount.deleting
                  : userSettingsConfig.modals.deleteAccount.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}