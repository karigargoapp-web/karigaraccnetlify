export function parseMediaUrls(imageUrl?: string | null): string[] {
  if (!imageUrl) return []
  const trimmed = imageUrl.trim()
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      return Array.isArray(arr) ? arr.filter(Boolean) : [trimmed]
    } catch {
      return [trimmed]
    }
  }
  return [trimmed]
}

export function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('.mp4') ||
    lower.includes('.webm') ||
    lower.includes('.mov') ||
    lower.includes('.avi') ||
    lower.includes('video_')
  )
}
