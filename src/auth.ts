export interface Env {
  DB: D1Database;
}

/**
 * Temporary auth stub.
 * Expects a header: X-User-Id: <numeric user id>
 * In production, replace with real auth (JWT, session, etc.).
 */
export async function getUserIdFromRequest(
  request: Request,
  env: Env
): Promise<number | null> {
  const header = request.headers.get("X-User-Id");
  if (!header) return null;

  const id = Number(header);
  if (!Number.isFinite(id)) return null;

  // Optionally verify user exists
  const row = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
    .bind(id)
    .first();

  return row ? id : null;
}
