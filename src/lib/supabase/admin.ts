import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con privilegios de administrador (service_role): se salta las
// reglas de RLS por completo. SOLO debe usarse dentro de Server Actions para
// operaciones que requieren la Admin API de Supabase (como crear un usuario
// nuevo en auth.users) — nunca debe llegar al navegador. La key se lee de
// una variable de entorno SIN el prefijo NEXT_PUBLIC_ para que Next.js jamás
// la incluya en el código que se envía al cliente.
//
// Usa el mismo nombre de variable (SUPABASE_SERVICE_KEY) que ya usa
// .github/scripts/sugerencia-precios.mjs, así se puede reutilizar la misma
// key: Supabase → Project Settings → API → "service_role" (secret).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Falta configurar SUPABASE_SERVICE_KEY en las variables de entorno (ver .env.local.example)."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
