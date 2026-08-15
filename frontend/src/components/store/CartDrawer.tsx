"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Minus, Plus, ShoppingBag, MessageCircle,
  CheckCircle2, ChevronRight, MapPin, User, Phone, Package, LogOut,
  Mail, FileText, ArrowLeft, CreditCard, Landmark, AlertTriangle, Tag,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useRecentPurchasesStore } from "@/store/recentPurchasesStore";
import { useAuthStore } from "@/store/authStore";
import { formatPrice, getStoreCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";
import PhoneInput from "@/components/ui/PhoneInput";
import PhoneVerifyStep from "./PhoneVerifyStep";
import { track } from "@vercel/analytics";
import { pixelPurchase } from "@/lib/marketingPixels";
import { getSessionId } from "@/lib/analyticsSession";

interface Props {
  open: boolean;
  onClose: () => void;
  store: any;
}

type Step = "cart" | "info" | "verify" | "payment" | "success";

const STEPS: { key: Step; label: string }[] = [
  { key: "cart", label: "Carrito" },
  { key: "info", label: "Datos" },
  { key: "payment", label: "Pago" },
];

// "verify" cuenta como parte de "Datos" en la barra de progreso — no es un
// paso grande aparte, es una validación antes de pasar a pago.
const STEP_IDX: Record<Step, number> = { cart: 0, info: 1, verify: 1, payment: 2, success: 3 };

const DEPARTAMENTOS = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
  "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín",
  "La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua",
  "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];

/* ── Step indicator ── */
function Stepper({ step, color }: { step: Step; color: string }) {
  const current = STEP_IDX[step];
  if (step === "success") return null;
  return (
    <div className="flex items-center justify-center gap-0 px-6 pt-1 pb-3">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: done || active ? color : "var(--line-2)",
                  color: done || active ? "#fff" : "var(--ink-3)",
                  transform: active ? "scale(1.1)" : "scale(1)",
                }}
              >
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span
                className="text-[10px] font-semibold transition-colors"
                style={{ color: active ? color : done ? "var(--ink-3)" : "var(--ink-4)" }}
              >
                {s.label}
              </span>
            </div>
            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className="w-16 h-0.5 mb-4 mx-1 transition-all duration-300"
                style={{ background: done ? color : "var(--line-2)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Barra de progreso hacia el envío gratis ── */
function FreeShippingBar({ subtotal, freeAbove, color, currency, locale }: { subtotal: number; freeAbove: number; color: string; currency: string; locale: string }) {
  const qualifies = subtotal >= freeAbove;
  const pct = Math.min(100, Math.round((subtotal / freeAbove) * 100));
  const missing = freeAbove - subtotal;

  return (
    <div
      className="rounded-2xl p-3.5 mb-3"
      style={{
        background: qualifies ? "var(--success-soft)" : `${color}0d`,
        border: `1.5px solid ${qualifies ? "var(--success)" : color}22`,
      }}
    >
      <p
        className="text-xs font-bold mb-2"
        style={{ color: qualifies ? "var(--success)" : "var(--ink)" }}
      >
        {qualifies
          ? "¡Envío gratis desbloqueado! 🎉"
          : <>Te faltan <strong>{formatPrice(missing, currency, locale)}</strong> para envío gratis</>}
      </p>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: qualifies ? "var(--success)" : color }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  );
}

/* ── Field wrapper ── */
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-3)" }}>
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════
   CART DRAWER
════════════════════════════════════════ */
export default function CartDrawer({ open, onClose, store }: Props) {
  const { code: currency, locale } = getStoreCurrency(store);
  const { items, updateQty, removeItem, clearCart, totalCents } = useCartStore();
  const recordPurchase = useRecentPurchasesStore((s) => s.record);
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>("cart");
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  // Recuerda los datos del comprador entre compras (misma persona, distinta tienda)
  const BUYER_INFO_KEY = "qtienda_buyer_info";
  function loadSavedBuyerInfo() {
    try {
      const raw = localStorage.getItem(BUYER_INFO_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  const [form, setForm] = useState(() => {
    const saved = loadSavedBuyerInfo();
    return {
      buyer_name: user?.full_name || saved.buyer_name || "",
      buyer_phone: saved.buyer_phone || "",
      buyer_dni: saved.buyer_dni || "",
      buyer_email: user?.email || saved.buyer_email || "",
      buyer_department: saved.buyer_department || "",
      buyer_province: saved.buyer_province || "",
      buyer_district: saved.buyer_district || "",
      buyer_address: saved.buyer_address || "",
      buyer_reference: saved.buyer_reference || "",
      notes: "",
      payment_method: "",
    };
  });

  // Persiste los datos (menos notas/pago, que son por pedido) en cada cambio
  useEffect(() => {
    const { notes, payment_method, ...buyerInfo } = form;
    localStorage.setItem(BUYER_INFO_KEY, JSON.stringify(buyerInfo));
  }, [form]);

  const color = store.primary_color || "#2563EB";
  // Checkout adaptado al país de la tienda: Perú usa DNI + ubigeo;
  // otros países ven etiquetas y validaciones genéricas.
  const isPE = (store.country || "PE") === "PE";
  const canPickup = !!store.settings?.accept_pickup;
  const [serviceType, setServiceType] = useState<"delivery" | "pickup">("delivery");
  const isPickup = canPickup && serviceType === "pickup";
  const deliveryFee = store.settings?.delivery_fee_cents || 0;
  const freeAbove = store.settings?.free_delivery_above;
  const subtotal = totalCents();
  const effectiveDel = isPickup ? 0 : (freeAbove && subtotal >= freeAbove ? 0 : deliveryFee);
  const total = subtotal + effectiveDel;
  const minOrder = store.settings?.min_order_cents || 0;
  const belowMin = minOrder > 0 && total < minOrder;

  // Descuento de bienvenida: solo se sabe si aplica una vez el comprador
  // escribió su teléfono (paso "info"). Nunca se muestra como aplicado
  // hasta que el backend lo confirma — evita prometer algo que luego no se cumpla.
  const welcomeEnabled = !!store.settings?.welcome_discount_enabled && !!store.settings?.welcome_discount_cents;
  const welcomeDiscountCents = store.settings?.welcome_discount_cents || 0;
  const [isFirstOrder, setIsFirstOrder] = useState<boolean | null>(null);
  const [checkingWelcome, setCheckingWelcome] = useState(false);
  const appliedDiscount = welcomeEnabled && isFirstOrder ? Math.min(welcomeDiscountCents, subtotal) : 0;

  // Cupón — el descuento mostrado es solo un preview; el backend es la
  // autoridad final y re-valida todo al crear el pedido.
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount_cents: number } | null>(null);
  const [couponError, setCouponError] = useState("");

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponApplying(true);
    setCouponError("");
    try {
      const { data } = await apiClient.post(`/public/store/${store.slug}/coupons/validate`, {
        code,
        subtotal_cents: subtotal,
      });
      if (data.valid) {
        setCouponApplied({ code: code.toUpperCase(), discount_cents: data.discount_cents });
        toast.success(data.message || "Cupón aplicado");
      } else {
        setCouponApplied(null);
        setCouponError(data.message || "Cupón no válido");
      }
    } catch {
      setCouponApplied(null);
      setCouponError("No se pudo validar el cupón");
    } finally {
      setCouponApplying(false);
    }
  }

  function removeCoupon() {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError("");
  }

  const couponDiscountCents = couponApplied ? Math.min(couponApplied.discount_cents, total - appliedDiscount) : 0;
  const displayTotal = total - appliedDiscount - couponDiscountCents;

  useEffect(() => {
    if (step !== "payment" || !welcomeEnabled || isFirstOrder !== null || !form.buyer_phone.trim()) return;
    setCheckingWelcome(true);
    apiClient
      .get(`/public/store/${store.slug}/buyer-first-order`, { params: { phone: form.buyer_phone.trim() } })
      .then(({ data }) => setIsFirstOrder(!!data.is_first_order))
      .catch(() => setIsFirstOrder(false))
      .finally(() => setCheckingWelcome(false));
  }, [step, welcomeEnabled, form.buyer_phone, isFirstOrder, store.slug]);

  // Si vuelve atrás y cambia el teléfono, se re-verifica en el próximo paso "payment"
  useEffect(() => {
    setIsFirstOrder(null);
  }, [form.buyer_phone]);

  const paymentOptions = [
    store.settings?.accept_cash && { value: "cash", label: "Efectivo", icon: "💵", sub: "Pago contra entrega" },
    store.settings?.accept_yape && { value: "yape", label: "Yape", icon: "💜", sub: store.settings?.yape_phone ? `Yape: ${store.settings.yape_phone}` : "Te enviamos el número" },
    store.settings?.accept_plin && { value: "plin", label: "Plin", icon: "💚", sub: store.settings?.plin_phone ? `Plin: ${store.settings.plin_phone}` : "Te enviamos el número" },
    store.settings?.accept_transfer && { value: "transfer", label: "Transferencia", icon: "🏦", sub: "Datos bancarios al confirmar" },
    store.settings?.accept_card && { value: "card", label: "Tarjeta", icon: "💳", sub: "POS al momento de la entrega" },
  ].filter(Boolean) as { value: string; label: string; icon: string; sub: string }[];

  function go(next: Step, dir = 1) {
    setDirection(dir);
    setStep(next);
  }

  function validateInfo(): boolean {
    if (!form.buyer_name.trim() || !form.buyer_phone.trim()) {
      toast.error("Nombre y teléfono son requeridos");
      return false;
    }
    // El DNI/documento es opcional — el backend lo acepta vacío. Si el
    // comprador lo llena igual se valida el formato, para no guardar basura.
    if (isPE && form.buyer_dni.trim() && !/^\d{8}$/.test(form.buyer_dni.trim())) {
      toast.error("El DNI debe tener 8 dígitos");
      return false;
    }
    // Recojo en tienda: no hay a dónde enviar, así que no se piden estos datos.
    if (isPickup) return true;
    if (isPE) {
      if (!form.buyer_department || !form.buyer_province.trim() || !form.buyer_district.trim()) {
        toast.error("Completa departamento, provincia y distrito");
        return false;
      }
    } else {
      if (!form.buyer_department.trim() || !form.buyer_province.trim()) {
        toast.error("Completa región/estado y ciudad");
        return false;
      }
    }
    if (!form.buyer_address.trim()) {
      toast.error("Ingresa la dirección de entrega");
      return false;
    }
    return true;
  }

  async function placeOrder() {
    if (!validateInfo()) return;
    if (!form.payment_method) {
      toast.error("Selecciona un método de pago");
      return;
    }
    setLoading(true);
    try {
      const result = await apiClient.post(`/public/store/${store.slug}/orders`, {
        buyer_name: form.buyer_name.trim(),
        buyer_phone: form.buyer_phone.trim(),
        buyer_dni: form.buyer_dni.trim() || undefined,
        buyer_email: form.buyer_email.trim() || undefined,
        buyer_department: form.buyer_department || undefined,
        buyer_province: form.buyer_province.trim() || undefined,
        buyer_district: form.buyer_district.trim() || undefined,
        buyer_address: form.buyer_address.trim() || undefined,
        buyer_reference: form.buyer_reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        payment_method: form.payment_method,
        service_type: isPickup ? "pickup" : "delivery",
        source: "tiktok",
        coupon_code: couponApplied?.code || undefined,
        cart_session_id: getSessionId(),
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
      });

      setOrderResult(result.data);
      pixelPurchase(result.data.order_number, result.data.total_cents ?? total);
      recordPurchase(store.slug, items.map((i) => i.id));
      clearCart();
      track("order_placed", {
        store_slug: store.slug,
        payment_method: form.payment_method,
        total_cents: result.data.total_cents ?? total,
        items_count: items.length,
      });
      go("success");

    } catch (err: any) {
      const detail: string = err.response?.data?.detail || "";
      if (detail.startsWith("PHONE_NOT_VERIFIED")) {
        // La verificación expiró justo en el medio — que la repita en vez
        // de solo mostrarle un error genérico sin salida.
        toast.error("Tu verificación expiró, verifica tu teléfono de nuevo");
        go("verify");
      } else {
        toast.error(detail || "Error al procesar pedido");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => { setStep("cart"); setOrderResult(null); }, 350);
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -40, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(4px)" }}
          />

          {/* Sheet (m\u00f3vil/tablet) / Modal centrado (desktop) */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[28px] lg:inset-0 lg:bottom-auto lg:m-auto lg:h-fit lg:max-w-[480px] lg:rounded-[24px]"
            style={{
              background: "var(--surface)",
              maxHeight: "90dvh",
              boxShadow: "0 -8px 48px rgba(20,19,15,.2)",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--line-2)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pb-3 flex-shrink-0">
              {step !== "cart" && step !== "success" && (
                <button
                  onClick={() => go(step === "payment" ? "verify" : step === "verify" ? "info" : "cart", -1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: "var(--surface-2)" }}
                >
                  <ArrowLeft size={18} style={{ color: "var(--ink-2)" }} />
                </button>
              )}
              <h2 className="font-extrabold text-lg flex-1" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                {step === "cart" && `Mi pedido (${items.length})`}
                {step === "info" && (isPickup ? "Tus datos" : "¿A dónde enviamos?")}
                {step === "verify" && "Verifica tu teléfono"}
                {step === "payment" && "¿Cómo pagas?"}
                {step === "success" && "¡Pedido enviado!"}
              </h2>
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--surface-2)" }}
              >
                <X size={17} style={{ color: "var(--ink-2)" }} />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex-shrink-0">
              <Stepper step={step} color={color} />
            </div>

            {/* Divider */}
            <div className="flex-shrink-0" style={{ borderTop: "1px solid var(--line)" }} />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >

                  {/* ── STEP: CART ── */}
                  {step === "cart" && (
                    <div className="px-4 py-4">
                      {items.length === 0 ? (
                        <div className="py-16 flex flex-col items-center text-center">
                          <div
                            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
                            style={{ background: "var(--surface-2)" }}
                          >
                            <ShoppingBag size={36} style={{ color: "var(--ink-4)" }} />
                          </div>
                          <p className="font-bold text-base" style={{ color: "var(--ink)" }}>Tu carrito está vacío</p>
                          <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
                            Agrega productos para continuar
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Antes esto solo se descubría al final, después de llenar
                              todo el formulario de entrega — se avisa acá, de entrada. */}
                          {paymentOptions.length === 0 && (
                            <div
                              className="flex items-start gap-2 rounded-2xl p-3"
                              style={{ background: "var(--danger-soft)", border: "1px solid var(--line)" }}
                            >
                              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                              <p className="text-xs" style={{ color: "var(--danger)" }}>
                                Esta tienda todavía no configuró ningún método de pago. Puedes escribirle por WhatsApp para coordinar antes de completar tu pedido.
                              </p>
                            </div>
                          )}
                          {/* Zonas de entrega — visibles antes de llenar la dirección, para
                              que el comprador no descubra recién al final que no le llega. */}
                          {Array.isArray(store.settings?.delivery_zones) && store.settings.delivery_zones.length > 0 && (
                            <details
                              className="rounded-2xl px-3 py-2.5"
                              style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
                            >
                              <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
                                🚚 Entregamos en {store.settings.delivery_zones.length} zona
                                {store.settings.delivery_zones.length !== 1 ? "s" : ""} — toca para ver cuáles
                              </summary>
                              <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>
                                {store.settings.delivery_zones.join(", ")}
                              </p>
                            </details>
                          )}
                          {!!freeAbove && deliveryFee > 0 && (
                            <FreeShippingBar subtotal={subtotal} freeAbove={freeAbove} color={color} currency={currency} locale={locale} />
                          )}
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-3 rounded-2xl"
                              style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
                            >
                              {/* Image */}
                              {item.image_url ? (
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                                  <Image src={item.image_url} alt={item.name} fill sizes="64px" className="object-cover" />
                                </div>
                              ) : (
                                <div
                                  className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                                  style={{ background: "var(--surface-2)" }}
                                >
                                  <ShoppingBag size={20} style={{ color: "var(--ink-4)" }} />
                                </div>
                              )}

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold leading-tight line-clamp-2" style={{ color: "var(--ink)" }}>
                                  {item.name}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                                  {formatPrice(item.price_cents, currency, locale)} c/u
                                </p>
                                <p className="text-sm font-extrabold mt-1" style={{ color }}>
                                  {formatPrice(item.price_cents * item.quantity, currency, locale)}
                                </p>
                              </div>

                              {/* Qty controls */}
                              <div
                                className="flex items-center gap-2 rounded-xl p-1 flex-shrink-0"
                                style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)" }}
                              >
                                <button
                                  onClick={() => item.quantity === 1 ? removeItem(item.id) : updateQty(item.id, item.quantity - 1)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                                  style={{ background: item.quantity === 1 ? "var(--danger-soft)" : "var(--surface-2)" }}
                                >
                                  <Minus size={12} style={{ color: item.quantity === 1 ? "var(--danger)" : "var(--ink-2)" }} />
                                </button>
                                <span className="text-sm font-extrabold w-5 text-center" style={{ color: "var(--ink)" }}>
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQty(item.id, item.quantity + 1)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 text-white"
                                  style={{ background: color }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Order summary */}
                          <div
                            className="rounded-2xl p-4 mt-3 space-y-2"
                            style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
                          >
                            <div className="flex justify-between text-sm" style={{ color: "var(--ink-2)" }}>
                              <span>Subtotal</span>
                              <span className="font-semibold">{formatPrice(subtotal, currency, locale)}</span>
                            </div>
                            {deliveryFee > 0 && (
                              <div className="flex justify-between text-sm" style={{ color: "var(--ink-2)" }}>
                                <span>Delivery</span>
                                <span className="font-semibold">
                                  {effectiveDel === 0 ? (
                                    <span style={{ color: "var(--success)" }}>Gratis 🎉</span>
                                  ) : formatPrice(effectiveDel, currency, locale)}
                                </span>
                              </div>
                            )}
                            <div
                              className="flex justify-between font-extrabold text-base pt-2"
                              style={{ borderTop: "1px solid var(--line-2)", color: "var(--ink)" }}
                            >
                              <span>Total</span>
                              <span style={{ color }}>{formatPrice(total, currency, locale)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── STEP: INFO ── */}
                  {step === "info" && (
                    <div className="px-4 py-4 space-y-4">
                      {canPickup && (
                        <div className="grid grid-cols-2 gap-2">
                          {(["delivery", "pickup"] as const).map((t) => {
                            const selected = serviceType === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setServiceType(t)}
                                className="flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-bold transition-all active:scale-[.98]"
                                style={{
                                  border: `2px solid ${selected ? color : "var(--line-2)"}`,
                                  background: selected ? `${color}09` : "var(--surface)",
                                  color: selected ? color : "var(--ink-2)",
                                }}
                              >
                                {t === "delivery" ? "🚚 Envío a domicilio" : "🏪 Recojo en tienda"}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <Field label="Nombre completo *" icon={<User size={11} />}>
                        <input
                          className="input"
                          placeholder="¿A nombre de quién?"
                          autoComplete="name"
                          value={form.buyer_name}
                          onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                        />
                      </Field>

                      <Field label="WhatsApp / Teléfono *" icon={<Phone size={11} />}>
                        <PhoneInput
                          value={form.buyer_phone}
                          onChange={(v) => setForm({ ...form, buyer_phone: v })}
                        />
                      </Field>

                      <Field label={isPE ? "DNI (opcional)" : "Documento de identidad (opcional)"} icon={<CreditCard size={11} />}>
                        <input
                          className="input"
                          inputMode={isPE ? "numeric" : "text"}
                          maxLength={isPE ? 8 : 15}
                          placeholder={isPE ? "8 dígitos" : "DNI / CI / CC / cédula"}
                          value={form.buyer_dni}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              buyer_dni: isPE
                                ? e.target.value.replace(/\D/g, "").slice(0, 8)
                                : e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 15),
                            })
                          }
                        />
                      </Field>

                      <Field label={user ? "Email (tu cuenta)" : "Email (opcional)"} icon={<Mail size={11} />}>
                        <input
                          className="input"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="tu@email.com"
                          value={form.buyer_email}
                          readOnly={!!user?.email}
                          onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
                          style={user?.email ? { background: "var(--bg)", color: "var(--ink-3)" } : {}}
                        />
                        {user?.email && (
                          <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>
                            Tu pedido se vinculará a tu cuenta automáticamente
                          </p>
                        )}
                      </Field>

                      {isPickup ? (
                        <div
                          className="rounded-2xl p-3.5 text-xs leading-relaxed"
                          style={{ background: "var(--success-soft)", color: "var(--success)", border: "1px solid var(--line-2)" }}
                        >
                          <p className="font-bold mb-1">🏪 Recoges tu pedido en la tienda</p>
                          <p>
                            {store.settings?.pickup_instructions?.trim() ||
                              "El vendedor te confirmará la dirección y el horario para recogerlo."}
                          </p>
                        </div>
                      ) : isPE ? (
                        <>
                          <Field label="Departamento *" icon={<Landmark size={11} />}>
                            <select
                              className="input"
                              value={form.buyer_department}
                              onChange={(e) => setForm({ ...form, buyer_department: e.target.value })}
                              style={{ color: form.buyer_department ? undefined : "var(--ink-3)" }}
                            >
                              <option value="">Selecciona…</option>
                              {DEPARTAMENTOS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </Field>

                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Provincia *" icon={<MapPin size={11} />}>
                              <input
                                className="input"
                                placeholder="Ej: Lima"
                                value={form.buyer_province}
                                onChange={(e) => setForm({ ...form, buyer_province: e.target.value })}
                              />
                            </Field>
                            <Field label="Distrito *" icon={<MapPin size={11} />}>
                              <input
                                className="input"
                                placeholder="Ej: Comas"
                                value={form.buyer_district}
                                onChange={(e) => setForm({ ...form, buyer_district: e.target.value })}
                              />
                            </Field>
                          </div>
                        </>
                      ) : (
                        <>
                          <Field label="Región / Estado *" icon={<Landmark size={11} />}>
                            <input
                              className="input"
                              placeholder="Ej: Antioquia, Jalisco…"
                              value={form.buyer_department}
                              onChange={(e) => setForm({ ...form, buyer_department: e.target.value })}
                            />
                          </Field>

                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Ciudad *" icon={<MapPin size={11} />}>
                              <input
                                className="input"
                                placeholder="Ej: Medellín"
                                value={form.buyer_province}
                                onChange={(e) => setForm({ ...form, buyer_province: e.target.value })}
                              />
                            </Field>
                            <Field label="Zona / Barrio" icon={<MapPin size={11} />}>
                              <input
                                className="input"
                                placeholder="Opcional"
                                value={form.buyer_district}
                                onChange={(e) => setForm({ ...form, buyer_district: e.target.value })}
                              />
                            </Field>
                          </div>
                        </>
                      )}

                      {!isPickup && (
                        <>
                          <Field label="Dirección de entrega *" icon={<MapPin size={11} />}>
                            <input
                              className="input"
                              placeholder="Calle, número, urbanización…"
                              autoComplete="street-address"
                              value={form.buyer_address}
                              onChange={(e) => setForm({ ...form, buyer_address: e.target.value })}
                            />
                          </Field>

                          <Field label="Referencia de la dirección" icon={<MapPin size={11} />}>
                            <input
                              className="input"
                              placeholder="Ej: frente al parque, casa de portón azul…"
                              value={form.buyer_reference}
                              onChange={(e) => setForm({ ...form, buyer_reference: e.target.value })}
                            />
                          </Field>
                        </>
                      )}

                      <Field label="Nota para el vendedor" icon={<FileText size={11} />}>
                        <textarea
                          className="input resize-none"
                          rows={2}
                          placeholder="Indicaciones especiales…"
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        />
                      </Field>
                    </div>
                  )}

                  {/* ── STEP: VERIFY (código de WhatsApp) ── */}
                  {step === "verify" && (
                    <div className="px-4 py-4">
                      <PhoneVerifyStep
                        phone={form.buyer_phone.trim()}
                        accentColor={color}
                        onBack={() => go("info", -1)}
                        onVerified={() => go("payment")}
                      />
                    </div>
                  )}

                  {/* ── STEP: PAYMENT ── */}
                  {step === "payment" && (
                    <div className="px-4 py-4 space-y-3">
                      {/* Resumen de lo que se está por confirmar — antes solo se veía
                          el total acá, sin poder revisar qué se está comprando. */}
                      <div className="rounded-2xl p-3" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 px-0.5" style={{ color: "var(--ink-3)" }}>
                          Tu pedido ({items.reduce((n, i) => n + i.quantity, 0)} producto{items.reduce((n, i) => n + i.quantity, 0) !== 1 ? "s" : ""})
                        </p>
                        <div className="space-y-1.5">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate" style={{ color: "var(--ink-2)" }}>
                                {item.quantity}× {item.name}
                              </span>
                              <span className="flex-shrink-0 font-semibold" style={{ color: "var(--ink)" }}>
                                {formatPrice(item.price_cents * item.quantity, currency, locale)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total destacado */}
                      <div
                        className="rounded-2xl p-4 flex items-center justify-between"
                        style={{ background: `${color}0d`, border: `1.5px solid ${color}22` }}
                      >
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>Total a pagar</p>
                          {(appliedDiscount > 0 || couponDiscountCents > 0) && (
                            <p className="text-xs line-through" style={{ color: "var(--ink-4)" }}>
                              {formatPrice(total, currency, locale)}
                            </p>
                          )}
                          <p className="font-extrabold text-2xl mt-0.5" style={{ color, fontFamily: "var(--font-display)" }}>
                            {formatPrice(displayTotal, currency, locale)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {isPickup ? (
                            <span
                              className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                              style={{ background: "var(--success-soft)", color: "var(--success)" }}
                            >
                              🏪 Recojo en tienda
                            </span>
                          ) : deliveryFee > 0 && effectiveDel === 0 ? (
                            <span
                              className="text-xs font-bold px-3 py-1.5 rounded-full"
                              style={{ background: "var(--success-soft)", color: "var(--success)" }}
                            >
                              Delivery gratis 🎉
                            </span>
                          ) : null}
                          {appliedDiscount > 0 && (
                            <span
                              className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                              style={{ background: "var(--success-soft)", color: "var(--success)" }}
                            >
                              🎁 -{formatPrice(appliedDiscount, currency, locale)} bienvenida
                            </span>
                          )}
                          {couponDiscountCents > 0 && (
                            <span
                              className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                              style={{ background: "var(--success-soft)", color: "var(--success)" }}
                            >
                              🏷️ -{formatPrice(couponDiscountCents, currency, locale)} cupón
                            </span>
                          )}
                          {checkingWelcome && (
                            <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>
                              Verificando descuento…
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cupón de descuento */}
                      <div className="rounded-2xl p-3.5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                        {couponApplied ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Tag size={15} style={{ color: "var(--success)" }} className="flex-shrink-0" />
                              <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>
                                Cupón {couponApplied.code} aplicado
                              </p>
                            </div>
                            <button
                              onClick={removeCoupon}
                              className="text-xs font-semibold flex-shrink-0"
                              style={{ color: "var(--ink-3)" }}
                            >
                              Quitar
                            </button>
                          </div>
                        ) : (
                          <>
                            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-3)" }}>
                              <Tag size={11} />
                              ¿Tienes un cupón?
                            </label>
                            <div className="flex gap-2">
                              <input
                                className="input flex-1"
                                placeholder="Código"
                                autoCapitalize="characters"
                                value={couponCode}
                                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                                onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                              />
                              <button
                                onClick={applyCoupon}
                                disabled={couponApplying || !couponCode.trim()}
                                className="px-4 rounded-xl font-bold text-sm flex-shrink-0 transition-all active:scale-95 disabled:opacity-50"
                                style={{ background: "var(--surface-2)", color: "var(--ink)" }}
                              >
                                {couponApplying ? "…" : "Aplicar"}
                              </button>
                            </div>
                            {couponError && (
                              <p className="text-xs font-medium mt-1.5" style={{ color: "var(--danger)" }}>{couponError}</p>
                            )}
                          </>
                        )}
                      </div>

                      {store.settings?.require_prepayment && (
                        <div
                          className="rounded-xl px-4 py-3 text-xs font-medium"
                          style={{ background: "var(--warn-soft)", border: "1px solid var(--line-2)", color: "var(--warn)" }}
                        >
                          ⚠️ Esta tienda requiere pago anticipado antes de preparar tu pedido.
                        </div>
                      )}

                      <p className="text-xs font-bold uppercase tracking-wider px-0.5" style={{ color: "var(--ink-3)" }}>
                        Elige cómo pagar
                      </p>

                      {paymentOptions.length === 0 ? (
                        <div
                          className="rounded-2xl p-4 text-center text-sm"
                          style={{ background: "var(--bg)", color: "var(--ink-3)" }}
                        >
                          La tienda no tiene métodos de pago configurados
                        </div>
                      ) : (
                        paymentOptions.map((opt) => {
                          const selected = form.payment_method === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setForm({ ...form, payment_method: opt.value })}
                              className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[.98]"
                              style={{
                                border: `2px solid ${selected ? color : "var(--line-2)"}`,
                                background: selected ? `${color}09` : "var(--surface)",
                                boxShadow: selected ? `0 0 0 3px ${color}18` : "none",
                              }}
                            >
                              <span className="text-2xl flex-shrink-0">{opt.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm" style={{ color: "var(--ink)" }}>{opt.label}</p>
                                {opt.sub && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>{opt.sub}</p>
                                )}
                              </div>
                              <div
                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                  borderColor: selected ? color : "var(--ink-4)",
                                  background: selected ? color : "transparent",
                                }}
                              >
                                {selected && <CheckCircle2 size={12} color="white" />}
                              </div>
                            </button>
                          );
                        })
                      )}

                      {/* QR del metodo elegido (Yape/Plin) — si la tienda subio uno, se muestra para escanear */}
                      {(() => {
                        const qrUrl =
                          form.payment_method === "yape" ? store.settings?.yape_qr_url :
                          form.payment_method === "plin" ? store.settings?.plin_qr_url :
                          null;
                        if (!qrUrl) return null;
                        return (
                          <div
                            className="flex flex-col items-center gap-2 rounded-2xl p-4"
                            style={{ background: "var(--bg)", border: "1px solid var(--line-2)" }}
                          >
                            <p className="text-xs font-bold" style={{ color: "var(--ink-2)" }}>
                              Escanea para pagar con {form.payment_method === "yape" ? "Yape" : "Plin"}
                            </p>
                            <div
                              className="relative w-40 h-40 rounded-xl overflow-hidden"
                              style={{ background: "#fff", border: "1px solid var(--line-2)" }}
                            >
                              <Image
                                src={qrUrl}
                                alt={`QR ${form.payment_method === "yape" ? "Yape" : "Plin"} de ${store.name}`}
                                fill
                                sizes="160px"
                                className="object-contain"
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {paymentOptions.length > 0 && (
                        <p className="text-[11px] text-center pt-1" style={{ color: "var(--ink-4)" }}>
                          🔒 Tu pedido se coordina directo con la tienda — nunca compartimos tus datos
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── STEP: SUCCESS ── */}
                  {step === "success" && orderResult && (
                    <div className="px-5 py-8 flex flex-col items-center text-center">
                      {/* Animated checkmark */}
                      <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                        className="w-24 h-24 rounded-[32px] flex items-center justify-center mb-5"
                        style={{ background: `${color}15` }}
                      >
                        <CheckCircle2 size={52} style={{ color }} />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                      >
                        <h3 className="font-extrabold text-2xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                          ¡Pedido enviado!
                        </h3>
                        <p className="text-sm mt-1.5" style={{ color: "var(--ink-2)" }}>
                          El vendedor está revisando tu pedido
                        </p>

                        {/* Order number badge */}
                        <div
                          className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 mt-4"
                          style={{ background: "var(--bg)", border: "1.5px solid var(--line-2)" }}
                        >
                          <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Pedido</span>
                          <span className="font-extrabold text-lg" style={{ color: "var(--ink)" }}>
                            #{orderResult.order_number}
                          </span>
                        </div>

                        {orderResult.discount_cents > 0 && (
                          <p className="text-xs font-bold mt-3" style={{ color: "var(--success)" }}>
                            🎁 Se aplicó tu descuento: -{formatPrice(orderResult.discount_cents, currency, locale)}
                          </p>
                        )}

                        <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--ink-3)" }}>
                          Te contactarán al {form.buyer_phone} para coordinar la entrega
                        </p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="w-full mt-8 space-y-3"
                      >
                        {orderResult.whatsapp_link && (
                          <a
                            href={orderResult.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 font-bold text-sm text-white transition-all active:scale-[.98]"
                            style={{ background: "#25D366", boxShadow: "0 4px 16px rgba(37,211,102,.35)" }}
                          >
                            <MessageCircle size={18} />
                            Ver en WhatsApp
                          </a>
                        )}
                        <a
                          href={`/pedido/${orderResult.order_number}`}
                          className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-bold text-sm transition-all active:scale-[.98]"
                          style={{ background: `${color}12`, color, border: `1.5px solid ${color}25` }}
                        >
                          📍 Seguir mi pedido
                          <ChevronRight size={15} />
                        </a>
                        {user && (
                          <a
                            href="/mis-pedidos"
                            className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-bold text-sm transition-all active:scale-[.98]"
                            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                          >
                            Ver mis pedidos
                            <ChevronRight size={15} />
                          </a>
                        )}
                        <button
                          onClick={handleClose}
                          className="w-full rounded-2xl py-3.5 font-semibold text-sm transition-all"
                          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                        >
                          Seguir comprando
                        </button>
                      </motion.div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer CTA ── */}
            {step !== "success" && (
              <div
                className="flex-shrink-0 px-4 pt-3 pb-safe"
                style={{
                  borderTop: "1px solid var(--line)",
                  paddingBottom: "max(16px, env(safe-area-inset-bottom))",
                }}
              >
                {step === "cart" && (
                  <>
                    {belowMin && items.length > 0 && (
                      <p className="text-xs text-center mb-2 font-medium" style={{ color: "var(--warn)" }}>
                        Agrega <strong>{formatPrice(minOrder - total, currency, locale)}</strong> más para el pedido mínimo
                      </p>
                    )}
                    <button
                      onClick={() => {
                        if (user?.email && !form.buyer_email) setForm((f) => ({ ...f, buyer_email: user.email }));
                        go("info");
                      }}
                      disabled={items.length === 0 || belowMin}
                      className="w-full flex items-center justify-between rounded-2xl px-5 py-4 font-bold text-white text-sm transition-all active:scale-[.98] disabled:opacity-40"
                      style={{ background: color, boxShadow: items.length > 0 ? `0 4px 16px ${color}40` : "none" }}
                    >
                      <span>Continuar</span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold">{formatPrice(total, currency, locale)}</span>
                        <ChevronRight size={18} />
                      </div>
                    </button>
                  </>
                )}

                {step === "info" && (
                  <button
                    onClick={() => {
                      if (!validateInfo()) return;
                      if (paymentOptions.length === 1 && !form.payment_method) {
                        setForm((f) => ({ ...f, payment_method: paymentOptions[0].value }));
                      }
                      go("verify");
                    }}
                    className="w-full flex items-center justify-between rounded-2xl px-5 py-4 font-bold text-white text-sm transition-all active:scale-[.98]"
                    style={{ background: color, boxShadow: `0 4px 16px ${color}40` }}
                  >
                    <span>Elegir método de pago</span>
                    <ChevronRight size={18} />
                  </button>
                )}

                {step === "payment" && (
                  <button
                    onClick={placeOrder}
                    disabled={loading || !form.payment_method}
                    className="w-full flex items-center justify-between rounded-2xl px-5 py-4 font-bold text-white text-sm transition-all active:scale-[.98] disabled:opacity-50"
                    style={{ background: color, boxShadow: form.payment_method ? `0 4px 16px ${color}40` : "none" }}
                  >
                    <span>{loading ? "Procesando…" : "Confirmar pedido"}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold">{formatPrice(displayTotal, currency, locale)}</span>
                      <ChevronRight size={18} />
                    </div>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
