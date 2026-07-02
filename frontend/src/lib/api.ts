const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TOKEN_KEY = "invodata_token";
const USER_KEY = "invodata_user";
const LANGUAGE_KEY = "invodata_language";
const USER_ENCRYPTION_KEY = "invodata_user_key";

export interface Issuer {
  name?: string;
  taxId?: string;
}

export interface InvoiceItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  taxPrice?: number;
  taxPercent?: number;
}

export interface Invoice {
  id?: number;
  publicId: string;
  documentNum: string;
  date: string;
  issuer?: Issuer;
  category?: string | null;
  items?: InvoiceItem[];
  revenue?: boolean;
  totalAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  licensePlate?: string;
  paymentMethod?: string;
  notes?: string;
  fileID?: string;
  redactedFileID?: string;
  originalFileName?: string;
  createdAt?: string;
  shared?: boolean;
  sharedBy?: string | null;
  shareId?: number | null;
  account?: {
    id: number;
    name?: string;
  } | null;
}

export interface UserProfile {
  id?: number;
  username?: string;
  name?: string;
  email?: string;
  taxId?: string;
  type?: string;
  aiConsent?: boolean;
  language?: string;
  mfaEnabled?: boolean;
}



export interface InvoiceCreatePayload {
  documentNum: string;
  date: string;
  revenue: boolean;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  licensePlate?: string;
  paymentMethod?: string;
  notes?: string;
  issuerTaxId?: string;
  issuerName?: string;
  issuerCategory?: string;
  items?: InvoiceItem[];
  accountId?: number | null;
}

export interface UploadJobCreateResponse {
  jobId: string;
}

export interface RedactionBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}

export interface UploadJobStatusResponse {
  jobId: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "ERROR" | "CANCELED";
  invoices?: Invoice[];
  existingInvoices?: UploadInvoiceReference[];
  error?: string | null;
}

export interface UploadInvoiceReference {
  publicId: string;
  originalFileName?: string;
  documentNum?: string;
}

export interface NotificationItem {
  id: number;
  message: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
  actionUrl?: string | null;
  shareId?: number | null;
}

export interface ChatSessionResponse {
  sessionId: string;
}

export interface ChatSessionListItem {
  id: string;
  title?: string | null;
  createdAt?: string | null;
  lastActivityAt?: string | null;
}

