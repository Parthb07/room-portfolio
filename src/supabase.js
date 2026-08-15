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

// Fetches work-experience entries (role/company/period + bullet points),
// ordered for display — a separate list, unrelated to any hotspot.
export async function fetchExperience() {
  const { data, error } = await supabase
    .from('experience')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

// Fetches project entries (title/summary/description/tags/link), ordered
// for display — same shape of list as fetchExperience, separate table.
export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

// Fetches the (single) degree row plus the certifications/courses list —
// two separate tables, since there's exactly one degree but a growing list
// of everything else.
export async function fetchEducation() {
  const [degreeResult, certificationsResult] = await Promise.all([
    supabase.from('degree').select('*').limit(1),
    supabase.from('certifications').select('*').order('sort_order', { ascending: true }),
  ])
  if (degreeResult.error) throw degreeResult.error
  if (certificationsResult.error) throw certificationsResult.error

  return {
    degree: degreeResult.data[0] ?? null,
    certifications: certificationsResult.data,
  }
}

// Fetches hobby entries (title/summary/description/tags/link), ordered for
// display — same shape of list as fetchProjects, separate table.
export async function fetchHobbies() {
  const { data, error } = await supabase
    .from('hobbies')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

// Fetches the gallery grid's media rows (image or video, each just a
// public URL + optional caption) — see gallery-page.js. `url` normally
// points at a file in the `media` storage bucket, but any public URL
// works, so external links (e.g. YouTube thumbnails hosted elsewhere)
// are fine too.
export async function fetchGalleryItems() {
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}
