export interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  region: string | null;
  brand: string | null;
  locale: string;
  timezone: string;
  wakePhrase: string;
  cloudAiForDocs: boolean;
  guardianConsent: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}
