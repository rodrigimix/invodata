import os
import json
import logging
import re
import numpy as np
import cv2
import fitz
import pytesseract
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import Response
from pdf2image import convert_from_bytes
from pyzbar.pyzbar import decode
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Optional
import enum
import asyncio
from datetime import datetime
from io import BytesIO
from PIL import Image, ImageDraw
from pytesseract import Output, TesseractNotFoundError


class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unitPrice: float
    taxPrice: Optional[float] = None
    taxPercent: Optional[float] = None
    totalPrice: float


class InvoiceHeader(BaseModel):
    documentNum: str
    date: str
    isRevenue: bool
    totalAmount: float
    taxAmount: float
    netAmount: float
    issuerTaxId: str
    issuerName: str
    country: str
    accountName: Optional[str] = None
    accountLast4: Optional[str] = None
    licensePlate: Optional[str] = None
    paymentMethod: Optional[str] = None


class InvoiceData(BaseModel):
    header: InvoiceHeader
    items: List[InvoiceItem]


class InvoiceList(BaseModel):
    invoices: List[InvoiceData]


class CategoryResult(BaseModel):
    category: str


class ChatRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str


class ChatUser(BaseModel):
    id: str
    username: str
    language: Optional[str] = None


class FinanceGlobalStats(BaseModel):
    total_spent: float
    total_revenue: float
    savings_rate: float


class FinanceTopCategory(BaseModel):
    category: str
    amount: float
    percentage: float


class FinanceTopCompany(BaseModel):
    name: str
    amount: float
    percentage: float


class FinanceTopInvoice(BaseModel):
    issuer_name: str
    category: Optional[str] = None
    issue_date: str
    total_amount: float
    document_num: Optional[str] = None


class FinanceInvoiceEntry(BaseModel):
    issuer_name: str
    issuer_tax_id: Optional[str] = None
    category: Optional[str] = None
    issue_date: str
    document_num: Optional[str] = None
    revenue: bool
    total_amount: float
    tax_amount: float
    net_amount: float
    payment_method: Optional[str] = None
    license_plate: Optional[str] = None
    account_name: Optional[str] = None
    items: Optional[List[InvoiceItem]] = None


class FinanceMonthlyTrend(BaseModel):
    month: str
    total_expense: float
    total_revenue: float


class FinanceSnapshot(BaseModel):
    period: str
    global_stats: FinanceGlobalStats
    top_categories: List[FinanceTopCategory]
    monthly_trend: List[FinanceMonthlyTrend]
    top_companies: List[FinanceTopCompany]
    top_invoices: List[FinanceTopInvoice]
    invoices: List[FinanceInvoiceEntry]
    goals: Optional[List["FinanceGoalEntry"]] = None


class FinanceGoalEntry(BaseModel):
    id: Optional[int] = None
    name: str
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[str] = None
    completed: Optional[bool] = None
    linked_account: Optional[str] = None


class ChatSessionRequest(BaseModel):
    sessionId: str
    user: ChatUser
    messages: List[ChatMessage]
    summary: Optional[str] = None
    finance_snapshot: FinanceSnapshot


class ChatAction(BaseModel):
    type: str
    name: Optional[str] = None
    accountType: Optional[str] = None
    currency: Optional[str] = None
    balance: Optional[float] = None
    last4: Optional[str] = None
    isEmergencyFund: Optional[bool] = None
    targetAmount: Optional[float] = None
    currentAmount: Optional[float] = None
    deadline: Optional[str] = None
    linkedAccountName: Optional[str] = None
    category: Optional[str] = None
    monthlyLimit: Optional[float] = None
    month: Optional[int] = None
    year: Optional[int] = None


class InvoiceFilter(BaseModel):
    search: Optional[str] = None
    period: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    category: Optional[str] = None
    paymentMethod: Optional[str] = None


class ChatSessionResponse(BaseModel):
    answer: str
    actions: List[ChatAction] = []
    invoiceFilter: Optional[InvoiceFilter] = None


load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = {
    "UTILITIES",
    "SUPERMARKET",
    "RESTAURANT",
    "ENTERTAINMENT",
    "TRANSPORT",
    "FUEL",
    "HEALTH",
    "TELECOM",
    "SERVICES",
    "EDUCATION",
    "CLOTHING",
}

