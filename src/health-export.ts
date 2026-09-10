import type { HealthAnalytics } from "./domain/health";
import type { Filters } from "./domain/types";
import { toCsv } from "./export";

export function healthCsv(
  analytics: HealthAnalytics,
  filters: Filters,
  page: "intelligence" | "glosas",
): string {
  const context: (string | number)[][] = [
    ["PULSO — SAÚDE / DADOS SINTÉTICOS"],
    [
      "Posição",
      analytics.asOf,
      "Período de faturamento",
      filters.startMonth,
      filters.endMonth,
      "Unidade",
      filters.unitId,
      "Pagador",
      filters.payerId,
    ],
  ];
  if (page === "glosas")
    return toCsv([
      ...context,
      [
        "Escopo",
        "Todos os casos conhecidos até a posição, inclusive anteriores ao mês inicial; filtros locais da fila não aplicados.",
      ],
      [
        "Caso",
        "Conta",
        "Guia",
        "Unidade",
        "Pagador",
        "Especialidade",
        "Procedimento",
        "Motivo",
        "Categoria local",
        "Responsável",
        "Situação",
        "Notificação",
        "Prazo para recurso",
        "Envio do recurso",
        "Protocolo",
        "Prazo para resposta",
        "Glosado (R$)",
        "Em discussão (R$)",
        "Revertido sem caixa (R$)",
        "Recuperado em caixa (R$)",
        "Baixado (R$)",
      ],
      ...analytics.cases.map((item) => [
        item.id,
        item.invoiceId,
        item.guideNumber,
        item.unitName,
        item.payerName,
        item.specialty,
        item.procedure,
        item.reason,
        item.category,
        item.owner,
        item.status,
        item.registeredDate,
        item.dueDate,
        item.submittedAt ?? "",
        item.protocol ?? "",
        item.appealDueDate ?? "",
        item.glosedCents / 100,
        item.underDiscussionCents / 100,
        item.releasedToReceiveCents / 100,
        item.recoveredCashCents / 100,
        item.writtenOffCents / 100,
      ]),
    ]);
  return toCsv([
    ...context,
    [
      "Escopo",
      "Contas faturadas no período; códigos internos demonstrativos, sem correspondência TUSS; checklist na emissão.",
    ],
    [
      "Conta",
      "Guia",
      "Tipo de guia",
      "Especialidade",
      "Procedimento",
      "Código interno",
      "Autorização na emissão",
      "Dias até faturar",
      "Documentação completa",
      "Valor da conta (R$)",
    ],
    ...analytics.accounts.map((item) => [
      item.invoiceId,
      item.guideNumber,
      item.guideType,
      item.specialty,
      item.procedure,
      item.internalCode,
      item.authorizationStatus,
      item.billingLagDays,
      item.documents.some((document) => document.status === "Pendente")
        ? "Não"
        : "Sim",
      item.items.reduce((total, line) => total + line.amountCents, 0) / 100,
    ]),
  ]);
}
