"use client";

// Banner de referidos — solo visible para tiendas en plan free.
// Invita a compartir el código: cada referido con tienda creada sube
// los límites de productos y pedidos del plan free.

import { useEffect, useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

interface ReferralInfo {
  code: string;
  share_url: string;
  bonus_applies: boolean;
  referred_with_store: number;
  counted: number;
  max_referrals: number;
  extra_products: number;
  extra_orders: number;
  bonus_per_referral: { products: number; orders: number };
  effective_limits: { max_products: number | null; max_orders_mo: number | null };
}

export default function ReferralBanner() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient
      .get<ReferralInfo>("/referrals/me")
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo(null));
  }, []);

  if (!info || !info.bonus_applies) return null;

  const perProducts = info.bonus_per_referral.products;
  const perOrders = info.bonus_per_referral.orders;
  const shareText = `Crea tu tienda online gratis en qtienda 🛍️ Regístrate con mi enlace: ${info.share_url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(info!.share_url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: "qtienda", text: shareText, url: info!.share_url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    }
  }

  return (
    <div
      className="mb-5 animate-fade-up rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, #F5F3FF, #FDF4FF)",
        border: "1.5px solid #DDD6FE",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #C026D3)" }}
        >
          <Gift size={17} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "#4C1D95" }}>
            Invita amigos y sube tus límites gratis
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#6D28D9" }}>
            Por cada amigo que cree su tienda ganas <strong>+{perProducts} productos</strong> y{" "}
            <strong>+{perOrders} pedidos/mes</strong> en tu plan free.
          </p>

          {info.counted > 0 && (
            <p
              className="inline-flex items-center gap-1 text-[11px] font-bold mt-2 px-2 py-0.5 rounded-full"
              style={{ background: "#EDE9FE", color: "#5B21B6" }}
            >
              🎉 {info.referred_with_store} referido{info.referred_with_store !== 1 ? "s" : ""} · +
              {info.extra_products} productos · +{info.extra_orders} pedidos/mes
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className="mono text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider"
              style={{ background: "#fff", color: "#5B21B6", border: "1px dashed #C4B5FD" }}
            >
              {info.code}
            </span>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
              style={{ background: "#fff", color: "#6D28D9", border: "1px solid #DDD6FE" }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #C026D3)" }}
            >
              <Share2 size={12} />
              Invitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
