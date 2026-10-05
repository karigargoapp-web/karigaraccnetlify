interface Props {
  value: string
  onChange: (value: string) => void
  hasError?: boolean
  placeholder?: string
}

export default function PhoneInput({ value, onChange, hasError, placeholder = '03001234567' }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={placeholder}
      value={value}
      maxLength={11}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
      className={hasError ? 'field-error' : ''}
    />
  )
}
