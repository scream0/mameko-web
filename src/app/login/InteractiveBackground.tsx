// @ts-nocheck
"use client";
import React, { useEffect, useRef } from "react";
import styles from "./InteractiveBackground.module.css";

export default function InteractiveBackground() {
  const glowRef1 = useRef(null);
  const glowRef2 = useRef(null);

  // Track current offset
  const currentOffset = useRef({ x: 0, y: 0 });
  // Track target offset from mouse
  const targetOffset = useRef({ x: 0, y: 0 });

  const requestRef = useRef(null);

  useEffect(() => {
    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      const pullFactor = 0.6;
      const maxOffset = 80;

      let targetX = deltaX * pullFactor;
      let targetY = deltaY * pullFactor;

      const dist = Math.sqrt(targetX * targetX + targetY * targetY);
      if (dist > maxOffset) {
        targetX = (targetX / dist) * maxOffset;
        targetY = (targetY / dist) * maxOffset;
      }

      targetOffset.current = {
        x: targetX,
        y: targetY,
      };
    };

    const animate = () => {
      currentOffset.current.x += (targetOffset.current.x - currentOffset.current.x) * 0.12;
      currentOffset.current.y += (targetOffset.current.y - currentOffset.current.y) * 0.12;

      if (glowRef1.current && glowRef2.current) {
        glowRef1.current.style.transform = `translate3d(${currentOffset.current.x}px, ${currentOffset.current.y}px, 0)`;
        glowRef2.current.style.transform = `translate3d(${currentOffset.current.x * 0.6}px, ${currentOffset.current.y * 0.6}px, 0)`;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div className={styles.container} aria-hidden="true">
      <div ref={glowRef1} className={styles.glowPrimary} />
      <div ref={glowRef2} className={styles.glowSecondary} />
    </div>
  );
}
