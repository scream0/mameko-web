-- Migration: Add promo_target_type and promo_target_variants to store_config
ALTER TABLE store_config 
  ADD COLUMN IF NOT EXISTS promo_target_type text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS promo_target_variants jsonb DEFAULT '[]'::jsonb;
