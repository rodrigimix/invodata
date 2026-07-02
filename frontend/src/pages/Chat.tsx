import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { MoreVertical } from "lucide-react";
import {
  createChatSession,
  getChatSessions,
  getChatMessages,
  getInvoices,
  postChatMessage,
  updateChatSession,
  deleteChatSession,
  type ChatSessionListItem,
  type ChatMessageResponse,
  type ChatAction,
  type ChatInvoiceFilter,
} from "@/lib/api";

type ChatMessage = ChatMessageResponse & {
  actions?: ChatAction[];
  invoiceLink?: { href: string; label: string };
};

const Chat = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const invoiceLinkStorageKey = "invodata_chat_invoice_links";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const invoiceLinkCacheRef = useRef<
    Map<string, { href: string; label: string } | undefined>
  >(new Map());

  const hashMessage = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 1000000007;
    }
    return hash.toString(36);
  };

  const getStoredInvoiceLink = (key: string) => {
    try {
      const raw = window.localStorage.getItem(invoiceLinkStorageKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Record<string, { href: string; label: string }>;
      return parsed[key];
    } catch {
      return undefined;
    }
  };

  const storeInvoiceLink = (key: string, link: { href: string; label: string }) => {
    try {
      const raw = window.localStorage.getItem(invoiceLinkStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, { href: string; label: string }>) : {};
      parsed[key] = link;
      window.localStorage.setItem(invoiceLinkStorageKey, JSON.stringify(parsed));
    } catch {
      // Ignore storage errors.
    }
  };

  const buildInvoiceLinkFromFilter = (filter: ChatInvoiceFilter) => {
    const params = new URLSearchParams();
    if (filter.search) {
      params.set("search", filter.search);
    }
    params.set("period", filter.period || "alltime");
    if (filter.startDate) {
      params.set("startDate", filter.startDate);
    }
    if (filter.endDate) {
      params.set("endDate", filter.endDate);
    }
    if (filter.category) {
      params.set("category", filter.category);
    }
    if (filter.paymentMethod) {
      params.set("paymentMethod", filter.paymentMethod);
    }
    const href = params.toString() ? `/invoices?${params.toString()}` : "/invoices";
    return { href, label: t("chat.viewInvoices") };
  };

  useEffect(() => {
    const initSession = async () => {
      setIsLoadingSessions(true);
      try {
        const existingSessions = await getChatSessions(30);
        setSessions(existingSessions);
        if (existingSessions.length > 0) {
          const latest = existingSessions[0];
          setSessionId(latest.id);
          setIsLoadingMessages(true);
          const history = await getChatMessages(latest.id, 50);
          const enriched = await enrichMessagesWithInvoiceLinks(history, latest.id);
          setMessages(enriched);
          return;
        }
        const session = await createChatSession(t("chat.sessionTitle"));
        setSessionId(session.sessionId);
        setSessions((prev) => [
          {
            id: session.sessionId,
            title: t("chat.sessionTitle"),
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        const history = await getChatMessages(session.sessionId, 50);
        const enriched = await enrichMessagesWithInvoiceLinks(history, session.sessionId);
        setMessages(enriched);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("chat.errors.init");
        setError(message);
      } finally {
        setIsLoadingSessions(false);
        setIsLoadingMessages(false);
      }
    };
    initSession();
  }, [t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectSession = async (nextSessionId: string) => {
    if (!nextSessionId || nextSessionId === sessionId) return;
    setSessionId(nextSessionId);
    setIsLoadingMessages(true);
    setError(null);
    try {
      const history = await getChatMessages(nextSessionId, 50);
      const enriched = await enrichMessagesWithInvoiceLinks(history, nextSessionId);
      setMessages(enriched);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("chat.errors.init");
      setError(message);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleNewSession = async () => {
    setError(null);
    try {
      const session = await createChatSession(t("chat.sessionTitle"));
      setSessionId(session.sessionId);
      setMessages([]);
      setSessions((prev) => [
        {
          id: session.sessionId,
          title: t("chat.sessionTitle"),
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("chat.errors.init");
      setError(message);
    }
  };

  const handleOpenRename = (session: ChatSessionListItem) => {
    setRenameSessionId(session.id);
    setRenameTitle(session.title || t("chat.sessionTitle"));
  };

  const handleConfirmRename = async () => {
    if (!renameSessionId || !renameTitle.trim()) return;
    setIsRenaming(true);
    try {
      const updated = await updateChatSession(renameSessionId, renameTitle.trim());
      setSessions((prev) =>
        prev.map((session) => (session.id === updated.id ? updated : session))
      );
      setRenameSessionId(null);
      setRenameTitle("");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("chat.errors.init");
      setError(message);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteSessionId) return;
    setIsDeleting(true);
    try {
      await deleteChatSession(deleteSessionId);
      const remaining = sessions.filter((session) => session.id !== deleteSessionId);
      setSessions(remaining);
      if (sessionId === deleteSessionId) {
        if (remaining.length > 0) {
          await handleSelectSession(remaining[0].id);
        } else {
          await handleNewSession();
        }
      }
      setDeleteSessionId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("chat.errors.init");
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!sessionId || !input.trim() || isSending) return;
    const content = input.trim();
    setInput("");
    setError(null);
    setIsSending(true);
    const userMessage: ChatMessage = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    try {
      const response = await postChatMessage(sessionId, content);
      const invoiceLink = response.invoiceFilter
        ? buildInvoiceLinkFromFilter(response.invoiceFilter)
        : await resolveInvoiceLink(content, response.response);
      if (invoiceLink && sessionId) {
        const storageKey = `${sessionId}:${hashMessage(response.response)}`;
        storeInvoiceLink(storageKey, invoiceLink);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.response,
          actions: response.actions,
          invoiceLink,
        },
      ]);
      setSessions((prev) => {
        const now = new Date().toISOString();
        const next = prev.map((session) =>
          session.id === sessionId
            ? { ...session, lastActivityAt: now }
            : session
        );
        return next.sort((a, b) => {
          const aTime = a.lastActivityAt || a.createdAt || "";
          const bTime = b.lastActivityAt || b.createdAt || "";
          return bTime.localeCompare(aTime);
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("chat.errors.send");
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const normalizeQuery = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const extractYear = (value: string) => {
    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  };

  const hasInvoiceIntent = (value: string) => {
    const normalized = normalizeQuery(value);
    return (
      normalized.includes("fatura") ||
      normalized.includes("faturas") ||
      normalized.includes("invoice") ||
      normalized.includes("invoices")
    );
  };

  const hasInvoiceCta = (value: string) => {
    const normalized = normalizeQuery(value);
    return (
      normalized.includes("botao abaixo") ||
      normalized.includes("botão abaixo") ||
      normalized.includes("click below") ||
      normalized.includes("clique abaixo") ||
      normalized.includes("clica no botao") ||
      normalized.includes("clica no botão")
    );
  };

  const extractIssuerName = (value: string) => {
    const patterns = [
      /emitida pela\s+([^,\.]+)[,\.]/i,
      /emitida por\s+([^,\.]+)[,\.]/i,
      /issued by\s+([^,\.]+)[,\.]/i,
      /for\s+([^,\.]+)\s+no valor/i,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  const extractDocumentNumber = (value: string) => {
    const patterns = [
      /documento\s*(?:n[úu]mero)?\s*[:#-]?\s*([A-Z]{1,4}\s*[0-9][A-Z0-9/\-\.]+)/i,
      /document number\s*[:#-]?\s*([A-Z]{1,4}\s*[0-9][A-Z0-9/\-\.]+)/i,
      /(FT\s*[0-9][A-Z0-9/\-\.]+)/i,
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/[\s\.,;:]+$/g, "");
      }
    }
    return null;
  };

  const countDocumentNumbers = (value: string) => {
    if (!value) return 0;
    const patterns = [
      /documento\s*(?:n[úu]mero)?\s*[:#-]?\s*([A-Z]{1,4}\s*[0-9][A-Z0-9/\-\.]+)/gi,
      /document number\s*[:#-]?\s*([A-Z]{1,4}\s*[0-9][A-Z0-9/\-\.]+)/gi,
      /(FT\s*[0-9][A-Z0-9/\-\.]+)/gi,
      /(ILPM[0-9/\-\.]+)/gi,
    ];
    let count = 0;
    for (const pattern of patterns) {
      const matches = value.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  };

  const hasFuelIntent = (value: string) => {
    const normalized = normalizeQuery(value);
    return (
      normalized.includes("combustivel") ||
      normalized.includes("fuel") ||
      normalized.includes("gasoline") ||
      normalized.includes("gas")
    );
  };

  const resolveInvoiceLink = async (query: string, assistantContent?: string) => {
    const hasIntent = hasInvoiceIntent(query) || (assistantContent ? hasInvoiceIntent(assistantContent) : false);
    const hasCta = assistantContent ? hasInvoiceCta(assistantContent) : false;
    if (!hasIntent && !hasCta) return undefined;
    const cacheKey = normalizeQuery([query, assistantContent].filter(Boolean).join("|"));
    if (invoiceLinkCacheRef.current.has(cacheKey)) {
      return invoiceLinkCacheRef.current.get(cacheKey);
    }
    const primary = assistantContent && hasInvoiceIntent(assistantContent) ? assistantContent : query;
    const year = extractYear(primary);
    const hasFuel = hasFuelIntent(primary);
    const issuerName = assistantContent ? extractIssuerName(assistantContent) : null;
    const documentNum = assistantContent ? extractDocumentNumber(assistantContent) : null;
    const documentCount = assistantContent ? countDocumentNumbers(assistantContent) : 0;
    const useIssuerSearchOnly = Boolean(issuerName) && documentCount > 1;
    const dateMatch = (assistantContent || "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const exactDate = dateMatch ? dateMatch[1] : null;
    if (!hasFuel && !year) {
      const params = new URLSearchParams();
      if (useIssuerSearchOnly && issuerName) {
        params.set("search", issuerName);
      } else if (issuerName) {
        params.set("issuerName", issuerName);
      }
      if (documentNum && documentCount <= 1 && !useIssuerSearchOnly) {
        params.set("search", documentNum);
      }
      if (exactDate && documentCount <= 1 && !issuerName) {
        params.set("startDate", exactDate);
        params.set("endDate", exactDate);
      }
      const href = params.toString() ? `/invoices?${params.toString()}` : "/invoices";
      const link = { href, label: t("chat.viewInvoices") };
      invoiceLinkCacheRef.current.set(cacheKey, link);
      return link;
    }
    const startDate = year && !useIssuerSearchOnly ? `${year}-01-01` : undefined;
    const endDate = year && !useIssuerSearchOnly ? `${year}-12-31` : undefined;
    try {
      const page = await getInvoices(
        0,
        2,
        undefined,
        undefined,
        issuerName || undefined,
        undefined,
        undefined,
        undefined,
        hasFuel ? "FUEL" : undefined,
        undefined,
        undefined,
        startDate,
        endDate
      );
      const total = page.totalElements ?? page.content?.length ?? 0;
      if (total === 1 && page.content?.[0]) {
        const link = { href: `/invoices/${page.content[0].publicId}`, label: t("chat.viewInvoice") };
        invoiceLinkCacheRef.current.set(cacheKey, link);
        return link;
      }
      const params = new URLSearchParams();
      if (useIssuerSearchOnly && issuerName) {
        params.set("search", issuerName);
      } else if (issuerName) {
        params.set("issuerName", issuerName);
      }
      if (documentNum && documentCount <= 1 && !useIssuerSearchOnly) {
        params.set("search", documentNum);
      }
      if (hasFuel) {
        params.set("category", "FUEL");
      }
      if (startDate) {
        params.set("startDate", startDate);
      }
      if (endDate) {
        params.set("endDate", endDate);
      }
      const label = hasFuel
        ? t("chat.viewFuelInvoices")
        : year
          ? t("chat.viewInvoicesYear", { year })
          : t("chat.viewInvoices");
      const link = { href: `/invoices?${params.toString()}`, label };
      invoiceLinkCacheRef.current.set(cacheKey, link);
      return link;
    } catch {
      invoiceLinkCacheRef.current.set(cacheKey, undefined);
      return undefined;
    }
  };

  const enrichMessagesWithInvoiceLinks = async (
    history: ChatMessageResponse[],
    activeSessionId?: string | null
  ) => {
    const enriched = history.map((message) => ({ ...message })) as ChatMessage[];
    const results = await Promise.all(
      enriched.map(async (message, index) => {
        if (message.role !== "assistant") {
          return message;
        }
        if (activeSessionId) {
          const storageKey = `${activeSessionId}:${hashMessage(message.content)}`;
          const stored = getStoredInvoiceLink(storageKey);
          if (stored) {
            return { ...message, invoiceLink: stored };
          }
        }
        const previousUser = enriched
          .slice(0, index)
          .reverse()
          .find((item) => item.role === "user");
        if (!previousUser) {
          return message;
        }
        const invoiceLink = await resolveInvoiceLink(previousUser.content, message.content);
        if (invoiceLink && activeSessionId) {
          const storageKey = `${activeSessionId}:${hashMessage(message.content)}`;
          storeInvoiceLink(storageKey, invoiceLink);
        }
        return invoiceLink ? { ...message, invoiceLink } : message;
      })
    );
    return results;
  };

  const renderRichText = (content: string) => {
    const parts = content.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <strong key={`${part}-${index}`} className="font-semibold text-foreground">
          {part}
        </strong>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      )
    );
  };

  const renderActionButtons = (actions?: ChatAction[]) => {
    if (!actions || actions.length === 0) return null;

    const mapped = actions
      .map((action, index) => {
        switch (action.type) {
          case "create_account":
            return { key: `account-${index}`, href: "/accounts", label: t("chat.viewAccount") };
          case "create_goal":
            return { key: `goal-${index}`, href: "/goals", label: t("chat.viewGoal") };
          case "create_budget":
            if (action.month && action.year) {
              const value = `${action.year}-${String(action.month).padStart(2, "0")}`;
              return {
                key: `budget-${index}`,
                href: `/budget?month=${value}`,
                label: t("chat.viewBudget"),
              };
            }
            return { key: `budget-${index}`, href: "/budget", label: t("chat.viewBudget") };
          default:
            return null;
        }
      })
      .filter(Boolean) as Array<{ key: string; href: string; label: string }>;

    if (mapped.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {mapped.map((item) => (
          <Button key={item.key} asChild size="sm" variant="default">
            <Link to={item.href}>{item.label}</Link>
          </Button>
        ))}
      </div>
    );
  };


  const renderInvoiceButton = (invoiceLink?: { href: string; label: string }) => {
    if (!invoiceLink) return null;
    return (
      <div className="mt-3">
        <Button asChild size="sm" variant="default">
          <Link to={invoiceLink.href}>{invoiceLink.label}</Link>
        </Button>
      </div>
    );
  };

  const renderAssistantMessage = (
    content: string,
    actions?: ChatAction[],
    invoiceLink?: { href: string; label: string }
  ) => {
    const summaryPatterns = [
      /^(Gastou um total de [^.]+\.)\s*Os gastos detalhados são:\s*([\s\S]*)$/i,
      /^(You spent a total of [^.]+\.)\s*Detailed spending:\s*([\s\S]*)$/i,
    ];
    const summaryMatch = summaryPatterns.map((pattern) => content.match(pattern)).find(Boolean);
    if (!summaryMatch) {
      return (
        <div className="text-sm">
          <p className="whitespace-pre-wrap">{renderRichText(content)}</p>
          {renderActionButtons(actions)}
          {renderInvoiceButton(invoiceLink)}
        </div>
      );
    }

    const summary = summaryMatch[1];
    const detailsRaw = summaryMatch[2];
    const items = detailsRaw
      .split(/\s*\*\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">{renderRichText(summary)}</p>
        <div className="rounded-lg border border-border/70 bg-background/70 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("chat.detailedSpending")}
          </p>
          <div className="mt-2 space-y-2">
            {items.map((item) => {
              const match = item.match(/^([^ ]+)\s+em\s+([0-9-]+)\s+\(Documento:\s*(.+)\)$/i);
              if (!match) {
                return (
                  <div key={item} className="text-xs text-foreground">
                    {renderRichText(item)}
                  </div>
                );
              }
              const [, amount, date, document] = match;
              return (
                <div key={item} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{amount}</span>
                    <span className="text-muted-foreground">{date}</span>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {document}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {renderActionButtons(actions)}
        {renderInvoiceButton(invoiceLink)}
      </div>
    );
  };

  const orderedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = a.lastActivityAt || a.createdAt || "";
      const bTime = b.lastActivityAt || b.createdAt || "";
      return bTime.localeCompare(aTime);
    });
  }, [sessions]);

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 gap-6 min-h-[calc(100vh-140px)] pb-6 lg:grid-cols-[260px,1fr]">
        <aside className="invodata-card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">{t("chat.historyTitle")}</h2>
            <Button variant="outline" size="sm" onClick={handleNewSession}>
              {t("chat.newSession")}
            </Button>
          </div>
          {isLoadingSessions && (
            <p className="text-xs text-muted-foreground">{t("chat.loadingHistory")}</p>
          )}
          {!isLoadingSessions && orderedSessions.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("chat.emptyHistory")}</p>
          )}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {orderedSessions.map((session) => (
              <div
                key={session.id}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${session.id === sessionId
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/70 hover:bg-muted/60"
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectSession(session.id)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-foreground">
                      {session.title || t("chat.sessionTitle")}
                    </div>
                    {session.lastActivityAt && (
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(session.lastActivityAt).toLocaleString()}
                      </div>
                    )}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenRename(session)}>
                        {t("chat.rename")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteSessionId(session.id)}
                        className="text-danger focus:text-danger"
                      >
                        {t("chat.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="grid grid-rows-[auto,1fr,auto] gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("chat.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("chat.subtitle")}
            </p>
          </div>

          <div className="invodata-card p-6 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {isLoadingMessages && (
                <div className="text-sm text-muted-foreground">{t("chat.loadingMessages")}</div>
              )}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-warning/30 dark:bg-warning/10 dark:text-warning-foreground">
                {isPt
                  ? "Esta conversa é com IA. A informação é apenas orientativa e pode conter imprecisões."
                  : "This conversation is with AI. The information is for guidance only and may be inaccurate."}
              </div>
              {!isLoadingMessages && messages.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  {t("chat.empty")}
                </div>
              )}
              {!isLoadingMessages && messages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[85%] md:max-w-[70%] rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm shadow-sm"
                          : "max-w-[85%] md:max-w-[70%] rounded-2xl bg-muted text-foreground px-4 py-3 text-sm"
                      }
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      ) : (
                        renderAssistantMessage(message.content, message.actions, message.invoiceLink)
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="invodata-card p-4">
            {error && (
              <div className="mb-3 text-sm text-danger">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("chat.placeholder")}
                className="min-h-[56px] resize-none"
                disabled={!sessionId || isSending}
              />
              <Button
                onClick={handleSend}
                disabled={!sessionId || isSending || !input.trim()}
                className="h-[56px] px-6 w-full sm:w-auto"
              >
                {t("chat.send")}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-12 pt-6 border-t border-border">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">{t("app.footer")}</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">
              {t("auth.termsLink")}
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              {t("auth.privacyPolicy")}
            </Link>
            <a href={surveyUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              {surveyLabel}
            </a>
          </div>
        </div>
      </footer>
      <Dialog open={Boolean(renameSessionId)} onOpenChange={(open) => {
        if (!open) {
          setRenameSessionId(null);
          setRenameTitle("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.renameTitle")}</DialogTitle>
            <DialogDescription>{t("chat.renameDesc")}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            placeholder={t("chat.renamePlaceholder")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSessionId(null)}>
              {t("chat.cancel")}
            </Button>
            <Button onClick={handleConfirmRename} disabled={isRenaming || !renameTitle.trim()}>
              {isRenaming ? t("chat.renaming") : t("chat.renameConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteSessionId)} onOpenChange={(open) => {
        if (!open) {
          setDeleteSessionId(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("chat.deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSessionId(null)}>
              {t("chat.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? t("chat.deleting") : t("chat.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Chat;
