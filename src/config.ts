export const CONFIG = {
  COPPERX_API_BASE_URL: "https://income-api.copperx.io",
  SUPPORT_LINK: "https://t.me/copperxcommunity/2183",
};

export const NETWORK_NAMES: { [key: string]: string } = {
  "137": "Polygon",
  "42161": "Arbitrum",
  "8453": "Base",
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

export type BalanceResponse = Array<{
  walletId: string;
  isDefault: boolean | null;
  network: string; // e.g., "137", "42161", "8453"
  balances: Array<{
    symbol: string;
    balance: string;
    decimals: number;
    address: string;
  }>;
}>;

export interface WalletResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  walletType: string;
  isDefault: boolean | null;
  network: string; // e.g., "137", "42161", "8453"
  walletAddress: string;
}

export interface HistoryResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    organizationId: string;
    type: "send" | "receive" | "withdraw" | "deposit" | string;
    providerCode: string;
    kycId: string | null;
    transferId: string;
    status: string;
    externalStatus: string;
    fromAccountId: string;
    toAccountId: string;
    fromAmount: string;
    fromCurrency: string;
    toAmount: string;
    toCurrency: string;
    totalFee: string | null;
    feeCurrency: string | null;
    transactionHash: string | null;
    externalCustomerId: string | null;
    externalTransactionId: string | null;
    depositUrl?: string;
    fromAccount: {
      id: string;
      createdAt: string;
      updatedAt: string;
      type: string;
      network: string;
      accountId: string | null;
      walletAddress: string | null;
      bankName: string | null;
      bankAddress: string | null;
      bankRoutingNumber: string | null;
      bankAccountNumber: string | null;
      bankDepositMessage: string | null;
      wireMessage: string | null;
      country: string;
      payeeId: string | null;
      payeeEmail: string | null;
      payeeOrganizationId: string | null;
      payeeDisplayName: string | null;
    };
    toAccount: {
      id: string;
      createdAt: string;
      updatedAt: string;
      type: string;
      network: string;
      accountId: string | null;
      walletAddress: string | null;
      bankName: string | null;
      bankAddress: string | null;
      bankRoutingNumber: string | null;
      bankAccountNumber: string | null;
      bankDepositMessage: string | null;
      wireMessage: string | null;
      country: string;
      payeeId: string | null;
      payeeEmail: string | null;
      payeeOrganizationId: string | null;
      payeeDisplayName: string | null;
    };
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
