export type UserRole = 'ADMIN' | 'STAFF' | 'TECHNICIAN' | 'CUSTOMER'
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical'
export type RequestStatus =
  | 'Pending'
  | 'Assigned'      // Routed to a technician — waiting for Pursue click
  | 'In_Progress'   // Technician clicked Pursue — actively working
  | 'Problematic'   // Tech reported a problem — staff reviews, tech stays assigned
  | 'Resolved'
  | 'Closed'
  | 'Cancelled'
export type NotificationType = 'NEW_REQUEST' | 'STATUS_UPDATE' | 'ASSIGNMENT' | 'RESOLVED' | 'URGENT_ALERT' | 'COMMENT' | 'SYSTEM'

export interface User {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  role: UserRole
  province?: string
  district?: string
  sector?: string
  cell?: string
  village?: string
  isActive: boolean
  emailVerified: boolean
  profilePhoto?: string
  lastLogin?: string
  createdAt: string
}

export interface AuthResponse {
  token: string
  tokenType: string
  userId: number
  fullName: string
  email: string
  role: UserRole
}

export interface Category {
  id: number
  name: string
  description?: string
  defaultPriority: PriorityLevel
  isActive?: boolean
}

export interface TechnicianRequests {
  active: RequestListItem[]
  history: RequestListItem[]
}

export type SlaStatus = 'OK' | 'AT_RISK' | 'BREACHED'

export interface ServiceRequest {
  id: number
  requestCode: string
  title: string
  description: string
  status: RequestStatus
  finalPriority: PriorityLevel
  aiPriority?: PriorityLevel
  aiConfidence?: number
  manualPriority?: PriorityLevel
  // finalPriority = manualPriority ?? aiPriority ?? 'Medium' — computed by backend
  aiKeywordsDetected?: { keywords: string[] }
  province: string
  district: string
  sector?: string
  cell?: string
  village?: string
  phone: string
  resolutionNotes?: string
  resolvedAt?: string
  closedAt?: string
  createdAt: string
  updatedAt?: string
  customerId: number
  customerName: string
  customerEmail?: string
  customerPhone?: string
  categoryId: number
  categoryName: string
  technicianId?: number
  technicianName?: string
  technicianEmail?: string
  comments?: Comment[]
  attachments?: Attachment[]
  // SLA fields (Feature 6)
  slaDeadline?: string
  slaStatus?: SlaStatus
  autoEscalated?: boolean
  slaEscalatedAt?: string
  // AI estimated resolution (Feature 2)
  estimatedResolutionHours?: number
  // Customer satisfaction rating (1–5 stars) after resolution
  satisfactionRating?: number
  customerFeedback?: string
  // Duplicate flag (Feature 3) — shown as badge to Staff/Admin only
  possibleDuplicate?: boolean
}

export interface RequestListItem {
  id: number
  requestCode: string
  title: string
  status: RequestStatus
  finalPriority: PriorityLevel
  aiPriority?: PriorityLevel
  aiConfidence?: number
  province: string
  district: string
  customerName: string
  categoryName: string
  technicianName?: string
  createdAt: string
  updatedAt?: string
  // SLA fields (Feature 6)
  slaDeadline?: string
  slaStatus?: SlaStatus
  autoEscalated?: boolean
  // Duplicate flag (Feature 3) — shown as badge to Staff/Admin only
  possibleDuplicate?: boolean
}

export interface Comment {
  id: number
  body: string
  isInternal: boolean
  authorId: number
  authorName: string
  authorRole: string
  createdAt: string
}

export interface Attachment {
  id: number
  fileName: string
  filePath: string
  fileSize?: number
  fileType?: string
  createdAt: string
}

export interface Technician {
  id: number
  userId: number
  fullName: string
  email: string
  employeeId?: string
  /** Canonical province (inherited from creator staff or set by admin at creation). */
  province?: string
  /** Canonical district (inherited from creator staff or set by admin at creation). */
  district?: string
  specialization?: string
  specializationTags?: string[]
  provinceCoverage?: string[]
  districtCoverage?: string[]
  categoryResolvedCounts?: Record<string, number>
  isAvailable: boolean
  currentWorkload: number
  maxWorkload: number
  rating?: number
  totalResolved: number
  /** True while the technician is actively pursuing a request (clicked Pursue). */
  isPursuing?: boolean
  /** ID of the request currently being pursued, if any. */
  pursuingRequestId?: number
}

export interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  requestId?: number
  createdAt: string
}

export interface DashboardStats {
  total: number
  pending: number
  inProgress: number
  resolved: number
  closed: number
  critical: number
  high: number
  thisWeek: number
  avgResolutionHours?: number
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface ScheduleEntry {
  dayOfWeek: string
  startTime: string   // "HH:mm"
  endTime: string     // "HH:mm"
  isWorking: boolean
}

export interface ApiResponse {
  success: boolean
  message: string
}

export interface AIPrediction {
  priority: PriorityLevel
  confidence: number
  keywords: string[]
  topFeatures?: string[]
  isUncertain?: boolean
}

// ── Feature 1: Smart technician matching ─────────────────────────────────────

export interface TechnicianRecommendation {
  id: number
  userId: number
  fullName: string
  email: string
  employeeId?: string
  specialization?: string
  specializationTags?: string[]
  provinceCoverage?: string[]
  districtCoverage?: string[]
  categoryResolvedCounts?: Record<string, number>
  isAvailable: boolean
  currentWorkload: number
  maxWorkload: number
  rating?: number
  totalResolved: number
  matchScore: number
  matchReasons: string[]
  /** True if this technician is already pursuing another request. */
  isPursuing?: boolean
}

// ── Feature 3: Duplicate / similar request detection ─────────────────────────

export interface SimilarRequest {
  id: number
  requestCode: string
  title: string
  status: RequestStatus
  finalPriority: PriorityLevel
  categoryName: string
  province: string
  district: string
  technicianName?: string
  createdAt: string
}

// ── Feature 4: Hotspot / cluster detection ────────────────────────────────────

export interface Hotspot {
  sector: string
  district: string
  province: string
  requestCount: number
  criticalCount: number
  highCount: number
  latestRequestAt: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE'
}

// ── Activity log / audit trail ───────────────────────────────────────────────

export interface ActivityLogEntry {
  id: number
  action: string
  description: string
  oldValue?: string
  newValue?: string
  actorName: string
  actorRole: string
  createdAt: string
}

// ── Feature 5: Auto-suggest category ─────────────────────────────────────────

export interface CategorySuggestion {
  categoryId: number
  categoryName: string
  score: number
  reason: string
}
