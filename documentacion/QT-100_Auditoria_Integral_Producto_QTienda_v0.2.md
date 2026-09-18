# QT-100

# AUDITORÍA INTEGRAL DE PRODUCTO QTienda

**Versión 0.2 --- Documento para revisión**

  Campo              Valor
  ------------------ --------------------------------------------------------
  Producto           QTiendashop / QTienda
  Dominio            qtienda.shop
  Fecha              07/09/2026
  Estado             Auditoría ejecutada --- pendiente de cierre documental
  Documento rector   QTienda Documento Maestro v0.2

## Control de versiones

  -----------------------------------------------------------------------
  Versión           Fecha             Estado            Descripción
  ----------------- ----------------- ----------------- -----------------
  0.1               30/07/2026        Base              Auditoría UX y
                                                        Optimización de
                                                        Conversión (CRO).

  0.2               07/09/2026        Para revisión     Ampliación a
                                                        auditoría
                                                        integral
                                                        funcional,
                                                        técnica y de
                                                        seguridad,
                                                        incorporando la
                                                        venta de
                                                        productos
                                                        digitales con
                                                        almacenamiento
                                                        privado y
                                                        descarga
                                                        condicionada a
                                                        pago confirmado.
  -----------------------------------------------------------------------

## 1. Objetivo

Evaluar el estado real de QTienda frente a la visión consolidada en el
Documento Maestro v0.2, revisando producto, arquitectura, seguridad,
experiencia, conversión y preparación para continuar hacia producción.
Esta auditoría no constituye una certificación formal de seguridad ni
sustituye una prueba de penetración profesional.

## 2. Alcance

-   Funcionalidades actualmente identificables.
-   Arquitectura backend, frontend, persistencia y principales
    entidades.
-   Autenticación, autorización y separación de roles.
-   Aislamiento multi-tenant mediante `store_id`.
-   Productos, variantes, imágenes, pedidos, cupones y checkout.
-   Delivery, evidencia de entrega y pago contra entrega.
-   Productos digitales, almacenamiento privado, confirmación de pago y
    habilitación de descarga.
-   Uploads y almacenamiento.
-   UX/CRO: landing, registro, creación de tienda, panel, tienda pública
    y embudo.
-   Hallazgos, riesgos residuales y backlog de correcciones.

Los resultados se basan en el documento QT-100 UX/CRO existente y en la
revisión del código y resultados de comandos proporcionados durante la
auditoría. Los puntos no comprobados funcionalmente se mantienen como
pendientes.

## 3. Resumen ejecutivo

QTienda presenta una base técnica consistente para continuar hacia una
etapa de lanzamiento controlado. La revisión encontró controles
explícitos de autenticación y autorización, separación de roles,
asociación de entidades principales con `store_id` y validaciones
relevantes en productos, pedidos, delivery y uploads.

No se identificó durante la revisión una vulnerabilidad crítica
demostrada de acceso cruzado entre tiendas, escalamiento de privilegios
o manipulación crítica del checkout. Esta conclusión se limita a las
superficies revisadas y no implica invulnerabilidad.

La incorporación de productos digitales agrega una superficie de
seguridad adicional: el archivo vendido debe permanecer privado y el
derecho de descarga debe depender de una compra válida y de la
confirmación del pago. Este flujo debe considerarse parte del cierre de
QT-100 y no se debe dar por validado únicamente por la existencia de la
funcionalidad.

