import axios from "axios";
import {
  CONFIG,
  OtpRequestResponse,
  AuthenticateResponse,
  ProfileResponse,
  KycResponse,
  BalanceResponse,
  WalletResponse,
  HistoryResponse,
  ErrorResponse,
  AxiosError,
} from "../config";

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
      { email, otp, sid }
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

// Get KYC status
export async function getKycStatus(accessToken: string): Promise<KycResponse> {
  try {
    const response = await apiClient.get<KycResponse>("/api/kycs", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page: 1, limit: 10 }, // Default pagination
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to get KYC status: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// getBalances
export async function getBalances(
  accessToken: string
): Promise<BalanceResponse> {
  try {
    const response = await apiClient.get<BalanceResponse>(
      "/api/wallets/balances",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to get balances: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// getWallets
export async function getWallets(
  accessToken: string
): Promise<WalletResponse[]> {
  try {
    const response = await apiClient.get<WalletResponse[]>("/api/wallets", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to get wallets: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// set default wallet
export async function setDefaultWallet(
  accessToken: string,
  walletId: string
): Promise<WalletResponse> {
  try {
    const response = await apiClient.post<WalletResponse>(
      "/api/wallets/default",
      { walletId },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to set default wallet: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// Send USDC to email or wallet
export async function sendUsdc(
  accessToken: string,
  recipient: string,
  amount: number,
  network: string = "solana"
): Promise<any> {
  try {
    const response = await apiClient.post(
      "/api/transactions/send",
      { recipient, amount, currency: "USDC", network },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to send USDC: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// Withdraw USDC
export async function withdrawUsdc(
  accessToken: string,
  destination: string,
  amount: number,
  network: string = "solana"
): Promise<any> {
  try {
    const response = await apiClient.post(
      "/api/transactions/withdraw",
      { destination, amount, currency: "USDC", network },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to withdraw USDC: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

export async function getTransactionHistory(
  accessToken: string,
  page: number = 1,
  limit: number = 10
): Promise<HistoryResponse> {
  try {
    const response = await apiClient.get<HistoryResponse>("/api/transactions", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to get transaction history: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}
