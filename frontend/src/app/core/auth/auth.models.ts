export interface User {
  id: number;
  name: string;
  username: string;
  phone: string;
  company: { id: number; name: string };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  username: string;
  phone: string;
  company: string;
  password: string;
}
