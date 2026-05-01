"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag, TrendingUp, Clock, CheckCircle2,
  Store, ExternalLink, Plus, ArrowRight,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface Stats {
  total_orders: number;
  pending: number;
  delivered: number;
  cancelled: number;
  revenue_cents: number;
}

interface StoreData {
  id: string;
  slug: string;
  name: string;
  status: string;
  store_url: string;
  primary_color: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [store, setStore] = useState<StoreData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    apiClient
      .get("/stores/me")
      .then(({ data }) => setStore(data))
      .catch(() => setStore(null))
      .finally(() => setLoadingStore(false));
  }, []);

  useEffect(() => {
    if (!store) return;
    apiClient
      .get("/orders/stats/summary")
      .then(({ data }) => setStats(data.this_month))
      .finally(() => setLoadingStats(false));
  }, [store]);

  const firstName = user?.full_name?.split(" ")[0] || "vendedor";

  if (loadingStore) {
    return (
      <div className="p-5 space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-5 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-gray-900">
          Hola, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen de tu negocio este mes</p>
      </div>

      {/* No store yet */}
      {!store ? (
        <div className="card p-6 text-center space-y-4 border-2 border-dashed border-brand-200 bg-brand-50/30">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto">
            <Store size={28} className="text-brand-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-gray-900">Crea tu tienda</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configura tu tienda online y recibe pedidos desde TikTok
            </p>
          </div>
          <Link href="/dashboard/configuracion" className="btn-primary w-full bg-brand-600">
            <Plus size={16} />
            Crear tienda ahora
          </Link>
        </div>
      ) : (
        <>
          {/* Store card */}
          <div className="card p-4 mb-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: store.primary_color }}
            >
              {store.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{store.name}</p>
              <p className="text-xs text-gray-400 truncate">qtienda.shop/tienda/{store.slug}</p>
            </div>
            <a
              href={`/tienda/${store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={16} className="text-gray-500" />
            </a>
          </div>

          {/* KPI cards */}
          {loadingStats ? (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-2xl" />
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <ShoppingBag size={14} className="text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-500">Pedidos</span>
                </div>
                <p className="font-display font-bold text-2xl text-gray-900">{stats.total_orders}</p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                    <TrendingUp size={14} className="text-green-600" />
                  </div>
                  <span className="text-xs text-gray-500">Ingresos</span>
                </div>
                <p className="font-display font-bold text-xl text-gray-900">
                  {formatPrice(stats.revenue_cents)}
                </p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center">
                    <Clock size={14} className="text-yellow-600" />
                  </div>
                  <span className="text-xs text-gray-500">Pendientes</span>
                </div>
                <p className="font-display font-bold text-2xl text-gray-900">{stats.pending}</p>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  </div>
                  <span className="text-xs text-gray-500">Entregados</span>
                </div>
                <p className="font-display font-bold text-2xl text-gray-900">{stats.delivered}</p>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="space-y-2">
            {stats?.pending ? (
              <Link
                href="/dashboard/pedidos?status=pending"
                className="card p-4 flex items-center justify-between hover:border-brand-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-yellow-50 flex items-center justify-center">
                    <Clock size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {stats.pending} pedido{stats.pending !== 1 ? "s" : ""} pendiente{stats.pending !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-gray-500">Requieren confirmación</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </Link>
            ) : null}

            <Link
              href="/dashboard/productos"
              className="card p-4 flex items-center justify-between hover:border-brand-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Plus size={16} className="text-brand-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Agregar producto</p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
