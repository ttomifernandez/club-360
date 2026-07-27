export default function handler(request, response) {
  const rawUrl = process.env.SUPABASE_URL || "";
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "");
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    supabaseUrl,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    configured: Boolean(supabaseUrl && process.env.SUPABASE_ANON_KEY),
  });
}
