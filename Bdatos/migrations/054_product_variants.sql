CREATE TABLE IF NOT EXISTS product_variants (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label        VARCHAR(120) NOT NULL,
    sku          VARCHAR(80),
    price_cents  INTEGER,        -- NULL = hereda products.price_cents
    stock        INTEGER,        -- NULL = ilimitado, mismo significado que products.stock
    sort_order   SMALLINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Snapshot de la variante elegida al momento de compra — mismo patrón que
-- product_name/product_sku en order_items (el producto puede cambiar o
-- borrarse después, el pedido conserva lo que el comprador realmente vio).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label VARCHAR(120);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_sku VARCHAR(80);
