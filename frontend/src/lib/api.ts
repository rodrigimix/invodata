const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const TOKEN_KEY = "invodata_token";
const USER_KEY = "invodata_user";
const LANGUAGE_KEY = "invodata_language";

export interface Issuer {
  name?: string;
  taxId?: string;
  category?: string;
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
  id: number;
  documentNum: string;
  date: string;
  issuer?: Issuer;
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
  aiConsent?: boolean;
  language?: string;
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
  id: number;
  originalFileName?: string;
  documentNum?: string;
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
};

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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
      message = payload?.error?.message || payload?.message || message;
    } catch {
      // Ignore JSON parsing errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
};

export const login = async (username: string, password: string) =>
  apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const registerUser = async (payload: {
  username: string;
  password: string;
  email: string;
  name: string;
  adminKey: string;
  aiConsent: boolean;
}) =>
  apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
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

export const deleteInvoice = async (id: number) =>
  apiFetch<void>(`/api/invoices/${id}`, { method: "DELETE" });

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
  const response = await fetch(`${API_BASE_URL}/api/user/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ password }),
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

export const getInvoiceById = async (id: number) =>
  apiFetch<Invoice>(`/api/invoices/${id}`);

export const createInvoice = async (payload: InvoiceCreatePayload) =>
  apiFetch<Invoice>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateInvoice = async (
  id: number,
  payload: Partial<InvoiceCreatePayload> & { clearAccount?: boolean }
) =>
  apiFetch<Invoice>(`/api/invoices/${id}`, {
    method: "PUT",
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

export const downloadInvoiceFile = async (id: number) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/${id}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = "Falha ao descarregar a fatura.";
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
  const filename = match?.[1] || `fatura-${id}.pdf`;
  const blob = await response.blob();
  return { blob, filename };
};

export const downloadRedactedInvoiceFile = async (id: number) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }

  const response = await fetch(`${API_BASE_URL}/api/invoices/${id}/file/redacted`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = "Falha ao descarregar a fatura mascarada.";
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
  const filename = match?.[1] || `fatura-${id}-mascarada.pdf`;
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

export interface CustomCategory {
  id: number;
  name: string;
  color?: string;
}

export const getCustomCategories = async (): Promise<CustomCategory[]> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }
  const response = await fetch(`${API_BASE_URL}/api/custom-categories`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch custom categories");
  }
  return response.json();
};

export const createCustomCategory = async (name: string, color?: string): Promise<CustomCategory> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }
  const response = await fetch(`${API_BASE_URL}/api/custom-categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name.trim(), color: color || "#3B82F6" }),
  });
  if (!response.ok) {
    let message = "Failed to create custom category";
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // Ignore
    }
    throw new Error(message);
  }
  return response.json();
};

export const deleteCustomCategory = async (id: number): Promise<void> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Sessao expirada. Faça login novamente.");
  }
  const response = await fetch(`${API_BASE_URL}/api/custom-categories/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to delete custom category");
  }
};

