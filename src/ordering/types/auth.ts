// src/ordering/types/auth.ts
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: string;
  restaurant_id?: string;
  role?: 'user' | 'admin' | 'super_admin';
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface JwtPayload {
  sub: string;
  exp: number;
  restaurant_id: string;
  [key: string]: any;
}
