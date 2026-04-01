/**
 * Fills empty profile columns from auth user_metadata (set at signUp via options.data).
 * Used after the user has a session (RLS allows update) to repair email-confirm flows.
 */
export type ProfileMetaSnapshot = {
  name: string | null;
  phone: string | null;
  date_of_birth: string | null;
};

export function profilePatchFromAuthMetadata(
  row: ProfileMetaSnapshot | null,
  meta: Record<string, unknown> | null | undefined,
): Record<string, string> | null {
  if (!meta || typeof meta !== 'object') return null;
  const name = typeof meta.name === 'string' ? meta.name.trim() : '';
  const phone = typeof meta.phone === 'string' ? meta.phone.trim() : '';
  const dobRaw = typeof meta.dob === 'string' ? meta.dob.trim().slice(0, 10) : '';

  const patch: Record<string, string> = {};
  if (!((row?.name ?? '').trim()) && name) patch.name = name;
  if (!((row?.phone ?? '').trim()) && phone) patch.phone = phone;
  if (!row?.date_of_birth && dobRaw) patch.date_of_birth = dobRaw;

  return Object.keys(patch).length ? patch : null;
}
