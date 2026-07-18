export type UserRole = 'customer' | 'worker' | 'admin'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

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
  approval_status: ApprovalStatus
  rejection_reason?: string
  suspended_at?: string
  suspension_reason?: string
  dispute_count: number
  cancellation_count: number
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
  cnic_verified_by?: string
  approval_reviewed_by?: string
  approval_reviewed_at?: string
  created_at: string
}

export type JobStatus =
  | 'pending'
  | 'bidAccepted'
  | 'inspectionDone'
  | 'proceedRequested'
  | 'workCostProposed'
  | 'workCostAccepted'
  | 'workCostRejected'
  | 'inProgress'
  | 'paused'
  | 'disputed'
  | 'completed'
  | 'cancelled'

export type CancellationActor = 'customer' | 'worker' | 'admin'

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Pending',
  bidAccepted: 'Bid Accepted',
  inspectionDone: 'Inspection Done',
  proceedRequested: 'Proceed Requested',
  workCostProposed: 'Cost Proposed',
  workCostAccepted: 'Cost Approved',
  workCostRejected: 'Cost Rejected',
  inProgress: 'In Progress',
  paused: 'Paused',
  disputed: 'Dispute Raised',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export interface Job {
  id: string
  title: string
  description: string
  category: string
  location: string
  latitude?: number
  longitude?: number
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
  work_cost_total?: number
  platform_fee?: number
  cancellation_reason?: string
  cancellation_actor?: CancellationActor
  cancelled_by?: string
  admin_note?: string
  paused_at?: string
  dispute_id?: string
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

export interface Wallet {
  id: string
  user_id: string
  balance: number
  reward_points: number
  created_at: string
  updated_at: string
}

export type WalletTxType =
  | 'top_up'
  | 'inspection_payment'
  | 'escrow_lock'
  | 'escrow_release'
  | 'commission'
  | 'reward'
  | 'bidding_fee'
  | 'refund'
  | 'partial_refund'
  | 'withdrawal'

export interface WalletTransaction {
  id: string
  user_id: string
  type: WalletTxType
  amount: number
  direction: 'credit' | 'debit'
  job_id?: string
  description: string
  created_at: string
}

export type EscrowStatus = 'inspection_held' | 'work_held' | 'released' | 'refunded' | 'partial_refund'

export interface Escrow {
  id: string
  job_id: string
  inspection_amount: number
  work_amount: number
  total_locked: number
  status: EscrowStatus
  released_at?: string
  created_at: string
  updated_at: string
}

export type DisputeStatus = 'open' | 'resolved' | 'cancelled'
export type DisputeResolution = 'continue' | 'partial' | 'cancel'

export interface Dispute {
  id: string
  job_id: string
  raised_by: string
  reason: string
  status: DisputeStatus
  resolution_type?: DisputeResolution
  settled_amount?: number
  admin_notes?: string
  resolved_by?: string
  resolved_at?: string
  photo_url?: string
  voice_url?: string
  video_url?: string
  created_at: string
}

export interface DisputeMessage {
  id: string
  dispute_id: string
  sender_id: string
  sender_role: UserRole
  message: string
  directed_to?: string
  photo_url?: string
  voice_url?: string
  video_url?: string
  created_at: string
}

export const DISPUTE_REASONS = [
  "Worker doesn't know the work",
  'Worker did not show up',
  'Worker misbehaved / unprofessional',
  'Work quality is poor',
  'Safety concern at site',
  'Job abandoned midway',
  'Other',
] as const

export interface AdminAction {
  id: string
  admin_id: string
  action_type: string
  entity_type: string
  entity_id: string
  notes?: string
  metadata?: Record<string, unknown>
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
  worker_received: number
  customer_reward_points: number
  worker_reward_points: number
  bidding_fee_charged: number
  total: number
  case_type: 'A' | 'B'
}

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

// Customer-facing category shown on Home / Post a Job
export const CUSTOMER_SERVICE_CATEGORIES = [
  ...SERVICE_CATEGORIES,
  { name: 'Electronics Repair', color: '#00B8D9', icon: '🔌' },
] as const

// Worker-facing specialization shown on signup / profile
export const WORKER_SKILL_CATEGORIES = [
  ...SERVICE_CATEGORIES,
  { name: 'Electronics Repairing', color: '#00B8D9', icon: '🔌' },
] as const

// Job category -> worker skills allowed to see/bid on it (OR match).
// Categories not listed here are visible to all workers (existing behaviour).
export const CATEGORY_SKILL_MATCH: Record<string, string[]> = {
  'Electronics Repair': ['Electrician', 'AC Technician', 'Electronics Repairing'],
}

export const PAKISTAN_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad',
  'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala',
  'Hyderabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Abbottabad',
] as const

export const PLATFORM_COMMISSION_RATE = 0.10
export const REWARD_RATE = 0.02
export const BIDDING_FEE = 20
export const MAX_INSPECTION_CHARGE = 500

export const WORKER_CANCELLATION_REASONS = [
  'Arrived but unable to perform the job',
  'Customer unavailable at location',
  'Safety concern at site',
  'Tools/equipment not available',
  'Other',
] as const

export const CUSTOMER_CANCELLATION_REASONS = [
  'Worker arrived too late',
  'Issue resolved on my own',
  'Changed my mind',
  'Worker behaviour issue',
  'Found another worker',
  'Other',
] as const
