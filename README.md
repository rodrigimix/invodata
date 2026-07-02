# Invodata 📊🤖

An open-source, AI-powered platform designed to help users effortlessly organize, analyze, and understand their daily spending history without complications.

> **Note:** This project was built with a genuine passion for leveraging modern technology to solve a real-world, everyday problem and simplify financial tracking for everyone.

---

## 🚀 Features

- 📄 **Smart Invoice Parsing:** Automated AI-driven text and data extraction from receipts and invoices using a distributed OCR pipeline.
- 💬 **AI Financial Assistant:** An integrated Q&A chat system where users can converse directly with the AI to get instant insights into their consumption, spending habits, and expenses.
- 📉 **Frictionless Analytics:** A clean, simple, and straightforward dashboard to track financial history, evolution, and spending goals.
- 🔒 **Zero-Knowledge Privacy:** Advanced client-side controlled encryption ensuring sensitive financial data is secure within the database.

---

## 🛠️ Tech Stack

### Frontend
- **Framework & Tooling:** React powered by Vite
- **Styling:** Tailwind CSS

### Backend Architecture
- **Core Engine:** Java 21 / Spring Boot 3.5 (incorporating Spring Security, Data JPA, Data MongoDB, Mail, and Actuator)
- **AI & OCR Processing Worker:** Python 3.12 / FastAPI orchestrated via Gunicorn and Uvicorn workers

### Polyglot Persistence (Databases)
- **MariaDB 11.5 (Relational):** Manages core financial models, accounts, invoice headers, budgets, and user goals
- **MongoDB 7 (Document-based):** Optimized for low-latency retrieval of chat sessions, messages, and AI history logs

### AI & Intelligent Document Processing
- **LLM Integration:** Google Cloud Vertex AI API utilizing Gemini 2.5 Flash models
- **Vision & OCR Pipeline:** Tesseract OCR (pre-configured with Portuguese language models `tesseract-ocr-por`), OpenCV (cv2), PyMuPDF (fitz), Pillow, and PyZbar for localized QR processing

### Security & Compliance
- **Data Encryption:** User-managed cryptographic layer using AES/GCM/NoPadding. Fields such as balances, document numbers, and descriptions are encrypted before persisting to the DB via JPA Attribute Converters using a runtime `X-User-Key`
- **Authentication:** Stateful JWT tokens combined with Spring Security filters
- **MFA:** Built-in Multi-Factor Authentication via Time-Based One-Time Password (TOTP) protocols

### Infrastructure & DevOps
- **Containerization:** Native Docker & Docker Compose setup routing a 6-tier local container architecture
- **Reverse Proxy & Web Server:** Caddy Server 2.8 implementing automatic HTTPS management
- **Deployment Compatibility:** Production-ready scripts designed for RHEL, Podman, and external Synology NFS volume attachments

---

## 🌿 Repository Structure

This repository features a decoupled architecture for flexible deployments:
- `main`: Production-ready core with full Google Cloud Vertex AI integration.
- `local`: Configured for standalone local deployment, allowing the application to run completely offline without requiring Google Cloud services.

---

## 💻 Getting Started

Follow these steps to set up and run the project locally on your machine.

### Prerequisites

- Git & WSL / Linux Terminal
- Java JDK 21+
- Node.js & Docker / Docker Compose
- A **Google Cloud Platform (GCP)** Account (required if running the `main` branch with live Vertex AI integration)

### Installation & Setup (Local Deployment)

1. **Clone the repository and switch to the local branch:**
   ```bash
   git clone git@github.com:rodrigimix/invodata.git
   cd invodata
   git checkout local
