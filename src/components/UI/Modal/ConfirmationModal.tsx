"use client";
import styles from "./ConfirmationModal.module.css";
import { useScrollLock } from "@/hooks/useScrollLock";

export default function ConfirmationModal({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmButtonText,
  cancelButtonText,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  title?: string;
  message?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}) {
  useScrollLock(Boolean(isOpen));
  const handleClose = onClose || onCancel;

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title || "Konfirmasi"}</h3>
        <p className={styles.message}>
          {message || "Apakah Anda yakin ingin melanjutkan tindakan ini?"}
        </p>
        <div className={styles.buttonGroup}>
          <button onClick={handleClose} className={styles.cancelBtn}>
            {cancelButtonText || "Batal"}
          </button>
          <button onClick={onConfirm} className={styles.confirmBtn}>
            {confirmButtonText || "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