CATEGORY_SYNONYMS = {
    "FOOD": "SUPERMARKET",
    "GROCERY": "SUPERMARKET",
    "SUPERMARKET": "SUPERMARKET",
    "RESTAURANT": "RESTAURANT",
    "RESTAURANTS": "RESTAURANT",
    "DINING": "RESTAURANT",
    "ENTERTAINMENT": "ENTERTAINMENT",
    "LEISURE": "ENTERTAINMENT",
    "TRANSPORT": "TRANSPORT",
    "TRANSPORTATION": "TRANSPORT",
    "TRANSIT": "TRANSPORT",
    "FUEL": "FUEL",
    "GAS": "FUEL",
    "PETROL": "FUEL",
    "HEALTH": "HEALTH",
    "MEDICAL": "HEALTH",
    "PHARMACY": "HEALTH",
    "TELECOM": "TELECOM",
    "TELECOMMUNICATIONS": "TELECOM",
    "INTERNET": "TELECOM",
    "UTILITIES": "UTILITIES",
    "UTILITY": "UTILITIES",
    "ELECTRICITY": "UTILITIES",
    "WATER": "UTILITIES",
    "HOUSING": "UTILITIES",
    "RENT": "UTILITIES",
    "EDUCATION": "EDUCATION",
    "SCHOOL": "EDUCATION",
    "TRAINING": "EDUCATION",
    "CLOTHING": "CLOTHING",
    "FASHION": "CLOTHING",
    "APPAREL": "CLOTHING",
    "SERVICES": "SERVICES",
    "SERVICE": "SERVICES",
    "OTHER": "SERVICES",
    "ACCOUNTANT": "SERVICES",
    "ACCOUNTING": "SERVICES",
    "FINANCE": "SERVICES",
    "FINANCIAL": "SERVICES",
}

CATEGORY_LABELS = {
    "pt": {
        "UTILITIES": "Utilidades",
        "SUPERMARKET": "Supermercado",
        "RESTAURANT": "Restaurante",
        "ENTERTAINMENT": "Entretenimento",
        "TRANSPORT": "Transporte",
        "FUEL": "Combustível",
        "HEALTH": "Saúde",
        "TELECOM": "Telecomunicações",
        "SERVICES": "Serviços",
        "EDUCATION": "Educação",
        "CLOTHING": "Vestuário",
    },
    "en": {
        "UTILITIES": "Utilities",
        "SUPERMARKET": "Supermarket",
        "RESTAURANT": "Restaurant",
        "ENTERTAINMENT": "Entertainment",
        "TRANSPORT": "Transport",
        "FUEL": "Fuel",
        "HEALTH": "Health",
        "TELECOM": "Telecom",
        "SERVICES": "Services",
        "EDUCATION": "Education",
        "CLOTHING": "Clothing",
    },
}


def _resolve_language(code: Optional[str]) -> str:
    if not code:
        return "pt"
    lowered = code.strip().lower()
    return "pt" if lowered.startswith("pt") else "en"


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().lower()


