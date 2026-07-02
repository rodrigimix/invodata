import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, Info, ChevronsUpDown, Check, Send, X, Calendar as CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import {
  createInvoice,
  createCustomCategory,
  getAccounts,
  getCustomCategories,
  getInvoiceById,
  lookupIssuerByTaxId,
  updateInvoice,
  type Account,
  type CustomCategory,
  type InvoiceItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ManualItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
};

type InvoiceDraft = {
  id: string;
  createdAt: string;
  data: {
    documentNum: string;
    date: string;
    revenue: boolean;
    paymentMethod: string;
    licensePlate: string;
    issuerName: string;
    issuerTaxId: string;
    issuerCountry: string;
    issuerCategory: string;
    notes: string;
    items: ManualItem[];
    accountId: number | null;
  };
};

const countryOptions = [
  { label: "Afghanistan", code: "AF" },
  { label: "Aland Islands", code: "AX" },
  { label: "Albania", code: "AL" },
  { label: "Algeria", code: "DZ" },
  { label: "American Samoa", code: "AS" },
  { label: "Andorra", code: "AD" },
  { label: "Angola", code: "AO" },
  { label: "Anguilla", code: "AI" },
  { label: "Antarctica", code: "AQ" },
  { label: "Antigua and Barbuda", code: "AG" },
  { label: "Argentina", code: "AR" },
  { label: "Armenia", code: "AM" },
  { label: "Aruba", code: "AW" },
  { label: "Australia", code: "AU" },
  { label: "Austria", code: "AT" },
  { label: "Azerbaijan", code: "AZ" },
  { label: "Bahamas", code: "BS" },
  { label: "Bahrain", code: "BH" },
  { label: "Bangladesh", code: "BD" },
  { label: "Barbados", code: "BB" },
  { label: "Belarus", code: "BY" },
  { label: "Belgium", code: "BE" },
  { label: "Belize", code: "BZ" },
  { label: "Benin", code: "BJ" },
  { label: "Bermuda", code: "BM" },
  { label: "Bhutan", code: "BT" },
  { label: "Bolivia", code: "BO" },
  { label: "Bonaire, Sint Eustatius and Saba", code: "BQ" },
  { label: "Bosnia and Herzegovina", code: "BA" },
  { label: "Botswana", code: "BW" },
  { label: "Bouvet Island", code: "BV" },
  { label: "Brazil", code: "BR" },
  { label: "British Indian Ocean Territory", code: "IO" },
  { label: "Brunei Darussalam", code: "BN" },
  { label: "Bulgaria", code: "BG" },
  { label: "Burkina Faso", code: "BF" },
  { label: "Burundi", code: "BI" },
  { label: "Cambodia", code: "KH" },
  { label: "Cameroon", code: "CM" },
  { label: "Canada", code: "CA" },
  { label: "Cabo Verde", code: "CV" },
  { label: "Cayman Islands", code: "KY" },
  { label: "Central African Republic", code: "CF" },
  { label: "Chad", code: "TD" },
  { label: "Chile", code: "CL" },
  { label: "China", code: "CN" },
  { label: "Christmas Island", code: "CX" },
  { label: "Cocos (Keeling) Islands", code: "CC" },
  { label: "Colombia", code: "CO" },
  { label: "Comoros", code: "KM" },
  { label: "Congo", code: "CG" },
  { label: "Congo, Democratic Republic of the", code: "CD" },
  { label: "Cook Islands", code: "CK" },
  { label: "Costa Rica", code: "CR" },
  { label: "Cote d'Ivoire", code: "CI" },
  { label: "Croatia", code: "HR" },
  { label: "Cuba", code: "CU" },
  { label: "Curacao", code: "CW" },
  { label: "Cyprus", code: "CY" },
  { label: "Czechia", code: "CZ" },
  { label: "Denmark", code: "DK" },
  { label: "Djibouti", code: "DJ" },
  { label: "Dominica", code: "DM" },
  { label: "Dominican Republic", code: "DO" },
  { label: "Ecuador", code: "EC" },
  { label: "Egypt", code: "EG" },
  { label: "El Salvador", code: "SV" },
  { label: "Equatorial Guinea", code: "GQ" },
  { label: "Eritrea", code: "ER" },
  { label: "Estonia", code: "EE" },
  { label: "Eswatini", code: "SZ" },
  { label: "Ethiopia", code: "ET" },
  { label: "Falkland Islands (Malvinas)", code: "FK" },
  { label: "Faroe Islands", code: "FO" },
  { label: "Fiji", code: "FJ" },
  { label: "Finland", code: "FI" },
  { label: "France", code: "FR" },
  { label: "French Guiana", code: "GF" },
  { label: "French Polynesia", code: "PF" },
  { label: "French Southern Territories", code: "TF" },
  { label: "Gabon", code: "GA" },
  { label: "Gambia", code: "GM" },
  { label: "Georgia", code: "GE" },
  { label: "Germany", code: "DE" },
  { label: "Ghana", code: "GH" },
  { label: "Gibraltar", code: "GI" },
  { label: "Greece", code: "GR" },
  { label: "Greenland", code: "GL" },
  { label: "Grenada", code: "GD" },
  { label: "Guadeloupe", code: "GP" },
  { label: "Guam", code: "GU" },
  { label: "Guatemala", code: "GT" },
  { label: "Guernsey", code: "GG" },
  { label: "Guinea", code: "GN" },
  { label: "Guinea-Bissau", code: "GW" },
  { label: "Guyana", code: "GY" },
  { label: "Haiti", code: "HT" },
  { label: "Heard Island and McDonald Islands", code: "HM" },
  { label: "Holy See", code: "VA" },
  { label: "Honduras", code: "HN" },
  { label: "Hong Kong", code: "HK" },
  { label: "Hungary", code: "HU" },
  { label: "Iceland", code: "IS" },
  { label: "India", code: "IN" },
  { label: "Indonesia", code: "ID" },
  { label: "Iran (Islamic Republic of)", code: "IR" },
  { label: "Iraq", code: "IQ" },
  { label: "Ireland", code: "IE" },
  { label: "Isle of Man", code: "IM" },
  { label: "Israel", code: "IL" },
  { label: "Italy", code: "IT" },
  { label: "Jamaica", code: "JM" },
  { label: "Japan", code: "JP" },
  { label: "Jersey", code: "JE" },
  { label: "Jordan", code: "JO" },
  { label: "Kazakhstan", code: "KZ" },
  { label: "Kenya", code: "KE" },
  { label: "Kiribati", code: "KI" },
  { label: "Korea, Democratic People's Republic of", code: "KP" },
  { label: "Korea, Republic of", code: "KR" },
  { label: "Kuwait", code: "KW" },
  { label: "Kyrgyzstan", code: "KG" },
  { label: "Lao People's Democratic Republic", code: "LA" },
  { label: "Latvia", code: "LV" },
  { label: "Lebanon", code: "LB" },
  { label: "Lesotho", code: "LS" },
  { label: "Liberia", code: "LR" },
  { label: "Libya", code: "LY" },
  { label: "Liechtenstein", code: "LI" },
  { label: "Lithuania", code: "LT" },
  { label: "Luxembourg", code: "LU" },
  { label: "Macao", code: "MO" },
  { label: "North Macedonia", code: "MK" },
  { label: "Madagascar", code: "MG" },
  { label: "Malawi", code: "MW" },
  { label: "Malaysia", code: "MY" },
  { label: "Maldives", code: "MV" },
  { label: "Mali", code: "ML" },
  { label: "Malta", code: "MT" },
  { label: "Marshall Islands", code: "MH" },
  { label: "Martinique", code: "MQ" },
  { label: "Mauritania", code: "MR" },
  { label: "Mauritius", code: "MU" },
  { label: "Mayotte", code: "YT" },
  { label: "Mexico", code: "MX" },
  { label: "Micronesia (Federated States of)", code: "FM" },
  { label: "Moldova, Republic of", code: "MD" },
  { label: "Monaco", code: "MC" },
  { label: "Mongolia", code: "MN" },
  { label: "Montenegro", code: "ME" },
  { label: "Montserrat", code: "MS" },
  { label: "Morocco", code: "MA" },
  { label: "Mozambique", code: "MZ" },
  { label: "Myanmar", code: "MM" },
  { label: "Namibia", code: "NA" },
  { label: "Nauru", code: "NR" },
  { label: "Nepal", code: "NP" },
  { label: "Netherlands", code: "NL" },
  { label: "New Caledonia", code: "NC" },
  { label: "New Zealand", code: "NZ" },
  { label: "Nicaragua", code: "NI" },
  { label: "Niger", code: "NE" },
  { label: "Nigeria", code: "NG" },
  { label: "Niue", code: "NU" },
  { label: "Norfolk Island", code: "NF" },
  { label: "Northern Mariana Islands", code: "MP" },
  { label: "Norway", code: "NO" },
  { label: "Oman", code: "OM" },
  { label: "Pakistan", code: "PK" },
  { label: "Palau", code: "PW" },
  { label: "Palestine, State of", code: "PS" },
  { label: "Panama", code: "PA" },
  { label: "Papua New Guinea", code: "PG" },
  { label: "Paraguay", code: "PY" },
  { label: "Peru", code: "PE" },
  { label: "Philippines", code: "PH" },
  { label: "Pitcairn", code: "PN" },
  { label: "Poland", code: "PL" },
  { label: "Portugal", code: "PT" },
  { label: "Puerto Rico", code: "PR" },
  { label: "Qatar", code: "QA" },
  { label: "Reunion", code: "RE" },
  { label: "Romania", code: "RO" },
  { label: "Russian Federation", code: "RU" },
  { label: "Rwanda", code: "RW" },
  { label: "Saint Barthelemy", code: "BL" },
  { label: "Saint Helena, Ascension and Tristan da Cunha", code: "SH" },
  { label: "Saint Kitts and Nevis", code: "KN" },
  { label: "Saint Lucia", code: "LC" },
  { label: "Saint Martin (French part)", code: "MF" },
  { label: "Saint Pierre and Miquelon", code: "PM" },
  { label: "Saint Vincent and the Grenadines", code: "VC" },
  { label: "Samoa", code: "WS" },
  { label: "San Marino", code: "SM" },
  { label: "Sao Tome and Principe", code: "ST" },
  { label: "Saudi Arabia", code: "SA" },
  { label: "Senegal", code: "SN" },
  { label: "Serbia", code: "RS" },
  { label: "Seychelles", code: "SC" },
  { label: "Sierra Leone", code: "SL" },
  { label: "Singapore", code: "SG" },
  { label: "Sint Maarten (Dutch part)", code: "SX" },
  { label: "Slovakia", code: "SK" },
  { label: "Slovenia", code: "SI" },
  { label: "Solomon Islands", code: "SB" },
  { label: "Somalia", code: "SO" },
  { label: "South Africa", code: "ZA" },
  { label: "South Georgia and the South Sandwich Islands", code: "GS" },
  { label: "South Sudan", code: "SS" },
  { label: "Spain", code: "ES" },
  { label: "Sri Lanka", code: "LK" },
  { label: "Sudan", code: "SD" },
  { label: "Suriname", code: "SR" },
  { label: "Svalbard and Jan Mayen", code: "SJ" },
  { label: "Sweden", code: "SE" },
  { label: "Switzerland", code: "CH" },
  { label: "Syrian Arab Republic", code: "SY" },
  { label: "Taiwan, Province of China", code: "TW" },
  { label: "Tajikistan", code: "TJ" },
  { label: "Tanzania, United Republic of", code: "TZ" },
  { label: "Thailand", code: "TH" },
  { label: "Timor-Leste", code: "TL" },
  { label: "Togo", code: "TG" },
  { label: "Tokelau", code: "TK" },
  { label: "Tonga", code: "TO" },
  { label: "Trinidad and Tobago", code: "TT" },
  { label: "Tunisia", code: "TN" },
  { label: "Turkey", code: "TR" },
  { label: "Turkmenistan", code: "TM" },
  { label: "Turks and Caicos Islands", code: "TC" },
  { label: "Tuvalu", code: "TV" },
  { label: "Uganda", code: "UG" },
  { label: "Ukraine", code: "UA" },
  { label: "United Arab Emirates", code: "AE" },
  { label: "United Kingdom", code: "GB" },
  { label: "United States of America", code: "US" },
  { label: "United States Minor Outlying Islands", code: "UM" },
  { label: "Uruguay", code: "UY" },
  { label: "Uzbekistan", code: "UZ" },
  { label: "Vanuatu", code: "VU" },
  { label: "Venezuela (Bolivarian Republic of)", code: "VE" },
  { label: "Viet Nam", code: "VN" },
  { label: "Virgin Islands (British)", code: "VG" },
  { label: "Virgin Islands (U.S.)", code: "VI" },
  { label: "Wallis and Futuna", code: "WF" },
  { label: "Western Sahara", code: "EH" },
  { label: "Yemen", code: "YE" },
  { label: "Zambia", code: "ZM" },
  { label: "Zimbabwe", code: "ZW" },
];