export interface ChatMessageResponse {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ChatAction {
  type: "create_account" | "create_goal" | "create_budget";
  name?: string | null;
  accountType?: string | null;
  balance?: number | null;
  currency?: string | null;
  last4?: string | null;
  isEmergencyFund?: boolean | null;
  targetAmount?: number | null;
  currentAmount?: number | null;
  deadline?: string | null;
  linkedAccountName?: string | null;
  category?: string | null;
  monthlyLimit?: number | null;
  month?: number | null;
  year?: number | null;
}

export interface ChatInvoiceFilter {
  search?: string | null;
  period?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
}

export interface ChatResponse {
  response: string;
  actions?: ChatAction[];
  invoiceFilter?: ChatInvoiceFilter | null;
}

export interface Account {
  id: number;
  name: string;
  type?: string;
  balance?: number;
  currency?: string;
  active?: boolean;
  isEmergencyFund?: boolean;
  last4?: string | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  number: number;
  size: number;
}

export interface InvoiceTotalsResponse {
  netTotal: number;
  taxTotal: number;
  totalAmount: number;
}

export interface SetupStatus {
  setupCompleted: boolean;
  storageTarget: string;
  localPath: string;
  nfsPath: string;
  aiEnabled: boolean;
  allowPublicShares: boolean;
}

export interface SetupRequest {
  adminPassword: string;
  storageTarget: string;
  localPath?: string;
  nfsPath?: string;
  aiEnabled?: boolean;
  allowPublicShares?: boolean;
}

export interface InvoiceShareResponse {
  id: number;
  type: "public" | "user";
  sharedWith?: string | null;
  token?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
}

export interface AdminPublicShareSettings {
  allowPublicShares: boolean;
}

export interface AdminStorageSettings {
  storageTarget: string;
  localPath: string;
  nfsPath: string;
}

export const getAdminPublicShares = async (password: string) => {
  if (!password) {
    throw new Error("Password é obrigatória.");
  }

  return apiFetch<AdminPublicShareSettings>(
    `/api/admin/public-shares?password=${encodeURIComponent(password)}`
  );
};

export const updateAdminPublicShares = async (password: string, allowPublicShares: boolean) => {
  if (!password) {
    throw new Error("Password é obrigatória.");
  }

  return apiFetch<AdminPublicShareSettings>(
    `/api/admin/public-shares?password=${encodeURIComponent(password)}`,
    {
      method: "PUT",
      body: JSON.stringify({ allowPublicShares }),
    }
  );
};

export const getAdminStorageSettings = async (password: string) => {
  if (!password) {
    throw new Error("Password é obrigatoria.");
  }

  return apiFetch<AdminStorageSettings>(
    `/api/admin/storage?password=${encodeURIComponent(password)}`
  );
};

export const updateAdminStorageSettings = async (password: string, payload: AdminStorageSettings) => {
  if (!password) {
    throw new Error("Password é obrigatoria.");
  }

  return apiFetch<AdminStorageSettings>(
    `/api/admin/storage?password=${encodeURIComponent(password)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
};

export interface InvoiceShareSnapshotItem {
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  taxPrice?: number | null;
  taxPercent?: number | null;
}

export interface InvoiceShareSnapshot {
  publicId?: string | null;
  documentNum?: string | null;
  date?: string | null;
  issuerName?: string | null;
  issuerTaxId?: string | null;
  category?: string | null;
  revenue?: boolean | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  netAmount?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
  originalFileName?: string | null;
  createdAt?: string | null;
  items?: InvoiceShareSnapshotItem[];
}

export interface InvoiceShareSnapshotResponse {
  shareId?: number | null;
  token?: string | null;
  type: "public" | "user";
  createdAt?: string | null;
  expiresAt?: string | null;
  allowImport?: boolean | null;
  allowPdf?: boolean | null;
  allowPdfDownload?: boolean | null;
  invoice?: InvoiceShareSnapshot | null;
}

export interface AdminMonthlyCount {
  month: string;
  total: number;
}

export interface AdminStatsResponse {
  totalUsers: number;
  totalInvoices: number;
  uploadedInvoices: number;
  manualInvoices: number;
  totalAccounts: number;
  totalIssuers: number;
  usersMonthly: AdminMonthlyCount[];
  invoicesMonthly: AdminMonthlyCount[];
  generatedAt: string;
}

export interface AdminUser {
  id: number;
  username: string;
  name?: string | null;
  email?: string | null;
  createdAt?: string | null;
}

export interface EmergencyFundStatus {
  targetAmount: number;
  currentSaved: number;
  progressPercentage: number;
  monthsCovered: number;
  isGoalMet: boolean;
}

export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  completed?: boolean | null;
  shared?: boolean;
  sharedBy?: string | null;
  shareId?: number | null;
  linkedAccount?: {
    id: number;
    name?: string;
  } | null;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  month: number;
  year: number;
}

export interface BudgetStatus {
  category: string;
  monthlyLimit: number;
  currentSpending: number;
  remaining: number;
  percentageUsed: number;
}

export interface InvoiceCategory {
  id: number;
  name: string;
  color: string;
}

export interface SavingsRateStats {
  month: number;
  year: number;
  totalRevenue: number;
  totalExpense: number;
  totalNetRevenue?: number;
  totalNetExpense?: number;
  savingsAmount: number;
  savingsRate: number;
}

export interface FinanceComparison {
  currentMonthTotal: number;
  previousMonthTotal: number;
  variationPercentage: number;
}

export interface CategorySpending {
  name: string;
  value: number;
}

export interface MonthlyEvolutionEntry {
  month: string;
  revenue: number;
  expense: number;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  mfaTrustToken?: string;
}

export interface PasswordResetRequestResponse {
  status: string;
  resetToken?: string;
  expiresAt?: string;
}

export const setAuth = (token: string, user: UserProfile) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user?.language) {
    localStorage.setItem(LANGUAGE_KEY, user.language);
  }
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const getAuthUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getStoredLanguage = () => localStorage.getItem(LANGUAGE_KEY);

export const setStoredLanguage = (language: string) => {
  localStorage.setItem(LANGUAGE_KEY, language);
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LANGUAGE_KEY);
  sessionStorage.removeItem(USER_ENCRYPTION_KEY);
};

export const setUserKey = (key: string) => {
  sessionStorage.setItem(USER_ENCRYPTION_KEY, key);
};

export const getUserKey = () => sessionStorage.getItem(USER_ENCRYPTION_KEY);

export const clearUserKey = () => sessionStorage.removeItem(USER_ENCRYPTION_KEY);

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  const token = getAuthToken();
  const userKey = getUserKey();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (userKey) {
    headers.set("X-User-Key", userKey);
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Erro ao comunicar com o servidor.";
    try {
      const payload = await response.json();
      const errorCode = payload?.error?.code as string | undefined;
      if (errorCode === "USER_KEY_REQUIRED") {
        clearAuth();
        message = "User encryption key required. Faça login novamente.";
      } else {
        message = payload?.error?.message || payload?.message || message;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return {} as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
};

export const getSetupStatus = async () =>
  apiFetch<SetupStatus>("/api/setup/status");

export const completeSetup = async (payload: SetupRequest) =>
  apiFetch<SetupStatus>("/api/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const uploadSetupAiCredentials = async (file: File, adminPassword?: string) => {
  const formData = new FormData();
  formData.append("file", file);
  const headers: HeadersInit = {};
  if (adminPassword) {
    headers["X-Admin-Password"] = adminPassword;
  }
  return apiFetch<void>("/api/setup/ai-credentials", {
    method: "POST",
    body: formData,
    headers,
  });
};

export const uploadAdminAiCredentials = async (file: File, adminPassword: string) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<void>("/api/admin/ai-credentials", {
    method: "POST",
    body: formData,
    headers: {
      "X-Admin-Password": adminPassword,
    },
  });
};

export const login = async (
  username: string,
  password: string,
  totp?: string,
  rememberDevice?: boolean,
  trustToken?: string
) =>
  apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, totp, rememberDevice, trustToken }),
  });

export const getUserEncryptionSalt = async (username: string) =>
  apiFetch<{ salt: string }>(`/api/auth/salt?username=${encodeURIComponent(username)}`);

export const setupMfa = async () =>
  apiFetch<{ secret: string; otpauthUrl: string }>("/api/user/mfa/setup", {
    method: "POST",
  });

export const enableMfa = async (code: string) =>
  apiFetch<{ status: string }>("/api/user/mfa/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

export const disableMfa = async (password: string, code: string) =>
  apiFetch<{ status: string }>("/api/user/mfa/disable", {
    method: "POST",
    body: JSON.stringify({ password, code }),
  });

export const registerUser = async (payload: {
  username: string;
  password: string;
  email: string;
  name: string;
  aiConsent: boolean;
  privacyConsent: boolean;
}) =>
  apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const requestPasswordReset = async (identifier: string) =>
  apiFetch<{ status: string; resetToken?: string; expiresAt?: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });

export const resetPassword = async (token: string, newPassword: string) =>
  apiFetch<{ status: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });

export const getNotifications = async () =>
  apiFetch<NotificationItem[]>("/api/notifications", {
    method: "GET",
  });

export const getUnreadNotificationsCount = async () =>
  apiFetch<number>("/api/notifications/unread-count", {
    method: "GET",
  });

export const markNotificationRead = async (id: number) =>
  apiFetch<void>(`/api/notifications/${id}/read`, {
    method: "PUT",
  });

export const markAllNotificationsRead = async () =>
  apiFetch<void>("/api/notifications/read-all", {
    method: "PUT",
  });

export const deleteNotification = async (id: number) =>
  apiFetch<void>(`/api/notifications/${id}`, {
    method: "DELETE",
  });

export const clearNotifications = async () =>
  apiFetch<void>("/api/notifications", {
    method: "DELETE",
  });

export const acceptUserShare = async (shareId: number) =>
  apiFetch<InvoiceShareSnapshotResponse>(`/api/shares/user/${shareId}/accept`, {
    method: "POST",
  });

export const declineUserShare = async (shareId: number) =>
  apiFetch<void>(`/api/shares/user/${shareId}`, {
    method: "DELETE",
  });


export const getInvoices = async (
  page = 0,
  size = 20,
  sort?: string,
  createdOn?: string,
  fileName?: string,
  accountId?: number,
  search?: string,
  period?: string,
  category?: string,
  paymentMethod?: string,
  revenue?: boolean,
  startDate?: string,
  endDate?: string
) => {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (sort) {
    params.set("sort", sort);
  }
  if (createdOn) {
    params.set("createdOn", createdOn);
  }
  if (fileName) {
    params.set("fileName", fileName);
  }
  if (accountId !== undefined) {
    params.set("accountId", String(accountId));
  }
  if (search) {
    params.set("search", search);
  }
  if (period) {
    params.set("period", period);
  }
  if (category) {
    params.set("category", category);
  }
  if (paymentMethod) {
    params.set("paymentMethod", paymentMethod);
  }
  if (revenue !== undefined) {
    params.set("revenue", String(revenue));
  }
  if (startDate) {
    params.set("startDate", startDate);
  }
  if (endDate) {
    params.set("endDate", endDate);
  }
  return apiFetch<Page<Invoice>>(`/api/invoices?${params.toString()}`);
};

export const getInvoiceSummary = async (
  search?: string,
  period?: string,
  category?: string,
  paymentMethod?: string,
  revenue?: boolean,
  createdOn?: string,
  fileName?: string,
  accountId?: number,
  startDate?: string,
  endDate?: string,
) => {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  if (period) {
    params.set("period", period);
  }
  if (category) {
    params.set("category", category);
  }
  if (paymentMethod) {
    params.set("paymentMethod", paymentMethod);
  }
  if (revenue !== undefined) {
    params.set("revenue", String(revenue));
  }
  if (createdOn) {
    params.set("createdOn", createdOn);
  }
  if (fileName) {
    params.set("fileName", fileName);
  }
  if (accountId !== undefined) {
    params.set("accountId", String(accountId));
  }
  if (startDate) {
    params.set("startDate", startDate);
  }
  if (endDate) {
    params.set("endDate", endDate);
  }
  const suffix = params.toString();
  return apiFetch<InvoiceTotalsResponse>(`/api/invoices/summary${suffix ? `?${suffix}` : ""}`);
};

export const deleteInvoice = async (publicId: string) =>
  apiFetch<void>(`/api/invoices/${publicId}`, { method: "DELETE" });

export const createUploadJob = async (
  file: File,
  privacy?: {
    userTaxId?: string;
    redactName?: string;
    redactTerms?: string;
    storeRedactedOnly?: boolean;
  },
  redactedFile?: File
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (privacy?.userTaxId) {
    formData.append("userTaxId", privacy.userTaxId);
  }
  if (privacy?.redactName) {
    formData.append("redactName", privacy.redactName);
  }
  if (privacy?.redactTerms) {
    formData.append("redactTerms", privacy.redactTerms);
  }
  if (privacy?.storeRedactedOnly) {
    formData.append("storeRedactedOnly", "true");
  }
  if (redactedFile) {
    formData.append("redactedFile", redactedFile);
  }
  return apiFetch<UploadJobCreateResponse>("/api/invoices/upload-job", {
    method: "POST",
    body: formData,
  });
};

export const getUploadJob = async (jobId: string) =>
  apiFetch<UploadJobStatusResponse>(`/api/invoices/upload-job/${jobId}`);

export const cancelUploadJob = async (jobId: string) =>
  apiFetch<void>(`/api/invoices/upload-job/${jobId}/cancel`, { method: "POST" });

export const createChatSession = async (title?: string) => {
  const suffix = title ? `?title=${encodeURIComponent(title)}` : "";
  return apiFetch<ChatSessionResponse>(`/api/chat/sessions${suffix}`, { method: "POST" });
};

export const getChatMessages = async (sessionId: string, limit = 50) =>
  apiFetch<ChatMessageResponse[]>(`/api/chat/sessions/${sessionId}/messages?limit=${limit}`);

export const getChatSessions = async (limit = 30) =>
  apiFetch<ChatSessionListItem[]>(`/api/chat/sessions?limit=${limit}`);

export const updateChatSession = async (sessionId: string, title: string) =>
  apiFetch<ChatSessionListItem>(`/api/chat/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });

export const deleteChatSession = async (sessionId: string) =>
  apiFetch<void>(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });

