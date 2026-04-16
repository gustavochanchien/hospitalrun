import { supabase } from './client'

const IMAGING_BUCKET = 'imaging'
const SIGNED_URL_TTL_SECONDS = 60 * 10

function sanitizeFilename(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return base.slice(0, 120) || 'file'
}

export async function uploadImagingFile(
  orgId: string,
  imagingId: string,
  file: File,
): Promise<string> {
  const path = `${orgId}/${imagingId}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage
    .from(IMAGING_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (error) throw error
  return path
}

export async function getImagingSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(IMAGING_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

export async function removeImagingFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGING_BUCKET).remove([path])
  if (error) throw error
}
