export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ErrorResponse {
  error: { code: string; message: string; status: number; details?: Record<string, unknown> }
}

export type SortDirection = "asc" | "desc"

export interface ListQueryParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: SortDirection
  search?: string
  filters?: Record<string, string | string[]>
}
