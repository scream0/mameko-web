// @ts-nocheck
"use client";
import { useEffect } from "react";

let lockCount = 0;
let originalHtmlOverflow = "";
let originalBodyOverflow = "";
let originalPaddingRight = "";

/**
 * Universal hook to lock document.body and document.documentElement scroll when a modal/drawer is open.
 * Supports reference counting for nested modals and scrollbar compensation to prevent layout shift.
 */
export function useScrollLock(lock: boolean = true) {
  useEffect(() => {
    if (!lock || typeof document === "undefined") return;

    if (lockCount === 0) {
      originalHtmlOverflow = document.documentElement.style.overflow;
      originalBodyOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;

      // Compensate for scrollbar width to prevent layout shift on desktop
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      // Lock both HTML and BODY to prevent scroll leak
      // (globals.css sets overflow-y: auto on both html and body)
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.documentElement.style.overflow = originalHtmlOverflow || "";
        document.body.style.overflow = originalBodyOverflow || "";
        document.body.style.paddingRight = originalPaddingRight || "";
      }
    };
  }, [lock]);
}
