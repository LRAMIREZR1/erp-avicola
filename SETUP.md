# ERP Avícola Doña Idelia — Guía de puesta en marcha

Panel interno (solo para ti y Soledad) para controlar clientes, stock, productos y pedidos.
Stack: **Next.js** + **Supabase** (base de datos y login) + **Vercel** (hosting) + **GitHub** (código).

---

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (puedes usar tu cuenta de GitHub para entrar más rápido).
2. Clic en **New Project**. Elige un nombre (ej. `erp-avicola`), una contraseña de base de datos (guárdala) y la región más cercana a Chile (ej. `South America (São Paulo)`).
3. Espera 1-2 minutos a que el proyecto se cree.
4. Ve a **Project Settings → API**. Copia:
   - **Project URL**
   - **anon public key**

## 2. Cargar el esquema de la base de datos

1. En el panel de Supabase, ve a **SQL Editor**.
2. Abre el archivo `supabase/migrations/0001_init.sql` de este proyecto, copia todo su contenido y pégalo en el editor. Clic en **Run**.
3. Haz lo mismo con `supabase/migrations/0002_stock_automatico.sql`.
4. Esto crea las tablas (`clientes`, `productos`, `pedidos`, etc.), las reglas de seguridad, y deja cargados 5 productos de ejemplo (ajusta los precios reales después desde la app, en "Productos y stock").

## 3. Crear tus usuarios (login de Luis y Soledad)

1. En Supabase, ve a **Authentication → Users → Add user**.
2. Crea un usuario para ti (tu correo + una contraseña) y otro para Soledad.
3. Al crear el usuario, en "User Metadata" puedes agregar `{"nombre": "Luis"}` o `{"nombre": "Soledad"}` para que su nombre aparezca en el panel (si no lo haces, se usa el correo).
4. Con esto ya pueden iniciar sesión en `/login` dentro de la app.

## 4. Probar en tu computador (opcional pero recomendado)

```bash
# dentro de la carpeta del proyecto
cp .env.local.example .env.local
```

Edita `.env.local` y pega tu **Project URL** y **anon key** de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Luego:

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` — te debería redirigir a `/login`.

## 5. Subir el código a GitHub

Ya tienes cuenta de GitHub. Crea un repositorio nuevo (vacío, sin README) en [github.com/new](https://github.com/new), por ejemplo `erp-avicola`. Luego, desde la carpeta del proyecto:

```bash
git add -A
git commit -m "ERP inicial: clientes, productos, pedidos, dashboard"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/erp-avicola.git
git push -u origin main
```

## 6. Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) y crea una cuenta (puedes usar tu cuenta de GitHub).
2. Clic en **Add New → Project** y selecciona el repositorio `erp-avicola` que acabas de subir.
3. En **Environment Variables**, agrega las mismas dos variables del paso 4:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clic en **Deploy**. En 1-2 minutos tendrás una URL pública (ej. `erp-avicola.vercel.app`) — esa es la que usarán tú y Soledad para trabajar todos los días.
5. Cada vez que subas cambios a `main` en GitHub, Vercel actualiza el sitio automáticamente.

## 7. Seguir desarrollando con Claude Code

Ya tienes Claude Code instalado (v2.1.218). Para seguir agregando funciones desde tu computador:

```bash
cd erp-avicola   # o donde hayas clonado/copiado el proyecto
claude
```

Y le pides directamente lo que necesites, por ejemplo:
- "Agrega un campo de RUT a los clientes"
- "Quiero que el reporte de ventas se pueda exportar a Excel"
- "Agrega una segunda alerta cuando el stock esté en cero"

Claude Code ya tiene contexto del proyecto (estructura, esquema de base de datos, convenciones) porque están en el propio código.

## Qué incluye esta primera versión

- **Login** solo para el staff (tú y Soledad), cada uno con su cuenta.
- **Dashboard**: ventas del día, pedidos pendientes, alertas de stock bajo.
- **Clientes**: registro de clientes B2B (hoteles, hospitales) y minoristas, con zona de entrega.
- **Productos y stock**: categorías Segunda/Primera/Extra, formatos bandeja de 30 y caja de 120/180, ajuste manual de stock.
- **Pedidos**: creación con varios productos por pedido, estados (pendiente → en preparación → entregado/cancelado). Al marcar un pedido como "entregado" se descuenta el stock automáticamente; si se cancela un pedido ya entregado, el stock se repone.
- **Reportes**: ventas totales por período, por vendedor y por producto.

## Ideas para siguientes etapas

- Editar los ítems de un pedido ya creado (hoy se crea completo o se cancela).
- Historial de movimientos de stock por producto.
- Exportar reportes a Excel/PDF.
- Notificación automática por WhatsApp cuando un pedido cambia de estado.
- Más adelante, si quieres que los propios clientes hagan pedidos desde la app (no solo tú y Soledad), se puede agregar un login separado para clientes — es un cambio grande de alcance, mejor conversarlo aparte.
