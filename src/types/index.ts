// src/types/index.ts
// Unified TypeScript Data Contracts matching Supabase Migrations (0001-0014) and Go Backend Models

export interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: "user" | "admin" | "superadmin" | string;
  status?: string;
  avatar_url?: string;
  points?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductVariant {
  size: string;
  price: number;
  stock?: number;
  stok?: number;
  image_url?: string;
  imageUrl?: string;
  imagePublicId?: string;
  sku?: string;
}

export type Variant = ProductVariant;

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price?: number;
  image_url?: string;
  imageUrl?: string;
  image_public_id?: string;
  variants: ProductVariant[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  status?: string;
  province?: string;
  city?: string;
  cityId?: string;
  stockLocation?: string;
  total_sold?: number;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  variant_name?: string;
  price: number;
  price_at_purchase: number;
  quantity: number;
  subtotal: number;
  size?: string;
  image_url?: string;
  weight_at_purchase?: number;
}

export interface Address {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  full_address: string;
  province: string;
  city: string;
  district?: string;
  postal_code?: string;
  biteship_area_id?: string;
  is_primary?: boolean;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number?: string;
  user_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  status: string;
  total_amount: number;
  shipping_cost: number;
  discount_amount: number;
  gross_amount: number;
  payment_method?: string;
  payment_type?: string;
  snap_token?: string;
  shipping_address?: Address | Record<string, any>;
  shipping_detail?: Record<string, any>;
  status_history?: any[];
  tracking_history?: any[];
  waybill_id?: string;
  courier_name?: string;
  courier_service?: string;
  courier_tracking_link?: string;
  biteship_order_id?: string;
  notes?: string;
  items?: OrderItem[];
  created_at: string;
  updated_at?: string;
  return_status?: string;
  return_admin_note?: string;
}

export interface Voucher {
  id: string;
  code: string;
  title: string;
  description?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_spend: number;
  max_discount?: number;
  quota?: number;
  used_count?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

export interface UserVoucher {
  id: string;
  user_id: string;
  voucher_id: string;
  voucher?: Voucher;
  is_used: boolean;
  used_at?: string;
  claimed_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  points: number;
  created_at?: string;
  updated_at?: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "credit" | "debit";
  source: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

export interface Review {
  id: string;
  order_id?: string;
  product_id: string;
  user_id: string;
  user_name?: string;
  rating: number;
  comment: string;
  photo_url?: string;
  status?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  sender: "user" | "admin";
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface StoreConfig {
  id: number;
  store_name?: string;
  support_phone?: string;
  support_email?: string;
  enable_midtrans?: boolean;
  midtrans_is_production?: boolean;
  promo_title?: string;
  promo_discount_percent?: number;
  promo_active?: boolean;
  promo_start_date?: string;
  promo_end_date?: string;
  promo_type?: string;
  promo_variant_targets?: string[];
  updated_at?: string;
}
