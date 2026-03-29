/**
 * Case-sensitive team codes. Only these exact strings work (no lowercasing).
 * Override with env in production.
 */
export function getViewerTeamCode(): string {
  return (process.env.PIRATES_SECURITY_CODE || 'Pirates102').trim();
}

export function getAdminTeamCode(): string {
  return (process.env.PIRATES_ADMIN_CODE || '#Pirateswinners').trim();
}