export const postChatMessage = async (sessionId: string, message: string) =>
  apiFetch<ChatResponse>(`/api/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });

export const getAccounts = async () => apiFetch<Account[]>("/api/user/account");

export const createAccount = async (payload: {
  name: string;
  type?: string;
  currency?: string;
  last4?: string;
}) =>
  apiFetch<Account>("/api/user/account", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getUserProfile = async () => apiFetch<UserProfile>("/api/user/");


export const migrateEncryption = async () =>
  apiFetch<Record<string, number>>("/api/user/migrate-encryption", {
    method: "POST",
  });

export const updateUserProfile = async (payload: {
  username?: string;
  name?: string;
  email?: string;
  taxId?: string;
  language?: string;
  currentPassword?: string;
  newPassword?: string;
}) =>
  apiFetch<{ user: UserProfile; token?: string }>("/api/user", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updatePassword = async (payload: {
  currentPassword: string;
  newPassword: string;
}) =>
  apiFetch<{ message: string }>("/api/user/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updateAiConsent = async (consent: boolean) =>
  apiFetch<{ ai_consent: boolean }>("/api/user/consent", {
    method: "PUT",
    body: JSON.stringify({ consent }),
  });

export const exportUserDataZip = async (password: string) => {
  const token = getAuthToken();
  const userKey = getUserKey();
  const response = await fetch(`${API_BASE_URL}/api/user/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userKey ? { "X-User-Key": userKey } : {}),
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    let message = "Erro ao comunicar com o servidor.";
    try {
      const payload = await response.json();
      const errorCode = payload?.error?.code as string | undefined;
      if (errorCode === "USER_KEY_REQUIRED") {
        clearAuth();
        message = "User encryption key required. Faça login novamente.";
      } else {
        message = payload?.error?.message || payload?.message || message;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("zip") && !contentType.includes("octet-stream")) {
    const text = await response.text();
    throw new Error(text || "Resposta inválida do servidor.");
  }

  return response.blob();
};

