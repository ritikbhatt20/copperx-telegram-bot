import axios from "axios";
import { CONFIG } from "./config";

// Define response types
interface OtpRequestResponse {
  email: string;
  sid: string;
}

interface AuthenticateResponse {
  accessToken: string;
  expireAt: string;
  user: {
    id: string;
    email: string;
    [key: string]: any; // Allow additional fields like firstName, etc.
  };
}

interface ProfileResponse {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  status: string;
  [key: string]: any; // Allow additional fields
}

interface ErrorResponse {
  message?: string;
  statusCode?: number;
  error?: string;
}

// Define the AxiosError type manually to avoid import errors
type AxiosError<T = any> = Error & {
  response?: {
    data?: T;
    status?: number;
    headers?: Record<string, string>;
  };
  isAxiosError: boolean;
};

const apiClient = axios.create({
  baseURL: CONFIG.COPPERX_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request OTP
export async function requestOtp(email: string): Promise<OtpRequestResponse> {
  try {
    const response = await apiClient.post<OtpRequestResponse>(
      "/api/auth/email-otp/request",
      { email }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to request OTP: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// Authenticate with OTP
export async function authenticateOtp(
  email: string,
  otp: string,
  sid: string
): Promise<AuthenticateResponse> {
  try {
    const response = await apiClient.post<AuthenticateResponse>(
      "/api/auth/email-otp/authenticate",
      {
        email,
        otp,
        sid,
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to authenticate: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// Get user profile
export async function getProfile(
  accessToken: string
): Promise<ProfileResponse> {
  try {
    const response = await apiClient.get<ProfileResponse>("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to get profile: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}
