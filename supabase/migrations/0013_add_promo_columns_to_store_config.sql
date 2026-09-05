-- Migration: Ensure promo columns exist on store_config table
ALTER TABLE store_config
  ADD COLUMN IF NOT EXISTS promo_banner_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_banner_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS promo_discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS promo_discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS promo_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS promo_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS promo_destination text DEFAULT '#product';
