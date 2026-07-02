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
import random
import time
import threading
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
    category: Optional[str] = None


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
    current_date: Optional[str] = None


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


def _normalize_for_match(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _normalize_category(raw: Optional[str], allowed: Optional[set[str]] = None) -> str:
    if not raw:
        return "SERVICES"
    allowed_set = allowed or set(ALLOWED_CATEGORIES)
    cleaned = raw.strip()
    normalized_key = re.sub(r"[^A-Za-z0-9]+", "_", cleaned).strip("_").upper()
    if normalized_key in allowed_set:
        return normalized_key
    cleaned_tokens = re.sub(r"[^A-Z0-9]+", " ", normalized_key).split()
    for token in cleaned_tokens:
        mapped = CATEGORY_SYNONYMS.get(token)
        if mapped:
            return mapped
    for key, mapped in CATEGORY_SYNONYMS.items():
        if key in normalized_key:
            return mapped
    return "SERVICES"


def _parse_categories(raw: str) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = []
    if not isinstance(parsed, list):
        return []
    categories: list[str] = []
    for entry in parsed:
        if isinstance(entry, str) and entry.strip():
            normalized = re.sub(r"[^A-Za-z0-9]+", "_", entry.strip()).strip("_").upper()
            if normalized:
                categories.append(normalized)
    return categories


def _parse_redact_terms(raw_terms: str) -> list[str]:
    if not raw_terms:
        return []
    if ";" in raw_terms:
        parts = re.split(r"[;]+", raw_terms)
    else:
        parts = [raw_terms]
    return [part.strip() for part in parts if part and part.strip()]


def _build_redaction_terms(user_name: str, user_tax_id: str, extra_terms: list[str]) -> list[str]:
    terms: set[str] = set()
    if user_name:
        normalized_name = " ".join(user_name.split())
        if len(normalized_name) > 2:
            terms.update(_expand_term_variants(normalized_name))
        for token in re.split(r"\s+", normalized_name):
            if len(token) > 2:
                terms.update(_expand_term_variants(token))
    if user_tax_id:
        compact = re.sub(r"\s+", "", user_tax_id)
        normalized = re.sub(r"[^A-Za-z0-9]", "", user_tax_id)
        digits = re.sub(r"\D", "", user_tax_id)
        for candidate in [compact, normalized, digits]:
            if len(candidate) > 2:
                terms.update(_expand_term_variants(candidate))
    for term in extra_terms:
        if term and len(term) > 2:
            terms.update(_expand_term_variants(term))
    return sorted(terms, key=len, reverse=True)


def _build_normalized_terms(terms: list[str]) -> list[str]:
    normalized = []
    for term in terms:
        clean = _normalize_for_match(term)
        if len(clean) > 2:
            normalized.append(clean)
    return sorted(set(normalized), key=len, reverse=True)


def _parse_redact_boxes(raw_boxes: str) -> list[dict]:
    if not raw_boxes:
        return []
    try:
        parsed = json.loads(raw_boxes)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    boxes = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        try:
            x = float(item.get("x", 0))
            y = float(item.get("y", 0))
            width = float(item.get("width", 0))
            height = float(item.get("height", 0))
            page = int(item.get("page", 1))
            page_width = float(item.get("pageWidth", 0))
            page_height = float(item.get("pageHeight", 0))
        except (TypeError, ValueError):
            continue
        if width <= 0 or height <= 0:
            continue
        boxes.append({
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "page": page,
            "pageWidth": page_width,
            "pageHeight": page_height,
        })
    return boxes


def _apply_boxes_to_image(image: Image.Image, boxes: list[dict]) -> int:
    if not boxes:
        return 0
    draw = ImageDraw.Draw(image)
    count = 0
    for box in boxes:
        page = box.get("page", 1)
        if page not in (1, 0, None):
            continue
        x = box.get("x", 0)
        y = box.get("y", 0)
        w = box.get("width", 0)
        h = box.get("height", 0)
        if w <= 0 or h <= 0:
            continue
        draw.rectangle([x, y, x + w, y + h], fill=(0, 0, 0))
        count += 1
    return count


def _apply_boxes_to_pdf(doc: fitz.Document, boxes: list[dict]) -> int:
    if not boxes:
        return 0
    count = 0
    for box in boxes:
        page_index = int(box.get("page", 1)) - 1
        if page_index < 0 or page_index >= doc.page_count:
            continue
        page = doc[page_index]
        page_width = page.rect.width
        page_height = page.rect.height
        src_width = box.get("pageWidth") or page_width
        src_height = box.get("pageHeight") or page_height
        if src_width <= 0 or src_height <= 0:
            continue
        scale_x = page_width / src_width
        scale_y = page_height / src_height
        x0 = box.get("x", 0) * scale_x
        y0 = box.get("y", 0) * scale_y
        x1 = (box.get("x", 0) + box.get("width", 0)) * scale_x
        y1 = (box.get("y", 0) + box.get("height", 0)) * scale_y
        rect = fitz.Rect(x0, y0, x1, y1)
        page.add_redact_annot(rect, fill=(0, 0, 0))
        page.apply_redactions()
        count += 1
    return count


def _redact_pil_image(image: Image.Image, terms: list[str]) -> int:
    normalized_terms = _build_normalized_terms(terms)
    if not normalized_terms:
        return 0
    try:
        data = pytesseract.image_to_data(
            image, output_type=Output.DICT, lang="por")
    except TesseractNotFoundError:
        logger.error("Tesseract not installed; skipping OCR redaction.")
        return 0
    draw = ImageDraw.Draw(image)
    redaction_count = 0
    for idx in range(len(data.get("text", []))):
        text = (data["text"][idx] or "").strip().lower()
        if not text:
            continue
        normalized = _normalize_for_match(text)
        if not normalized:
            continue
        if not any(token in normalized for token in normalized_terms):
            continue
        x = data["left"][idx]
        y = data["top"][idx]
        w = data["width"][idx]
        h = data["height"][idx]
        draw.rectangle([x, y, x + w, y + h], fill=(0, 0, 0))
        redaction_count += 1
    return redaction_count


def _redact_image_bytes(image_bytes: bytes, user_name: str, user_tax_id: str, extra_terms: list[str], redact_boxes: list[dict]) -> bytes:
    terms = _build_redaction_terms(
        user_name or "", user_tax_id or "", extra_terms)
    if not terms and not redact_boxes:
        return image_bytes
    try:
        image = Image.open(BytesIO(image_bytes))
    except Exception:
        return image_bytes
    original_format = image.format or "PNG"
    image = image.convert("RGB")
    redaction_count = _redact_pil_image(image, terms) if terms else 0
    box_count = _apply_boxes_to_image(image, redact_boxes)
    if redaction_count == 0 and box_count == 0:
        logger.info("No redaction matches found in image.")
        return image_bytes
    if redaction_count > 0:
        logger.info(
            "Redaction applied for %d term occurrences (image).", redaction_count)
    if box_count > 0:
        logger.info("Redaction applied for %d manual boxes (image).", box_count)
    buffer = BytesIO()
    image.save(buffer, format=original_format)
    return buffer.getvalue()


def _redact_pdf_bytes(pdf_bytes: bytes, user_name: str, user_tax_id: str, extra_terms: list[str], redact_boxes: list[dict]) -> bytes:
    terms = _build_redaction_terms(
        user_name or "", user_tax_id or "", extra_terms)
    normalized_terms = _build_normalized_terms(terms)
    if not terms and not redact_boxes:
        return pdf_bytes
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return pdf_bytes
    try:
        redacted = False
        redaction_count = 0
        box_count = 0
        for page_index in range(doc.page_count):
            page = doc[page_index]
            page_redacted = False
            if normalized_terms:
                words = page.get_text("words")
                for word in words:
                    text = word[4] if len(word) > 4 else ""
                    normalized = _normalize_for_match(text)
                    if not normalized:
                        continue
                    if not any(token in normalized for token in normalized_terms):
                        continue
                    rect = fitz.Rect(word[0], word[1], word[2], word[3])
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    page_redacted = True
                    redaction_count += 1
            if redact_boxes:
                page_boxes = [
                    box for box in redact_boxes
                    if int(box.get("page", 1)) - 1 == page_index
                ]
                for box in page_boxes:
                    page_width = page.rect.width
                    page_height = page.rect.height
                    src_width = box.get("pageWidth") or page_width
                    src_height = box.get("pageHeight") or page_height
                    if src_width <= 0 or src_height <= 0:
                        continue
                    scale_x = page_width / src_width
                    scale_y = page_height / src_height
                    x0 = box.get("x", 0) * scale_x
                    y0 = box.get("y", 0) * scale_y
                    x1 = (box.get("x", 0) + box.get("width", 0)) * scale_x
                    y1 = (box.get("y", 0) + box.get("height", 0)) * scale_y
                    rect = fitz.Rect(x0, y0, x1, y1)
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    page_redacted = True
                    box_count += 1
            if page_redacted:
                page.apply_redactions()
                redacted = True
        if redacted:
            logger.info(
                "Redaction applied for %d term occurrences.", redaction_count)
            if box_count > 0:
                logger.info(
                    "Redaction applied for %d manual boxes (PDF).", box_count)
            return doc.tobytes()
        logger.info("No text matches found. Falling back to OCR redaction.")
        try:
            images = convert_from_bytes(pdf_bytes)
        except Exception:
            return pdf_bytes
        ocr_count = 0
        box_count = 0
        redacted_images = []
        for idx, image in enumerate(images):
            rgb = image.convert("RGB")
            ocr_count += _redact_pil_image(rgb, terms)
            page_boxes = [
                box for box in redact_boxes
                if int(box.get("page", 1)) - 1 == idx
            ]
            if page_boxes:
                box_count += _apply_boxes_to_image(rgb, page_boxes)
            redacted_images.append(rgb)
        if ocr_count == 0 and box_count == 0:
            logger.info("No OCR matches found.")
            return pdf_bytes
        logger.info("OCR redaction applied for %d term occurrences.", ocr_count)
        if box_count > 0:
            logger.info(
                "Redaction applied for %d manual boxes (PDF OCR).", box_count)
        buffer = BytesIO()
        redacted_images[0].save(
            buffer, format="PDF", save_all=True, append_images=redacted_images[1:])
        return buffer.getvalue()
    finally:
        doc.close()


app = FastAPI(title="InvoData AI API")

_AI_ENABLED = os.getenv("INVODATA_AI_ENABLED", "true").strip().lower() in {"1", "true", "yes"}
_CLIENT = None
_CLIENT_ERROR = None
MODEL_ID = "gemini-2.5-flash"
MAX_CHAT_MESSAGES = 50
MAX_MESSAGES_TEXT_CHARS = 8000
BACKOFF_MAX_ATTEMPTS = 5
BACKOFF_BASE_SECONDS = 0.5
BACKOFF_MAX_SECONDS = 8.0
VERTEX_MIN_INTERVAL_SECONDS = 0.1
VERTEX_MAX_CONCURRENCY = 4
_VERTEX_LAST_CALL = 0.0
_VERTEX_LOCK = threading.Lock()
_VERTEX_SEMAPHORE = threading.Semaphore(VERTEX_MAX_CONCURRENCY)


def _get_ai_client():
    if not _AI_ENABLED:
        raise HTTPException(status_code=503, detail="AI is disabled.")
    global _CLIENT
    global _CLIENT_ERROR
    if _CLIENT is None:
        try:
            _CLIENT = genai.Client(
                vertexai=True,
                project=os.getenv("GCP_PROJECT"),
                location=os.getenv("GCP_LOCATION", "europe-west4")
            )
            _CLIENT_ERROR = None
        except Exception as exc:  # noqa: BLE001
            _CLIENT_ERROR = exc
    if _CLIENT is None:
        detail = "AI credentials are not configured."
        if _CLIENT_ERROR is not None:
            detail = f"{detail} {_CLIENT_ERROR}"
        raise HTTPException(status_code=503, detail=detail)
    return _CLIENT


def _generate_with_backoff(*args, **kwargs):
    client = _get_ai_client()
    last_error = None
    for attempt in range(1, BACKOFF_MAX_ATTEMPTS + 1):
        try:
            with _VERTEX_SEMAPHORE:
                with _VERTEX_LOCK:
                    now = time.time()
                    wait_for = VERTEX_MIN_INTERVAL_SECONDS - \
                        (now - _VERTEX_LAST_CALL)
                    if wait_for > 0:
                        time.sleep(wait_for)
                    globals()["_VERTEX_LAST_CALL"] = time.time()
                return client.models.generate_content(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt >= BACKOFF_MAX_ATTEMPTS:
                break
            delay = min(BACKOFF_MAX_SECONDS,
                        BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
            jitter = random.uniform(0, delay * 0.2)
            sleep_for = delay + jitter
            logger.warning(
                "Vertex AI request failed (attempt %d/%d). Retrying in %.2fs.",
                attempt,
                BACKOFF_MAX_ATTEMPTS,
                sleep_for,
            )
            time.sleep(sleep_for)
    raise last_error


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


@app.post("/api/redact-file")
async def redact_file(file: UploadFile = File(...),
                      user_name: str = Form(""),
                      user_tax_id: str = Form(""),
                      redact_name: str = Form(""),
                      redact_terms: str = Form(""),
                      redact_boxes: str = Form("")):
    logger.info("Received redaction request.")
    file_bytes = await file.read()
    extra_terms = _parse_redact_terms(redact_terms)
    boxes = _parse_redact_boxes(redact_boxes)
    redact_name_value = redact_name or user_name
    if (file.content_type or "").startswith("image/"):
        redacted_bytes = _redact_image_bytes(
            file_bytes, redact_name_value, user_tax_id, extra_terms, boxes)
    else:
        redacted_bytes = _redact_pdf_bytes(
            file_bytes, redact_name_value, user_tax_id, extra_terms, boxes)
    content_type = file.content_type or "application/octet-stream"
    return Response(content=redacted_bytes, media_type=content_type)


@app.post("/api/extract-invoice")
async def extract_invoice(file: UploadFile = File(...),
                          accounts: str = Form("[]"),
                          categories: str = Form("[]"),
                          user_name: str = Form(""),
                          user_tax_id: str = Form(""),
                          redact_name: str = Form(""),
                          redact_terms: str = Form(""),
                          redact_boxes: str = Form("")):
    logger.info("Received AI extraction request.")
    pdf_bytes = await file.read()

    account_names = json.loads(accounts)
    accounts_context = ", ".join(
        account_names) if account_names else "No accounts provided"

    provided_categories = _parse_categories(categories)
    allowed_categories = set(ALLOWED_CATEGORIES)
    allowed_categories.update(provided_categories)
    categories_context = ", ".join(sorted(allowed_categories))

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

    OUTPUT REQUIREMENTS:
    - The 'date' field must be in ISO format: YYYY-MM-DD.
    - 'issuerTaxId' must be unique per issuer and formatted as COUNTRYCODE+NIF with no spaces (example: PT123456789).
    - If the PDF contains multiple invoice/receipt numbers, you must return one invoice per number.
    - Do not merge different invoice/receipt numbers into a single invoice.
    - Each invoice must use the correct document number for its own section.
    - Each item must include 'taxPrice' and 'taxPercent' (percentage value from 0-100) when available.
    - If an item indicates free shipping (e.g., "envio grátis", "portes grátis"), represent it as a discount with negative totalPrice and unitPrice when values exist.
    - If you set 'accountLast4', it must be exactly 4 digits.
    - If you provide 'category', it must be one of: {categories_context}.
    """

    try:
        extra_terms = _parse_redact_terms(redact_terms)
        boxes = _parse_redact_boxes(redact_boxes)
        redact_name_value = redact_name or user_name
        if redact_name_value or user_tax_id or extra_terms or boxes:
            if (file.content_type or "").startswith("image/"):
                pdf_bytes = _redact_image_bytes(
                    pdf_bytes, redact_name_value, user_tax_id, extra_terms, boxes)
            else:
                pdf_bytes = _redact_pdf_bytes(
                    pdf_bytes, redact_name_value, user_tax_id, extra_terms, boxes)
        response = _generate_with_backoff(
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
            header_category = header.get("category")
            if header_category:
                header["category"] = _normalize_category(header_category, allowed_categories)
        return invoices

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting Gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/categorize-issuer")
async def categorize_issuer(
    issuer_name: str = Form(...),
    designation: str = Form(None),
    items: str = Form(None),
    categories: str = Form("[]")
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

    provided_categories = _parse_categories(categories)
    allowed_categories = set(ALLOWED_CATEGORIES)
    allowed_categories.update(provided_categories)
    categories_context = ", ".join(sorted(allowed_categories))

    prompt = (
        f"Analyze this company: {context} and classify it. "
        "Use item/service descriptions to disambiguate when available. "
        "Return exactly one of these uppercase categories: "
        f"{categories_context}."
    )

    try:
        response = _generate_with_backoff(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CategoryResult
            )
        )

        result = json.loads(response.text)
        final_category = _normalize_category(result.get("category"), allowed_categories)

        logger.info(f"Categorization success: {final_category}")
        return {"category": final_category}

    except HTTPException:
        raise
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

    current_date = payload.current_date or datetime.utcnow().strftime("%Y-%m-%d")
    prompt = (
        "You are a helpful finance assistant. Use the provided session summary, "
        "message history, and finance snapshot to answer the latest user request. "
        f"Today's date is {current_date}. "
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
            _generate_with_backoff,
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ChatSessionResponse
            )
        )
    except HTTPException:
        raise
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
