export default function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="field-error-text">{message}</p>
}
