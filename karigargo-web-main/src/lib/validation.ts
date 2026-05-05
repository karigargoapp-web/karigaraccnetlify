/** Shared client-side validation. Returns `null` if valid, otherwise an error message. */

export const PASSWORD_HINT =
  'Use 8+ characters with uppercase, lowercase, a number, and a special character (e.g. @ $ ! % * ? & #)'

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/** Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special. */
const PASSWORD_SPECIAL = /[@$!%*?&#^\-_=+[{\]}\\|:;"'<>,./~`]/

export function validateEmail(email: string): string | null {
  const t = email.trim()
  if (!t) return 'Email is required'
  if (t.length > 254) return 'Email is too long'
  if (!EMAIL_RE.test(t)) return 'Enter a valid email address'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 128) return 'Password is too long'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one capital letter'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number'
  if (!PASSWORD_SPECIAL.test(password)) {
    return 'Password must include at least one special character (e.g. @ $ ! % * ? & #)'
  }
  return null
}

/** Pakistan CNIC: 13 digits, optional dashes as 12345-1234567-1 */
export function normalizeCNICDigits(input: string): string {
  return input.replace(/\D/g, '')
}

export function validateCNIC(input: string): string | null {
  const digits = normalizeCNICDigits(input)
  if (!digits) return 'CNIC number is required'
  if (digits.length !== 13) return 'CNIC must be 13 digits (format: 12345-1234567-1)'
  return null
}

/** Pakistan mobile: 03XXXXXXXXX (11 digits) or +92 3XX XXXXXXX */
export function validatePakistanPhone(phone: string, { optional }: { optional: boolean }): string | null {
  const t = phone.trim()
  if (!t) {
    return optional ? null : 'Phone number is required'
  }
  const digits = t.replace(/\D/g, '')
  let n = digits
  if (n.startsWith('92') && n.length >= 12) n = '0' + n.slice(2)
  if (n.length !== 11) return 'Enter a valid Pakistan mobile (e.g. 03001234567)'
  if (!n.startsWith('0')) return 'Mobile must start with 0 (e.g. 03001234567)'
  if (n[1] !== '3') return 'Pakistan mobile must start with 03 (e.g. 03001234567)'
  return null
}

/** Full name: letters (Latin or common Arabic script), spaces, hyphen, apostrophe, dot */
const NAME_RE = /^[a-zA-Z\u0600-\u06FF\u0750-\u077F\s\-'.]{2,80}$/

export function validatePersonName(name: string): string | null {
  const t = name.trim()
  if (!t) return 'Name is required'
  if (t.length < 2) return 'Name must be at least 2 characters'
  if (t.length > 80) return 'Name is too long'
  if (!NAME_RE.test(t)) return 'Name may only contain letters, spaces, hyphens, apostrophes, and dots'
  if (!/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/.test(t)) return 'Name must include letters'
  return null
}

export function validateWorkerBio(bio: string): string | null {
  if (bio.length > 500) return 'Bio must be 500 characters or less'
  return null
}

export function validateJobTitle(title: string): string | null {
  const t = title.trim()
  if (!t) return 'Title is required'
  if (t.length < 3) return 'Title must be at least 3 characters'
  if (t.length > 120) return 'Title is too long (max 120 characters)'
  return null
}

export function validateJobDescription(description: string): string | null {
  const t = description.trim()
  if (!t) return 'Description is required'
  if (t.length < 10) return 'Description must be at least 10 characters'
  if (t.length > 5000) return 'Description is too long'
  return null
}

export function validateJobBudget(budgetRaw: string): string | null {
  const t = budgetRaw.trim()
  if (!t) return 'Budget is required'
  if (!/^\d+$/.test(t)) return 'Budget must be a whole number (PKR)'
  const n = Number(t)
  if (n < 1) return 'Budget must be at least 1 PKR'
  if (n > 50_000_000) return 'Budget is too high — contact support if this is correct'
  return null
}

/** Pretty-print CNIC after digits-only input */
export function formatCNICDisplay(digits: string): string {
  const d = normalizeCNICDigits(digits)
  if (d.length !== 13) return digits.trim()
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function validateImageFile(file: File | null, { required }: { required: boolean }): string | null {
  if (!file) return required ? 'Please upload an image' : null
  const okType =
    /^image\/(jpeg|png|webp)$/i.test(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name)
  if (!okType) return 'Use a JPG, PNG, or WebP image'
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be 5MB or smaller'
  return null
}

const MAX_VOICE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_MEDIA_BYTES = 50 * 1024 * 1024 // 50MB per file
const MAX_MEDIA_COUNT = 5 // max 5 photos/videos

export function validateVoiceNote(voiceBlob: Blob | null, { required }: { required: boolean }): string | null {
  if (!voiceBlob) return required ? 'Voice note is required to explain the problem' : null
  if (voiceBlob.size > MAX_VOICE_BYTES) return 'Voice note must be 10MB or smaller'
  return null
}

export function validateMediaItems(items: { file: File }[], { required }: { required: boolean }): string | null {
  if (items.length === 0) return required ? 'Please add at least one photo or video showing the problem' : null
  if (items.length > MAX_MEDIA_COUNT) return `Maximum ${MAX_MEDIA_COUNT} photos/videos allowed`
  for (const item of items) {
    if (item.file.size > MAX_MEDIA_BYTES) {
      return `Each file must be 50MB or smaller (${item.file.name})`
    }
  }
  return null
}

const MAX_CERT_BYTES = 10 * 1024 * 1024

export function validateJobDate(dateRaw: string): string | null {
  if (!dateRaw) return null // date is optional
  const selected = new Date(dateRaw)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (selected < today) return 'Job date cannot be in the past'
  return null
}

export function validateCertificateFile(file: File): string | null {
  const ok =
    /^image\/(jpeg|png|webp)$/i.test(file.type) ||
    file.type === 'application/pdf' ||
    /\.(pdf|jpe?g|png|webp)$/i.test(file.name)
  if (!ok) return 'Certificates must be JPG, PNG, or PDF'
  if (file.size > MAX_CERT_BYTES) return 'Each certificate must be 10MB or smaller'
  return null
}
