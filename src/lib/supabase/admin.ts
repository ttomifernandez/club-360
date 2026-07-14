import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service role: solo usar en el servidor (API routes / webhooks).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