def _user_mentions_date_period(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False
    if _extract_year(normalized) is not None:
        return True
    if re.search(r"\b(19|20)\d{2}-\d{2}-\d{2}\b", normalized):
        return True
    if re.search(r"\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b", normalized):
        return True
    date_keywords = [
        "hoje", "ontem", "amanha", "amanhã", "esta semana", "semana passada",
        "este mes", "este mês", "mes passado", "mês passado", "este ano", "ano passado",
        "entre", "desde", "até", "ate",
        "today", "yesterday", "tomorrow", "this week", "last week",
        "this month", "last month", "this year", "last year",
    ]
    if any(keyword in normalized for keyword in date_keywords):
        return True
    month_keywords = [
        "janeiro", "fevereiro", "marco", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
        "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
        "january", "february", "march", "april", "may", "june", "july", "august",
        "september", "october", "november", "december",
    ]
    return any(keyword in normalized for keyword in month_keywords)


def _extract_year(text: str) -> Optional[int]:
    if not text:
        return None
    match = re.search(r"\b(19|20)\d{2}\b", text)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def _first_name_from_username(username: str) -> str:
    parts = [part for part in username.strip().split() if part]
    return parts[0] if parts else username.strip()


def _build_chat_snapshot(snapshot: FinanceSnapshot) -> dict:
    return {
        "period": snapshot.period,
        "global_stats": snapshot.global_stats.model_dump(),
        "top_categories": [entry.model_dump() for entry in snapshot.top_categories],
        "monthly_trend": [entry.model_dump() for entry in snapshot.monthly_trend],
        "top_companies": [entry.model_dump() for entry in snapshot.top_companies],
        "top_invoices": [entry.model_dump() for entry in snapshot.top_invoices],
        "invoices": [entry.model_dump() for entry in snapshot.invoices],
        "goals": [entry.model_dump() for entry in (snapshot.goals or [])],
    }


def _expand_term_variants(value: str) -> set[str]:
    cleaned = value.strip()
    if not cleaned:
        return set()
    return {cleaned, cleaned.lower(), cleaned.upper(), cleaned.title()}


def _normalize_category(raw: Optional[str]) -> str:
    if not raw:
        return "SERVICES"
    cleaned = raw.strip().upper()
    if cleaned in ALLOWED_CATEGORIES:
        return cleaned
    cleaned_tokens = re.sub(r"[^A-Z0-9]+", " ", cleaned).split()
    for token in cleaned_tokens:
        mapped = CATEGORY_SYNONYMS.get(token)
        if mapped:
            return mapped
    for key, mapped in CATEGORY_SYNONYMS.items():
        if key in cleaned:
            return mapped
    return "SERVICES"


app = FastAPI(title="InvoData AI API")

client = genai.Client(
    vertexai=True,
    project=os.getenv("GCP_PROJECT"),
    location=os.getenv("GCP_LOCATION", "europe-west4")
)
MODEL_ID = "gemini-2.5-flash"
MAX_CHAT_MESSAGES = 50
MAX_MESSAGES_TEXT_CHARS = 8000


def normalize_invoice_date(raw_date: str) -> str:
    normalized = raw_date.strip().split(" ")[0]
    normalized = normalized.replace(".", "-").replace("/", "-")
    formats = (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d-%m-%y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(normalized, fmt).date().isoformat()
        except ValueError:
            continue
    return raw_date


def normalize_license_plate(raw_plate: Optional[str]) -> Optional[str]:
    """
    Normalize license plate to format AA-00-AA where:
    - AA = uppercase letters
    - 00 = digits
    Examples: AB-12-CD, XY-99-ZW
    """
    if not raw_plate:
        return raw_plate

    # Remove all non-alphanumeric characters and convert to uppercase
    cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_plate).upper()

    if not cleaned:
        return raw_plate

    # If already in correct format (4 letters + 2 digits), return with dashes
    if len(cleaned) == 6:
        # Check if format is: 2 letters, 2 digits, 2 letters
        if cleaned[:2].isalpha() and cleaned[2:4].isdigit() and cleaned[4:6].isalpha():
            return f"{cleaned[:2]}-{cleaned[2:4]}-{cleaned[4:6]}"

    # Try to extract pattern from the string
    # Look for: letters, digits, letters
    match = re.search(r"([A-Z]{2})\D*(\d{2})\D*([A-Z]{2})", cleaned)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    # If we can't parse it, return original
    return raw_plate


def normalize_issuer_tax_id(raw_tax_id: Optional[str], country: Optional[str]) -> Optional[str]:
    if not raw_tax_id:
        return raw_tax_id
    normalized = re.sub(r"[^A-Za-z0-9]", "", raw_tax_id).upper()
    if not normalized:
        return raw_tax_id
    if len(normalized) >= 2 and normalized[:2].isalpha():
        return normalized
    if country and len(country.strip()) >= 2:
        prefix = country.strip().upper()[:2]
        return f"{prefix}{normalized}"
    return normalized


def get_qr_codes(pdf_bytes):
    logger.info("Initializing extraction de QR Code")
    try:
        pages = convert_from_bytes(pdf_bytes, dpi=300)
        qr_codes = []
        for page in pages:
            img = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2GRAY)
            _, thresh = cv2.threshold(
                img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            decoded = decode(thresh)
            for obj in decoded:
                data = obj.data.decode('utf-8')
                if data not in qr_codes:
                    qr_codes.append(data)
        return qr_codes
    except Exception as e:
        logger.error(f"Error on local scan of QR: {str(e)}")
        return []


@app.post("/api/scan-qr")
async def scan_qr(file: UploadFile = File(...)):
    logger.info("Received QR scan request.")
    pdf_bytes = await file.read()
    loop = asyncio.get_event_loop()
    qr_codes = await loop.run_in_executor(None, get_qr_codes, pdf_bytes)
    return {"qr_codes": qr_codes}



@app.post("/api/extract-invoice")
async def extract_invoice(file: UploadFile = File(...),
                          accounts: str = Form("[]"),
                          user_name: str = Form(""),
                          user_tax_id: str = Form(""),
                          redact_name: str = Form(""),
                          redact_terms: str = Form(""),
                          custom_categories: str = Form("[]")):
    logger.info("Received AI extraction request.")
    pdf_bytes = await file.read()

    account_names = json.loads(accounts)
    accounts_context = ", ".join(
        account_names) if account_names else "No accounts provided"

    # Parse custom categories
    try:
        custom_cats = json.loads(custom_categories)
        custom_cat_names = [cat.get("name") for cat in custom_cats if isinstance(cat, dict) and cat.get("name")]
    except (json.JSONDecodeError, TypeError):
        custom_cat_names = []

    # Build categories context
    predefined_categories = [
        "UTILITIES", "SUPERMARKET", "RESTAURANT", "ENTERTAINMENT", "TRANSPORT",
        "FUEL", "HEALTH", "TELECOM", "SERVICES", "EDUCATION", "CLOTHING", "REVENUE"
    ]
    all_categories = predefined_categories + custom_cat_names
    categories_list = ", ".join(all_categories)

    prompt = f"""
    Analyze this invoice.

    REVENUE VS EXPENSE LOGIC:
    - Default to expense: if in doubt, 'isRevenue' MUST be false.
    - 'isRevenue' is true only if the user is clearly the issuer and receiving money.
    - Only set 'isRevenue' to true when the issuer name matches the user name or the document explicitly states the user is the issuer.
    - If the document type is "Fatura", "Fatura/Recibo" or "Documento", assume expense unless it clearly states the user is the issuer.

    CONTEXT DATA:
    - 'accountName': Match with one of these if possible: [{accounts_context}]
    - If the bank name is missing, try to extract the last 4 digits and fill 'accountLast4'.
    - User name: "{user_name or 'unknown'}"
    - User tax id (NIF): "{user_tax_id or 'unknown'}"

    IDENTIFICATION RULES:
    - The issuer is the supplier. The buyer/customer may also appear on the document.
    - Never set issuerTaxId to the user's tax id unless the document clearly shows the user as issuer.
    - If the user's name and tax id appear only as customer/buyer, issuerTaxId must be the supplier's tax id.
    - Set 'isRevenue' to true ONLY when the issuer matches the user by name AND tax id.
    - If only one of name or tax id matches the user, treat it as expense unless the document explicitly states the user is the issuer.

    LICENSE PLATE RULES:
    - When extracting license plates (matrículas), format them as AA-00-AA where:
      * AA = uppercase letters (A-Z)
      * 00 = two digits (0-9)
    - Examples of correct format: AB-12-CD, XY-99-ZW
    - Always convert to uppercase and standardize the format.
    - If a license plate is found in a different format, convert it to AA-00-AA format.

    CATEGORY ASSIGNMENT:
    - Assign category from this complete list: {categories_list}
    - Custom categories (user-created): {", ".join(custom_cat_names) if custom_cat_names else "None"}
    - Prioritize custom categories if they match the issuer/content
    - If no custom category matches, use predefined categories
    - Always use exact category names from the list above

    OUTPUT REQUIREMENTS:
    - The 'date' field must be in ISO format: YYYY-MM-DD.
    - 'issuerTaxId' must be unique per issuer and formatted as COUNTRYCODE+NIF with no spaces (example: PT123456789).
    - If the PDF contains multiple invoice/receipt numbers, you must return one invoice per number.
    - Do not merge different invoice/receipt numbers into a single invoice.
    - Each invoice must use the correct document number for its own section.
    - Each item must include 'taxPrice' and 'taxPercent' (percentage value from 0-100) when available.
    - If an item indicates free shipping (e.g., "envio grátis", "portes grátis"), represent it as a discount with negative totalPrice and unitPrice when values exist.
    - If you set 'accountLast4', it must be exactly 4 digits.
    - If you set 'licensePlate', it must be in the format AA-00-AA with uppercase letters.
    """

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes, mime_type=file.content_type),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=InvoiceList
            )
        )

        parsed_response = json.loads(response.text)
        invoices = parsed_response.get("invoices", [])
        for invoice in invoices:
            header = invoice.get("header", {})
            header_date = header.get("date")
            if header_date:
                header["date"] = normalize_invoice_date(header_date)
            header_tax_id = header.get("issuerTaxId")
            header_country = header.get("country")
            if header_tax_id:
                header["issuerTaxId"] = normalize_issuer_tax_id(
                    header_tax_id, header_country)
            # Normalize license plate to AA-00-AA format
            license_plate = header.get("licensePlate")
            if license_plate:
                header["licensePlate"] = normalize_license_plate(license_plate)
        return invoices

    except Exception as e:
        logger.error(f"Error extracting Gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/categorize-issuer")
