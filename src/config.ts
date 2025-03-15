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
  organizationId?: string;
  otpRequestedAt?: Date;
  loginState?: "waiting_for_email" | "waiting_for_otp" | "logged_in";
  lastAction?: string;
  withdrawQuote?: {
    signature: string;
    bankAccountId: string;
    amount: number;
    payload: string;
  };
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
  organizationId?: string;
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

// for the offramp to bank
export interface WalletBalanceResponse {
  balance: string;
  decimals: number;
  symbol: string;
  address: string;
}

export interface AccountListResponse {
  data: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    organizationId: string;
    type: string;
    walletAccountType: string | null;
    isDefault: boolean;
    country: string;
    network: string | null;
    walletAddress: string | null;
    bankAccount?: {
      bankName: string;
      bankAddress: string;
      bankAccountType: string;
      bankRoutingNumber: string;
      bankAccountNumber: string;
      bankBeneficiaryName: string;
      swiftCode: string;
      method: string;
    };
    method: string;
    accountKycs: Array<{
      id: string;
      createdAt: string;
      updatedAt: string;
      accountId: string;
      providerId: string;
      status: string;
      providerCode: string;
      supportRemittance: boolean;
    }>;
    status: string;
  }>;
}

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
    status: string;
    customerId: string | null;
    type: "send" | "receive" | "withdraw" | "deposit" | "off_ramp" | string;
    amount: string;
    currency: string;
    amountSubtotal: string;
    totalFee: string | null;
    feeCurrency: string | null;
    invoiceNumber: string | null;
    invoiceUrl: string | null;
    purposeCode: string | null;
    sourceAccountId: string;
    destinationAccountId: string;
    sourceCountry: string;
    sourceOfFundsFile: string | null;
    note: string | null;
    destinationCountry: string;
    isThirdPartyPayment: boolean | null;
    destinationCurrency: string | null;
    mode: string;
    feePercentage: string | null;
    paymentUrl: string | null;
    senderDisplayName: string | null;
    transactions: Array<{
      id: string;
      createdAt: string;
      updatedAt: string;
      organizationId: string;
      type: "send" | "receive" | "withdraw" | "deposit" | "off_ramp" | string;
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
      depositAccount?: {
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
    sourceAccount: {
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
    destinationAccount: {
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

export interface WithdrawResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  status: string;
  customerId: string | null;
  customer?: {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    businessName: string;
    email: string;
    country: string;
  };
  type: string;
  sourceCountry: string;
  destinationCountry: string;
  destinationCurrency: string;
  amount: string;
  currency: string;
  amountSubtotal: string;
  totalFee: string;
  feePercentage: string | null;
  feeCurrency: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  sourceOfFundsFile: string | null;
  note: string | null;
  purposeCode: string;
  sourceOfFunds: string | null;
  recipientRelationship: string | null;
  sourceAccountId: string;
  destinationAccountId: string;
  paymentUrl: string | null;
  mode: string;
  isThirdPartyPayment: boolean | null;
  sourceAccount: {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    country: string;
    network: string;
    accountId: string | null;
    walletAddress: string | null;
    bankName: string | null;
    bankAddress: string | null;
    bankRoutingNumber: string | null;
    bankAccountNumber: string | null;
    bankDepositMessage: string | null;
    wireMessage: string | null;
    payeeEmail: string | null;
    payeeOrganizationId: string | null;
    payeeId: string | null;
    payeeDisplayName: string | null;
  };
  destinationAccount: {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    country: string;
    network: string;
    accountId: string | null;
    walletAddress: string | null;
    bankName: string | null;
    bankAddress: string | null;
    bankRoutingNumber: string | null;
    bankAccountNumber: string | null;
    bankDepositMessage: string | null;
    wireMessage: string | null;
    payeeEmail: string | null;
    payeeOrganizationId: string | null;
    payeeId: string | null;
    payeeDisplayName: string | null;
  };
  senderDisplayName: string;
}

export interface PayeeAdditionResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  nickName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
  displayName: string;
  bankAccount: {
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
  } | null;
  isGuest: boolean;
  hasBankAccount: boolean;
}

export interface PayeeListResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    organizationId: string;
    nickName: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phoneNumber: string | null;
    displayName: string;
    bankAccount: {
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
    } | null;
    isGuest: boolean;
    hasBankAccount: boolean;
  }>;
}

export interface SendResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  status: string;
  customerId: string | null;
  type: string;
  sourceCountry: string;
  destinationCountry: string;
  destinationCurrency: string | null;
  amount: string;
  currency: string;
  amountSubtotal: string;
  totalFee: string;
  feeCurrency: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  purposeCode: string;
  sourceOfFundsFile: string | null;
  note: string | null;
  sourceAccountId: string;
  destinationAccountId: string;
  mode: string;
  senderDisplayName: string;
  sourceAccount: {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    network: string;
    accountId: string | null;
    walletAddress: string | null;
    country: string;
  };
  destinationAccount: {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    network: string;
    accountId: string | null;
    walletAddress: string | null;
    country: string;
    payeeId: string | null;
    payeeEmail: string | null;
    payeeDisplayName: string | null;
  };
}

export interface OfframpQuoteResponse {
  minAmount: string;
  maxAmount: string;
  arrivalTimeMessage: string;
  provider: {
    id: string;
    createdAt: string;
    updatedAt: string;
    organizationId: string;
    status: string;
    providerCode: string;
    externalKycId: string | null;
    externalCustomerId: string | null;
    providerData: Record<string, any>;
    country: string;
    supportRemittance: boolean;
  };
  error: string | null;
  quotePayload: string;
  quoteSignature: string;
}

export interface WithdrawToBankResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  status: string;
  customerId: string | null;
  type: string;
  amount: string;
  currency: string;
  amountSubtotal: string;
  totalFee: string;
  feeCurrency: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  purposeCode: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceCountry: string;
  sourceOfFundsFile: string | null;
  note: string | null;
  destinationCountry: string;
  isThirdPartyPayment: boolean;
  destinationCurrency: string;
  mode: string;
  feePercentage: string;
  paymentUrl: string;
  senderDisplayName: string;
  sourceAccount: {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    network: string;
    accountId: string;
    walletAddress: string;
  };
  destinationAccount: {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: string;
    network: string | null;
    accountId: string | null;
    walletAddress: string | null;
    bankName: string;
    bankAddress: string;
    bankRoutingNumber: string;
    bankAccountNumber: string;
  };
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
