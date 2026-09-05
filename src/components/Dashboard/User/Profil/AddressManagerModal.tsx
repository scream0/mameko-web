// @ts-nocheck
import React from "react";
import styles from "./UserProfil.module.css";
import { useScrollLock } from "@/hooks/useScrollLock";
import profileConfig from "@/data/ui/userProfilConfig.json";

export default function AddressManagerModal({
  isOpen,
  onClose,
  addresses = [],
  onSetPrimary,
  onEdit,
  onDelete,
  onOpenAdd,
}) {
  useScrollLock(Boolean(isOpen));

  if (!isOpen) return null;

  const cfg = profileConfig.modals.addressManager;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles.addressManagerContent}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {cfg.title} ({addresses.length}/3)
          </h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>

        <div className={styles.addressList}>
          {addresses.length === 0 ? (
            <p className={styles.emptyAddressText}>
              {cfg.empty}
            </p>
          ) : (
            addresses.map((addr: any) => (
              <div key={addr.id} className={styles.addressCard}>
                <div className={styles.addressCardTop}>
                  <div className={styles.addressLabelGroup}>
                    <span className={styles.addressLabel}>
                      {addr.label || profileConfig.modals.address.defaultLabel}
                    </span>
                    {addr.isPrimary && (
                      <span className={styles.primaryTag}>
                        {cfg.primaryBadge}
                      </span>
                    )}
                  </div>
                  <div className={styles.addressCardActions}>
                    {!addr.isPrimary && (
                      <button
                        type="button"
                        onClick={() => onSetPrimary(addr.id)}
                        className={styles.btnSetPrimary}
                      >
                        {cfg.setPrimary}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(addr)}
                      className={styles.btnEditAddress}
                    >
                      {cfg.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(addr.id)}
                      className={styles.btnDeleteAddress}
                    >
                      {cfg.delete}
                    </button>
                  </div>
                </div>
                <p className={styles.recipientDetails}>
                  {addr.recipientName} ({addr.recipientPhone})
                </p>
                <p className={styles.streetDetails}>
                  {addr.street}, {addr.city}, {addr.province} - {addr.postalCode}
                </p>
              </div>
            ))
          )}

          {addresses.length < 3 ? (
            <button
              type="button"
              onClick={onOpenAdd}
              className={`${styles.actionBtnPrimary} ${styles.fullWidthAddBtn}`}
            >
              {cfg.addBtn} ({addresses.length}/3)
            </button>
          ) : (
            <p className={styles.maxLimitNote}>
              {cfg.maxLimit}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}