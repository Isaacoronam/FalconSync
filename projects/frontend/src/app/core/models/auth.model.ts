export type UserRole = 'user' | 'moderator' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  data: {
    user: AuthUser;
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
  };
}

export interface AuthMeResponse {
  data: {
    user: AuthUser;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}


