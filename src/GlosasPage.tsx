import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileWarning,
  Search,
  ShieldAlert,
  WalletCards,
  X,
} from "lucide-react";
import type { GlosaCasePosition, HealthAnalytics } from "./domain/health";
import type { Filters } from "./domain/types";
import { downloadCsv, toCsv } from "./export";
import { dateLabel, money, monthLabel, percent } from "./format";
import "./glosas.css";

interface Props {
  analytics: HealthAnalytics;
  filters: Filters;
  onSelectInvoice: (id: string) => void;
}

type Stage = "registered" | "disputed" | "released" | "recovered" | "loss";
type StageSummary = Record<Stage, { amountCents: number; count: number }>;

const statusClass: Record<GlosaCasePosition["status"], string> = {
  "A preparar": "preparing",
  "Em análise": "review",
  "Liberada a receber": "released",
  Recebida: "received",
  Baixada: "writtenoff",
};

const statusLabel = (status: GlosaCasePosition["status"]) => status;

function computeStages(cases: GlosaCasePosition[]): StageSummary {
  const seed: StageSummary = {
    registered: { amountCents: 0, count: 0 },
    disputed: { amountCents: 0, count: 0 },
    released: { amountCents: 0, count: 0 },
    recovered: { amountCents: 0, count: 0 },
    loss: { amountCents: 0, count: 0 },
  };
  return cases.reduce((summary, item) => {
    const entries: Array<[Stage, number]> = [
      ["registered", item.glosedCents],
      ["disputed", item.underDiscussionCents],
      ["released", item.releasedToReceiveCents],
      ["recovered", item.recoveredCashCents],
      ["loss", item.writtenOffCents],
    ];
    entries.forEach(([stage, amountCents]) => {
      if (!amountCents) return;
      summary[stage].amountCents += amountCents;
      summary[stage].count += 1;
    });
    return summary;
  }, seed);
}

function cohortRows(cases: GlosaCasePosition[]) {
  const rows = new Map<string, GlosaCasePosition[]>();
  cases.forEach((item) => {
    const month = item.registeredDate.slice(0, 7);
    rows.set(month, [...(rows.get(month) ?? []), item]);
  });
  return [...rows.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, cohort]) => ({
      month,
      cases: cohort,
      stages: computeStages(cohort),
    }));
}

function dueLabel(item: GlosaCasePosition) {
  if (item.status === "Em análise" && item.appealDueDate)
    return `Resposta: ${dateLabel(item.appealDueDate)}`;
  if (item.status === "A preparar") {
    return item.dueDate
      ? `Recurso: ${dateLabel(item.dueDate)}`
      : "Prazo contratual não informado";
  }
  if (item.status === "Liberada a receber") return "Aguardando recebimento";
  return item.status === "Recebida" ? "Valor recebido" : "Baixa definitiva";
}

function stageText(stage: Stage, summary: StageSummary) {
  const labels: Record<Stage, string> = {
    registered: "Glosa registrada",
    disputed: "Em discussão",
    released: "Revertida, aguardando caixa",
    recovered: "Recuperada em caixa",
    loss: "Perda / baixa definitiva",
  };
  return { ...summary[stage], label: labels[stage] };
}

const dueOrder: Record<GlosaCasePosition["priority"]["dueState"], number> = {
  Vencido: 0,
  Próximo: 1,
  "Em dia": 2,
  "Sem prazo": 3,
};
const priorityOrder: Record<GlosaCasePosition["priority"]["level"], number> = {
  Alta: 0,
  Média: 1,
  Baixa: 2,
};
const queueSort = (a: GlosaCasePosition, b: GlosaCasePosition) =>
  dueOrder[a.priority.dueState] - dueOrder[b.priority.dueState] ||
  priorityOrder[a.priority.level] - priorityOrder[b.priority.level] ||
  b.underDiscussionCents - a.underDiscussionCents ||
  a.dueDate.localeCompare(b.dueDate) ||
  a.id.localeCompare(b.id);