## 4. Estado funcional observado

  -----------------------------------------------------------------------
  Área                    Estado                  Observación
  ----------------------- ----------------------- -----------------------
  Registro /              🟢                      Registro, registro de
  autenticación                                   comprador, login y
                                                  recuperación.

  Roles                   🟢                      admin, vendor y
                                                  delivery con
                                                  dependencias
                                                  diferenciadas.

  Productos               🟢                      CRUD, categorías,
                                                  límites por plan, slug,
                                                  imágenes y variantes.

  Catálogo público        🟢                      Rutas públicas de
                                                  tiendas y productos.

  Pedidos                 🟢                      Creación, consulta,
                                                  estados y asignación.

  Checkout                🟢                      Flujo de servidor y
                                                  controles de negocio
                                                  revisados.

  Cupones                 🟢                      Validación y gestión
                                                  por tienda.

  Delivery                🟢                      Estados, pedidos y
                                                  evidencia fotográfica.

  Uploads                 🟢                      Validación de archivo,
                                                  tamaño, imagen y
                                                  almacenamiento.

  Productos digitales     🟡                      Nueva capacidad;
                                                  requiere validación
                                                  específica de
                                                  privacidad,
                                                  autorización de
                                                  descarga y dependencia
                                                  del pago confirmado.

  Servicios / citas       🟡                      Incluidos en el alcance
                                                  estratégico; madurez
                                                  integral no demostrada
                                                  en esta ronda.

  Mall QTienda            🟡                      Componente estratégico;
                                                  auditoría funcional
                                                  exhaustiva pendiente.

  SEO / Analytics /       🟡                      Frentes identificados;
  Growth                                          requieren auditorías
                                                  específicas.
  -----------------------------------------------------------------------

## 5. Arquitectura técnica observada

-   Backend con FastAPI y SQLAlchemy.
-   Frontend React/TypeScript/Vite/Tailwind en las áreas revisadas.
-   PostgreSQL como persistencia.
-   Infraestructura contenerizada y almacenamiento compatible con R2/S3
    en componentes revisados.
-   API organizada por endpoints de autenticación, productos, pedidos,
    cupones, delivery, uploads y funciones públicas.

La documentación técnica debe continuar basándose en la implementación
real y distinguir claramente capacidades actuales de capacidades
futuras.

## 6. Seguridad y aislamiento multi-tenant

### 6.1 Autenticación y autorización

`get_current_user()` valida el token de acceso, recupera el usuario y
comprueba que esté activo y no eliminado. `require_role()` compara el
rol efectivo con los roles permitidos.

  Control                      Resultado
  ---------------------------- -------------------
  `require_admin`              🟢 Solo admin
  `require_vendor`             🟢 admin + vendor
  `require_delivery`           🟢 Solo delivery
  Usuario inactivo/eliminado   🟢 Rechazado
  Token inválido/no access     🟢 Rechazado

### 6.2 Aislamiento por tienda

Las entidades principales revisadas incluyen `store_id` o un vínculo
equivalente. En `products.py` se observa repetidamente la condición
`Product.store_id == store.id` antes de consultar o modificar recursos.

-   Productos y categorías: validación por tienda.
-   Pedidos: asociados a `store_id`.
-   Cupones: asociados a `store_id`.
-   Delivery: `delivery_store_id` asociado a `stores.id`.
-   Imágenes y variantes: alcanzables a través del producto propietario.
-   Cambios de estado: registrados mediante `AuditLog` con contexto de
    tienda.

## 7. Productos, variantes e imágenes

La gestión de productos presenta controles de propiedad antes de
consultar, modificar, eliminar, duplicar o gestionar imágenes y
variantes. El límite de productos se resuelve desde el plan vigente y
contempla el bono de referidos cuando corresponde.

Las imágenes requieren URL y permiten definir imagen principal. La
eliminación comprueba producto, imagen y tienda.

## 8. Pedidos, checkout y pagos

El flujo revisado mantiene la tienda como contexto del pedido y el
backend participa en la determinación de importes. La generación de
números de pedido utiliza una función PostgreSQL.

Se mantiene como hardening pendiente la validación de
`payment_collected` para asegurar que el marcado de pago cobrado solo
sea válido cuando el método y las reglas de negocio correspondan a
contra entrega. Se clasifica como 🟡, no como vulnerabilidad crítica
demostrada.

## 9. Delivery

El módulo delivery presenta separación entre gestión de repartidores por
el vendor y operaciones del repartidor. Las transiciones revisadas son
`preparing → on_the_way` y `on_the_way → delivered`.

