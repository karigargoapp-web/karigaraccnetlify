import { useEffect, useRef, useState } from 'react'
import { IoChevronDown, IoCheckmark } from 'react-icons/io5'

export const REJECT_FIELDS = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'name', label: 'Full name' },
  { key: 'phone', label: 'Phone number' },
  { key: 'city', label: 'City' },
  { key: 'skills', label: 'Skills' },
  { key: 'cnic', label: 'CNIC number' },
  { key: 'cnic_front', label: 'CNIC front image' },
  { key: 'cnic_back', label: 'CNIC back image' },
] as const

export function rejectReasonText(fields: string[], note?: string): string {
  const labels = REJECT_FIELDS.filter(f => fields.includes(f.key)).map(f => f.label)
  const base = `Please correct: ${labels.join(', ')}`
  return note && note.trim() ? `${base}. ${note.trim()}` : base
}

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

export default function RejectFieldsPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])

  const summary = value.length === 0
    ? 'Select what the worker must fix'
    : REJECT_FIELDS.filter(f => value.includes(f.key)).map(f => f.label).join(', ')

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
      >
        <span className={`truncate ${value.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>{summary}</span>
        <IoChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {REJECT_FIELDS.map(f => {
            const on = value.includes(f.key)
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggle(f.key)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <span>{f.label}</span>
                {on && <IoCheckmark size={16} className="text-red-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
