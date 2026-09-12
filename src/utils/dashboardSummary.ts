function getVariantStock(variant: any) {
  if (!variant || typeof variant !== "object") return 0;
  return Number(variant.stock ?? variant.stok ?? 0) || 0;
}

function calculateDashboardStats(
  arg1?: { products?: any[]; orders?: any[] } | any[],
  arg2?: any[]
) {
  let productList: any[] = [];
  let orderList: any[] = [];

  if (Array.isArray(arg1) || Array.isArray(arg2)) {
    const list1 = Array.isArray(arg1) ? arg1 : [];
    const list2 = Array.isArray(arg2) ? arg2 : [];

    // Helper to detect if an item in the array looks like an order
    const isOrderLike = (item: any) =>
      Boolean(
        item &&
          (item.order_number !== undefined ||
            item.orderNumber !== undefined ||
            item.shipping_detail !== undefined ||
            item.shippingDetail !== undefined ||
            item.customer_name !== undefined ||
            item.customerName !== undefined ||
            item.gross_amount !== undefined ||
            item.total_amount !== undefined)
      );

    if (list1.some(isOrderLike)) {
      orderList = list1;
      productList = list2;
    } else if (list2.some(isOrderLike)) {
      orderList = list2;
      productList = list1;
    } else {
      // Default fallback: arg1 as orders, arg2 as products
      orderList = list1;
      productList = list2;
    }
  } else if (arg1 && typeof arg1 === "object") {
    productList = Array.isArray(arg1.products) ? arg1.products : [];
    orderList = Array.isArray(arg1.orders) ? arg1.orders : [];
  }

  const activeProductsCount = productList.length;
  const lowStockCount = productList.reduce((count, product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const lowStockVariants = variants.filter((variant: any) => getVariantStock(variant) <= 5);
    return count + lowStockVariants.length;
  }, 0);

  const paidStatuses = new Set([
    "paid",
    "success",
    "processing",
    "shipped",
    "shipping",
    "completed",
    "settlement",
    "delivered",
    "capture",
  ]);

  const totalRevenue = orderList.reduce((total, order) => {
    const status = String(order?.status || "").toLowerCase();
    if (!paidStatuses.has(status)) return total;
    return (
      total +
      Number(
        order?.amount ||
          order?.total_amount ||
          order?.gross_amount ||
          order?.total ||
          order?.price ||
          0
      )
    );
  }, 0);

  return {
    totalRevenue,
    totalOrders: orderList.length,
    activeProducts: activeProductsCount,
    lowStockCount,
  };
}

export { calculateDashboardStats };