export const deleteUserData = async (password: string) =>
  apiFetch<{ message: string }>("/api/user", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });

export const updateAccount = async (id: number, payload: {
  name?: string;
  type?: string;
  currency?: string;
  balance?: number;
  isEmergencyFund?: boolean;
  active?: boolean;
  last4?: string;
}) =>
  apiFetch<Account>(`/api/user/account/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteAccount = async (id: number) =>
  apiFetch<void>(`/api/user/account/${id}`, { method: "DELETE" });

export const getInvoiceById = async (publicId: string) =>
  apiFetch<Invoice>(`/api/invoices/${publicId}`);

export const getAdminUsers = async (password: string) =>
  apiFetch<AdminUser[]>(`/api/admin/users?password=${encodeURIComponent(password)}`);

export const adminResetUserPassword = async (password: string, username: string, newPassword: string) =>
  apiFetch<void>(`/api/admin/users/reset-password?password=${encodeURIComponent(password)}`, {
    method: "POST",
    body: JSON.stringify({ username, newPassword }),
  });

export const adminDeleteUser = async (password: string, username: string) =>
  apiFetch<void>(`/api/admin/users/${encodeURIComponent(username)}?password=${encodeURIComponent(password)}`, {
    method: "DELETE",
  });

export const createInvoiceShare = async (
  publicId: string,
  payload: {
    username?: string;
    publicLink?: boolean;
    expiresInDays?: number;
    allowImport?: boolean;
    allowPdf?: boolean;
    allowPdfDownload?: boolean;
  }
) =>
  apiFetch<InvoiceShareResponse>(`/api/shares/invoices/${publicId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listInvoiceShares = async (publicId: string) =>
  apiFetch<InvoiceShareResponse[]>(`/api/shares/invoices/${publicId}`);

export const revokeInvoiceShare = async (publicId: string, shareId: number) =>
  apiFetch<void>(`/api/shares/invoices/${publicId}/${shareId}`, {
    method: "DELETE",
  });

export const getSharedInvoiceByToken = async (token: string) =>
  apiFetch<InvoiceShareSnapshotResponse>(`/api/shares/token/${token}`);

export const getSharedInvoiceForUser = async (shareId: number) =>
  apiFetch<InvoiceShareSnapshotResponse>(`/api/shares/user/${shareId}`);

export const downloadSharedInvoiceFileByToken = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/shares/token/${token}/file`);
  if (!response.ok) {
    let message = "Falha ao descarregar o PDF.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || "fatura.pdf";
  const blob = await response.blob();
  return { blob, filename };
};

export const downloadSharedInvoiceFileForUser = async (shareId: number) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }
  const response = await fetch(`${API_BASE_URL}/api/shares/user/${shareId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    let message = "Falha ao descarregar o PDF.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || "fatura.pdf";
  const blob = await response.blob();
  return { blob, filename };
};

export const importSharedInvoiceByToken = async (token: string) =>
  apiFetch<Invoice>(`/api/shares/import/token/${token}`, {
    method: "POST",
  });

export const importSharedInvoiceForUser = async (shareId: number) =>
  apiFetch<Invoice>(`/api/shares/import/user/${shareId}`, {
    method: "POST",
  });

export const createInvoice = async (payload: InvoiceCreatePayload) =>
  apiFetch<Invoice>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateInvoice = async (
  publicId: string,
  payload: Partial<InvoiceCreatePayload> & { clearAccount?: boolean }
) =>
  apiFetch<Invoice>(`/api/invoices/${publicId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getInvoiceCategories = async () =>
  apiFetch<InvoiceCategory[]>("/api/categories");

export const createInvoiceCategory = async (payload: { name: string; color: string }) =>
  apiFetch<InvoiceCategory>("/api/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });


export const lookupIssuerByTaxId = async (taxId: string) => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/issuers/by-tax-id?taxId=${encodeURIComponent(taxId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (response.status === 404 || response.status === 204) {
    return null;
  }

  if (!response.ok) {
    let message = "Erro ao comunicar com o servidor.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }

  return response.json() as Promise<Issuer>;
};

export const uploadInvoices = async (
  files: File[],
  privacy?: {
    userTaxId?: string;
    redactName?: string;
    redactTerms?: string;
    storeRedactedOnly?: boolean;
  }
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  if (privacy?.userTaxId) {
    formData.append("userTaxId", privacy.userTaxId);
  }
  if (privacy?.redactName) {
    formData.append("redactName", privacy.redactName);
  }
  if (privacy?.redactTerms) {
    formData.append("redactTerms", privacy.redactTerms);
  }
  if (privacy?.storeRedactedOnly) {
    formData.append("storeRedactedOnly", "true");
  }
  return apiFetch<Invoice[]>("/api/invoices/upload", {
    method: "POST",
    body: formData,
  });
};

export const getEmergencyFundStatus = async (months = 6) =>
  apiFetch<EmergencyFundStatus>(`/api/finance/emergency-fund/status?months=${months}`);

export const getGoals = async () => apiFetch<Goal[]>("/api/goals");

export const getBudgets = async () => apiFetch<Budget[]>("/api/budgets");

export const createBudget = async (payload: {
  category: string;
  monthlyLimit: number;
  month: number;
  year: number;
}) =>
  apiFetch<Budget>("/api/budgets", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateBudget = async (
  category: string,
  month: number,
  year: number,
  payload: {
    category?: string;
    monthlyLimit?: number;
    month?: number;
    year?: number;
  },
) =>
  apiFetch<Budget>(`/api/budgets?category=${encodeURIComponent(category)}&month=${month}&year=${year}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteBudget = async (category: string, month: number, year: number) =>
  apiFetch<void>(`/api/budgets?category=${encodeURIComponent(category)}&month=${month}&year=${year}`, {
    method: "DELETE",
  });

export const getBudgetStatus = async (category: string, month: number, year: number) =>
  apiFetch<BudgetStatus>(
    `/api/budgets/status?category=${encodeURIComponent(category)}&month=${month}&year=${year}`,
  );

export const createGoal = async (payload: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  linkedAccountId?: number | null;
}) => {
  const body: Record<string, unknown> = {
    name: payload.name,
    targetAmount: payload.targetAmount,
  };
  if (payload.currentAmount !== undefined) {
    body.currentAmount = payload.currentAmount;
  }
  if (payload.deadline) {
    body.deadline = payload.deadline;
  }
  if (payload.linkedAccountId) {
    body.linkedAccount = { id: payload.linkedAccountId };
  }
  return apiFetch<Goal>("/api/goals", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const updateGoal = async (id: number, payload: {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string;
  linkedAccountId?: number | null;
  clearLinkedAccount?: boolean;
}) =>
  apiFetch<Goal>(`/api/goals/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteGoal = async (id: number) =>
  apiFetch<void>(`/api/goals/${id}`, { method: "DELETE" });

export const addGoalFunds = async (id: number, amount: number) =>
  apiFetch<Goal>(`/api/goals/${id}/add-funds`, {
    method: "PATCH",
    body: JSON.stringify({ amount }),
  });

export const getSavingsRateStats = async (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set("month", String(month));
  if (year) params.set("year", String(year));
  const suffix = params.toString();
  return apiFetch<SavingsRateStats>(`/api/finance/stats/savings-rate${suffix ? `?${suffix}` : ""}`);
};

export const getFinanceComparison = async () =>
  apiFetch<FinanceComparison>("/api/finance/stats/comparison");

export const getCategorySpending = async (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.set("month", String(month));
  if (year) params.set("year", String(year));
  const suffix = params.toString();
  return apiFetch<CategorySpending[]>(`/api/finance/chart/categories${suffix ? `?${suffix}` : ""}`);
};

export const getMonthlyEvolutionDetailed = async () => {
  const raw = await apiFetch<Record<string, unknown>[]>("/api/finance/chart/evolution-detailed");
  return raw.map((entry) => {
    const month =
      (entry.month as string | undefined) ||
      (entry.MONTH as string | undefined) ||
      (entry.month_key as string | undefined) ||
      (entry.MONTH_KEY as string | undefined) ||
      "";
    const revenue =
      Number(entry.revenue ?? entry.total_revenue ?? entry.REVENUE ?? entry.TOTAL_REVENUE ?? 0);
    const expense =
      Number(entry.expense ?? entry.total_expense ?? entry.EXPENSE ?? entry.TOTAL_EXPENSE ?? 0);
    return {
      month,
      revenue,
      expense,
    } satisfies MonthlyEvolutionEntry;
  });
};

export const downloadInvoiceFile = async (publicId: string) => {
  const token = getAuthToken();
  const userKey = getUserKey();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/${publicId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(userKey ? { "X-User-Key": userKey } : {}),
    },
  });

  if (!response.ok) {
    let message = "Falha ao descarregar a fatura.";
    try {
      const payload = await response.json();
      const errorCode = payload?.error?.code as string | undefined;
      if (errorCode === "USER_KEY_REQUIRED") {
        clearAuth();
        message = "User encryption key required. Faça login novamente.";
      } else {
        message = payload?.error?.message || payload?.message || message;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || `fatura-${publicId}.pdf`;
  const blob = await response.blob();
  return { blob, filename };
};

export const downloadRedactedInvoiceFile = async (publicId: string) => {
  const token = getAuthToken();
  const userKey = getUserKey();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/${publicId}/file/redacted`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(userKey ? { "X-User-Key": userKey } : {}),
    },
  });

  if (!response.ok) {
    let message = "Falha ao descarregar a fatura mascarada.";
    try {
      const payload = await response.json();
      const errorCode = payload?.error?.code as string | undefined;
      if (errorCode === "USER_KEY_REQUIRED") {
        clearAuth();
        message = "User encryption key required. Faça login novamente.";
      } else {
        message = payload?.error?.message || payload?.message || message;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || `fatura-${publicId}-mascarada.pdf`;
  const blob = await response.blob();
  return { blob, filename };
};

export const requestRedactedPreview = async (
  file: File,
  privacy?: {
    userTaxId?: string;
    redactName?: string;
    redactTerms?: string;
    redactBoxes?: RedactionBox[];
  }
) => {
  const token = getAuthToken();
  const userKey = getUserKey();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }
  const formData = new FormData();
  formData.append("file", file);
  if (privacy?.userTaxId) {
    formData.append("userTaxId", privacy.userTaxId);
  }
  if (privacy?.redactName) {
    formData.append("redactName", privacy.redactName);
  }
  if (privacy?.redactTerms) {
    formData.append("redactTerms", privacy.redactTerms);
  }
  if (privacy?.redactBoxes && privacy.redactBoxes.length > 0) {
    formData.append("redactBoxes", JSON.stringify(privacy.redactBoxes));
  }
  const response = await fetch(`${API_BASE_URL}/api/invoices/redact-preview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(userKey ? { "X-User-Key": userKey } : {}),
    },
    body: formData,
  });
  if (!response.ok) {
    let message = "Falha ao mascarar a fatura.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const contentType = response.headers.get("Content-Type") || blob.type;
  return { blob, contentType };
};

export const getAdminStats = async (password: string, months: number = 6) => {
  if (!password) {
    throw new Error("Password é obrigatória.");
  }

  const params = new URLSearchParams();
  if (months) {
    params.set("months", String(months));
  }
  const suffix = params.toString();

  const response = await fetch(`${API_BASE_URL}/api/admin/stats${suffix ? `?${suffix}` : ""}`, {
    method: "GET",
    headers: {
      "X-Admin-Password": password,
    },
  });

  if (!response.ok) {
    let message = "Erro ao comunicar com o servidor.";
    try {
      const payload = await response.json();
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }

  return (await response.json()) as AdminStatsResponse;
};
