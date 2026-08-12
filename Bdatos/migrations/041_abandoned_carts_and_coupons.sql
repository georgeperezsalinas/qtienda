-- 041_abandoned_carts_and_coupons.sql
-- Carrito abandonado (notificacion al vendedor) + cupones de descuento con codigo.

CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    buyer_name VARCHAR(150),
    buyer_phone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'notified', 'recovered')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notified_at TIMESTAMPTZ,
    UNIQUE (store_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_watcher
    ON abandoned_carts (status, updated_at)
    WHERE status = 'open';

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value INTEGER NOT NULL,
    min_order_cents INTEGER,
    max_uses INTEGER,
    uses_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons (store_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(30);
