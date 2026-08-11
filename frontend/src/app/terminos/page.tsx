import Link from "next/link";
import { Metadata } from "next";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import Logo from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Términos de Uso",
  description: "Términos y condiciones de uso de qtienda.shop.",
  alternates: { canonical: "/terminos" },
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

export default function TerminosPage() {
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
          Términos de Uso
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
            <strong>Borrador para revisión legal.</strong> Este documento fue redactado como punto de partida
            adaptado al funcionamiento real de qtienda, pero no reemplaza el asesoramiento de un abogado.
            Revísalo con uno antes de considerarlo vinculante, especialmente en lo referente a responsabilidad
            entre plataforma/vendedor/comprador y a las normas de protección al consumidor de cada país donde
            operen tus tiendas.
          </p>
        </div>

        <S n={1} title="Aceptación de estos términos">
          <p>
            Al crear una cuenta, una tienda, o realizar un pedido a través de qtienda.shop (&ldquo;qtienda&rdquo;,
            &ldquo;la plataforma&rdquo;, &ldquo;nosotros&rdquo;), aceptas estos Términos de Uso y nuestra{" "}
            <Link href="/privacidad" className="font-semibold" style={{ color: "var(--accent)" }}>
              Política de Privacidad
            </Link>
            . Si no estás de acuerdo, no debes usar la plataforma.
          </p>
        </S>

        <S n={2} title="Qué es qtienda">
          <p>
            qtienda es una plataforma tecnológica que permite a cualquier persona (&ldquo;vendedor&rdquo;) crear
            su propia tienda online en minutos, publicar productos y recibir pedidos, principalmente para
            vender a través de redes sociales como TikTok. qtienda provee el software, el hosting y las
            herramientas — <strong>no es dueña de las tiendas, no fabrica ni vende los productos publicados,
            y no es parte del contrato de compraventa</strong> entre el vendedor y el comprador.
          </p>
        </S>

        <S n={3} title="Cuentas y roles">
          <p>La plataforma tiene distintos tipos de cuenta:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Vendedor:</strong> crea y administra una tienda, publica productos y gestiona sus pedidos.</li>
            <li><strong>Comprador:</strong> realiza pedidos en las tiendas publicadas en la plataforma.</li>
            <li><strong>Repartidor:</strong> personal asignado por un vendedor para entregar sus pedidos.</li>
            <li><strong>Administrador:</strong> personal de qtienda que opera y da soporte a la plataforma.</li>
          </ul>
          <p>
            Eres responsable de la veracidad de los datos que registras, de mantener tu contraseña en
            secreto, y de toda actividad que ocurra en tu cuenta. Debes tener al menos 18 años, o la mayoría
            de edad legal en tu país, para crear una tienda como vendedor.
          </p>
        </S>

        <S n={4} title="Planes y pago por el uso de la plataforma">
          <p>
            qtienda ofrece un plan gratuito y planes pagos con más funciones o límites más altos (cantidad de
            productos, pedidos mensuales, etc.). Los precios y beneficios vigentes se muestran dentro del
            panel del vendedor al momento de elegir o cambiar de plan. Si tu suscripción vence sin renovarse,
            tu tienda puede pasar automáticamente al plan gratuito y quedar sujeta a sus límites, sin que esto
            elimine tus productos o pedidos existentes.
          </p>
        </S>

        <S n={5} title="La relación entre comprador y vendedor">
          <p>
            Cada tienda es operada de forma independiente por su vendedor. El vendedor es el único
            responsable de: la exactitud de las descripciones y precios de sus productos, el stock
            disponible, la calidad y legalidad de lo que vende, los plazos y la forma de entrega, y el
            cumplimiento de las leyes de protección al consumidor aplicables en su país.
          </p>
          <p>
            qtienda no garantiza la existencia, calidad, seguridad o legalidad de los productos publicados
            por los vendedores, ni la capacidad de un vendedor para completar una venta. Cualquier reclamo
            sobre un producto o pedido debe dirigirse primero al vendedor de esa tienda.
          </p>
        </S>

        <S n={6} title="Pagos entre comprador y vendedor">
          <p>
            Los métodos de pago (efectivo, Yape, Plin, transferencia bancaria, tarjeta u otros) son
            configurados y gestionados directamente por cada vendedor. Salvo que se indique expresamente lo
            contrario dentro de una tienda, <strong>qtienda no procesa, retiene ni garantiza estos pagos</strong> —
            el dinero se transfiere directamente entre comprador y vendedor por el medio que el vendedor haya
            habilitado. Cuando un pago se procesa con tarjeta a través de un proveedor externo integrado en la
            plataforma, ese proveedor tiene sus propios términos, que también aplican a esa transacción.
          </p>
        </S>

        <S n={7} title="Contenido que publicas">
          <p>
            Como vendedor, eres responsable de tener los derechos necesarios sobre las fotos, descripciones,
            logos y demás contenido que subas a tu tienda. Al publicarlo, le das a qtienda una licencia no
            exclusiva para almacenarlo, mostrarlo y distribuirlo como parte del funcionamiento normal de la
            plataforma (por ejemplo, al generar la vista previa de tu tienda para compartir en redes sociales).
          </p>
          <p>
            Como comprador, las reseñas y comentarios que dejes sobre un pedido deben corresponder a una
            experiencia real tuya. qtienda puede ocultar reseñas que incumplan esto o que contengan contenido
            abusivo, sin que eso te dé derecho a una compensación.
          </p>
        </S>

        <S n={8} title="Uso prohibido">
          <p>No está permitido usar qtienda para:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Vender productos o servicios ilegales en el país donde se realiza la venta.</li>
            <li>Suplantar a otra persona o negocio, o publicar información falsa sobre tu tienda.</li>
            <li>Enviar spam, o intentar recolectar datos de otros usuarios fuera de lo necesario para un pedido.</li>
            <li>Intentar vulnerar la seguridad de la plataforma o acceder a cuentas ajenas.</li>
            <li>Publicar reseñas falsas, propias o de terceros, con el fin de manipular la calificación de una tienda.</li>
          </ul>
          <p>
            qtienda puede suspender o cerrar una cuenta o tienda que incumpla estas reglas, con o sin previo
            aviso según la gravedad del caso.
          </p>
        </S>

        <S n={9} title="Pixels y herramientas de marketing de terceros">
          <p>
            Un vendedor puede activar en su propia tienda herramientas de medición de terceros (por ejemplo,
            TikTok Pixel, Meta Pixel o Google Analytics) para medir sus campañas de publicidad. Cuando un
            vendedor activa estas herramientas, tu navegación dentro de esa tienda específica puede ser
            registrada también por esos terceros, conforme a sus propias políticas de privacidad. qtienda no
            controla ni es responsable del uso que el vendedor o esos terceros hagan de esos datos.
          </p>
        </S>

        <S n={10} title="Propiedad intelectual de qtienda">
          <p>
            La marca qtienda, el software de la plataforma, su diseño y su código son propiedad de qtienda o
            de sus licenciantes. Estos términos no te otorgan ningún derecho sobre ellos más allá del uso
            normal de la plataforma para operar tu tienda o realizar tus compras.
          </p>
        </S>

        <S n={11} title="Disponibilidad del servicio">
          <p>
            Hacemos un esfuerzo razonable para que qtienda esté disponible de forma continua, pero no
            garantizamos un funcionamiento ininterrumpido o libre de errores. Podemos realizar mantenimientos,
            actualizaciones o cambios en las funciones disponibles en cualquier momento.
          </p>
        </S>

        <S n={12} title="Limitación de responsabilidad">
          <p>
            En la máxima medida permitida por la ley aplicable, qtienda no será responsable por daños
            indirectos, pérdida de ganancias, ni por disputas, incumplimientos o daños derivados de la
            relación entre un comprador y un vendedor. El uso de la plataforma es bajo tu propio riesgo.
          </p>
        </S>

        <S n={13} title="Suspensión y terminación">
          <p>
            Puedes dejar de usar qtienda y solicitar el cierre de tu cuenta en cualquier momento. Podemos
            suspender o cerrar cuentas que incumplan estos términos, que representen un riesgo para otros
            usuarios, o por inactividad prolongada conforme a nuestras políticas internas.
          </p>
        </S>

        <S n={14} title="Cambios a estos términos">
          <p>
            Podemos actualizar estos Términos de Uso para reflejar cambios en la plataforma o en la
            normativa aplicable. Publicaremos la fecha de la última actualización en la parte superior de
            esta página; si los cambios son significativos, buscaremos notificarlos por un medio adicional.
          </p>
        </S>

        <S n={15} title="Ley aplicable">
          <p>
            Estos términos se rigen por las leyes de la República del Perú, sin perjuicio de los derechos
            que la normativa de protección al consumidor de tu país de residencia pueda otorgarte de forma
            imperativa.
          </p>
        </S>

        <S n={16} title="Contacto">
          <p>
            Si tienes preguntas sobre estos términos, escríbenos a{" "}
            <a href="mailto:ventas@qtienda.shop" className="font-semibold" style={{ color: "var(--accent)" }}>
              ventas@qtienda.shop
            </a>.
          </p>
        </S>
      </main>
    </div>
  );
}