-   El repartidor debe tener `delivery_store_id`.
-   El pedido debe pertenecer a la tienda asignada.
-   No se permiten transiciones fuera de `DELIVERY_TRANSITIONS`.
-   Para `delivered` se exige foto de entrega.
-   La evidencia puede incluir fecha y coordenadas.
-   El cambio se registra mediante `AuditLog`.
-   El marcado de pago requiere el hardening indicado en la sección 8.

## 10. Uploads

-   Tipos permitidos para evidencia de delivery: JPEG, PNG y WebP;
    también PDF para productos digitales.
-   Límite de evidencia de delivery: 10 MB.
-   En uploads generales se observa validación de imagen,
    redimensionamiento y eliminación de metadata.
-   Nombres generados mediante UUID.
-   Separación de rutas/objetos por tipo de imagen.
-   Existe fallback de R2 a almacenamiento local ante error de R2.

El fallback R2 → local se clasifica como 🟡 hardening operativo. Debe
quedar explícita la política de producción, observabilidad y
comportamiento esperado.

## 11. Productos digitales y descarga segura

La incorporación de la venta de productos digitales amplía el alcance
funcional y de seguridad de QTienda. En este modelo, el archivo
comercializado debe permanecer en almacenamiento privado y el acceso a
su contenido debe depender de una compra cuyo pago haya sido confirmado.

### 11.1 Flujo funcional a auditar

El flujo esperado es:

**Producto digital → archivo privado → compra → confirmación de pago →
habilitación de descarga → descarga del comprador**

La auditoría debe verificar que la habilitación de descarga no dependa
únicamente de datos controlables por el cliente y que exista una
relación verificable entre:

**tienda → producto digital → pedido → comprador → archivo**

### 11.2 Controles de seguridad

  -----------------------------------------------------------------------
  Control                 Resultado esperado      Prioridad
  ----------------------- ----------------------- -----------------------
  Almacenamiento privado  El archivo no debe      P0
                          exponerse mediante URL  
                          pública permanente      

  Confirmación de pago    La descarga solo se     P0
                          habilita después de un  
                          estado de pago válido   

  Propiedad de compra     El comprador solo       P0
                          accede a productos      
                          digitales adquiridos    
                          por él                  

  Aislamiento             Un comprador/tienda no  P0
  multi-tenant            puede acceder a         
                          archivos de otra tienda 

  Manipulación de         Cambiar `product_id`,   P0
  identificadores         `order_id` o            
                          identificadores de      
                          descarga no debe        
                          permitir acceso         

  URL de descarga         Preferentemente         P1
                          temporal/firmada o      
                          protegida por           
                          autorización de         
                          servidor                

  Re-descarga             Debe existir una        P1
                          política explícita de   
                          re-descarga             

  Auditoría               Registrar eventos       P1
                          relevantes de           
                          habilitación y descarga 

  Reemplazo/eliminación   Debe conservarse la     P1
                          relación correcta entre 
                          producto y archivo      
                          vigente                 

  Falla de almacenamiento Comportamiento definido P1
                          y observable ante       
                          errores de R2/storage   
  -----------------------------------------------------------------------

### 11.3 Pruebas de cierre específicas

-   Intentar descargar un producto digital sin haber realizado una
    compra.
-   Intentar descargar antes de la confirmación del pago.
-   Comprar el producto A e intentar acceder al archivo del producto B.
-   Intentar utilizar el `order_id` de otro comprador.
-   Intentar modificar `product_id` o identificadores equivalentes en la
    solicitud de descarga.
-   Intentar acceder a un archivo perteneciente a otra tienda.
-   Intentar acceder directamente al objeto almacenado sin pasar por el
    mecanismo autorizado.
-   Verificar que una URL temporal/firmada, si existe, expire conforme a
    la política definida.
-   Verificar el comportamiento ante pedido cancelado, reembolsado o
    pago rechazado.
-   Verificar re-descargas de una compra válida.
-   Verificar que la eliminación o sustitución del archivo no exponga
    archivos antiguos de forma no autorizada.

### 11.4 Criterio de aceptación

