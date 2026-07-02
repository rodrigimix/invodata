# Segurança e Acessos — Políticas e Rotação

**Última atualização:** 2026-02-01

Documento interno com políticas de acesso e rotação de chaves.

## 1) Controlo de acessos (least‑privilege)

- Acesso concedido apenas ao necessário para a função.
- Revisões de permissões a cada 90 dias.
- Contas de serviço com permissões mínimas e sem chaves partilhadas.

## 2) MFA e contas administrativas

- MFA obrigatório para contas administrativas.
- Contas admin separadas de contas pessoais quando possível.

## 3) Rotação de chaves e segredos

- **Segredos de aplicação**: rotação a cada 90 dias ou após incidente.
- **Chaves KMS (GCP)**: rotação automática configurada no KMS.
- **Chaves locais** (se usadas): troca manual e migração dos ficheiros encriptados.

## 4) Registo e auditoria

- Ações críticas registadas em auditoria.
- Monitorização de acessos e falhas de autenticação.

## 5) Configuração (GCS)

- **CMEK** (KMS): ativar com:
  - `invodata.storage.encryption.enabled=true`
  - `invodata.storage.encryption.kmsKey=projects/<project>/locations/<location>/keyRings/<ring>/cryptoKeys/<key>`

## 6) Configuração (armazenamento local)

- Encriptação local opcional:
  - `invodata.storage.encryption.enabled=true`
  - `invodata.storage.encryption.key=<base64 16/24/32 bytes>`
