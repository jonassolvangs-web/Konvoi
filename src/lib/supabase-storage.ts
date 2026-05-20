import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(bucket).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * Upload a JSON backup to the backups bucket.
 */
export async function uploadBackup(
  fileName: string,
  jsonData: string
): Promise<string> {
  const buffer = Buffer.from(jsonData, 'utf-8');
  const { error } = await getSupabase().storage
    .from('backups')
    .upload(fileName, buffer, {
      contentType: 'application/json',
      upsert: false,
    });

  if (error) throw new Error(`Backup upload failed: ${error.message}`);
  return fileName;
}

/**
 * List all files in the backups bucket.
 */
export async function listBackups(): Promise<
  { name: string; created_at: string | null }[]
> {
  const { data, error } = await getSupabase().storage.from('backups').list('', {
    sortBy: { column: 'created_at', order: 'asc' },
  });

  if (error) throw new Error(`List backups failed: ${error.message}`);
  return (data || []).map((f) => ({
    name: f.name,
    created_at: f.created_at,
  }));
}

/**
 * Delete multiple files from a bucket.
 */
export async function deleteFiles(
  bucket: string,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getSupabase().storage.from(bucket).remove(paths);
  if (error) throw new Error(`Delete files failed: ${error.message}`);
}

/**
 * Extract the storage path from a Supabase public URL.
 * E.g. "https://xxx.supabase.co/storage/v1/object/public/avatars/user-123.jpg"
 * → "user-123.jpg"
 */
export function extractPathFromUrl(
  url: string,
  bucket: string
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}
