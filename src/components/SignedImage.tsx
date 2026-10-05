import { useEffect, useState } from 'react'
import { signedDocUrl } from '../lib/docs'

interface Props {
  src: string | null | undefined
  alt?: string
  className?: string
  onResolved?: (url: string) => void
}

export default function SignedImage({ src, alt = '', className, onResolved }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    signedDocUrl(src).then(u => {
      if (cancelled) return
      setUrl(u)
      if (u && onResolved) onResolved(u)
    })
    return () => { cancelled = true }
  }, [src])
  if (!url) return <div className={`${className || ''} bg-gray-100 animate-pulse`} />
  return <img src={url} alt={alt} className={className} loading="lazy" />
}
