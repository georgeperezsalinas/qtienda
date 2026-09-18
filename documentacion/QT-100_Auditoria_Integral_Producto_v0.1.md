QT-100
AUDITORÍA INTEGRAL DE PRODUCTO QTienda

Versión 0.2 — Documento para revisión

| Campo | Valor |
| --- | --- |
| Producto | QTiendashop / QTienda |
| Dominio | qtienda.shop |
| Fecha | 04/09/2026 |
| Estado | Auditoría ejecutada — pendiente de cierre documental |
| Documento rector | QTienda Documento Maestro v0.2 |

## Control de versiones

| Versión | Fecha | Estado | Descripción |
| --- | --- | --- | --- |
| 0.1 | 30/07/2026 | Base | Auditoría UX y Optimización de Conversión (CRO). |
| 0.2 | 04/09/2026 | Para revisión | Ampliación a auditoría integral funcional, técnica y de seguridad, conservando los hallazgos UX/CRO originales. |

## 1. Objetivo

Evaluar el estado real de QTienda frente a la visión consolidada en el Documento Maestro v0.2, revisando producto, arquitectura, seguridad, experiencia, conversión y preparación para continuar hacia producción. Esta auditoría no constituye una certificación formal de seguridad ni sustituye una prueba de penetración profesional.

## 2. Alcance

- Funcionalidades actualmente identificables.
- Arquitectura backend, frontend, persistencia y principales entidades.
- Autenticación, autorización y separación de roles.
- Aislamiento multi-tenant mediante store_id.
- Productos, variantes, imágenes, pedidos, cupones y checkout.
- Delivery, evidencia de entrega y pago contra entrega.
- Uploads y almacenamiento.
- UX/CRO: landing, registro, creación de tienda, panel, tienda pública y embudo.
- Hallazgos, riesgos residuales y backlog de correcciones.
Los resultados se basan en el documento QT-100 UX/CRO existente y en la revisión del código y resultados de comandos proporcionados durante la auditoría. Los puntos no comprobados funcionalmente se mantienen como pendientes.

## 3. Resumen ejecutivo

QTienda presenta una base técnica consistente para continuar hacia una etapa de lanzamiento controlado. La revisión encontró controles explícitos de autenticación y autorización, separación de roles, asociación de entidades principales con store_id y validaciones relevantes en productos, pedidos, delivery y uploads.

No se identificó durante la revisión una vulnerabilidad crítica demostrada de acceso cruzado entre tiendas, escalamiento de privilegios o manipulación crítica del checkout. Esta conclusión se limita a las superficies revisadas y no implica invulnerabilidad.

El trabajo pendiente es principalmente de hardening y validación reproducible: cerrar los elementos P0, ejecutar pruebas negativas A/B y convertir los hallazgos en un backlog técnico controlado.

## 4. Estado funcional observado

| Área | Estado | Observación |
| --- | --- | --- |
| Registro / autenticación | 🟢 | Registro, registro de comprador, login y recuperación. |
| Roles | 🟢 | admin, vendor y delivery con dependencias diferenciadas. |
| Productos | 🟢 | CRUD, categorías, límites por plan, slug, imágenes y variantes. |
| Catálogo público | 🟢 | Rutas públicas de tiendas y productos. |
| Pedidos | 🟢 | Creación, consulta, estados y asignación. |
| Checkout | 🟢 | Flujo de servidor y controles de negocio revisados. |
| Cupones | 🟢 | Validación y gestión por tienda. |
| Delivery | 🟢 | Estados, pedidos y evidencia fotográfica. |
| Uploads | 🟢 | Validación de archivo, tamaño, imagen y almacenamiento. |
| Servicios / citas | 🟡 | Incluidos en el alcance estratégico; madurez integral no demostrada en esta ronda. |
| Mall QTienda | 🟡 | Componente estratégico; auditoría funcional exhaustiva pendiente. |
| SEO / Analytics / Growth | 🟡 | Frentes identificados; requieren auditorías específicas. |

## 5. Arquitectura técnica observada

