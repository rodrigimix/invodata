# Notificação de Incidentes de Segurança (72h) — Política e Runbook

**Última atualização:** 2026-02-01

Documento interno para resposta e notificação de incidentes de segurança.

## 1) Política

- Classificar incidentes conforme impacto e tipo de dados.
- Registar todos os incidentes num registo interno.
- Notificar a autoridade competente no prazo máximo de **72 horas** após tomada de conhecimento, quando aplicável.
- Notificar titulares afetados sem demora injustificada quando houver elevado risco.

## 2) Definições

- **Incidente de segurança:** violação de confidencialidade, integridade ou disponibilidade.
- **Dados pessoais:** qualquer informação relacionada com pessoa identificada ou identificável.

## 3) Papel e contactos

- **Responsável/DPO:** <rodrigimix56@gmail.com>
- **Equipa técnica:** equipa de engenharia InvoData

## 4) Runbook (passo a passo)

1. **Detetar e registar (T0):**
   - Abrir ticket de incidente e registar hora de deteção.
   - Guardar evidências iniciais (logs, métricas, alertas).

2. **Conter (T0+):**
   - Isolar sistemas afetados, revogar credenciais comprometidas, aplicar mitigação temporária.

3. **Avaliar impacto (até 24h):**
   - Confirmar se há dados pessoais envolvidos.
   - Determinar tipo de dados, volume, número de titulares e risco.

4. **Notificar autoridade (até 72h):**
   - Enviar descrição do incidente, categorias de dados, medidas tomadas e ponto de contacto.

5. **Notificar titulares (se necessário):**
   - Comunicar de forma clara o que aconteceu, riscos e recomendações.

6. **Erradicar e recuperar:**
   - Corrigir falhas, aplicar patches, restaurar serviços com validação.

7. **Lições aprendidas (até 10 dias úteis):**
   - RCA, ações corretivas, atualização de controlos e documentação.

## 5) Modelo de notificação (resumo)

- Data/hora do incidente e da deteção
- Descrição resumida
- Categorias de dados afetados
- Número estimado de titulares afetados
- Medidas tomadas
- Contacto responsável
