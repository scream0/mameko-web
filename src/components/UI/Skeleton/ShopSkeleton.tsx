"use client";

import React from "react";

/* --- Isolated Shop catalog skeleton using pure utility classes --- */
export function ShopSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="w-full py-4 animate-pulse">
      <div className="flex flex-col gap-2 mb-5">
        <div className="h-6 w-48 bg-white/10 rounded-md"></div>
        <div className="h-4 w-72 bg-white/5 rounded-md"></div>
      </div>

      {/* Category pills */}
      <div className="flex flex-row gap-2 flex-wrap mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`cat-${i}`}
            className="h-8 rounded-full bg-white/10"
            style={{ width: i === 0 ? 72 : 54 }}
          />
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={`prod-${i}`}
            className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="aspect-square w-full rounded-lg bg-white/10"></div>
            <div className="h-4 w-3/4 bg-white/10 rounded"></div>
            <div className="h-3 w-1/2 bg-white/5 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShopSkeleton;