- Backend con FastAPI y SQLAlchemy.
- Frontend React/TypeScript/Vite/Tailwind en las áreas revisadas.
- PostgreSQL como persistencia.
- Infraestructura contenerizada y almacenamiento compatible con R2/S3 en componentes revisados.
- API organizada por endpoints de autenticación, productos, pedidos, cupones, delivery, uploads y funciones públicas.
La documentación técnica debe continuar basándose en la implementación real y distinguir claramente capacidades actuales de capacidades futuras.

## 6. Seguridad y aislamiento multi-tenant

### 6.1 Autenticación y autorización

get_current_user() valida el token de acceso, recupera el usuario y comprueba que esté activo y no eliminado. require_role() compara el rol efectivo con los roles permitidos.

| Control | Resultado |
| --- | --- |
| require_admin | 🟢 Solo admin |
| require_vendor | 🟢 admin + vendor |
| require_delivery | 🟢 Solo delivery |
| Usuario inactivo/eliminado | 🟢 Rechazado |
| Token inválido/no access | 🟢 Rechazado |

### 6.2 Aislamiento por tienda

Las entidades principales revisadas incluyen store_id o un vínculo equivalente. En products.py se observa repetidamente la condición Product.store_id == store.id antes de consultar o modificar recursos.

- Productos y categorías: validación por tienda.
- Pedidos: asociados a store_id.
- Cupones: asociados a store_id.
- Delivery: delivery_store_id asociado a stores.id.
- Imágenes y variantes: alcanzables a través del producto propietario.
- Cambios de estado: registrados mediante AuditLog con contexto de tienda.
## 7. Productos, variantes e imágenes

La gestión de productos presenta controles de propiedad antes de consultar, modificar, eliminar, duplicar o gestionar imágenes y variantes. El límite de productos se resuelve desde el plan vigente y contempla el bono de referidos cuando corresponde.

Las imágenes requieren URL y permiten definir imagen principal. La eliminación comprueba producto, imagen y tienda.

## 8. Pedidos, checkout y pagos

El flujo revisado mantiene la tienda como contexto del pedido y el backend participa en la determinación de importes. La generación de números de pedido utiliza una función PostgreSQL.

Se mantiene como hardening pendiente la validación de payment_collected para asegurar que el marcado de pago cobrado solo sea válido cuando el método y las reglas de negocio correspondan a contra entrega. Se clasifica como 🟡, no como vulnerabilidad crítica demostrada.

## 9. Delivery

El módulo delivery presenta separación entre gestión de repartidores por el vendor y operaciones del repartidor. Las transiciones revisadas son preparing → on_the_way y on_the_way → delivered.

- El repartidor debe tener delivery_store_id.
- El pedido debe pertenecer a la tienda asignada.
- No se permiten transiciones fuera de DELIVERY_TRANSITIONS.
- Para delivered se exige foto de entrega.
- La evidencia puede incluir fecha y coordenadas.
- El cambio se registra mediante AuditLog.
- El marcado de pago requiere el hardening indicado en la sección 8.

## 10. Uploads

- Tipos permitidos para evidencia de delivery: JPEG, PNG y WebP, tambien PDF para productos digitales
- Límite de evidencia de delivery: 10 MB.
- En uploads generales se observa validación de imagen, redimensionamiento y eliminación de metadata.
- Nombres generados mediante UUID.
- Separación de rutas/objetos por tipo de imagen.
- Existe fallback de R2 a almacenamiento local ante error de R2.
El fallback R2 → local se clasifica como 🟡 hardening operativo. Debe quedar explícita la política de producción, observabilidad y comportamiento esperado.

## 11. UX y CRO

La versión base de QT-100 identificó oportunidades centradas en confianza, demostración de valor y adquisición. Esos hallazgos se conservan.

| Área | Recomendaciones | Prioridad |
| --- | --- | --- |
| Landing | CTA, beneficios, casos, FAQ, confianza | Alta |
| Registro | Menos fricción, progreso, confirmación, ayuda | Media |
| Creación de tienda | Asistente, plantillas, datos de ejemplo, checklist | Alta |
| Panel | Tareas, progreso, accesos rápidos, recomendaciones | Media |
| Tienda pública | Velocidad, SEO, opiniones, destacados, compartir | Alta |
| Confianza | Tienda demo, testimonios, video | Alta |

