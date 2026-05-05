/* ===== KarigarGo Types ===== */

export type UserRole = 'customer' | 'worker' | 'admin'

export interface User {
  id: string
  name: string
  email?: string
  phone?: string
  role: UserRole
  profile_photo_url?: string
  city?: string
  verified: boolean
  profile_complete: boolean
  avg_rating: number
  total_reviews: number
  created_at: string
  updated_at: string
}

export interface WorkerProfile {
  id: string
  user_id: string
  skills: string[]
  bio?: string
  cnic?: string
  cnic_front_url?: string
  cnic_back_url?: string
  certificate_urls?: string[]
  avg_rating: number
  total_jobs: number
  total_earnings: number
  created_at: string
}

export type JobStatus = 'pending' | 'bidAccepted' | 'inspectionDone' | 'workCostProposed' | 'workCostAccepted' | 'workCostRejected' | 'completed' | 'cancelled'

export interface Job {
  id: string
  title: string
  description: string
  category: string
  location: string
  latitude?: number
  longitude?: number
  budget: number
  date: string
  time: string
  image_url?: string
  voice_note_url?: string
  status: JobStatus
  city?: string
  customer_id: string
  customer_name: string
  customer_photo?: string
  worker_id?: string
  worker_name?: string
  worker_photo?: string
  inspection_charges?: number
  work_cost?: number
  platform_fee?: number
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface Bid {
  id: string
  job_id: string
  worker_id: string
  worker_name: string
  worker_photo?: string
  skill: string
  inspection_charges: number
  message?: string
  rating: number
  distance?: string
  verified: boolean
  status: 'pending' | 'accepted' | 'rejected'
  worker_lat?: number
  worker_lng?: number
  created_at: string
}

export interface ChatMessage {
  id: string
  job_id: string
  sender_id: string
  text: string
  image_url?: string
  voice_url?: string
  video_url?: string
  is_customer: boolean
  read: boolean
  created_at: string
}

export interface WorkerLocation {
  user_id: string
  job_id?: string
  latitude: number
  longitude: number
  updated_at: string
}

export interface Review {
  id: string
  job_id: string
  reviewer_id: string
  reviewer_name: string
  worker_id: string
  rating: number
  comment?: string
  direction: 'customer_to_worker' | 'worker_to_customer'
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'bid_received' | 'bid_accepted' | 'bid_rejected' | 'job_update' | 'message' | 'review' | 'system'
  title: string
  body: string
  read: boolean
  data?: Record<string, unknown>
  created_at: string
}

export interface Receipt {
  job_id: string
  job_title: string
  worker_name: string
  customer_name: string
  date: string
  inspection_fee: number
  work_cost: number
  platform_fee: number
  total: number
  case_type: 'A' | 'B'
}

/* ===== Constants ===== */
export const SERVICE_CATEGORIES = [
  { name: 'Electrician', color: '#FFB800', icon: '⚡' },
  { name: 'Plumber', color: '#0066CC', icon: '💧' },
  { name: 'AC Technician', color: '#CC3300', icon: '❄️' },
  { name: 'Carpenter', color: '#8B4513', icon: '🔨' },
  { name: 'Painter', color: '#9C27B0', icon: '🎨' },
  { name: 'Cleaner', color: '#10B981', icon: '🏠' },
  { name: 'Mazdoor', color: '#FF6B35', icon: '👷' },
  { name: 'Mistri', color: '#4A90E2', icon: '🔧' },
  { name: 'Gardener', color: '#2ECC71', icon: '🌿' },
  { name: 'Welder', color: '#B71C1C', icon: '🔥' },
] as const

export const PAKISTAN_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad',
  'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala',
  'Hyderabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Abbottabad',
] as const
