export interface User {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string;
  isAdmin: boolean;
  company: { id: number; name: string };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  // Username or email.
  login: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  username: string;
  email: string;
  phone: string;
  company: string;
  password: string;
}
