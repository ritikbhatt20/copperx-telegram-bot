export const CONFIG = {
  COPPERX_API_BASE_URL: "https://income-api.copperx.io",
  SUPPORT_LINK: "https://t.me/copperxcommunity/2183",
};

export interface UserSession {
  chatId: string;
  email?: string;
  sid?: string;
  accessToken?: string;
  expireAt?: string;
  otpRequestedAt?: Date;
  loginState?: "waiting_for_email" | "waiting_for_otp" | "logged_in";
  lastAction?: string;
}

// Define response types
export interface OtpRequestResponse {
  email: string;
  sid: string;
}

export interface AuthenticateResponse {
  accessToken: string;
  expireAt: string;
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

export interface ProfileResponse {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  status: string;
  [key: string]: any;
}

export interface KycResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: Array<{
    id: string;
    status: string; // e.g., "approved", "pending", "rejected"
    type: string; // e.g., "individual", "business"
    kycUrl?: string; // Optional URL for KYC completion
    [key: string]: any; // Allow additional fields
  }>;
}

export interface BalanceResponse {
  balances: Array<{
    currency: string;
    network: string;
    amount: string;
  }>;
}

export interface ErrorResponse {
  message?: string;
  statusCode?: number;
  error?: string;
}

// Define the AxiosError type manually
export type AxiosError<T = any> = Error & {
  response?: {
    data?: T;
    status?: number;
    headers?: Record<string, string>;
  };
  isAxiosError: boolean;
};
