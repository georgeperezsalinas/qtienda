"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag, MessageCircle, CheckCircle2 } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  store: any;
}

type Step = "cart" | "info" | "success";

export default function CartDrawer({ open, onClose, store }: Props) {
  const { items, updateQty, removeItem, clearCart, totalCents } = useCartStore();
  const [step, setStep] = useState<Step>("cart");
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  const [form, setForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    buyer_address: "",
    notes: "",
  });

  const deliveryFee = store.settings?.delivery_fee_cents || 0;
  const freeAbove = store.settings?.free_delivery_above;
  const effectiveDelivery =
    freeAbove && totalCents() >= freeAbove ? 0 : deliveryFee;
  const total = totalCents() + effectiveDelivery;

  async function placeOrder() {
    if (!form.buyer_name.trim() || !form.buyer_phone.trim()) {
      toast.error("Nombre y teléfono son requeridos");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        buyer_name: form.buyer_name,
        buyer_phone: form.buyer_phone,
        buyer_address: form.buyer_address,
        notes: form.notes,
        source: "tiktok",
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
      };
      const result = await apiClient.post(`/public/store/${store.slug}/orders`, payload);
      setOrderResult(result.data);
      clearCart();
      setStep("success");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al procesar pedido");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep("cart");
      setOrderResult(null);
    }, 300);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[92vh] flex flex-col shadow-float"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg text-gray-900">
                {step === "cart" && "Tu carrito"}
                {step === "info" && "Datos de entrega"}
                {step === "success" && "¡Pedido enviado!"}
              </h2>
              <button onClick={handleClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {step === "cart" && (
                <div className="px-5 py-4 space-y-3">
                  {items.length === 0 ? (
                    <div className="py-12 flex flex-col items-center text-center">
                      <ShoppingBag size={48} className="text-gray-200 mb-3" />
                      <p className="text-gray-400 text-sm">Tu carrito está vacío</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-50"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: store.primary_color }}>
                            {formatPrice(item.price_cents * item.quantity)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() =>
                              item.quantity === 1
                                ? removeItem(item.id)
                                : updateQty(item.id, item.quantity - 1)
                            }
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center active:scale-90 transition-transform"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform"
                            style={{ background: store.primary_color }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {step === "info" && (
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Nombre completo *
                    </label>
                    <input
                      className="input"
                      placeholder="¿A quién enviamos?"
                      value={form.buyer_name}
                      onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      WhatsApp / Teléfono *
                    </label>
                    <input
                      className="input"
                      type="tel"
                      placeholder="987 654 321"
                      value={form.buyer_phone}
                      onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Dirección de entrega
                    </label>
                    <input
                      className="input"
                      placeholder="Calle, número, distrito..."
                      value={form.buyer_address}
                      onChange={(e) => setForm({ ...form, buyer_address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Notas adicionales
                    </label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      placeholder="Indicaciones especiales..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>

                  {/* Order Summary */}
                  <div className="rounded-2xl bg-surface-50 p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatPrice(totalCents())}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery</span>
                      <span>
                        {effectiveDelivery === 0 && deliveryFee > 0 ? (
                          <span className="text-green-600 font-semibold">Gratis 🎉</span>
                        ) : (
                          formatPrice(effectiveDelivery)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                      <span>Total</span>
                      <span style={{ color: store.primary_color }}>{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {step === "success" && orderResult && (
                <div className="px-5 py-8 flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                  >
                    <CheckCircle2 size={72} style={{ color: store.primary_color }} />
                  </motion.div>
                  <h3 className="font-display font-bold text-xl mt-4 mb-1">¡Pedido recibido!</h3>
                  <p className="text-gray-500 text-sm mb-1">
                    Número de pedido:{" "}
                    <span className="font-bold text-gray-900">{orderResult.order_number}</span>
                  </p>
                  <p className="text-gray-500 text-sm mb-6">
                    El vendedor te contactará pronto por WhatsApp
                  </p>

                  {/* Buyer account CTA */}
                  <a
                    href="/registro"
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 mb-3 text-sm font-bold border-2 transition-colors"
                    style={{
                      color: store.primary_color,
                      borderColor: store.primary_color,
                      background: "transparent",
                    }}
                  >
                    Crea tu cuenta para ver todos tus pedidos
                  </a>

                  {orderResult.whatsapp_link && (
                    <a
                      href={orderResult.whatsapp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary w-full mb-3"
                      style={{ background: "#25D366" }}
                    >
                      <MessageCircle size={18} />
                      Abrir WhatsApp
                    </a>
                  )}
                  <button onClick={handleClose} className="btn-secondary w-full">
                    Seguir comprando
                  </button>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            {step !== "success" && (
              <div className="px-5 py-4 pb-safe border-t border-gray-100">
                {step === "cart" ? (
                  <button
                    onClick={() => setStep("info")}
                    disabled={items.length === 0}
                    className="btn-primary w-full"
                    style={{ background: store.primary_color }}
                  >
                    Continuar · {formatPrice(totalCents())}
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setStep("cart")} className="btn-secondary !w-auto flex-shrink-0 px-4">
                      Atrás
                    </button>
                    <button
                      onClick={placeOrder}
                      disabled={loading}
                      className="btn-primary flex-1"
                      style={{ background: store.primary_color }}
                    >
                      {loading ? "Enviando..." : `Realizar pedido · ${formatPrice(total)}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
