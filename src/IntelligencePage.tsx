import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Clock3,
  FileCheck2,
  Info,
  Layers,
  Search,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dashboard, Dataset, Filters } from "./domain/types";
import type { HealthAnalytics } from "./domain/health";
import {
  compareLatestMonth,
  recoveryScenario,
  type ComparisonMeasure,
} from "./domain/intelligence";
import { money, moneyCompact, monthLabel, percent } from "./format";
import "./intelligence.css";

interface Props {
  analytics: HealthAnalytics;
  dashboard: Dashboard;
  data: Dataset;
  filters: Filters;
  onSelectInvoice: (id: string) => void;
  onSelectPayer: (id: string) => void;
  onOpenGlosas: () => void;
}
const number = (value: number | null, suffix = "") =>
  value === null
    ? "Não apurado"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;

export function IntelligencePage({
  analytics,
  dashboard,
  data,
  filters,
  onSelectInvoice,
  onSelectPayer,
  onOpenGlosas,
}: Props) {
  const [specialty, setSpecialty] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [disputePct, setDisputePct] = useState(30);
  const [releasedPct, setReleasedPct] = useState(100);
  const comparison = useMemo(
    () => compareLatestMonth(data, filters, "2026-01"),
    [data, filters],
  );
  const dispute = analytics.cases.reduce(
    (total, item) => total + item.underDiscussionCents,
    0,
  );
  const released = analytics.cases.reduce(
    (total, item) => total + item.releasedToReceiveCents,
    0,
  );
  const scenario = recoveryScenario(dispute, released, disputePct, releasedPct);
  const largestPayer = [...analytics.payerScorecards].sort(
    (a, b) => b.billedCents - a.billedCents,
  )[0];
  const pendingDocs = analytics.accounts.filter((account) =>
    account.documents.some((doc) => doc.status === "Pendente"),
  );
  const accountRows = analytics.accounts.filter(
    (account) =>
      (specialty === "all" || account.specialty === specialty) &&
      `${account.invoiceId} ${account.guideNumber} ${account.procedure} ${account.internalCode}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const pageCount = Math.max(1, Math.ceil(accountRows.length / 8));
  const currentPage = Math.min(page, pageCount - 1);
  const specialtyOptions = [
    ...new Set(analytics.accounts.map((account) => account.specialty)),
  ].sort();
  const m = analytics.summary;
  return (
    <section className="pg-page intelligence-page">
      <div className="intel-intro">
        <span className="intel-intro-icon">
          <Stethoscope size={24} />
        </span>
        <div>
          <h2>Da conta assistencial à decisão financeira</h2>
          <p>
            Especialidades, qualidade do faturamento e pontos de atenção
            calculados a partir do recorte.
          </p>
        </div>
        <span className="intel-tag">Análise explicável</span>
      </div>
      <div className="pg-metrics pg-metrics-four">
        <HealthMetric
          icon={<Layers size={18} />}
          label="Contas faturadas"
          value={number(m.billedVolume)}
          detail="Contas emitidas no período; não é número de pacientes."
        />
        <HealthMetric
          icon={<ChartNoAxesCombined size={18} />}
          label="Ticket por conta"
          value={money(m.averageTicketCents)}
          detail="Valor faturado ÷ número de contas do período."
        />
        <HealthMetric
          icon={<Clock3 size={18} />}
          label="Tempo até faturar"
          value={number(m.averageBillingLagDays, " dias")}
          detail="Média entre a data do serviço e a emissão da conta."
        />
        <HealthMetric
          icon={<FileCheck2 size={18} />}
          label="Documentação completa"
          value={percent(m.completeDocumentsPct)}
          detail="Contas sem pendências no checklist de faturamento."
        />
      </div>
      <article className="panel intel-reading">
        <div className="panel-head">
          <div>
            <p className="eyebrow">LEITURA DOS DADOS</p>
            <h2>Onde concentrar a análise</h2>
          </div>
          <span className="intel-tag">Regras transparentes</span>
        </div>
        <div className="intel-signals">
          <div>
            <span className="intel-signal-number">01</span>
            <h3>Exposição da carteira</h3>
            <p>
              <strong>{money(dashboard.metrics.overdueCents)}</strong> estão
              vencidos:{" "}
              {percent(
                dashboard.metrics.openCents
                  ? (dashboard.metrics.overdueCents /
                      dashboard.metrics.openCents) *
                      100
                  : null,
              )}{" "}
              do saldo aberto. A glosa já faz parte desse saldo.
            </p>
            <small>Base: posição da carteira na data de corte.</small>
          </div>
          <div>
            <span className="intel-signal-number">02</span>
            <h3>Composição da receita</h3>
            <p>
              {largestPayer && m.billedCents > 0 ? (
                <>
                  <strong>{largestPayer.name}</strong> concentra{" "}
                  {percent((largestPayer.billedCents / m.billedCents) * 100)} do
                  faturamento, com {largestPayer.invoiceCount} contas.
                </>
              ) : (
                "Não há faturamento no recorte para avaliar composição."
              )}
            </p>
            <small>Participação observada; não estima risco de crédito.</small>
          </div>
          <div>
            <span className="intel-signal-number">03</span>
            <h3>Prevenção de retrabalho</h3>
            <p>
              <strong>{pendingDocs.length} contas</strong> têm documento
              pendente. Na carteira de glosas,{" "}
              <strong>{analytics.queues.overdue.length} casos</strong> têm prazo
              de ação vencido.
            </p>
            <button className="text-button" onClick={onOpenGlosas}>
              Abrir central de glosas <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </article>
      <div className="intel-two-columns">
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MOVIMENTO RECENTE</p>
              <h2>
                {monthLabel(comparison.currentMonth)} versus{" "}
                {monthLabel(comparison.previousMonth)}
              </h2>
              <p className="muted">
                Último mês selecionado e mês imediatamente anterior.
              </p>
            </div>
          </div>
          {comparison.available ? (
            <div className="intel-comparison">
              <ComparisonRow
                label="Faturamento"
                value={comparison.billed!}
                currency
              />
              <ComparisonRow
                label="Recebimentos"
                value={comparison.received!}
                currency
              />
              <ComparisonRow
                label="Contas emitidas"
                value={comparison.accounts!}
              />
            </div>
          ) : (
            <p className="intel-empty">{comparison.reason}</p>
          )}
          <p className="intel-footnote">
            Mesmos filtros de unidade e pagador. Compara meses completos, mesmo
            que o anterior esteja fora do mês inicial. Sem ajuste por dias úteis
            ou sazonalidade.
          </p>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">PERFIL ASSISTENCIAL</p>
              <h2>Faturamento por especialidade</h2>
              <p className="muted">
                Receita por emissão da conta, no período selecionado.
              </p>
            </div>
          </div>
          {analytics.specialtyBreakdown.length ? (
            <div
              className="intel-chart"
              role="img"
              aria-label="Gráfico de faturamento por especialidade. Consulte os valores na tabela abaixo."
            >
              <ResponsiveContainer width="100%" height={245}>
                <BarChart
                  data={analytics.specialtyBreakdown}
                  layout="vertical"
                  margin={{ left: 4, right: 24, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e9ec"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={moneyCompact}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12, fill: "#365854" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar
                    dataKey="billedCents"
                    name="Faturamento"
                    fill="#168c7c"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="intel-empty">Nenhuma conta faturada neste recorte.</p>
          )}
          <details className="intel-details">
            <summary>Ver valores e taxas por especialidade</summary>
            <div className="table-wrap">
              <table className="data-table">
                <caption>
                  Contas faturadas no período, com glosas conhecidas até a
                  posição
                </caption>
                <thead>
                  <tr>
                    <th>Especialidade</th>
                    <th>Contas</th>
                    <th>Faturado</th>
                    <th>Glosa inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.specialtyBreakdown.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.invoiceCount}</td>
                      <td>{money(row.billedCents)}</td>
                      <td>{percent(row.cohortGlosaRatePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      </div>
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PAGADORES</p>
            <h2>Exposição e qualidade do faturamento</h2>
            <p className="muted">
              Taxa inicial = primeira glosa conhecida ÷ faturamento das mesmas
              contas.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table intel-payers">
            <caption>Comparação descritiva de pagadores no período</caption>
            <thead>
              <tr>
                <th>Pagador</th>
                <th>Contas</th>
                <th>Faturado</th>
                <th>Glosa inicial</th>
                <th>Saldo vencido¹</th>
                <th>
                  <span className="sr-only">Detalhamento</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.payerScorecards.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <small>
                      {row.id === "p-municipal"
                        ? "Contrato público demonstrativo"
                        : row.id === "p-particular"
                          ? "Pagamento direto"
                          : "Saúde suplementar"}
                    </small>
                  </td>
                  <td>{row.invoiceCount}</td>
                  <td>{money(row.billedCents)}</td>
                  <td>
                    <strong>{percent(row.cohortGlosaRatePct)}</strong>
                    <small>{money(row.glosaCents)} glosados</small>
                  </td>
                  <td>
                    {money(
                      dashboard.payers.find((payer) => payer.id === row.id)
                        ?.overdueCents ?? 0,
                    )}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      aria-label={`Ver contas de ${row.name}`}
                      onClick={() => onSelectPayer(row.id)}
                    >
                      Ver contas <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="intel-footnote">
          ¹ Posição inclui contas anteriores ao período. Coortes recentes
          tiveram menos tempo para receber glosas; taxas não demonstram
          qualidade clínica nem permitem concluir causalidade. Pagamentos
          particulares não recebem glosa de operadora nesta demo.
        </p>
      </article>
      <article className="panel intel-simulator">
        <div className="panel-head">
          <div>
            <p className="eyebrow">CENÁRIO DE CAIXA</p>
            <h2>Quanto uma recuperação poderia acrescentar?</h2>
            <p className="muted">
              Ajuste hipóteses sobre os saldos de glosa ainda abertos na
              posição.
            </p>
          </div>
          <SlidersHorizontal size={22} />
        </div>
        <div className="intel-simulation-grid">
          <div className="intel-sliders">
            <label htmlFor="dispute-scenario">
              Parcela em discussão a recuperar <strong>{disputePct}%</strong>
              <input
                id="dispute-scenario"
                type="range"
                min="0"
                max="100"
                step="5"
                value={disputePct}
                onChange={(event) => setDisputePct(Number(event.target.value))}
              />
              <small>Saldo em discussão: {money(dispute)}</small>
            </label>
            <label htmlFor="released-scenario">
              Parcela já liberada a receber <strong>{releasedPct}%</strong>
              <input
                id="released-scenario"
                type="range"
                min="0"
                max="100"
                step="5"
                value={releasedPct}
                onChange={(event) => setReleasedPct(Number(event.target.value))}
              />
              <small>Revertido sem recebimento: {money(released)}</small>
            </label>
          </div>
          <div className="intel-scenario-result" aria-live="polite">
            <span>Caixa adicional simulado</span>
            <strong>{money(scenario.additionalCashCents)}</strong>
            <p>
              {money(scenario.fromDisputeCents)} da discussão
              <br />+ {money(scenario.fromReleasedCents)} já liberados
            </p>
            <small>
              Limite do saldo elegível: {money(scenario.ceilingCents)}
            </small>
          </div>
        </div>
        <p className="intel-footnote">
          <Info size={14} /> Hipótese escolhida por você, sem previsão de prazo
          ou probabilidade. Não altera os indicadores realizados; não inclui
          impostos, custos do recurso ou valores já recuperados.
        </p>
      </article>
      <article className="panel">
        <div className="panel-head intel-table-head">
          <div>
            <p className="eyebrow">RASTREABILIDADE ASSISTENCIAL</p>
            <h2>Guias e procedimentos faturados</h2>
            <p className="muted">
              Códigos internos demonstrativos; não correspondem à TUSS.
            </p>
          </div>
          <div className="pg-controls intel-controls">
            <label>
              <span className="sr-only">Filtrar especialidade da tabela</span>
              <select
                aria-label="Filtrar especialidade da tabela"
                value={specialty}
                onChange={(event) => {
                  setSpecialty(event.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Todas as especialidades</option>
                {!specialtyOptions.includes(specialty) &&
                  specialty !== "all" && (
                    <option value={specialty}>{specialty}</option>
                  )}
                {specialtyOptions.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="pg-search">
              <Search size={16} />
              <input
                aria-label="Buscar guia ou procedimento"
                placeholder="Guia, conta ou procedimento"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table intel-accounts">
            <caption>Contas e informações de faturamento por guia</caption>
            <thead>
              <tr>
                <th>Conta / guia</th>
                <th>Procedimento</th>
                <th>Autorização</th>
                <th>Checklist</th>
                <th>Até faturar</th>
                <th>
                  <span className="sr-only">Detalhe</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accountRows
                .slice(currentPage * 8, currentPage * 8 + 8)
                .map((row) => (
                  <tr key={row.invoiceId}>
                    <td>
                      <strong>{row.invoiceId}</strong>
                      <small>
                        {row.guideNumber} · {row.guideType}
                      </small>
                    </td>
                    <td>
                      {row.procedure}
                      <small>
                        {row.specialty} · {row.internalCode}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${row.authorizationStatus === "Pendente" ? "intel-pending" : ""}`}
                      >
                        {row.authorizationStatus}
                      </span>
                    </td>
                    <td>
                      {row.documents.some(
                        (doc) => doc.status === "Pendente",
                      ) ? (
                        <span className="intel-pending-text">Pendente</span>
                      ) : (
                        "Completo"
                      )}
                    </td>
                    <td>{row.billingLagDays} dias</td>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`Detalhar conta assistencial ${row.invoiceId}`}
                        onClick={() => onSelectInvoice(row.invoiceId)}
                      >
                        Detalhar <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!accountRows.length && (
            <p className="intel-empty">
              Nenhuma guia corresponde à busca e aos filtros.
            </p>
          )}
        </div>
        <div className="pg-pagination">
          <span>
            {accountRows.length} contas · {currentPage + 1} de {pageCount}
          </span>
          <button
            className="btn btn-secondary"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <button
            className="btn btn-secondary"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
        <p className="intel-footnote">
          Busca e especialidade filtram apenas esta tabela. Os cartões e o CSV
          do topo seguem os filtros globais. Uma conta não representa
          necessariamente um atendimento único.
        </p>
      </article>
    </section>
  );
}

function HealthMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="panel pg-metric">
      <span className="pg-metric-icon">{icon}</span>
      <p className="muted">{label}</p>
      <strong className="metric-value">{value}</strong>
      <span className="pg-metric-sub">{detail}</span>
    </article>
  );
}
function ComparisonRow({
  label,
  value,
  currency = false,
}: {
  label: string;
  value: ComparisonMeasure;
  currency?: boolean;
}) {
  const format = currency ? money : (input: number) => number(input);
  return (
    <div className="intel-comparison-row">
      <div>
        <span>{label}</span>
        <small>Anterior: {format(value.previous)}</small>
      </div>
      <div>
        <strong>{format(value.current)}</strong>
        <small>
          {value.changePct === null
            ? "Variação não apurada: base zero"
            : `${value.changePct > 0 ? "+" : ""}${percent(value.changePct)} · ${value.difference > 0 ? "+" : ""}${format(value.difference)}`}
        </small>
      </div>
    </div>
  );
}
