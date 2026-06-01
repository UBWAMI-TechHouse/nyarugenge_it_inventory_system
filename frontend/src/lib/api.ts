// ─── Base ─────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"

let _token: string | null = localStorage.getItem("token")

export function setToken(t: string | null) {
  _token = t
  if (t) localStorage.setItem("token", t)
  else localStorage.removeItem("token")
}

export function getToken() {
  return _token
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (_token) headers["Authorization"] = `Bearer ${_token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const json = await res.json()

  if (!res.ok) {
    const msg = json?.message ?? json?.errors?.[0] ?? `Request failed: ${res.status}`
    throw new Error(msg)
  }
  return json
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type EquipmentStatus = "assigned" | "available" | "maintenance" | "retired"
export type EquipmentCondition = "excellent" | "good" | "fair" | "poor"
export type HandoverStatus = "completed" | "pending" | "cancelled"
export type HandoverActivityType = "reassign" | "return" | "new_issue"

export interface Department {
  id: string
  name: string
  code: string
  description?: string
  created_at: string
  user_count?: number
  equipment_count?: number
}

export interface User {
  id: string
  name: string
  email: string
  department_id: string
  department?: string
  role: string
  avatar?: string
  is_admin?: boolean
  created_at: string
  equipment_count?: number
  handover_count?: number
}

export interface Equipment {
  id: string
  name: string
  category: string
  serial_number: string
  tag_number: string
  assigned_to: string | null
  status: EquipmentStatus
  purchase_date: string
  condition: EquipmentCondition
  created_at: string
  assigned_user_name?: string | null
  assigned_user_dept?: string | null
  notes?: string
}

export interface Handover {
  id: string
  from_user_id: string | null
  to_user_id: string | null
  equipment_id: string
  date: string
  status: HandoverStatus
  activity_type: HandoverActivityType
  notes?: string
  created_at: string
  from_user_name?: string
  to_user_name?: string
  equipment_name?: string
  equipment_category?: string
  equipment_tag_number?: string
}

export interface DashboardStats {
  totalEquipment: number
  assigned: number
  available: number
  maintenance: number
  retired: number
  totalUsers: number
  totalHandovers: number
  recentHandovers: Handover[]
  categoryBreakdown: { category: string; count: number }[]
  statusBreakdown: { status: string; count: number }[]
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: string[]
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    request<ApiResponse<{ user: User; token: string }>>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (body: { name: string; email: string; password: string; department_id: string; role: string }) =>
    request<ApiResponse<{ user: User; token: string }>>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<ApiResponse<User>>("/auth/me"),

  // Password reset (new routes needed in backend)
  forgotPassword: (email: string) =>
    request<ApiResponse<{ message: string }>>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<ApiResponse<{ message: string }>>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
}

// ─── Departments ──────────────────────────────────────────────────────────────

export const departments = {
  list: () =>
    request<ApiResponse<Department[]>>("/departments"),

  // Returns dept + users + equipment (new backend route needed)
  get: (id: string) =>
    request<ApiResponse<Department & { users: User[]; equipment: Equipment[] }>>(`/departments/${id}`),

  create: (body: { name: string; code: string; description?: string }) =>
    request<ApiResponse<Department>>("/departments", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<{ name: string; code: string; description: string }>) =>
    request<ApiResponse<Department>>(`/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/departments/${id}`, { method: "DELETE" }),
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = {
  list: (params?: { search?: string; department?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set("search", params.search)
    if (params?.department) q.set("department", params.department)
    if (params?.page) q.set("page", String(params.page))
    if (params?.limit) q.set("limit", String(params.limit))
    return request<ApiResponse<User[]> & { total: number; page: number; limit: number; totalPages: number }>(`/users?${q}`)
  },

  get: (id: string) =>
    request<ApiResponse<User & { equipment: Equipment[]; handovers: Handover[] }>>(`/users/${id}`),

  create: (body: { name: string; email: string; department_id: string; role: string; password?: string }) =>
    request<ApiResponse<User>>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<{ name: string; email: string; department_id: string; role: string; avatar: string }>) =>
    request<ApiResponse<User>>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/users/${id}`, { method: "DELETE" }),
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export const equipment = {
  list: (params?: {
    search?: string; status?: string; category?: string; condition?: string
    assignedTo?: string; departmentId?: string; page?: number; limit?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set("search", params.search)
    if (params?.status) q.set("status", params.status)
    if (params?.category) q.set("category", params.category)
    if (params?.condition) q.set("condition", params.condition)
    if (params?.assignedTo) q.set("assignedTo", params.assignedTo)
    if (params?.departmentId) q.set("departmentId", params.departmentId)
    if (params?.page) q.set("page", String(params.page))
    if (params?.limit) q.set("limit", String(params.limit))
    return request<ApiResponse<Equipment[]> & { total: number; totalPages: number }>(`/equipment?${q}`)
  },

  categories: () =>
    request<ApiResponse<{ category: string; count: number }[]>>("/equipment/categories"),

  get: (id: string) =>
    request<ApiResponse<Equipment & { handovers: Handover[] }>>(`/equipment/${id}`),

  create: (body: {
    name: string; category: string; serial_number: string; tag_number: string
    status: EquipmentStatus; condition: EquipmentCondition; purchase_date: string
    assigned_to?: string | null; notes?: string
  }) =>
    request<ApiResponse<Equipment>>("/equipment", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<{
    name: string; category: string; serial_number: string; tag_number: string
    status: EquipmentStatus; condition: EquipmentCondition; purchase_date: string
    assigned_to: string | null; notes: string
  }>) =>
    request<ApiResponse<Equipment>>(`/equipment/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/equipment/${id}`, { method: "DELETE" }),
}

// ─── Handovers ────────────────────────────────────────────────────────────────

export const handovers = {
  list: (params?: {
    status?: string; activityType?: string; userId?: string
    equipmentId?: string; search?: string; dateFrom?: string; dateTo?: string
    sortBy?: string; sortDir?: string; page?: number; limit?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set("status", params.status)
    if (params?.activityType) q.set("activityType", params.activityType)
    if (params?.userId) q.set("userId", params.userId)
    if (params?.equipmentId) q.set("equipmentId", params.equipmentId)
    if (params?.search) q.set("search", params.search)
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom)
    if (params?.dateTo) q.set("dateTo", params.dateTo)
    if (params?.sortBy) q.set("sortBy", params.sortBy)
    if (params?.sortDir) q.set("sortDir", params.sortDir)
    if (params?.page) q.set("page", String(params.page))
    if (params?.limit) q.set("limit", String(params.limit))
    return request<ApiResponse<Handover[]> & { total: number; totalPages: number }>(`/handovers?${q}`)
  },

  get: (id: string) =>
    request<ApiResponse<Handover & {
      from_user_email?: string; from_user_dept?: string
      to_user_email?: string; to_user_dept?: string
      equipment_serial?: string; equipment_condition?: string
    }>>(`/handovers/${id}`),

  create: (body: {
    equipment_id: string; activity_type: HandoverActivityType
    from_user_id?: string | null; to_user_id?: string | null
    notes?: string; date?: string
  }) =>
    request<ApiResponse<Handover>>("/handovers", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cancel: (id: string) =>
    request<ApiResponse<Handover>>(`/handovers/${id}/cancel`, { method: "PATCH" }),
}

// ─── Maintenance Logs ──────────────────────────────────────────────────────────

export interface MaintenanceLog {
  id: string
  equipment_id: string
  type: "repair" | "inspection" | "calibration" | "cleaning" | "upgrade" | "other"
  description: string
  cost?: number
  date: string
  logged_by?: string
  logged_by_name?: string
  created_at: string
}

export const maintenance = {
  list: (equipmentId: string) =>
    request<ApiResponse<MaintenanceLog[]>>(`/maintenance/${equipmentId}`),

  create: (body: {
    equipment_id: string
    type: string
    description: string
    cost?: number
    date?: string
  }) =>
    request<ApiResponse<MaintenanceLog>>("/maintenance", {
      method: "POST",
      body: JSON.stringify(body),
    }),
}

// ─── Activity Events ───────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  user_id?: string
  user_name?: string
  action: string
  entity_type: string
  entity_id?: string
  description: string
  metadata?: Record<string, unknown>
  created_at: string
}

export const activities = {
  list: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set("page", String(params.page))
    if (params?.limit) q.set("limit", String(params.limit))
    return request<ApiResponse<ActivityEvent[]> & { total: number; totalPages: number }>(`/activities?${q}`)
  },
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reports = {
  dashboard: () =>
    request<ApiResponse<DashboardStats>>("/reports/dashboard"),

  equipment: (params?: {
    department?: string; condition?: string; category?: string; period?: string
    dateFrom?: string; dateTo?: string; userId?: string
  }) => {
    const q = new URLSearchParams()
    if (params?.department) q.set("department", params.department)
    if (params?.condition) q.set("condition", params.condition)
    if (params?.category) q.set("category", params.category)
    if (params?.period) q.set("period", params.period)
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom)
    if (params?.dateTo) q.set("dateTo", params.dateTo)
    if (params?.userId) q.set("userId", params.userId)
    return request<ApiResponse<{
      byDepartment: { dept: string; count: number }[]
      byCategory: { name: string; value: number }[]
      byCondition: { name: string; value: number }[]
      topUsers: { name: string; count: number; department: string }[]
      items?: Equipment[]
    }>>(`/reports/equipment?${q}`)
  },

  handovers: (params?: {
    period?: string; dateFrom?: string; dateTo?: string
    userId?: string; activityType?: string
  }) => {
    const q = new URLSearchParams()
    if (params?.period) q.set("period", params.period)
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom)
    if (params?.dateTo) q.set("dateTo", params.dateTo)
    if (params?.userId) q.set("userId", params.userId)
    if (params?.activityType) q.set("activityType", params.activityType)
    return request<ApiResponse<{
      monthly: { month: string; count: number }[]
      byActivity: { activity_type: string; count: number }[]
      topUsers: { name: string; count: number }[]
      items?: Handover[]
    }>>(`/reports/handovers?${q}`)
  },
}