async def categorize_issuer(
    issuer_name: str = Form(...),
    designation: str = Form(None),
    items: str = Form(None)
):
    logger.info("Categorization request received.")

    items_context = ""
    if items:
        try:
            parsed_items = json.loads(items)
            if isinstance(parsed_items, list):
                normalized_items = []
                for entry in parsed_items:
                    if isinstance(entry, str):
                        normalized_items.append(entry)
                    elif isinstance(entry, dict):
                        desc = entry.get("description") or entry.get(
                            "name") or str(entry)
                        normalized_items.append(desc)
                    else:
                        normalized_items.append(str(entry))
                if normalized_items:
                    items_context = "Items/Services: " + \
                        "; ".join(normalized_items)
        except Exception:
            items_context = ""

    context_parts = [
        f"Company Name: {issuer_name}",
        f"Technical Designation: {designation}"
    ]
    if items_context:
        context_parts.append(items_context)

    context = ", ".join(context_parts)

    combined_context = " ".join(
        [issuer_name or "", designation or "", items_context]).lower()
    telecom_keywords = [
        "telecom", "telecomunica", "telefonia", "phone", "mobile", "móvel",
        "internet", "fibra", "tv", "net", "voz", "broadband",
        "meo", "vodafone", "nos", "nowo"
    ]
    if any(keyword in combined_context for keyword in telecom_keywords):
        logger.info("Heuristic categorization: TELECOM")
        return {"category": "TELECOM"}

    prompt = (
        f"Analyze this company: {context} and classify it. "
        "Use item/service descriptions to disambiguate when available. "
        "Return exactly one of these uppercase categories: "
        "UTILITIES, SUPERMARKET, RESTAURANT, ENTERTAINMENT, TRANSPORT, FUEL, "
        "HEALTH, TELECOM, SERVICES, EDUCATION, CLOTHING."
    )

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CategoryResult
            )
        )

        result = json.loads(response.text)
        final_category = _normalize_category(result.get("category"))

        logger.info(f"Categorization success: {final_category}")
        return {"category": final_category}

    except Exception as e:
        logger.error(f"Error on categorize: {str(e)}")
        return {"category": "SERVICES"}


