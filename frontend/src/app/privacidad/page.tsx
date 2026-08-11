import Link from "next/link";
import { Metadata } from "next";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import Logo from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Cómo qtienda.shop recopila, usa y protege tus datos.",
  alternates: { canonical: "/privacidad" },
  robots: { index: true, follow: true },
};

function S({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-bold text-lg mb-2.5" style={{ color: "var(--ink)" }}>
        {n}. {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-dvh" style={{ background: "var(--surface-2)" }}>
      <header
        className="sticky top-0 z-10"
        style={{
          background: "color-mix(in srgb, var(--surface) 95%, transparent)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-5" style={{ paddingTop: "max(14px, env(safe-area-inset-top))", paddingBottom: 14 }}>
          <Link href="/" className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>
            <ChevronLeft size={18} /> Inicio
          </Link>
          <div className="flex-1" />
          <Logo size="sm" variant="brand" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="font-display font-extrabold text-2xl mb-1" style={{ color: "var(--ink)" }}>
          Política de Privacidad
        </h1>
        <p className="text-xs mb-6" style={{ color: "var(--ink-4)" }}>
          Última actualización: agosto de 2026 · Aplica a qtienda.shop y todas las tiendas creadas en la plataforma
        </p>

        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-8"
          style={{ background: "var(--warn-soft)", border: "1.5px solid var(--line-2)" }}
        >
          <AlertTriangle size={18} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>
            <strong>Borrador para revisión legal.</strong> Este documento describe de forma honesta los datos
            que la plataforma maneja hoy, pero antes de publicarlo como definitivo debe revisarlo un abogado
            para confirmar que cumple con la normativa de protección de datos de cada país donde operen tus
            tiendas (por ejemplo, la Ley N.° 29733 en Perú y equivalentes en otros países de la región).
          </p>
        </div>

        <S n={1} title="Quién trata tus datos">
          <p>
            qtienda.shop (&ldquo;qtienda&rdquo;, &ldquo;nosotros&rdquo;) es responsable del tratamiento de los
            datos personales que recopila directamente para operar la plataforma. Cuando compras en una
            tienda específica, el vendedor de esa tienda también trata tus datos de pedido como responsable
            independiente, para poder atenderlo y entregártelo — ver la sección 4.
          </p>
        </S>

        <S n={2} title="Qué datos recopilamos">
          <p><strong>Si creas una cuenta</strong> (vendedor, comprador o repartidor): nombre completo, correo
            electrónico, teléfono, y una contraseña que almacenamos cifrada (nunca en texto plano). Si inicias
            sesión con Google o Facebook, recibimos tu nombre, correo y foto de perfil desde esos servicios.</p>
          <p><strong>Si haces un pedido como comprador</strong>: nombre, teléfono, correo (opcional), dirección
            de entrega, documento de identidad cuando el vendedor lo solicita, y el método de pago que
            elegiste. Estos datos los ve el vendedor de esa tienda para poder atender tu pedido.</p>
          <p><strong>Si eres vendedor</strong>: además de tu cuenta, la información de tu tienda (nombre,
            logo, descripción, ciudad) y los datos de cobro que decidas mostrar a tus compradores (por
            ejemplo, tu número de Yape/Plin o cuenta bancaria).</p>
          <p><strong>Si eres repartidor</strong>: nombre, teléfono, tipo y placa de vehículo, y — solo al
            confirmar una entrega — tu ubicación GPS en ese momento y una foto como comprobante de entrega.</p>
          <p><strong>Uso de la plataforma</strong>: qué páginas y productos visitas dentro de una tienda,
            si agregaste algo al carrito, y datos técnicos básicos (dispositivo, referencia de origen). Esto
            se guarda de forma agregada para generar las estadísticas que ve cada vendedor, no como un perfil
            de navegación fuera de qtienda.</p>
          <p><strong>Reseñas</strong>: la calificación y el comentario que dejas sobre un pedido ya entregado
            se asocian a tu cuenta, pero se muestran públicamente con tu nombre parcialmente oculto (ej. &ldquo;María G.&rdquo;).</p>
        </S>

        <S n={3} title="Para qué usamos tus datos">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Crear y administrar tu cuenta, y darte acceso a las funciones de la plataforma según tu rol.</li>
            <li>Procesar y dar seguimiento a tus pedidos, y ponerte en contacto con la tienda correspondiente.</li>
            <li>Enviarte notificaciones sobre tu cuenta o tus pedidos (correo y/o notificaciones push, si las activaste).</li>
            <li>Prevenir fraude, abuso o incumplimientos de nuestros Términos de Uso.</li>
            <li>Generar estadísticas internas para cada vendedor sobre el desempeño de su tienda.</li>
            <li>Cumplir obligaciones legales o responder a requerimientos de autoridades competentes.</li>
          </ul>
        </S>

        <S n={4} title="Con quién compartimos tus datos">
          <p>
            <strong>Con el vendedor de la tienda donde compras:</strong> tus datos de pedido (nombre, contacto,
            dirección, lo que compraste) se comparten con ese vendedor específico — es indispensable para que
            pueda atenderte, y él pasa a ser responsable de esos datos frente a ti también.
          </p>
          <p>
            <strong>Con proveedores que operan la plataforma por nosotros:</strong> hosting y servidores,
            envío de correos transaccionales, almacenamiento de imágenes, y — cuando el pago es con tarjeta —
            la pasarela de pago que procesa esa transacción. Estos proveedores solo acceden a los datos
            necesarios para prestar su servicio.
          </p>
          <p>
            <strong>Con herramientas de marketing que el propio vendedor active en su tienda</strong> (por
            ejemplo, TikTok Pixel, Meta Pixel o Google Analytics): si un vendedor las activa, tu navegación
            dentro de esa tienda puede registrarse también en esas plataformas, bajo sus propias políticas de
            privacidad — qtienda no controla ese tratamiento.
          </p>
          <p>
            No vendemos tus datos personales a terceros.
          </p>
        </S>

        <S n={5} title="Transferencias internacionales">
          <p>
            Algunos de nuestros proveedores de infraestructura operan servidores fuera de tu país de
            residencia. En esos casos, tomamos medidas razonables para que tus datos sigan protegidos con un
            nivel de seguridad equivalente al descrito en esta política.
          </p>
        </S>

        <S n={6} title="Cuánto tiempo conservamos tus datos">
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta o cierras tu tienda,
            conservamos los datos de pedidos ya realizados por el tiempo que exijan las normas contables o
            tributarias aplicables, y el resto de tus datos se elimina o anonimiza en un plazo razonable.
          </p>
        </S>

        <S n={7} title="Tus derechos">
          <p>
            Puedes solicitarnos acceder a tus datos, corregirlos si están desactualizados, o eliminarlos
            cuando no exista una obligación legal de conservarlos. También puedes actualizar la mayoría de tu
            información directamente desde tu cuenta. Para ejercer estos derechos, escríbenos a{" "}
            <a href="mailto:ventas@qtienda.shop" className="font-semibold" style={{ color: "var(--accent)" }}>
              ventas@qtienda.shop
            </a>.
          </p>
        </S>

        <S n={8} title="Seguridad">
          <p>
            Aplicamos medidas técnicas razonables para proteger tus datos (contraseñas cifradas, conexión
            segura HTTPS, control de acceso por rol). Ningún sistema es 100% infalible, pero trabajamos para
            mantener estos estándares actualizados.
          </p>
        </S>

        <S n={9} title="Menores de edad">
          <p>
            qtienda no está dirigido a menores de edad. Si detectamos que una cuenta fue creada por un menor
            sin la autorización correspondiente, podemos suspenderla.
          </p>
        </S>

        <S n={10} title="Cookies y almacenamiento local">
          <p>
            Usamos almacenamiento local del navegador (no cookies de terceros por nuestra parte) para
            recordar tu carrito de compras, tus favoritos y tu sesión iniciada. Un vendedor que active pixels
            de terceros en su tienda puede hacer que esos terceros instalen sus propias cookies — ver la
            sección 4.
          </p>
        </S>

        <S n={11} title="Cambios a esta política">
          <p>
            Podemos actualizar esta Política de Privacidad. Publicaremos la fecha de la última actualización
            en la parte superior de esta página; si el cambio es significativo, buscaremos notificarlo por un
            medio adicional.
          </p>
        </S>

        <S n={12} title="Contacto">
          <p>
            Para cualquier consulta sobre esta política o sobre tus datos, escríbenos a{" "}
            <a href="mailto:ventas@qtienda.shop" className="font-semibold" style={{ color: "var(--accent)" }}>
              ventas@qtienda.shop
            </a>.
          </p>
        </S>
      </main>
    </div>
  );
}
