import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Fetches every row from `objects`, indexed by id so hotspot zones
// (which share the same ids) can look up their data in O(1).
export async function fetchObjects() {
  const { data, error } = await supabase.from('objects').select('*')
  if (error) throw error

  return data.reduce((byId, row) => {
    byId[row.id] = row
    return byId
  }, {})
}
