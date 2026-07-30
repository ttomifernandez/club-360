// Alta y baja de usuarios del panel. Corre en Vercel con el service role key,
// que nunca llega al navegador. Solo un owner activo puede invocarlo.
export default async function handler(request, response) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return response.status(405).json({ error: "Método no permitido." });
  }
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !anonKey) {
    return response.status(500).json({ error: "Supabase no está configurado." });
  }
  if (!serviceKey) {
    return response.status(500).json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel." });
  }

  const token = (request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Sesión requerida." });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return response.status(401).json({ error: "Sesión inválida o vencida." });
  const caller = await userRes.json();

  const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=role,active`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  const profiles = profRes.ok ? await profRes.json() : [];
  if (!profiles.length || profiles[0].role !== "owner" || !profiles[0].active) {
    return response.status(403).json({ error: "Solo el propietario puede crear usuarios." });
  }

  if (request.method === "DELETE") {
    const { userId } = request.body || {};
    // Solo un UUID: sin esto se podrían inyectar rutas ("../") y alcanzar
    // otros endpoints de Supabase con la clave de servicio.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ""))) {
      return response.status(400).json({ error: "Usuario inválido." });
    }
    if (userId === caller.id) return response.status(400).json({ error: "No podés eliminar tu propio usuario." });
    const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
    if (!delRes.ok) {
      const body = await delRes.json().catch(() => ({}));
      return response.status(400).json({ error: body?.msg || body?.message || "No se pudo eliminar el usuario." });
    }
    return response.status(200).json({ ok: true });
  }

  const { email, password, fullName, role, active } = request.body || {};
  const validRoles = ["owner", "operator", "catalog", "support", "auditor", "seller"];
  if (!email || !/.+@.+\..+/.test(email)) return response.status(400).json({ error: "Email inválido." });
  if (!password || password.length < 8) return response.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
  if (!validRoles.includes(role)) return response.status(400).json({ error: "Rol inválido." });

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName || email } }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    const msg = created?.msg || created?.message || created?.error_description || "No se pudo crear el usuario.";
    return response.status(createRes.status >= 500 ? 502 : 400).json({ error: msg });
  }

  // El trigger on_auth_user_created ya creó el perfil (support, inactivo);
  // upsert por si el trigger no existiera, y fija nombre, rol y acceso.
  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ id: created.id, full_name: fullName || email, role, active: active !== false }]),
  });
  if (!upsertRes.ok) {
    return response.status(200).json({ ok: true, id: created.id, warning: "Usuario creado, pero no se pudo fijar el rol: editalo desde la tabla." });
  }
  return response.status(200).json({ ok: true, id: created.id });
}