@app.post("/api/chat-session", response_model=ChatSessionResponse)
async def chat_session_endpoint(payload: ChatSessionRequest):
    messages = payload.messages[-MAX_CHAT_MESSAGES:]
    if messages and messages[-1].role != ChatRole.user:
        logger.warning("chat-session last message is not from user")
    last_user_message = None
    for message in reversed(messages):
        if message.role == ChatRole.user:
            last_user_message = message.content
            break

    messages_text = "\n".join(
        [f"{message.role.value}: {message.content}" for message in messages]
    )
    if len(messages_text) > MAX_MESSAGES_TEXT_CHARS:
        messages_text = messages_text[-MAX_MESSAGES_TEXT_CHARS:]

    user_first_name = _first_name_from_username(payload.user.username)
    finance_context = json.dumps(
        _build_chat_snapshot(payload.finance_snapshot),
        ensure_ascii=False
    )
    summary_text = payload.summary or "None"
    language = _resolve_language(payload.user.language)
    labels = CATEGORY_LABELS.get(language, CATEGORY_LABELS["pt"])
    localized_categories = ", ".join(
        [f"{code} ({labels.get(code, code)})" for code in sorted(ALLOWED_CATEGORIES)])

    prompt = (
        "You are a helpful finance assistant. Use the provided session summary, "
        "message history, and finance snapshot to answer the latest user request. "
        "Answer in the same language as the user. "
        "If the requested detail is not present in the snapshot, say you don't have "
        "enough data to answer precisely. When asked about goals, use finance_snapshot.goals. "
        "If the user asks to view/visualize invoices, confirm that you can open the invoices list "
        "or a specific invoice detail in the app and invite them to use the button (e.g., in PT: "
        "'Posso abrir já a fatura na app — clica no botão abaixo.'). Do not say you cannot visualize.\n\n"
        "Return JSON with an 'answer' string and optional 'actions' and 'invoiceFilter'. "
        "Only include actions when the user explicitly asks to create accounts, goals, or budgets. "
        "When asking the user for missing details, NEVER expose internal field or variable names (e.g., "
        "targetAmount, currentAmount, linkedAccountName). Use natural language only. "
        "If the user asks to view/visualize/open invoices, include 'invoiceFilter' with optional fields: "
        "search (document number, issuer/entity name, or license plate), "
        "period (one of: alltime, month, quarter, year, custom), "
        "startDate, endDate (YYYY-MM-DD, required when period=custom), "
        "category (canonical code), paymentMethod. Omit fields that are not requested. "
        "Use these action types: create_account, create_goal, create_budget. "
        "For create_account, include: name, accountType, currency, balance, last4, isEmergencyFund. "
        "For create_goal, include: name, targetAmount, currentAmount, deadline (YYYY-MM-DD), linkedAccountName. "
        "For create_budget, include: category, monthlyLimit, month, year. "
        "If the user says 'agora'/'now' when asked for month/year, interpret it as the current month/year. "
        "When you list category options to the user, use the localized labels below, but keep "
        "the action.category value as the canonical code (e.g., FUEL, HEALTH). "
        f"Localized categories: {localized_categories}.\n\n"
        f"Session ID: {payload.sessionId}\n"
        f"User: {user_first_name}\n"
        f"Summary: {summary_text}\n"
        f"Finance Snapshot: {finance_context}\n\n"
        f"Messages:\n{messages_text}\n\n"
        "Answer:"
    )

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ChatSessionResponse
            )
        )
    except Exception as e:
        logger.error(f"Error in chat-session endpoint: {str(e)}")
        raise HTTPException(status_code=502, detail="Gemini request failed")

    answer = getattr(response, "text", None) or ""
    if not answer and getattr(response, "candidates", None):
        try:
            answer = response.candidates[0].content.parts[0].text
        except Exception:
            answer = ""

    try:
        parsed = json.loads(answer)
    except Exception:
        parsed = {"answer": answer, "actions": []}

    if parsed.get("invoiceFilter"):
        filter_payload = parsed.get("invoiceFilter") or {}
        year_mentioned = _extract_year(
            last_user_message or "") if last_user_message else None
        if last_user_message and not _user_mentions_date_period(last_user_message):
            filter_payload.pop("startDate", None)
            filter_payload.pop("endDate", None)
            filter_payload.pop("period", None)
        elif year_mentioned is not None:
            period = (filter_payload.get("period") or "").strip().lower()
            if period in {"", "alltime", "year"}:
                filter_payload["period"] = "custom"
                filter_payload["startDate"] = f"{year_mentioned}-01-01"
                filter_payload["endDate"] = f"{year_mentioned}-12-31"
        parsed["invoiceFilter"] = filter_payload

    return {
        "answer": parsed.get("answer", ""),
        "actions": parsed.get("actions", []),
        "invoiceFilter": parsed.get("invoiceFilter")
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
