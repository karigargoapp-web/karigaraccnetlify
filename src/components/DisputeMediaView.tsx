interface Props {
  photo_url?: string
  voice_url?: string
  video_url?: string
}

export default function DisputeMediaView({ photo_url, voice_url, video_url }: Props) {
  if (!photo_url && !voice_url && !video_url) return null
  return (
    <div className="mt-2 space-y-2">
      {photo_url && <img src={photo_url} className="w-full max-w-[220px] rounded-lg border border-border" alt="evidence" />}
      {video_url && <video src={video_url} controls className="w-full max-w-[220px] rounded-lg border border-border" />}
      {voice_url && <audio src={voice_url} controls className="w-full max-w-[220px]" />}
    </div>
  )
}
