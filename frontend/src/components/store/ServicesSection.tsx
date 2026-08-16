"use client";

// Sección "Servicios" de la tienda pública — solo se muestra si la tienda
// tiene servicios activos. Distinta de la grilla de productos: acá no se
// agrega al carrito, se reserva un horario.

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarClock, Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import BookingModal from "./BookingModal";
import MyAppointmentsModal from "./MyAppointmentsModal";

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price_cents?: number | null;
  image_url?: string | null;
}

export default function ServicesSection({
  storeSlug, storeAddress, accentColor, storeCurrency, storeLocale,
}: {
  storeSlug: string;
  storeAddress?: string | null;
  accentColor: string;
  storeCurrency?: string;
  storeLocale?: string;
}) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [booking, setBooking] = useState<Service | null>(null);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [showMyAppointments, setShowMyAppointments] = useState(false);

  useEffect(() => {
    apiClient
      .get(`/public/store/${storeSlug}/services`)
      .then(({ data }) => setServices(data))
      .catch(() => setServices([]));
  }, [storeSlug]);

  // Se lee después de montar (localStorage no existe en el server) — marca
  // qué servicios este mismo comprador ya reservó, para no dejarlo pedir de
  // nuevo sin darse cuenta y así no toparse con el límite anti-spam del backend.
  useEffect(() => {
    if (!services) return;
    const booked = new Set(
      services.filter((s) => localStorage.getItem(`qtienda_booked_${storeSlug}_${s.id}`) === "1").map((s) => s.id)
    );
    setBookedIds(booked);
  }, [services, storeSlug]);

  function refreshBooked() {
    if (!services) return;
    setBookedIds(new Set(
      services.filter((s) => localStorage.getItem(`qtienda_booked_${storeSlug}_${s.id}`) === "1").map((s) => s.id)
    ));
  }

  if (!services || services.length === 0) return null;

  return (
    <section className="px-4 lg:px-0 pt-4 pb-2" id="tienda-servicios">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: accentColor }}>
          <CalendarClock size={13} color="white" />
        </div>
        <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: accentColor }}>
          Servicios — reserva tu cita
        </span>
        <button
          onClick={() => setShowMyAppointments(true)}
          className="ml-auto text-xs font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--ink-3)" }}
        >
          Ver mis citas
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => setBooking(s)}
            className="flex items-center gap-3 rounded-2xl p-3 text-left transition-all active:scale-[.98]"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--line)" }}
          >
            {s.image_url ? (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                <Image src={s.image_url} alt={s.name} fill className="object-cover" sizes="56px" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}14` }}>
                <CalendarClock size={20} style={{ color: accentColor }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{s.name}</p>
              <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                <Clock size={11} /> {s.duration_minutes} min
                {s.price_cents != null && <> · {formatPrice(s.price_cents, storeCurrency, storeLocale)}</>}
              </p>
            </div>
            {bookedIds.has(s.id) ? (
              <span
                className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: "var(--success-soft)", color: "var(--success)" }}
              >
                ✓ Ya reservaste
              </span>
            ) : (
              <span
                className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full text-white"
                style={{ background: accentColor }}
              >
                Reservar
              </span>
            )}
          </button>
        ))}
      </div>

      {booking && (
        <BookingModal
          service={booking}
          storeSlug={storeSlug}
          storeAddress={storeAddress}
          storeCurrency={storeCurrency}
          storeLocale={storeLocale}
          accentColor={accentColor}
          onClose={() => { setBooking(null); refreshBooked(); }}
        />
      )}

      {showMyAppointments && (
        <MyAppointmentsModal
          storeSlug={storeSlug}
          accentColor={accentColor}
          onClose={() => setShowMyAppointments(false)}
        />
      )}
    </section>
  );
}
