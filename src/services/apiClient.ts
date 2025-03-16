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
  WithdrawResponse,
  PayeeAdditionResponse,
  PayeeListResponse,
  SendResponse,
  WalletBalanceResponse,
  AccountListResponse,
  OfframpQuoteResponse,
  WithdrawToBankResponse,
  BatchPaymentResponse,
  BatchPaymentRequest,
  ErrorResponse,
  PointsResponse,
  AxiosError,
} from "../config";

const apiClient = axios.create({
  baseURL: CONFIG.COPPERX_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Helper function to handle rate limit errors
function handleRateLimitError(error: AxiosError<ErrorResponse>): void {
  if (error.response?.status === 429) {
    const retryAfter = error.response?.headers?.["retry-after"];
    const retryTime = retryAfter
      ? parseInt(retryAfter, 10) || 60 // Default to 60 seconds if parsing fails
      : 60;
    throw new Error(
      `Rate limit exceeded. Please try again in ${retryTime} seconds.`
    );
  }
}

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
    handleRateLimitError(axiosError);
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
    handleRateLimitError(axiosError);
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

// Fetch total Copperx Mint points for a user
export async function getTotalPoints(
  email: string,
  accessToken: string
): Promise<PointsResponse> {
  try {
    const response = await apiClient.get<PointsResponse>("/api/points/total", {
      params: { email },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to fetch points: ${
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

// withdraw to external wallet
export async function withdrawToWallet(
  accessToken: string,
  withdrawData: {
    walletAddress: string;
    amount: string;
    purposeCode: string;
    currency: string;
  }
): Promise<WithdrawResponse> {
  try {
    const response = await apiClient.post<WithdrawResponse>(
      "/api/transfers/wallet-withdraw",
      withdrawData,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to withdraw: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// Addition of payee
export async function createPayee(
  accessToken: string,
  payeeData: {
    nickName: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    bankAccount?: {
      country: string;
      bankName: string;
      bankAddress: string;
      type: string;
      bankAccountType: string;
      bankRoutingNumber: string;
      bankAccountNumber: string;
      bankBeneficiaryName: string;
      bankBeneficiaryAddress: string;
      swiftCode: string;
    };
  }
): Promise<PayeeAdditionResponse> {
  try {
    const response = await apiClient.post<PayeeAdditionResponse>(
      "/api/payees",
      payeeData,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to create payee: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// fetch the list of payees
export async function getPayees(
  accessToken: string,
  page: number = 1,
  limit: number = 10
): Promise<PayeeListResponse> {
  try {
    const response = await apiClient.get<PayeeListResponse>("/api/payees", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to fetch payees: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// sending usdc using email
export async function sendToUser(
  accessToken: string,
  sendData: {
    email?: string;
    walletAddress?: string;
    payeeId?: string;
    amount: string;
    purposeCode: string;
    currency: string;
  }
): Promise<SendResponse> {
  try {
    const response = await apiClient.post<SendResponse>(
      "/api/transfers/send",
      sendData,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to send payment: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

export async function getWalletBalance(
  accessToken: string
): Promise<WalletBalanceResponse> {
  try {
    const response = await apiClient.get<WalletBalanceResponse>(
      "/api/wallets/balance",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to fetch wallet balance: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

export async function getAccounts(
  accessToken: string
): Promise<AccountListResponse> {
  try {
    const response = await apiClient.get<AccountListResponse>("/api/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to fetch accounts: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

// fetching the offramp to bank quotes/details
export async function getOfframpQuote(
  accessToken: string,
  quoteData: {
    amount: string;
    currency: string;
    destinationCountry: string;
    onlyRemittance: boolean;
    preferredBankAccountId: string;
    sourceCountry: string;
  }
): Promise<OfframpQuoteResponse> {
  try {
    const response = await apiClient.post<OfframpQuoteResponse>(
      "/api/quotes/offramp",
      quoteData,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to fetch offramp quote: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}

export async function createOfframpTransfer(
  accessToken: string,
  transferData: {
    purposeCode: string;
    quotePayload: string;
    quoteSignature: string;
  }
): Promise<WithdrawToBankResponse> {
  try {
    const response = await apiClient.post<WithdrawToBankResponse>(
      "/api/transfers/offramp",
      transferData,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to create offramp transfer: ${
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
    const response = await apiClient.get<HistoryResponse>("/api/transfers", {
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

// Send batch payment
export async function sendBatchPayment(
  accessToken: string,
  requests: BatchPaymentRequest[]
): Promise<BatchPaymentResponse> {
  try {
    const response = await apiClient.post<BatchPaymentResponse>(
      "/api/transfers/send-batch",
      { requests },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ErrorResponse>;
    throw new Error(
      `Failed to send batch payment: ${
        axiosError.response?.data?.message || axiosError.message
      }`
    );
  }
}
