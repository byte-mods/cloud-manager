export type UserRole = "cloud_architect" | "devops_engineer" | "data_engineer" | "system_admin" | "network_admin"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  mfaEnabled: boolean
  organization?: string
  createdAt?: string
}

export interface Permission {
  module: string
  level: "full" | "read_write" | "read" | "none"
}

export interface Session {
  id: string
  userId: string
  accessToken: string
  refreshToken?: string
  expiresAt: string
  device?: string
  ip?: string
}

export interface LoginRequest {
  email: string
  password: string
  mfaCode?: string
}

export interface LoginResponse {
  user: User
  access_token: string
}