export function GlosasPage({ analytics, filters, onSelectInvoice }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | GlosaCasePosition["status"]>(
    "all",
  );
  const [category, setCategory] = useState<
    "all" | GlosaCasePosition["category"]
  >("all");
  const [responsible, setResponsible] = useState("all");
  const [dueState, setDueState] = useState<
    "all" | GlosaCasePosition["priority"]["dueState"]
  >("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState("");
  const stages = useMemo(
    () => computeStages(analytics.cases),
    [analytics.cases],
  );
  const rows = useMemo(() => cohortRows(analytics.cases), [analytics.cases]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return analytics.cases.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.id,
          item.invoiceId,
          item.guideNumber,
          item.payerName,
          item.procedure,
          item.reason,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      return (
        matchesSearch &&
        (status === "all" || item.status === status) &&
        (category === "all" || item.category === category) &&
        (responsible === "all" || item.owner === responsible) &&
        (dueState === "all" || item.priority.dueState === dueState)
      );
    });
  }, [analytics.cases, category, dueState, responsible, search, status]);
  const ordered = useMemo(() => [...filtered].sort(queueSort), [filtered]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const visibleCases = ordered.slice(page * pageSize, (page + 1) * pageSize);
  const selected = useMemo(
    () => analytics.cases.find((item) => item.id === selectedId) ?? null,
    [analytics.cases, selectedId],
  );
  useEffect(
    () => setPage(0),
    [search, status, category, responsible, dueState],
  );
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);
  useEffect(() => {
    if (!exportNotice) return;
    const timeout = window.setTimeout(() => setExportNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [exportNotice]);
  const filteredStages = useMemo(() => computeStages(filtered), [filtered]);
  const responsibles = useMemo(
    () => [...new Set(analytics.cases.map((item) => item.owner))].sort(),
    [analytics.cases],
  );
  const pareto = useMemo(() => {
    const map = new Map<string, { amountCents: number; count: number }>();
    analytics.cases.forEach((item) => {
      const current = map.get(item.reason) ?? { amountCents: 0, count: 0 };
      current.amountCents += item.glosedCents;
      current.count += 1;
      map.set(item.reason, current);
    });
    return [...map.entries()]
      .map(([reason, values]) => ({ reason, ...values }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [analytics.cases]);
  const totalGlosed = stages.registered.amountCents;
  const releasedCases = analytics.cases.filter(
    (item) => item.releasedToReceiveCents > 0,
  );
  const periodCases = analytics.cases.filter(
    (item) =>
      item.registeredDate >= `${filters.startMonth}-01` &&
      item.registeredDate <= analytics.asOf,
  );
  const periodGlosed = periodCases.reduce(
    (sum, item) => sum + item.glosedCents,
    0,
  );
  const periodRecovery = periodCases.reduce(
    (sum, item) => sum + item.recoveredCashCents,
    0,
  );
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("all");
    setResponsible("all");
    setDueState("all");
  };
  const exportQueue = () => {
    const header = [
      "Caso",
      "Conta",
      "Guia",
      "Pagador",
      "Procedimento",
      "Categoria",
      "Motivo",
      "Responsável",
      "Situação",
      "Glosado (R$)",
      "Em discussão (R$)",
      "Liberado a receber (R$)",
      "Prazo",
      "Prioridade",
    ];
    const csv = toCsv([
      ["PULSO — FILA DE GLOSAS / DADOS SINTÉTICOS"],
      [
        "Posição",
        analytics.asOf,
        "Período",
        filters.startMonth,
        filters.endMonth,
        "Unidade",
        filters.unitId,
        "Pagador",
        filters.payerId,
      ],
      [
        "Filtros locais",
        "Busca",
        search || "Todos",
        "Situação",
        status,
        "Categoria",
        category,
        "Responsável",
        responsible,
        "Prazo",
        dueState,
      ],
      ["Casos exportados", ordered.length],
      header,
      ...ordered.map((item) => [
        item.id,
        item.invoiceId,
        item.guideNumber,
        item.payerName,
        item.procedure,
        item.category,
        item.reason,
        item.owner,
        item.status,
        item.glosedCents / 100,
        item.underDiscussionCents / 100,
        item.releasedToReceiveCents / 100,
        dueLabel(item),
        item.priority.level,
      ]),
    ]);
    downloadCsv(csv, `pulso-fila-glosas-${analytics.asOf}.csv`);
    setExportNotice(
      `${ordered.length} casos da fila atual foram preparados em CSV.`,
    );
  };
  return (
    <section className="gl-page">
      <div className="gl-intro">
        <div>
          <p className="eyebrow">GESTÃO DE GLOSAS</p>
          <h2>Da notificação à recuperação em caixa</h2>
          <p>
            Leitura por casos da base demonstrativa. Valores em discussão já
            compõem o saldo a receber; não devem ser somados novamente.
          </p>
        </div>
        <button className="btn btn-secondary gl-export" onClick={exportQueue}>
          <ArrowDownToLine size={16} /> Exportar fila atual
        </button>
      </div>

      <section
        className="gl-reconciliation"
        aria-labelledby="gl-reconciliation-title"
      >
        <div className="gl-section-head">
          <div>
            <p className="eyebrow">CARTEIRA ACUMULADA</p>
            <h3 id="gl-reconciliation-title">
              Ciclo financeiro desde a origem até a posição
            </h3>
          </div>
          <span>
            Posição em {dateLabel(analytics.asOf)}: {analytics.cases.length}{" "}
            casos
          </span>
        </div>
        <div className="gl-stage-grid">
          {(
            [
              "registered",
              "disputed",
              "released",
              "recovered",
              "loss",
            ] as Stage[]
          ).map((stage, index) => {
            const item = stageText(stage, stages);
            return (
              <div className={`gl-stage gl-stage-${stage}`} key={stage}>
                <span className="gl-stage-step">{index + 1}</span>
                <span>{item.label}</span>
                <strong>{money(item.amountCents)}</strong>
                <small>
                  {item.count} {item.count === 1 ? "caso" : "casos"}
                </small>
              </div>
            );
          })}
        </div>
        <p className="gl-reconciliation-note">
          <CircleAlert size={16} /> Glosado = em discussão + liberado sem caixa
          + recuperado + baixado. Um caso parcialmente resolvido pode aparecer
          em mais de uma contagem. “Revertida, aguardando caixa” ainda não é
          recuperação financeira.
        </p>
      </section>

      <section
        className="gl-period-flow"
        aria-labelledby="gl-period-flow-title"
      >
        <div>
          <p className="eyebrow">COORTE DO PERÍODO</p>
          <h3 id="gl-period-flow-title">
            Coortes notificadas entre {monthLabel(filters.startMonth)} e{" "}
            {monthLabel(filters.endMonth)}
          </h3>
          <p>
            Recuperação é acompanhada apenas dentro dessas mesmas coortes até a
            posição selecionada.
          </p>
        </div>
        <div className="gl-period-metrics">
          <div>
            <span>Notificadas no período</span>
            <strong>{money(periodGlosed)}</strong>
            <small>
              {periodCases.length} {periodCases.length === 1 ? "caso" : "casos"}
            </small>
          </div>
          <div>
            <span>Recuperação da mesma coorte</span>
            <strong>{money(periodRecovery)}</strong>
            <small>Em caixa até {dateLabel(analytics.asOf)}</small>
          </div>
          <div>
            <span>Recuperação / glosado da coorte</span>
            <strong>
              {percent(
                periodGlosed ? (periodRecovery / periodGlosed) * 100 : null,
              )}
            </strong>
            <small>Não compara caixa atual com novas glosas.</small>
          </div>
        </div>
      </section>

      <div className="gl-insight-grid">
        <article className="panel gl-pareto">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MOTIVOS</p>
              <h3>Onde a glosa se concentra</h3>
            </div>
          </div>
          {pareto.length ? (
            <ol className="gl-pareto-list">
              {pareto.slice(0, 5).map((item, index) => (
                <li key={item.reason}>
                  <span className="gl-rank">{index + 1}</span>
                  <div>
                    <strong>{item.reason}</strong>
                    <span className="gl-bar">
                      <i
                        style={{
                          width: `${totalGlosed ? (item.amountCents / totalGlosed) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <small>
                      {item.count} casos · {money(item.amountCents)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty />
          )}
          <p className="gl-panel-note">
            Ordem por valor inicialmente glosado. Use os motivos como ponto de
            investigação, não como diagnóstico automático.
          </p>
        </article>
        <article className="panel gl-queues">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SINAIS DE TRABALHO</p>
              <h3>Onde olhar primeiro</h3>
            </div>
          </div>
          <ul>
            <QueueItem
              icon={AlertTriangle}
              tone="danger"
              label="Prazo vencido"
              cases={analytics.queues.overdue.length}
              amount={analytics.queues.overdue.reduce(
                (sum, item) => sum + item.underDiscussionCents,
                0,
              )}
            />
            <QueueItem
              icon={CalendarClock}
              tone="warning"
              label="Prazo próximo"
              cases={analytics.queues.dueSoon.length}
              amount={analytics.queues.dueSoon.reduce(
                (sum, item) => sum + item.underDiscussionCents,
                0,
              )}
            />
            <QueueItem
              icon={FileWarning}
              tone="muted"
              label="A preparar"
              cases={analytics.queues.toPrepare.length}
              amount={analytics.queues.toPrepare.reduce(
                (sum, item) => sum + item.underDiscussionCents,
                0,
              )}
            />
            <QueueItem
              icon={WalletCards}
              tone="success"
              label="Valor liberado a receber"
              cases={releasedCases.length}
              amount={releasedCases.reduce(
                (sum, item) => sum + item.releasedToReceiveCents,
                0,
              )}
            />
          </ul>
          <p className="gl-panel-note">
            Prazos são demonstrativos e dependem do contrato cadastrado; a tela
            não infere regra universal.
          </p>
        </article>
      </div>

      <article className="panel gl-cohorts">
        <div className="panel-head">
          <div>
            <p className="eyebrow">COORTES</p>
            <h3>Resultado por mês de notificação</h3>
            <p>Mostra a situação acumulada até {dateLabel(analytics.asOf)}.</p>
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table gl-cohort-table">
              <caption>
                Coortes por data de notificação; valores acumulados até a
                posição selecionada.
              </caption>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Casos</th>
                  <th>Glosado</th>
                  <th>Em discussão</th>
                  <th>Liberado a receber</th>
                  <th>Recebido</th>
                  <th>Baixado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <td>{monthLabel(row.month)}</td>
                    <td>{row.cases.length}</td>
                    <td>{money(row.stages.registered.amountCents)}</td>
                    <td>{money(row.stages.disputed.amountCents)}</td>
                    <td>{money(row.stages.released.amountCents)}</td>
                    <td>{money(row.stages.recovered.amountCents)}</td>
                    <td>{money(row.stages.loss.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </article>

      <article className="panel gl-work-queue">
        <div className="panel-head">
          <div>
            <p className="eyebrow">FILA DE TRABALHO</p>
            <h3>Casos para análise</h3>
            <p>
              Os totais do quadro acima são globais; estes filtros atuam apenas
              nesta lista.
            </p>
          </div>
          <span className="count-pill">{filtered.length}</span>
        </div>
        <div className="gl-filters">
          <label className="pg-search">
            <Search size={16} />
            <span className="pg-sr-only">Buscar casos</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Conta, guia, pagador ou motivo"
            />
          </label>
          <label>
            <span>Situação</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="all">Todas</option>
              {Object.keys(statusClass).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Categoria</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as typeof category)
              }
            >
              <option value="all">Todas</option>
              <option>Administrativa</option>
              <option>Técnica</option>
              <option>Contratual</option>
            </select>
          </label>
          <label>
            <span>Responsável</span>
            <select
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
            >
              <option value="all">Todos</option>
              {responsibles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Prazo</span>
            <select
              value={dueState}
              onChange={(event) =>
                setDueState(event.target.value as typeof dueState)
              }
            >
              <option value="all">Todos</option>
              <option>Vencido</option>
              <option>Próximo</option>
              <option>Em dia</option>
              <option>Sem prazo</option>
            </select>
          </label>
          <button className="text-button" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
        <div className="gl-filter-summary">
          <span>
            Fila filtrada:{" "}
            <strong>
              {ordered.length} casos ·{" "}
              {money(filteredStages.disputed.amountCents)} em discussão
            </strong>
          </span>
          <span>Ordem: prazo, prioridade, valor em discussão e data.</span>
        </div>
        {ordered.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table gl-work-table">
                <caption>
                  Lista local filtrada; os totais da reconciliação acima
                  permanecem globais.
                </caption>
                <thead>
                  <tr>
                    <th>Caso</th>
                    <th>Motivo e procedimento</th>
                    <th>Responsável</th>
                    <th>Prazo / sinal</th>
                    <th>Em discussão</th>
                    <th>
                      <span className="pg-sr-only">Detalhe</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.id}</strong>
                        <small>
                          {item.guideNumber} · {item.payerName}
                        </small>
                      </td>
                      <td>
                        <strong>{item.reason}</strong>
                        <small>
                          {item.procedure} · {item.category}
                        </small>
                      </td>
                      <td>
                        {item.owner}
                        <span
                          className={`gl-status gl-status-${statusClass[item.status]}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <strong
                          className={`gl-due gl-due-${item.priority.dueState.toLocaleLowerCase("pt-BR").replace("ó", "o")}`}
                        >
                          {item.priority.dueState}
                        </strong>
                        <small>{dueLabel(item)}</small>
                      </td>
                      <td>
                        <strong>{money(item.underDiscussionCents)}</strong>
                        <small>
                          Glosado: {money(item.glosedCents)} ·{" "}
                          {item.priority.level} prioridade
                        </small>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setSelectedId(item.id)}
                          aria-label={`Ver caso ${item.id}`}
                        >
                          Ver detalhe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav
              className="pg-pagination"
              aria-label="Paginação da fila de glosas"
            >
              <button
                className="btn btn-secondary"
                disabled={page === 0}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </button>
              <span>
                Página {page + 1} de {pageCount}
              </span>
              <button
                className="btn btn-secondary"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </nav>
          </>
        ) : (
          <Empty text="Nenhum caso corresponde aos filtros locais." />
        )}
      </article>
      <div className="gl-export-feedback" role="status" aria-live="polite">
        {exportNotice}
      </div>
      {selected && (
        <GlosaDialog
          item={selected}
          asOf={analytics.asOf}
          close={() => setSelectedId(null)}
          onSelectInvoice={onSelectInvoice}
        />
      )}
    </section>
  );
}

function QueueItem({
  icon: Icon,
  tone,
  label,
  cases,
  amount,
}: {
  icon: typeof AlertTriangle;
  tone: string;
  label: string;
  cases: number;
  amount: number;
}) {
  return (
    <li>
      <span className={`gl-queue-icon ${tone}`}>
        <Icon size={18} />
      </span>
      <div>
        <strong>{label}</strong>
        <small>
          {cases} {cases === 1 ? "caso" : "casos"}
        </small>
      </div>
      <b>{money(amount)}</b>
    </li>
  );
}

function Empty({
  text = "Não há dados para este recorte.",
}: {
  text?: string;
}) {
  return (
    <div className="empty-state">
      <ShieldAlert size={24} />
      <p>{text}</p>
    </div>
  );
}

function GlosaDialog({
  item,
  asOf,
  close,
  onSelectInvoice,
}: {
  item: GlosaCasePosition;
  asOf: string;
  close: () => void;
  onSelectInvoice: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previousFocus.current?.focus();
    };
  }, []);
  const chronology = item.events
    .filter((event) => event.date <= asOf)
    .map((event) => ({
      date: event.date,
      title: event.label,
      detail:
        event.type === "appeal_submission"
          ? `Protocolo: ${item.protocol ?? "Não registrado"}`
          : event.type === "payment"
            ? `${money(event.amountCents)} na conta · ${money(event.recoveredCents ?? 0)} de recuperação desta glosa`
            : money(event.amountCents),
    }));
  return (
    <dialog
      ref={dialog}
      className="invoice-dialog gl-dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="glosa-dialog-title"
    >
      <div className="dialog-content">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">CASO DE GLOSA</p>
            <h2 id="glosa-dialog-title">{item.id}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Fechar detalhe da glosa"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <div className="dialog-context">
          <span className={`gl-status gl-status-${statusClass[item.status]}`}>
            {item.status}
          </span>
          <span>Posição em {dateLabel(asOf)}</span>
        </div>
        <dl className="invoice-facts gl-case-facts">
          <div>
            <dt>Guia</dt>
            <dd>
              {item.guideNumber} · {item.guideType}
            </dd>
          </div>
          <div>
            <dt>Especialidade</dt>
            <dd>{item.specialty}</dd>
          </div>
          <div>
            <dt>Procedimento</dt>
            <dd>{item.procedure}</dd>
          </div>
          <div>
            <dt>Classificação local</dt>
            <dd>{item.category}</dd>
          </div>
          <div>
            <dt>Motivo original</dt>
            <dd>{item.reason}</dd>
          </div>
          <div>
            <dt>Responsável</dt>
            <dd>{item.owner}</dd>
          </div>
        </dl>
        <div className="gl-dialog-money">
          <div>
            <span>Glosado</span>
            <strong>{money(item.glosedCents)}</strong>
          </div>
          <div>
            <span>Em discussão</span>
            <strong>{money(item.underDiscussionCents)}</strong>
          </div>
          <div>
            <span>Liberado a receber</span>
            <strong>{money(item.releasedToReceiveCents)}</strong>
          </div>
          <div>
            <span>Recuperado em caixa</span>
            <strong>{money(item.recoveredCashCents)}</strong>
          </div>
          <div>
            <span>Baixa definitiva</span>
            <strong>{money(item.writtenOffCents)}</strong>
          </div>
        </div>
        <section className="gl-recommendation">
          <ClipboardCheck size={19} />
          <div>
            <strong>Próxima leitura operacional</strong>
            <p>{item.recommendation}</p>
            <small>Justificativa: {item.priority.reason}</small>
          </div>
        </section>
        <div className="gl-detail-grid">
          <section>
            <h3>Prazos e protocolo</h3>
            <dl className="gl-mini-facts">
              <div>
                <dt>Contrato demonstrativo</dt>
                <dd>
                  {item.contractLabel} · {item.contractId}
                </dd>
              </div>
              <div>
                <dt>Prazo contratual</dt>
                <dd>
                  {item.contractualDays} dias · {dateLabel(item.dueDate)}
                </dd>
              </div>
              <div>
                <dt>Notificação</dt>
                <dd>{dateLabel(item.registeredDate)}</dd>
              </div>
              <div>
                <dt>Protocolo</dt>
                <dd>{item.protocol ?? "Não registrado"}</dd>
              </div>
              <div>
                <dt>Recurso</dt>
                <dd>
                  {item.submittedAt
                    ? dateLabel(item.submittedAt)
                    : "Não submetido"}
                </dd>
              </div>
              <div>
                <dt>Resposta</dt>
                <dd>
                  {item.appealDueDate
                    ? dateLabel(item.appealDueDate)
                    : "Não informado"}
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Checklist da emissão</h3>
            {item.documents.length ? (
              <ul className="gl-documents">
                {item.documents.map((doc) => (
                  <li key={doc.label}>
                    <span
                      className={
                        doc.status === "Pendente" ? "missing" : "present"
                      }
                    >
                      {doc.status === "Pendente" ? (
                        <FileWarning size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </span>
                    <span>{doc.label}</span>
                    <small>{doc.status}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="gl-empty-docs">
                Sem checklist documental informado para esta emissão.
              </p>
            )}
          </section>
        </div>
        <section className="gl-timeline-section">
          <h3>Cronologia até a posição</h3>
          <ol className="timeline">
            {chronology.map((event, index) => (
              <li key={`${event.title}-${index}`}>
                <span className="timeline-point" />
                <div>
                  <time>{dateLabel(event.date)}</time>
                  <strong>{event.title}</strong>
                  <span>{event.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="gl-dialog-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              close();
              onSelectInvoice(item.invoiceId);
            }}
          >
            Ver conta financeira <ChevronRight size={16} />
          </button>
          <p>
            Leitura demonstrativa: nenhum recurso, protocolo ou documento é
            alterado nesta tela.
          </p>
        </div>
      </div>
    </dialog>
  );
}