Se considerará cerrado este componente cuando una prueba de usuario
autorizado pueda descargar únicamente los archivos digitales para los
que exista una compra válida y pago confirmado, mientras que cualquier
intento de acceso no autorizado sea rechazado.

**Nota:** La presente auditoría identifica los controles que deben
verificarse a partir de la incorporación de productos digitales. No debe
afirmarse que estos controles fueron implementados o probados
funcionalmente hasta disponer de evidencia de la implementación y de las
pruebas correspondientes.

## 12. UX y CRO

La versión base de QT-100 identificó oportunidades centradas en
confianza, demostración de valor y adquisición. Esos hallazgos se
conservan.

  -----------------------------------------------------------------------
  Área                    Recomendaciones         Prioridad
  ----------------------- ----------------------- -----------------------
  Landing                 CTA, beneficios, casos, Alta
                          FAQ, confianza          

  Registro                Menos fricción,         Media
                          progreso, confirmación, 
                          ayuda                   

  Creación de tienda      Asistente, plantillas,  Alta
                          datos de ejemplo,       
                          checklist               

  Panel                   Tareas, progreso,       Media
                          accesos rápidos,        
                          recomendaciones         

  Tienda pública          Velocidad, SEO,         Alta
                          opiniones, destacados,  
                          compartir               

  Confianza               Tienda demo,            Alta
                          testimonios, video      
  -----------------------------------------------------------------------

El embudo base es: **Visita → Registro → Tienda creada → Primer producto
→ Primer pedido → Cliente recurrente**. Debe medirse rebote, tiempo de
registro, abandono del onboarding, tiendas activas y tiempo hasta primer
producto y primer pedido.

## 13. Hallazgos consolidados

  -------------------------------------------------------------------------------
  ID                Hallazgo              Severidad         Acción
  ----------------- --------------------- ----------------- ---------------------
  SEC-001           `payment_collected`   🟡 Media          Validar contra
                    requiere                                entrega y agregar
                    endurecimiento según                    prueba.
                    método de pago                          

  OPS-001           Fallback R2 → local   🟡 Media          Definir política,
                    ante error                              observabilidad y
                                                            prueba.

  UX-001            Reforzar prueba       🟡 Alta comercial Tienda demo,
                    social y demostración                   testimonios y video.
                    de valor                                

  UX-002            Reducir fricción del  🟡 Media          Asistente/checklist y
                    onboarding                              medición.

  SEO-001           Auditoría SEO         🟡 Alta           Ejecutar QT-101.
                    específica pendiente                    

  TEST-001          Pruebas negativas A/B 🟡 Alta           Ejecutar con dos
                    no ejecutadas en esta                   tiendas de prueba.
                    ronda                                   

  DIG-001           Acceso a archivos     🔴 P0             Verificar
                    digitales debe                          autorización de
                    depender de compra y                    descarga y
                    pago confirmado                         aislamiento.

  DIG-002           Almacenamiento        🔴 P0             Verificar que los
                    privado y protección                    archivos no sean
                    contra acceso directo                   públicamente
                                                            accesibles.

  DIG-003           Pruebas de            🔴 P0             Ejecutar pruebas con
                    manipulación de                         `product_id`,
                    identificadores de                      `order_id` y recursos
                    descarga                                de otra tienda.
  -------------------------------------------------------------------------------

## 14. Pruebas de cierre recomendadas

-   Tienda A intentando acceder a producto, variante, pedido y cupón de
    tienda B → 403/404.
-   Tienda B intentando modificar recursos de tienda A → 403/404.
-   Delivery A intentando operar sobre pedido B → 403/404.
-   Vendor intentando endpoint exclusivo de admin → 403.
-   Delivery intentando endpoint de vendor → 403.
-   Buyer intentando endpoint de vendor → 403.
-   Cliente intentando alterar precio, subtotal, descuento o total → el
    servidor debe reconstruir/validar.
-   Intento de cargar tipos/tamaños no permitidos → rechazo.
-   Usuario no autorizado intentando descargar producto digital →
    rechazo.
-   Usuario con compra pendiente o pago no confirmado intentando
    descargar → rechazo.