El embudo base es: Visita → Registro → Tienda creada → Primer producto → Primer pedido → Cliente recurrente. Debe medirse rebote, tiempo de registro, abandono del onboarding, tiendas activas y tiempo hasta primer producto y primer pedido.

## 12. Hallazgos consolidados

| ID | Hallazgo | Severidad | Acción |
| --- | --- | --- | --- |
| SEC-001 | payment_collected requiere endurecimiento según método de pago | 🟡 Media | Validar contra entrega y agregar prueba. |
| OPS-001 | Fallback R2 → local ante error | 🟡 Media | Definir política, observabilidad y prueba. |
| UX-001 | Reforzar prueba social y demostración de valor | 🟡 Alta comercial | Tienda demo, testimonios y video. |
| UX-002 | Reducir fricción del onboarding | 🟡 Media | Asistente/checklist y medición. |
| SEO-001 | Auditoría SEO específica pendiente | 🟡 Alta | Ejecutar QT-101. |
| TEST-001 | Pruebas negativas A/B no ejecutadas en esta ronda | 🟡 Alta | Ejecutar con dos tiendas de prueba. |

## 13. Pruebas de cierre recomendadas

- Tienda A intentando acceder a producto, variante, pedido y cupón de tienda B → 403/404.
- Tienda B intentando modificar recursos de tienda A → 403/404.
- Delivery A intentando operar sobre pedido B → 403/404.
- Vendor intentando endpoint exclusivo de admin → 403.
- Delivery intentando endpoint de vendor → 403.
- Buyer intentando endpoint de vendor → 403.
- Cliente intentando alterar precio, subtotal, descuento o total → el servidor debe reconstruir/validar.
- Intento de cargar tipos/tamaños no permitidos → rechazo.
- Pruebas de regresión posteriores a cada corrección.
## 14. Backlog técnico de cierre

| ID | Prioridad | Acción | Criterio de aceptación |
| --- | --- | --- | --- |
| SEC-001 | P0 | Endurecer payment_collected | Solo válido cuando método y reglas COD lo permitan. |
| TEST-001 | P0 | Pruebas A/B multi-tenant | Todos los accesos cruzados son rechazados. |
| TEST-002 | P0 | Prueba de manipulación económica | El total válido depende del servidor. |
| OPS-001 | P1 | Revisar fallback R2/local | Comportamiento documentado, observable y probado. |
| UX-001 | P1 | Tienda demo + prueba social | Visible y medible. |
| UX-002 | P1 | Optimizar onboarding | Medir registro → tienda → primer producto. |
| SEO-001 | P1 | Crear QT-101 | Auditoría SEO y backlog. |

## 15. Dictamen

DICTAMEN: 🟢 APTO PARA CONTINUAR HACIA PRODUCCIÓN CONTROLADA, condicionado al cierre de los elementos P0 y a la ejecución de las pruebas funcionales negativas de aislamiento y manipulación económica.

La revisión no demostró vulnerabilidades críticas en las superficies auditadas. Este dictamen no constituye certificación formal de seguridad ni sustituye una prueba de penetración profesional.

## 16. Relación con el Documento Maestro

QT-100 no modifica el Documento Maestro v0.2. Su función es aportar evidencia sobre el estado real del producto. El Documento Maestro v0.2 estableció que QT-100 debía verificar la realidad del producto antes de continuar ampliando la visión. fileciteturn97file5

## 17. Secuencia posterior

| Paso | Actividad | Estado |
| --- | --- | --- |
| 1 | Revisión y aprobación de QT-100 | Ahora |
| 2 | Backlog técnico de correcciones | Siguiente |
| 3 | Correcciones P0 | Pendiente |
| 4 | Pruebas de regresión / seguridad funcional | Pendiente |
| 5 | QT-101 Auditoría SEO | Posterior |
| 6 | Lanzamiento / Growth | Después del cierre técnico |

## 18. Nota de trazabilidad

La versión 0.1 de QT-100 fue concebida como auditoría UX y CRO, con énfasis en confianza, demostración de valor, onboarding y conversión. La versión 0.2 conserva esos hallazgos y amplía el documento para incorporar la auditoría funcional, técnica y de seguridad realizada posteriormente. Se mantiene el origen y se agrega la evidencia acumulada.
