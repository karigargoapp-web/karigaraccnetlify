export async function compressImage(file: File, maxPx = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      if (scale === 1 && file.size < 400 * 1024) return resolve(file)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export function withTimeout<T>(promise: PromiseLike<T>, ms = 45000, message = 'Request timed out. Check your connection and try again.'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

export async function uploadPublic(bucket: string, path: string, file: File): Promise<string> {
  const { supabase } = await import('./supabase')
  const prepared = await compressImage(file)
  const { error } = await withTimeout(supabase.storage.from(bucket).upload(path, prepared, { contentType: prepared.type || undefined }))
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
