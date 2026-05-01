import Link from "next/link";
import { ArrowRight, Store, ShoppingBag, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex flex-col">
      <header className="px-5 py-4 flex items-center justify-between">
        <span className="font-display font-bold text-xl text-brand-600">qtienda</span>
        <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-brand-600">
          Iniciar sesión
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 text-center py-16">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Shopify para vendedores de TikTok
        </div>

        <h1 className="font-display text-4xl font-bold text-gray-900 leading-tight mb-4 max-w-sm">
          Tu tienda online en{" "}
          <span className="text-brand-600">2 minutos</span>
        </h1>

        <p className="text-gray-500 text-base mb-8 max-w-xs">
          Crea tu link personalizado, publícalo en TikTok y recibe pedidos directo a tu WhatsApp.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/auth/register" className="btn-primary bg-brand-600 text-base py-4">
            Crear tienda gratis <ArrowRight size={18} />
          </Link>
          <Link href="/auth/login" className="btn-secondary text-base py-4">
            Ya tengo cuenta
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-12 w-full max-w-xs text-center">
          {[
            { icon: Store, label: "Tienda propia" },
            { icon: ShoppingBag, label: "Pedidos fáciles" },
            { icon: Zap, label: "30 segundos" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <Icon size={18} className="text-brand-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-5 py-4 text-center text-xs text-gray-400">
        © 2025 qtienda.shop
      </footer>
    </div>
  );
}
