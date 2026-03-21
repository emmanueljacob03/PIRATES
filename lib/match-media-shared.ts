/** Normalize album for rows before `album` column existed or from API. */
export function mediaAlbum(row: { album?: string | null }): 'main' | 'others' {
  return row.album === 'others' ? 'others' : 'main';
}
