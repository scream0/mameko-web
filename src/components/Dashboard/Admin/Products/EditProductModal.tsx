// @ts-nocheck
"use client";
import ProductForm from "./ProductForm";
import styles from "./EditProductModal.module.css";
import { useScrollLock } from "@/hooks/useScrollLock";

export default function EditProductModal({ product, onClose, onUpdate }) {
  useScrollLock(true);
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <ProductForm
          product={product}
          onSuccess={onUpdate}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