-   Usuario autorizado con pago confirmado descargando su producto →
    permitido.
-   Usuario intentando manipular identificadores para acceder a otro
    archivo → rechazo.
-   Pruebas de regresión posteriores a cada corrección.

## 15. Backlog técnico de cierre

  ---------------------------------------------------------------------------
  ID                Prioridad         Acción                Criterio de
                                                            aceptación
  ----------------- ----------------- --------------------- -----------------
  SEC-001           P0                Endurecer             Solo válido
                                      `payment_collected`   cuando método y
                                                            reglas COD lo
                                                            permitan.

  TEST-001          P0                Pruebas A/B           Todos los accesos
                                      multi-tenant          cruzados son
                                                            rechazados.

  TEST-002          P0                Prueba de             El total válido
                                      manipulación          depende del
                                      económica             servidor.

  DIG-001           P0                Auditar autorización  Solo comprador
                                      de descarga digital   con compra y pago
                                                            confirmado puede
                                                            descargar.

  DIG-002           P0                Verificar             No existe acceso
                                      almacenamiento        público directo
                                      privado               al archivo
                                                            digital.

  DIG-003           P0                Pruebas de            Cambios de
                                      manipulación de       identificadores
                                      descarga              no permiten
                                                            acceso indebido.

  OPS-001           P1                Revisar fallback      Comportamiento
                                      R2/local              documentado,
                                                            observable y
                                                            probado.

  UX-001            P1                Tienda demo + prueba  Visible y
                                      social                medible.

  UX-002            P1                Optimizar onboarding  Medir registro →
                                                            tienda → primer
                                                            producto.

  SEO-001           P1                Crear QT-101          Auditoría SEO y
                                                            backlog.
  ---------------------------------------------------------------------------

## 16. Dictamen

**DICTAMEN: 🟡 APTO PARA CONTINUAR HACIA PRODUCCIÓN CONTROLADA,
condicionado al cierre de los elementos P0 y a la ejecución de las
pruebas funcionales negativas de aislamiento, manipulación económica y
descarga de productos digitales.**

La revisión no demostró vulnerabilidades críticas en las superficies
auditadas. Este dictamen no constituye certificación formal de seguridad
ni sustituye una prueba de penetración profesional.

La nueva funcionalidad de productos digitales debe considerarse un
componente P0 de cierre debido a que introduce un activo privado cuyo
acceso depende directamente de la autorización derivada de una compra y
de su pago confirmado.

## 17. Relación con el Documento Maestro

QT-100 no modifica el Documento Maestro v0.2. Su función es aportar
evidencia sobre el estado real del producto. El Documento Maestro v0.2
mantiene su carácter de documento rector.

## 18. Secuencia posterior

  Paso   Actividad                                    Estado
  ------ -------------------------------------------- ----------------------------
  1      Revisión y aprobación de QT-100              Ahora
  2      Implementación/corrección de P0              Pendiente
  3      Pruebas de regresión / seguridad funcional   Pendiente
  4      Validación de productos digitales            Pendiente
  5      QT-101 Auditoría SEO                         Posterior
  6      Lanzamiento / Growth                         Después del cierre técnico

## 19. Criterio de cierre de productos digitales

Los productos digitales quedan incorporados al alcance de QT-100, pero
no se consideran validados únicamente por la existencia del flujo
funcional. El cierre requiere evidencia de implementación y pruebas
negativas que demuestren almacenamiento privado, autorización por compra
y pago confirmado, aislamiento entre tiendas y compradores, y
resistencia a la manipulación de identificadores.

## 20. Nota de trazabilidad

La versión 0.1 de QT-100 fue concebida como auditoría UX y CRO, con
énfasis en confianza, demostración de valor, onboarding y conversión. La
versión 0.2 conserva esos hallazgos y amplía el documento para
incorporar la auditoría funcional, técnica y de seguridad realizada
posteriormente, incluyendo la nueva capacidad de productos digitales. Se
mantiene el origen y se agrega la evidencia acumulada.