const emptyItem: ManualItem = {
  description: "",
  quantity: "1",
  unitPrice: "",
  taxPercent: "23",
};

const parseNumber = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toFlagEmoji = (code: string) =>
  code
    .toUpperCase()
    .replace(/[A-Z]/g, (char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65));

const titleCase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
};

const toIsoDate = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr] = match;
  const day = Number.parseInt(dayStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const year = Number.parseInt(yearStr, 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearStr}-${monthStr}-${dayStr}`;
};

const toDisplayDate = (value?: string | null) => {
  if (!value) return "";
  const parts = value.split("T")[0]?.split("-");
  if (!parts || parts.length !== 3) return "";
  const [year, month, day] = parts;
  if (!year || !month || !day) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

const parseDisplayDate = (value: string) => {
  const parsed = parse(value, "dd/MM/yyyy", new Date());
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const InvoiceManualEntry = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  const invoiceId = id ? Number(id) : null;
  const isEditing = Boolean(invoiceId && !Number.isNaN(invoiceId));
  const [documentNum, setDocumentNum] = useState("");
  const [date, setDate] = useState("");
  const [revenue, setRevenue] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [issuerTaxId, setIssuerTaxId] = useState("");
  const [issuerCountry, setIssuerCountry] = useState("PT");
  const [issuerCategory, setIssuerCategory] = useState("none");
  const [issuerNameLocked, setIssuerNameLocked] = useState(false);
  const [issuerNameAuto, setIssuerNameAuto] = useState(false);
  const [issuerLookupStatus, setIssuerLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [issuerLookupMessage, setIssuerLookupMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ManualItem[]>([{ ...emptyItem }]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [originalAccountId, setOriginalAccountId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const issuerCategoryOptions = useMemo(
    () => [
      { value: "none", label: t("invoiceManual.issuer.categoryNone") },
      { value: "REVENUE", label: t("issuerCategories.REVENUE") },
      { value: "FUEL", label: t("issuerCategories.FUEL") },
      { value: "RESTAURANT", label: t("issuerCategories.RESTAURANT") },
      { value: "SUPERMARKET", label: t("issuerCategories.SUPERMARKET") },
      { value: "TRANSPORT", label: t("issuerCategories.TRANSPORT") },
      { value: "HEALTH", label: t("issuerCategories.HEALTH") },
      { value: "UTILITIES", label: t("issuerCategories.UTILITIES") },
      { value: "TELECOM", label: t("issuerCategories.TELECOM") },
      { value: "CLOTHING", label: t("issuerCategories.CLOTHING") },
      { value: "EDUCATION", label: t("issuerCategories.EDUCATION") },
      { value: "ENTERTAINMENT", label: t("issuerCategories.ENTERTAINMENT") },
      { value: "SERVICES", label: t("issuerCategories.SERVICES") },
      ...customCategories.map((cat) => ({
        value: `CUSTOM_${cat.id}`,
        label: cat.name,
        color: cat.color || "#3B82F6",
      })),
    ],
    [t, customCategories]
  );

  useEffect(() => {
    // When user changes invoice type to "Revenue", auto-set category to REVENUE
    // But only if we're NOT loading an invoice (isLoadingInvoice = true)
    if (revenue && !isLoadingInvoice && issuerCategory !== "REVENUE") {
      setIssuerCategory("REVENUE");
    }
  }, [revenue, isLoadingInvoice]);

  const selectedCountry = countryOptions.find((country) => country.code === issuerCountry);
  const selectedCountryLabel = selectedCountry
    ? `${toFlagEmoji(selectedCountry.code)} ${selectedCountry.label} (${selectedCountry.code})`
    : t("invoiceManual.issuer.countrySelect");

  useEffect(() => {
    let isMounted = true;
    getAccounts()
      .then((data) => {
        if (!isMounted) return;
        setAccounts(data || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setAccounts([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isEditing) return;
    const stored = localStorage.getItem("invodata_invoice_drafts");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as InvoiceDraft[];
      setDrafts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDrafts([]);
    }
  }, [isEditing]);

  useEffect(() => {
    let isMounted = true;
    getCustomCategories()
      .then((categories) => {
        if (!isMounted) return;
        setCustomCategories(categories || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Failed to load custom categories:", err);
        setCustomCategories([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isEditing) return;
    localStorage.setItem("invodata_invoice_drafts", JSON.stringify(drafts));
  }, [drafts, isEditing]);

   useEffect(() => {
     if (!isEditing || invoiceId === null) return;
     let isMounted = true;
     setIsLoadingInvoice(true);
     getInvoiceById(invoiceId)
       .then((invoice) => {
         if (!isMounted) return;
         const parsedItems =
           invoice.items?.map((item) => ({
             description: item.description || "",
             quantity: item.quantity !== undefined ? String(item.quantity) : "1",
             unitPrice: item.unitPrice !== undefined ? String(item.unitPrice) : "",
             taxPercent: item.taxPercent !== undefined ? String(item.taxPercent) : "0",
           })) || [{ ...emptyItem }];
         const issuerTaxIdRaw = invoice.issuer?.taxId || "";
         const countryMatch = issuerTaxIdRaw.match(/^[a-zA-Z]{2}/);
         const countryCode = countryMatch ? countryMatch[0].toUpperCase() : "PT";
         const taxIdValue = countryMatch ? issuerTaxIdRaw.slice(2) : issuerTaxIdRaw;

         // Handle category - if it's a custom category reference, validate it exists
         let categoryToSet = invoice.issuer?.category || "none";
         if (categoryToSet && categoryToSet.startsWith("CUSTOM_")) {
           // Verify the custom category still exists
           const customCatId = Number.parseInt(categoryToSet.split("_")[1], 10);
           const exists = customCategories.some((cat) => cat.id === customCatId);
           if (!exists) {
             // If custom category doesn't exist anymore, set to none
             categoryToSet = "none";
           }
         }

         setDocumentNum(invoice.documentNum || "");
         setDate(toDisplayDate(invoice.date));
         setPaymentMethod(invoice.paymentMethod || "");
         setLicensePlate(invoice.licensePlate || "");
         setIssuerName(invoice.issuer?.name || "");
         setIssuerTaxId(taxIdValue);
         setIssuerCountry(countryCode);
         // Set category BEFORE revenue, so the revenue handler doesn't override it
         setIssuerCategory(categoryToSet);
         setNotes(invoice.notes || "");
         setItems(parsedItems.length > 0 ? parsedItems : [{ ...emptyItem }]);
         setAccountId(invoice.account?.id ?? null);
         setOriginalAccountId(invoice.account?.id ?? null);
         setIssuerNameLocked(false);
         setIssuerNameAuto(false);
         setIssuerLookupStatus("idle");
         setIssuerLookupMessage(null);
         setFieldErrors({});
         setFormError(null);
         // Set revenue LAST so the revenue-watching useEffect doesn't interfere
         setRevenue(Boolean(invoice.revenue));
       })
       .catch((err) => {
         if (!isMounted) return;
         const message = err instanceof Error ? err.message : t("invoiceManual.errors.load");
         setFormError(message);
       })
       .finally(() => {
         if (isMounted) setIsLoadingInvoice(false);
       });
     return () => {
       isMounted = false;
     };
   }, [invoiceId, isEditing, t, customCategories]);

  const computed = useMemo(() => {
    const lines = items.map((item) => {
      const quantity = parseNumber(item.quantity);
      const unitPrice = parseNumber(item.unitPrice);
      const taxPercent = parseNumber(item.taxPercent);
      const net = quantity * unitPrice;
      const tax = net * (taxPercent / 100);
      const total = net + tax;
      return { net, tax, total };
    });

    const totals = lines.reduce(
      (acc, line) => ({
        net: acc.net + line.net,
        tax: acc.tax + line.tax,
        total: acc.total + line.total,
      }),
      { net: 0, tax: 0, total: 0 }
    );

    return { lines, totals };
  }, [items]);

  const hasTotalsError = Boolean(
    fieldErrors.totalAmount || fieldErrors.netAmount || fieldErrors.taxAmount
  );

  const handleItemChange = (index: number, field: keyof ManualItem, value: string) => {
    setItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
    if (fieldErrors.items || fieldErrors.totalAmount || fieldErrors.netAmount || fieldErrors.taxAmount) {
      setFieldErrors((current) => {
        const { items, totalAmount, netAmount, taxAmount, ...rest } = current;
        return rest;
      });
    }
  };

  const handleAddItem = () => {
    setItems((current) => [...current, { ...emptyItem }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => (current.length > 1 ? current.filter((_, idx) => idx !== index) : current));
  };

  const buildItemsPayload = () => {
    const payload: InvoiceItem[] = [];
    items.forEach((item) => {
      const quantity = parseNumber(item.quantity);
      const unitPrice = parseNumber(item.unitPrice);
      const taxPercent = parseNumber(item.taxPercent);
      const hasContent = item.description.trim() || quantity > 0 || unitPrice > 0;
      if (!hasContent) {
        return;
      }
      const net = quantity * unitPrice;
      const tax = net * (taxPercent / 100);
      const total = net + tax;
      payload.push({
        description: item.description.trim() || undefined,
        quantity,
        unitPrice,
        taxPercent,
        taxPrice: tax,
        totalPrice: total,
      });
    });
    return payload;
  };

  const handleSubmit = async () => {
    setFormError(null);
    const errors: Record<string, string> = {};
    if (!documentNum.trim()) {
      errors.documentNum = t("invoiceManual.errors.required");
    }
    if (!date.trim()) {
      errors.date = t("invoiceManual.errors.required");
    } else if (!toIsoDate(date)) {
      errors.date = t("invoiceManual.errors.invalidDate");
    }
    const normalizedTaxId = issuerTaxId.replace(/\s+/g, "");
    const trimmedIssuerName = issuerName.trim();
    const hasIssuerTaxId = normalizedTaxId.length > 0;
    const hasIssuerName = trimmedIssuerName.length > 0;
    if (issuerTaxId.trim() && !/^[a-zA-Z0-9]+$/.test(normalizedTaxId)) {
      errors.issuerTaxId = t("invoiceManual.errors.taxIdInvalid");
    }
    if (hasIssuerTaxId !== hasIssuerName) {
      const message = t("invoiceManual.errors.taxIdNameMismatch");
      errors.issuerTaxId = message;
      errors.issuerName = message;
    }

    const itemsPayload = buildItemsPayload();
    if (itemsPayload.length === 0) {
      errors.items = t("invoiceManual.errors.itemsRequired");
      errors.totalAmount = t("invoiceManual.errors.required");
      errors.taxAmount = t("invoiceManual.errors.required");
      errors.netAmount = t("invoiceManual.errors.required");
    }
    if (computed.totals.total <= 0) {
      errors.totalAmount = t("invoiceManual.errors.required");
    }
    if (computed.totals.net <= 0) {
      errors.netAmount = t("invoiceManual.errors.required");
    }
    if (computed.totals.tax < 0) {
      errors.taxAmount = t("invoiceManual.errors.required");
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError(t("invoiceManual.errors.requiredFields"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        documentNum: documentNum.trim(),
        date: toIsoDate(date) as string,
        revenue,
        totalAmount: computed.totals.total,
        taxAmount: computed.totals.tax,
        netAmount: computed.totals.net,
        licensePlate: licensePlate.trim() || undefined,
        paymentMethod: paymentMethod.trim() || undefined,
        notes: notes.trim() || undefined,
        issuerName: hasIssuerTaxId && hasIssuerName ? titleCase(trimmedIssuerName) : undefined,
        issuerTaxId: hasIssuerTaxId && hasIssuerName ? `${issuerCountry}${normalizedTaxId}` : undefined,
        issuerCategory: issuerCategory !== "none" ? issuerCategory : undefined,
        items: itemsPayload,
        accountId: accountId ?? undefined,
        clearAccount: accountId === null && originalAccountId !== null ? true : undefined,
      };
      const invoice = isEditing && invoiceId
        ? await updateInvoice(invoiceId, payload)
        : await createInvoice(payload);
      if (!isEditing && activeDraftId) {
        setDrafts((current) => {
          const next = current.filter((draft) => draft.id !== activeDraftId);
          localStorage.setItem("invodata_invoice_drafts", JSON.stringify(next));
          return next;
        });
        setActiveDraftId(null);
      }
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : t(isEditing ? "invoiceManual.errors.update" : "invoiceManual.errors.create");
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    const draftId = activeDraftId
      ? activeDraftId
      : typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const draft: InvoiceDraft = {
      id: draftId,
      createdAt: new Date().toISOString(),
      data: {
        documentNum,
        date,
        revenue,
        paymentMethod,
        licensePlate,
        issuerName,
        issuerTaxId,
        issuerCountry,
        issuerCategory,
        notes,
        items,
        accountId,
      },
    };
    setDrafts((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === draftId);
      if (existingIndex === -1) {
        return [draft, ...current];
      }
      const next = [...current];
      next[existingIndex] = draft;
      return next;
    });
    setActiveDraftId(draftId);
    setFieldErrors({});
    setFormError(null);
  };

  const handleLoadDraft = (draft: InvoiceDraft) => {
    const data = draft.data;
    setDocumentNum(data.documentNum || "");
    setDate(data.date || "");
    setRevenue(Boolean(data.revenue));
    setPaymentMethod(data.paymentMethod || "");
    setLicensePlate(data.licensePlate || "");
    setIssuerName(data.issuerName || "");
    setIssuerTaxId(data.issuerTaxId || "");
    setIssuerCountry(data.issuerCountry || "PT");
    setIssuerCategory(data.issuerCategory || "none");
    setNotes(data.notes || "");
    setItems(data.items && data.items.length > 0 ? data.items : [{ ...emptyItem }]);
    setAccountId(data.accountId ?? null);
    setIssuerNameLocked(false);
    setIssuerNameAuto(false);
    setIssuerLookupStatus("idle");
    setIssuerLookupMessage(null);
    setFieldErrors({});
    setFormError(null);
    setActiveDraftId(draft.id);
  };

  const handleRemoveDraft = (draftId: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
  };

  const handleTaxIdBlur = async () => {
    setIssuerLookupMessage(null);
    const normalizedTaxId = issuerTaxId.replace(/\s+/g, "");
    if (!normalizedTaxId) {
      setIssuerLookupStatus("idle");
      setIssuerNameLocked(false);
      setIssuerNameAuto(false);
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(normalizedTaxId)) {
      setIssuerLookupStatus("idle");
      setIssuerNameLocked(false);
      setIssuerNameAuto(false);
      setIssuerLookupMessage(t("invoiceManual.lookup.taxIdInvalid"));
      return;
    }

    const fullTaxId = `${issuerCountry}${normalizedTaxId}`;
    setIssuerLookupStatus("loading");
    try {
      const issuer = await lookupIssuerByTaxId(fullTaxId);
      if (issuer?.name) {
        setIssuerName(titleCase(issuer.name));
        setIssuerNameLocked(true);
        setIssuerNameAuto(true);
        setIssuerLookupStatus("found");
        setIssuerLookupMessage(t("invoiceManual.lookup.found"));
        setIssuerCategory(issuer.category || "none");
      } else {
        setIssuerLookupStatus("not_found");
        setIssuerNameLocked(false);
        setIssuerNameAuto(false);
        setIssuerLookupMessage(t("invoiceManual.lookup.notFound"));
      }
    } catch (err) {
      setIssuerLookupStatus("idle");
      setIssuerNameLocked(false);
      setIssuerNameAuto(false);
      setIssuerLookupMessage(t("invoiceManual.lookup.failed"));
    }
  };

  const handleAddCustomCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    setIsCreatingCategory(true);
    try {
      const newCategory = await createCustomCategory(trimmedName, newCategoryColor);
      setCustomCategories((current) => [...current, newCategory]);
      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setShowNewCategoryInput(false);
    } catch (err) {
      console.error("Failed to create custom category:", err);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/invoices">{t("invoiceManual.breadcrumb.invoices")}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t("invoiceManual.breadcrumb.current")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold text-foreground mt-3">{t("invoiceManual.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("invoiceManual.subtitle")}
          </p>
        </div>
      </div>

      {formError && (
        <div className="invodata-card p-4 mb-6 text-sm text-danger">
          {formError}
        </div>
      )}

      {isLoadingInvoice && (
        <div className="invodata-card p-4 mb-6 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="invodata-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("invoiceManual.invoiceData.title")}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  {t("invoiceManual.invoiceData.documentNumber")} <span className="text-danger">*</span>
                </label>
                <Input
                  placeholder={t("invoiceManual.invoiceData.documentNumberPlaceholder")}
                  className={cn("mt-2", fieldErrors.documentNum ? "border-danger focus-visible:ring-danger" : "")}
                  value={documentNum}
                  onChange={(event) => {
                    setDocumentNum(event.target.value);
                    if (fieldErrors.documentNum) {
                      setFieldErrors((current) => {
                        const { documentNum, ...rest } = current;
                        return rest;
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  {t("invoiceManual.invoiceData.issueDate")} <span className="text-danger">*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "mt-2 w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                        fieldErrors.date ? "border-danger focus-visible:ring-danger" : "",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date || t("invoiceManual.invoiceData.issueDatePlaceholder")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date ? parseDisplayDate(date) : undefined}
                      onSelect={(value) => {
                        setDate(value ? format(value, "dd/MM/yyyy") : "");
                        if (fieldErrors.date) {
                          setFieldErrors((current) => {
                            const { date, ...rest } = current;
                            return rest;
                          });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  {t("invoiceManual.invoiceData.type")} <span className="text-danger">*</span>
                </label>
                <Select value={revenue ? "true" : "false"} onValueChange={(value) => setRevenue(value === "true")}>
                  <SelectTrigger className={cn("mt-2", fieldErrors.revenue ? "border-danger ring-danger" : "")}>
                    <SelectValue placeholder={t("invoiceManual.invoiceData.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("invoiceManual.invoiceData.revenue")}</SelectItem>
                    <SelectItem value="false">{t("invoiceManual.invoiceData.expense")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("invoiceManual.invoiceData.paymentMethod")}</label>
                <Input
                  placeholder={t("invoiceManual.invoiceData.paymentMethodPlaceholder")}
                  className="mt-2"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("invoiceManual.invoiceData.licensePlate")}</label>
                <Input
                  placeholder={t("invoiceManual.invoiceData.licensePlatePlaceholder")}
                  className="mt-2"
                  value={licensePlate}
                  onChange={(event) => setLicensePlate(event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("invoiceManual.invoiceData.account")}</label>
                <Select
                  value={accountId ? String(accountId) : "none"}
                  onValueChange={(value) => setAccountId(value === "none" ? null : Number(value))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={t("invoiceManual.invoiceData.accountPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("invoiceManual.invoiceData.noAccount")}</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="invodata-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("invoiceManual.issuer.title")}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">{t("invoiceManual.issuer.country")}</label>
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={countryOpen}
                      className="mt-2 w-full justify-between"
                    >
                      {selectedCountryLabel}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    avoidCollisions={false}
                  >
                    <Command>
                      <CommandInput placeholder={t("invoiceManual.issuer.countrySearch")} />
                      <CommandList>
                        <CommandEmpty>{t("invoiceManual.issuer.countryEmpty")}</CommandEmpty>
                        <CommandGroup>
                          {countryOptions.map((country) => (
                            <CommandItem
                              key={country.code}
                              value={`${country.label} ${country.code}`}
                              onSelect={() => {
                                setIssuerCountry(country.code);
                                setIssuerLookupStatus("idle");
                                setIssuerLookupMessage(null);
                                if (issuerNameAuto) {
                                  setIssuerName("");
                                }
                                setIssuerNameLocked(false);
                                setIssuerNameAuto(false);
                                setCountryOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  issuerCountry === country.code ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {toFlagEmoji(country.code)} {country.label} ({country.code})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("invoiceManual.issuer.taxId")}</label>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-3 py-2 rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground">
                    {issuerCountry}
                  </span>
                  <Input
                    placeholder={t("invoiceManual.issuer.taxIdPlaceholder")}
                    className={fieldErrors.issuerTaxId ? "border-danger focus-visible:ring-danger" : ""}
                    value={issuerTaxId}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setIssuerTaxId(nextValue);
                      setIssuerLookupStatus("idle");
                      setIssuerLookupMessage(null);
                      if (fieldErrors.issuerTaxId) {
                        setFieldErrors((current) => {
                          const { issuerTaxId, ...rest } = current;
                          return rest;
                        });
                      }
                      if (issuerNameAuto) {
                        setIssuerName("");
                      }
                      setIssuerNameLocked(false);
                      setIssuerNameAuto(false);
                    }}
                    onBlur={handleTaxIdBlur}
                  />
                </div>
                {issuerLookupStatus === "loading" && (
                  <p className="text-xs text-muted-foreground mt-2">{t("invoiceManual.issuer.lookupLoading")}</p>
                )}
                {issuerLookupMessage && (
                  <p className="text-xs text-muted-foreground mt-2">{issuerLookupMessage}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground">{t("invoiceManual.issuer.name")}</label>
                <Input
                  placeholder={t("invoiceManual.issuer.namePlaceholder")}
                  className={cn("mt-2", fieldErrors.issuerName ? "border-danger focus-visible:ring-danger" : "")}
                  value={issuerName}
                  onChange={(event) => {
                    setIssuerName(event.target.value);
                    if (fieldErrors.issuerName) {
                      setFieldErrors((current) => {
                        const { issuerName, ...rest } = current;
                        return rest;
                      });
                    }
                  }}
                  onBlur={() => {
                    if (!issuerNameLocked) {
                      setIssuerName((current) => titleCase(current));
                    }
                  }}
                  disabled={issuerNameLocked}
                />
              </div>
               <div className="col-span-2">
                 <label className="text-sm text-muted-foreground">{t("invoiceManual.issuer.category")}</label>
                 <div className="space-y-2 mt-2">
                   <Select value={issuerCategory} onValueChange={setIssuerCategory} disabled={revenue}>
                     <SelectTrigger className="mt-0">
                       <SelectValue placeholder={t("invoiceManual.issuer.categoryPlaceholder")} />
                     </SelectTrigger>
                      <SelectContent>
                        {issuerCategoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              {option.color && (
                                <div
                                  className="w-3 h-3 rounded-full border border-border"
                                  style={{ backgroundColor: option.color }}
                                />
                              )}
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                   {!revenue && (
                     <>
                       {showNewCategoryInput ? (
                         <div className="space-y-3">
                           <div className="flex gap-2">
                             <Input
                               placeholder={t("invoiceManual.issuer.newCategoryPlaceholder") || "New category name..."}
                               value={newCategoryName}
                               onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !isCreatingCategory) {
                                    handleAddCustomCategory();
                                  } else if (e.key === "Escape") {
                                    setShowNewCategoryInput(false);
                                    setNewCategoryName("");
                                    setNewCategoryColor("#3B82F6");
                                  }
                                }}
                               disabled={isCreatingCategory}
                               autoFocus
                             />
                           </div>
                           <div className="flex items-center gap-3">
                             <label className="text-sm text-muted-foreground">{t("common.color")}</label>
                             <div className="flex items-center gap-2">
                               <input
                                 type="color"
                                 value={newCategoryColor}
                                 onChange={(e) => setNewCategoryColor(e.target.value)}
                                 disabled={isCreatingCategory}
                                 className="h-10 w-16 rounded border border-border cursor-pointer"
                               />
                               <span className="text-xs text-muted-foreground">{newCategoryColor}</span>
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={handleAddCustomCategory}
                               disabled={!newCategoryName.trim() || isCreatingCategory}
                               className="flex-1"
                             >
                               {isCreatingCategory ? t("common.saving") : t("invoiceManual.issuer.createCategory")}
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => {
                                 setShowNewCategoryInput(false);
                                 setNewCategoryName("");
                                 setNewCategoryColor("#3B82F6");
                               }}
                               disabled={isCreatingCategory}
                               className="flex-1"
                             >
                               {t("invoiceManual.issuer.cancel")}
                             </Button>
                           </div>
                         </div>
                       ) : (
                         <Button
                           size="sm"
                           variant="outline"
                           className="w-full gap-2"
                           onClick={() => setShowNewCategoryInput(true)}
                         >
                           <Plus className="w-4 h-4" />
                           {t("invoiceManual.issuer.addCustomCategory") || "Add Custom Category"}
                         </Button>
                       )}
                     </>
                   )}
                 </div>
               </div>
            </div>
          </div>

          <div className="invodata-card">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("invoiceManual.items.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("invoiceManual.items.subtitle")}</p>
              </div>
              <Button variant="outline" className="gap-2" onClick={handleAddItem}>
                <Plus className="w-4 h-4" />
                {t("invoiceManual.items.addLine")}
              </Button>
            </div>
            {fieldErrors.items && (
              <div className="px-6 pt-4 text-sm text-danger">{fieldErrors.items}</div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.description")}
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.quantity")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.unitPrice")} <span className="text-danger">*</span>
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.vatPercent")} <span className="text-danger">*</span>
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.vat")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.total")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceManual.items.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const line = computed.lines[index];
                    return (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="px-6 py-4">
                          <Input
                            placeholder={t("invoiceManual.items.placeholders.description")}
                            value={item.description}
                            onChange={(event) => handleItemChange(index, "description", event.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <Input
                            placeholder={t("invoiceManual.items.placeholders.quantity")}
                            className="text-center"
                            value={item.quantity}
                            onChange={(event) => handleItemChange(index, "quantity", event.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <Input
                            placeholder={t("invoiceManual.items.placeholders.unitPrice")}
                            className={cn(
                              "text-right",
                              hasTotalsError ? "border-danger focus-visible:ring-danger" : ""
                            )}
                            value={item.unitPrice}
                            onChange={(event) => handleItemChange(index, "unitPrice", event.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <Input
                            placeholder={t("invoiceManual.items.placeholders.vatPercent")}
                            className={cn(
                              "text-right",
                              hasTotalsError ? "border-danger focus-visible:ring-danger" : ""
                            )}
                            value={item.taxPercent}
                            onChange={(event) => handleItemChange(index, "taxPercent", event.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {formatCurrency(line.tax)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          {formatCurrency(line.total)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveItem(index)}
                            disabled={items.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-border">
              <label className="text-sm text-muted-foreground">{t("invoiceManual.items.notesLabel")}</label>
              <Textarea
                className="mt-2"
                rows={3}
                placeholder={t("invoiceManual.items.notesPlaceholder")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="invodata-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("invoiceManual.summary.title")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("invoiceManual.summary.subtotal")}</span>
                <span className="font-medium text-foreground">{formatCurrency(computed.totals.net)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("invoiceManual.summary.vatTotal")}</span>
                <span className="font-medium text-foreground">{formatCurrency(computed.totals.tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-base font-semibold text-foreground">{t("invoiceManual.summary.total")}</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(computed.totals.total)}
                </span>
              </div>
              {(fieldErrors.totalAmount || fieldErrors.netAmount || fieldErrors.taxAmount) && (
                <div className="text-sm text-danger">{t("invoiceManual.summary.missingTotals")}</div>
              )}
            </div>
          </div>

          <div className="invodata-card p-6">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("invoiceManual.tip.title")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("invoiceManual.tip.body")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full gap-2" onClick={handleSubmit} disabled={isSubmitting}>
              <Send className="h-4 w-4" />
              {isSubmitting
                ? t("invoiceManual.actions.saving")
                : t(isEditing ? "invoiceManual.actions.update" : "invoiceManual.actions.submit")}
            </Button>
            {!isEditing && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
              >
                {t("invoiceManual.actions.saveDraft")}
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate(isEditing && invoiceId ? `/invoices/${invoiceId}` : "/invoices")}
              disabled={isSubmitting}
            >
              {t("invoiceManual.actions.cancel")}
            </Button>
          </div>

          {!isEditing && (
            <div className="invodata-card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t("invoiceManual.drafts.title")}</h3>
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("invoiceManual.drafts.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {drafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => handleLoadDraft(draft)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                        draft.id === activeDraftId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {draft.data.documentNum || t("invoiceManual.drafts.noNumber")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("invoiceManual.drafts.meta", {
                            issuer: draft.data.issuerName || t("invoiceManual.drafts.noIssuer"),
                            date: draft.data.date || t("invoiceManual.drafts.noDate"),
                          })}
                        </span>
                      </div>
                      <span
                        role="button"
                        aria-label={t("invoiceManual.drafts.remove")}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveDraft(draft.id);
                        }}
                        className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-danger"
                      >
                        <X className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceManualEntry;
