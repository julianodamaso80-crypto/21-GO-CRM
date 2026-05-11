// @ts-nocheck
import { useRef, useState, useEffect, useMemo } from 'react'
import { Play, Pause, Download, FileText, Image as ImageIcon } from 'lucide-react'

interface MessageContentProps {
  messageType?: string | null
  content?: string | null
  mediaBase64?: string | null
  mediaMimeType?: string | null
  outbound?: boolean
}

/**
 * Renderiza o conteúdo de uma mensagem do WhatsApp respeitando o tipo.
 * - audio: player customizado com velocidade 1x/1.5x/2x
 * - image: thumbnail clicável (abre em nova aba)
 * - video: <video controls>
 * - document: link de download
 * - texto: parágrafo
 *
 * `mediaBase64` é o payload bruto vindo do webhook (Evolution salva base64 cru
 * sem prefixo data:). Montamos a data URL aqui.
 */
export function MessageContent({
  messageType,
  content,
  mediaBase64,
  mediaMimeType,
  outbound,
}: MessageContentProps) {
  const dataUrl = useMemo(() => {
    if (!mediaBase64) return null
    if (mediaBase64.startsWith('data:')) return mediaBase64
    const mime = mediaMimeType || guessMimeFromKind(messageType)
    if (!mime) return null
    return `data:${mime};base64,${mediaBase64}`
  }, [mediaBase64, mediaMimeType, messageType])

  if (messageType === 'audio' && dataUrl) {
    return <AudioPlayer src={dataUrl} outbound={outbound} />
  }
  if (messageType === 'image' && dataUrl) {
    return (
      <div className="space-y-1">
        <a href={dataUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={dataUrl}
            alt="imagem"
            className="rounded-lg max-w-[280px] max-h-[280px] object-cover cursor-zoom-in"
          />
        </a>
        {content && content !== '[imagem]' && (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}
      </div>
    )
  }
  if (messageType === 'video' && dataUrl) {
    return (
      <video
        src={dataUrl}
        controls
        className="rounded-lg max-w-[300px] max-h-[300px]"
      />
    )
  }
  if (messageType === 'document' && dataUrl) {
    return (
      <a
        href={dataUrl}
        download
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
          outbound ? 'bg-emerald-700/40 text-white' : 'bg-dark-700/60 text-gray-200'
        } hover:opacity-90 transition`}
      >
        <FileText className="w-4 h-4" />
        <span className="text-sm truncate max-w-[200px]">{content || 'documento'}</span>
        <Download className="w-3.5 h-3.5 opacity-70" />
      </a>
    )
  }
  if ((messageType === 'image' || messageType === 'video' || messageType === 'audio') && !dataUrl) {
    // Mídia sem base64 — fallback: mostra placeholder com o label
    return (
      <div className="flex items-center gap-2 text-xs italic opacity-70">
        <ImageIcon className="w-3.5 h-3.5" />
        {content || `[${messageType} sem mídia]`}
      </div>
    )
  }

  // Default: texto
  return <p className="text-sm whitespace-pre-wrap">{content}</p>
}

function guessMimeFromKind(kind?: string | null): string | null {
  switch (kind) {
    case 'audio':
      return 'audio/ogg'
    case 'image':
      return 'image/jpeg'
    case 'video':
      return 'video/mp4'
    case 'document':
      return 'application/pdf'
    default:
      return null
  }
}

const SPEEDS = [1, 1.5, 2] as const

function AudioPlayer({ src, outbound }: { src: string; outbound?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onLoaded = () => {
      const d = Number.isFinite(a.duration) ? a.duration : 0
      setDuration(d)
    }
    const onTime = () => setTime(a.currentTime)
    const onEnd = () => {
      setPlaying(false)
      setTime(0)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('durationchange', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('durationchange', onLoaded)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[speedIdx]
  }, [speedIdx])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a || !duration) return
    const next = (Number(e.target.value) / 100) * duration
    a.currentTime = next
    setTime(next)
  }

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return '0:00'
    const m = Math.floor(s / 60)
    const r = Math.floor(s % 60)
    return `${m}:${String(r).padStart(2, '0')}`
  }

  const progress = duration > 0 ? (time / duration) * 100 : 0
  const accent = outbound ? 'bg-white/90 text-emerald-700' : 'bg-gold-500 text-dark-900'
  const trackBg = outbound ? 'bg-white/20' : 'bg-dark-600'
  const textColor = outbound ? 'text-emerald-100' : 'text-gray-400'

  return (
    <div className="flex items-center gap-2.5 min-w-[240px] max-w-[320px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={`flex-shrink-0 w-9 h-9 rounded-full ${accent} flex items-center justify-center hover:opacity-90 transition`}
        aria-label={playing ? 'Pausar' : 'Tocar'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`relative h-1 rounded-full ${trackBg} overflow-hidden`}>
          <div
            className={`absolute inset-y-0 left-0 ${outbound ? 'bg-white/80' : 'bg-gold-400'}`}
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={seek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label="Posição do áudio"
          />
        </div>
        <div className={`flex items-center justify-between text-[10px] mt-1 ${textColor}`}>
          <span className="tabular-nums">{fmt(playing || time > 0 ? time : duration)}</span>
        </div>
      </div>
      <button
        onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
        className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
          outbound ? 'bg-white/20 text-white' : 'bg-dark-700 text-gold-400'
        } hover:opacity-90 transition tabular-nums`}
        title="Velocidade"
      >
        {SPEEDS[speedIdx]}x
      </button>
    </div>
  )
}
