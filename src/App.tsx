import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  ShieldAlert,
  ChartNoAxesCombined,
  BookOpen,
  Download,
  ChevronRight,
  ArrowUpRight,
  CalendarDays,
  Info,
  Menu,
  X,
  CircleCheck,
  CircleAlert,
  Building2,
  ListFilter,
  RotateCcw,
  Stethoscope,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { demoData } from "./data/demo";
import { calculateDashboard, validateDataset } from "./domain/finance";
import type { Dashboard, Filters, InvoicePosition } from "./domain/types";
import {
  dateLabel,
  delta,
  money,
  moneyCompact,
  monthLabel,
  percent,
} from "./format";
import { dashboardCsv, downloadCsv } from "./export";
import { DetailPage } from "./DetailPages";
import { healthDemo } from "./data/health-demo";
import { calculateHealth, validateHealthData } from "./domain/health";
import { IntelligencePage } from "./IntelligencePage";
import { GlosasPage } from "./GlosasPage";
import { healthCsv } from "./health-export";

type Page =
  | "overview"
  | "intelligence"
  | "revenue"
  | "receivables"
  | "glosas"
  | "costs"
  | "guide";
const pages: {
  id: Page;
  label: string;
  subtitle: string;
  icon: typeof Activity;
}[] = [
  {
    id: "overview",
    label: "Visão geral",
    subtitle: "Resultado, caixa e pontos de atenção da operação.",
    icon: LayoutDashboard,
  },
  {
    id: "intelligence",
    label: "Inteligência assistencial",
    subtitle:
      "Receita por especialidade, qualidade do faturamento e cenários de recuperação.",
    icon: Stethoscope,
  },
  {
    id: "revenue",
    label: "Faturamento e caixa",
    subtitle: "Quanto faturamos e quanto efetivamente recebemos?",
    icon: ArrowLeftRight,
  },
  {
    id: "receivables",
    label: "Contas a receber",
    subtitle: "Quanto falta receber, de quem e desde quando?",
    icon: Wallet,
  },
  {
    id: "glosas",
    label: "Central de glosas",
    subtitle:
      "Prazos, recursos e recuperação: do motivo original ao recebimento.",
    icon: ShieldAlert,
  },
  {
    id: "costs",
    label: "Custos e resultado",
    subtitle: "Para onde vão os recursos da operação?",
    icon: ChartNoAxesCombined,
  },
  {
    id: "guide",
    label: "Guia dos indicadores",
    subtitle: "Definições, origem dos números e limites de leitura.",
    icon: BookOpen,
  },
];
const defaultFilters: Filters = {
  startMonth: "2026-01",
  endMonth: "2026-08",
  unitId: "all",
  payerId: "all",
};
const months = Array.from(
  { length: 8 },
  (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
);
function pageFromHash(): Page {
  const id = window.location.hash.slice(1);
  return pages.find((page) => page.id === id)?.id ?? "overview";
}
const datasetErrors = [
  ...validateDataset(demoData),
  ...validateHealthData(demoData, healthDemo),
];

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState("");
  const dashboard = useMemo(
    () => calculateDashboard(demoData, filters),
    [filters],
  );
  const healthAnalytics = useMemo(
    () => calculateHealth(demoData, healthDemo, filters),
    [filters],
  );
  const current = pages.find((item) => item.id === page)!;
  const selected = dashboard.positions.find((item) => item.id === selectedId);
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#main-content") return;
      setPage(pageFromHash());
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = `${current.label} · Pulso`;
  }, [current.label]);
  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [menuOpen]);
  useEffect(() => {
    if (!exportNotice) return;
    const timeout = window.setTimeout(() => setExportNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [exportNotice]);
  function navigate(next: Page) {
    setPage(next);
    window.location.hash = next;
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function changeFilter(key: keyof Filters, value: string) {
    setFilters((previous) => {
      const next = { ...previous, [key]: value };
      if (next.startMonth > next.endMonth) {
        if (key === "startMonth") next.endMonth = next.startMonth;
        else next.startMonth = next.endMonth;
      }
      return next;
    });
  }
  if (datasetErrors.length)
    return (
      <main className="fatal-state">
        <CircleAlert size={32} />
        <h1>Não foi possível validar a base</h1>
        <p>
          Os indicadores estão indisponíveis para evitar apresentar números
          inconsistentes.
        </p>
        <ul>
          {datasetErrors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </main>
    );
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      {menuOpen && (
        <button
          className="nav-scrim"
          aria-label="Fechar navegação"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
          aria-label="Pulso, visão geral"
        >
          <span className="brand-mark">
            <Activity size={28} strokeWidth={2.6} />
          </span>
          <span>
            pulso<span className="brand-caption">FINANÇAS DA SAÚDE</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">
            <Building2 size={19} />
          </span>
          <div>
            Rede Horizonte<small>Ambiente demonstrativo</small>
          </div>
        </div>
        <div className="nav-caption">GESTÃO FINANCEIRA</div>
        <nav aria-label="Navegação principal">
          {pages
            .filter((item) => item.id !== "guide")
            .map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {page === item.id && <span className="nav-active-mark" />}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="#guide"
            className={`nav-item ${page === "guide" ? "active" : ""}`}
            onClick={() => navigate("guide")}
            aria-current={page === "guide" ? "page" : undefined}
          >
            <BookOpen size={19} />
            Guia dos indicadores
          </a>
          <div className="demo-card">
            <div>
              <span className="demo-dot" />
              DADOS SINTÉTICOS
            </div>
            <p>Explore uma operação fictícia de saúde.</p>
            <span>Base até {dateLabel(demoData.snapshotDate)}</span>
          </div>
          <div className="sidebar-footer">
            <span className="user-avatar">GH</span>
            <div>
              Gestão Horizonte<small>Visão do prestador</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn menu-toggle"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={21} />
            </button>
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <strong>{current.label}</strong>
          </div>
          <span className="demo-pill">
            <span />
            Demonstração
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-title-row">
            <div>
              <p className="eyebrow">INTELIGÊNCIA FINANCEIRA</p>
              <h1>{current.label}</h1>
              <p className="page-subtitle">{current.subtitle}</p>
            </div>
            {page !== "guide" && (
              <button
                className="btn btn-secondary export-button"
                onClick={() => {
                  downloadCsv(
                    page === "intelligence" || page === "glosas"
                      ? healthCsv(healthAnalytics, filters, page)
                      : dashboardCsv(dashboard, filters, page),
                    `pulso-${page}-${filters.endMonth}.csv`,
                  );
                  setExportNotice(
                    "CSV preparado com os dados do recorte atual.",
                  );
                }}
              >
                <Download size={17} />
                Exportar CSV
              </button>
            )}
          </div>
          {page !== "guide" && (
            <>
              <section className="filter-bar" aria-label="Filtros do dashboard">
                <span className="filter-icon">
                  <ListFilter size={19} />
                </span>
                <label>
                  De
                  <select
                    aria-label="Mês inicial"
                    value={filters.startMonth}
                    onChange={(event) =>
                      changeFilter("startMonth", event.target.value)
                    }
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {monthLabel(month)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Até
                  <select
                    aria-label="Mês final e posição da carteira"
                    value={filters.endMonth}
                    onChange={(event) =>
                      changeFilter("endMonth", event.target.value)
                    }
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {monthLabel(month)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="filter-divider" />
                <label className="unit-filter">
                  Unidade
                  <select
                    value={filters.unitId}
                    onChange={(event) =>
                      changeFilter("unitId", event.target.value)
                    }
                  >
                    <option value="all">Todas as unidades</option>
                    {demoData.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="payer-filter">
                  Pagador
                  <select
                    value={filters.payerId}
                    onChange={(event) =>
                      changeFilter("payerId", event.target.value)
                    }
                  >
                    <option value="all">Todos os pagadores</option>
                    {demoData.payers.map((payer) => (
                      <option key={payer.id} value={payer.id}>
                        {payer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="icon-btn reset-button"
                  onClick={() => setFilters(defaultFilters)}
                  aria-label="Restaurar filtros"
                  title="Restaurar filtros"
                >
                  <RotateCcw size={17} />
                </button>
              </section>
              <div className="context-line">
                <span>
                  <CalendarDays size={14} />
                  {monthLabel(filters.startMonth)} a{" "}
                  {monthLabel(filters.endMonth)}
                </span>
                <span>Carteira na posição de {dateLabel(dashboard.asOf)}</span>
                <span>
                  {demoData.units.find((unit) => unit.id === filters.unitId)
                    ?.name ?? "Rede completa"}
                </span>
              </div>
            </>
          )}
          {page === "overview" ? (
            <Overview dashboard={dashboard} navigate={navigate} />
          ) : page === "intelligence" ? (
            <IntelligencePage
              analytics={healthAnalytics}
              dashboard={dashboard}
              data={demoData}
              filters={filters}
              onSelectInvoice={setSelectedId}
              onSelectPayer={(id) => {
                changeFilter("payerId", id);
                navigate("receivables");
              }}
              onOpenGlosas={() => navigate("glosas")}
            />
          ) : page === "glosas" ? (
            <GlosasPage
              analytics={healthAnalytics}
              filters={filters}
              onSelectInvoice={setSelectedId}
            />
          ) : (
            <DetailPage
              page={page}
              dashboard={dashboard}
              data={demoData}
              filters={filters}
              onSelectInvoice={setSelectedId}
            />
          )}
          <footer className="main-footer">
            <span>
              <Activity size={14} />
              Pulso · Gestão financeira de serviços de saúde
            </span>
            <span>Valores demonstrativos · Sem dados de pacientes</span>
          </footer>
        </main>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        {exportNotice && (
          <span className="toast">
            <CircleCheck size={18} />
            {exportNotice}
          </span>
        )}
      </div>
      {selected && (
        <InvoiceDialog
          invoice={selected}
          asOf={dashboard.asOf}
          close={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  target,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  target?: number | null;
  accent?: boolean;
  icon: typeof Activity;
}) {
  return (
    <article className={`metric-card ${accent ? "metric-primary" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <div className="metric-value" title={money(value)}>
        {moneyCompact(value)}
      </div>
      <div
        className={`metric-comparison ${target && value >= target ? "positive" : ""}`}
      >
        {detail}
      </div>
      <div className="metric-note">
        {target
          ? `Meta do período: ${moneyCompact(target)}`
          : label === "Em disputa"
            ? "Incluído no saldo a receber"
            : "Posição no último dia do período"}
      </div>
    </article>
  );
}

function Overview({
  dashboard: d,
  navigate,
}: {
  dashboard: Dashboard;
  navigate: (page: Page) => void;
}) {
  const m = d.metrics;
  const [showTable, setShowTable] = useState(false);
  const billedShare = d.payers
    .filter((payer) => payer.billedCents > 0)
    .sort((a, b) => b.billedCents - a.billedCents);
  return (
    <>
      <section className="metric-grid" aria-label="Indicadores principais">
        <Metric
          label="Faturamento"
          value={m.billedCents}
          detail={delta(m.billedCents, m.billedTargetCents)}
          target={m.billedTargetCents}
          accent
          icon={ChartNoAxesCombined}
        />
        <Metric
          label="Recebido no período"
          value={m.receivedCents}
          detail={delta(m.receivedCents, m.receivedTargetCents)}
          target={m.receivedTargetCents}
          icon={ArrowLeftRight}
        />
        <Metric
          label="Saldo a receber"
          value={m.openCents}
          detail={`${moneyCompact(m.overdueCents)} vencidos`}
          icon={Wallet}
        />
        <Metric
          label="Em disputa"
          value={m.disputedCents}
          detail="Glosas ainda em discussão"
          icon={ShieldAlert}
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel cash-chart">
          <div className="panel-head">
            <div>
              <p className="eyebrow">EVOLUÇÃO FINANCEIRA</p>
              <h2>Faturamento e recebimentos</h2>
            </div>
            <button className="text-button" onClick={() => navigate("revenue")}>
              Explorar
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div
            className="chart-wrap"
            role="img"
            aria-label="Evolução mensal do faturamento e dos recebimentos. Valores detalhados disponíveis no botão Ver tabela."
          >
            <ResponsiveContainer width="100%" height={272}>
              <ComposedChart
                data={d.monthly}
                margin={{ top: 12, right: 15, bottom: 5, left: 7 }}
              >
                <defs>
                  <linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#118577" stopOpacity={0.16} />
                    <stop
                      offset="100%"
                      stopColor="#118577"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 4"
                  vertical={false}
                  stroke="#e8eef0"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#62717a", fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  tickFormatter={(value) => `${Number(value) / 100000} mil`}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                  tick={{ fill: "#62717a", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => money(Number(value))}
                  labelFormatter={(label) => monthLabel(String(label))}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #dbe4e6",
                    fontSize: 14,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ paddingTop: 21, fontSize: 13 }}
                />
                <Area
                  type="monotone"
                  dataKey="receivedCents"
                  name="Recebido"
                  stroke="#118577"
                  strokeWidth={2.5}
                  fill="url(#cash-fill)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="billedCents"
                  name="Faturado"
                  stroke="#355a82"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote">
            <span>Faturamento por emissão · Recebimentos por pagamento</span>
            <button
              className="text-button"
              aria-expanded={showTable}
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? "Ocultar tabela" : "Ver tabela"}
            </button>
          </div>
          {showTable && (
            <div className="table-wrap">
              <table className="data-table">
                <caption>Valores mensais em reais</caption>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Faturado</th>
                    <th>Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {d.monthly.map((row) => (
                    <tr key={row.month}>
                      <td>{monthLabel(row.month)}</td>
                      <td>{money(row.billedCents)}</td>
                      <td>{money(row.receivedCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel payer-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ORIGEM DA RECEITA</p>
              <h2>Faturamento por pagador</h2>
            </div>
          </div>
          <p className="panel-description">
            Participação no valor faturado do período.
          </p>
          <div className="payer-bars">
            {billedShare.map((payer, index) => (
              <div className="payer-bar" key={payer.id}>
                <div>
                  <span>
                    <i className={`payer-swatch swatch-${index % 4}`} />
                    {payer.name}
                  </span>
                  <strong>
                    {percent(
                      m.billedCents
                        ? (payer.billedCents / m.billedCents) * 100
                        : 0,
                    )}
                  </strong>
                </div>
                <div className="bar-track">
                  <span
                    className={`bar-fill swatch-${index % 4}`}
                    style={{
                      width: `${m.billedCents ? (payer.billedCents / m.billedCents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>{money(payer.billedCents)}</small>
              </div>
            ))}
          </div>
          {!billedShare.length && (
            <p className="empty-state">Nenhuma conta faturada neste recorte.</p>
          )}
          <button
            className="panel-bottom-link"
            onClick={() => navigate("receivables")}
          >
            Ver carteira de recebíveis
            <ChevronRight size={16} />
          </button>
        </section>
        <section className="panel attention-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">PARA ACOMPANHAR</p>
              <h2>Atenção à operação</h2>
            </div>
            <span className="count-pill">{d.alerts.length}</span>
          </div>
          <div className="alert-list">
            {d.alerts.length ? (
              d.alerts.map((alert) => (
                <button
                  className={`alert-item alert-${alert.level}`}
                  key={alert.id}
                  onClick={() => navigate(alert.page)}
                >
                  <span className="alert-icon">
                    <CircleAlert size={19} />
                  </span>
                  <span>
                    <strong>{alert.title}</strong>
                    <span>{alert.description}</span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <CircleCheck size={24} />
                <p>
                  Nenhum alerta para os critérios demonstrativos deste recorte.
                </p>
              </div>
            )}
          </div>
        </section>
        <section className="panel result-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">RESULTADO DO PERÍODO</p>
              <h2>Da receita ao resultado</h2>
            </div>
            <Info size={18} aria-hidden="true" />
          </div>
          {m.costCents !== null && m.resultCents !== null ? (
            <>
              <div className="result-rows">
                <div>
                  <span>Faturamento</span>
                  <strong>{money(m.billedCents)}</strong>
                </div>
                <div>
                  <span>Baixas definitivas no período</span>
                  <strong>− {money(m.writeOffCents)}</strong>
                </div>
                <div>
                  <span>Custos por competência</span>
                  <strong>− {money(m.costCents)}</strong>
                </div>
              </div>
              <div className="result-total">
                <div>
                  <span>Resultado gerencial</span>
                  <strong className={m.resultCents < 0 ? "negative" : ""}>
                    {moneyCompact(m.resultCents)}
                  </strong>
                </div>
                <span
                  className={`badge ${m.resultCents < 0 ? "badge-warning" : "badge-success"}`}
                >
                  {percent(m.marginPct)} do faturado
                </span>
              </div>
              <p className="fine-print">
                Simulação sem impostos. Não representa lucro contábil. Glosas em
                recurso continuam no saldo a receber.
              </p>
            </>
          ) : (
            <div className="empty-state">
              <Info size={24} />
              <p>
                Custos não foram rateados por pagador. Selecione todos os
                pagadores para apurar o resultado.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="method-note">
        <Info size={17} />
        <span>
          <strong>Período e posição têm leituras diferentes.</strong>{" "}
          Faturamento e caixa são movimentos do período. A carteira considera
          todas as contas existentes até {dateLabel(d.asOf)}, inclusive as
          anteriores ao mês inicial.
        </span>
      </div>
    </>
  );
}

function InvoiceDialog({
  invoice,
  asOf,
  close,
}: {
  invoice: InvoicePosition;
  asOf: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus.current?.focus();
    };
  }, []);
  const events = demoData.events
    .filter((event) => event.invoiceId === invoice.id && event.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date));
  const healthAccount = healthDemo.accounts.find(
    (account) => account.invoiceId === invoice.id,
  );
  const names = {
    payment: "Pagamento recebido",
    glosa: "Glosa registrada",
    glosa_reversal: "Glosa revertida",
    write_off: "Baixa definitiva",
  };
  return (
    <dialog
      ref={dialog}
      className="invoice-dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="invoice-title"
    >
      <div className="dialog-content">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">DETALHAMENTO FINANCEIRO</p>
            <h2 id="invoice-title">Conta {invoice.id}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Fechar detalhe da conta"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <div className="dialog-context">
          <span className="badge">{invoice.status}</span>
          <span>Posição em {dateLabel(asOf)}</span>
        </div>
        <dl className="invoice-facts">
          <div>
            <dt>Unidade</dt>
            <dd>{invoice.unitName}</dd>
          </div>
          <div>
            <dt>Pagador</dt>
            <dd>{invoice.payerName}</dd>
          </div>
          <div>
            <dt>Serviço</dt>
            <dd>{invoice.service}</dd>
          </div>
          <div>
            <dt>Vencimento</dt>
            <dd>{dateLabel(invoice.dueDate)}</dd>
          </div>
        </dl>
        <div className="invoice-amounts">
          <div>
            <span>Faturado</span>
            <strong>{money(invoice.amountCents)}</strong>
          </div>
          <div>
            <span>Recebido</span>
            <strong>{money(invoice.paidCents)}</strong>
          </div>
          <div>
            <span>Em aberto</span>
            <strong>{money(invoice.openCents)}</strong>
          </div>
        </div>
        {healthAccount && (
          <section
            className="health-account-detail"
            aria-label="Detalhes assistenciais da conta"
          >
            <h3>Informações para o faturamento</h3>
            <dl>
              <div>
                <dt>Guia / tipo</dt>
                <dd>
                  {healthAccount.guideNumber} · {healthAccount.guideType}
                </dd>
              </div>
              <div>
                <dt>Especialidade</dt>
                <dd>{healthAccount.specialty}</dd>
              </div>
              <div>
                <dt>Procedimento / código interno</dt>
                <dd>
                  {healthAccount.procedure} · {healthAccount.internalCode}
                </dd>
              </div>
              <div>
                <dt>Autorização na emissão</dt>
                <dd>{healthAccount.authorizationStatus}</dd>
              </div>
              <div>
                <dt>Serviço realizado</dt>
                <dd>{dateLabel(invoice.serviceDate)}</dd>
              </div>
              <div>
                <dt>Tempo até faturar</dt>
                <dd>{healthAccount.billingLagDays} dias</dd>
              </div>
            </dl>
            <ul aria-label="Checklist na emissão">
              {healthAccount.documents.map((document) => (
                <li key={document.label}>
                  {document.label}: <strong>{document.status}</strong>
                </li>
              ))}
            </ul>
            <details className="intel-details">
              <summary>Composição da conta em itens</summary>
              <div className="table-wrap">
                <table className="data-table">
                  <caption>
                    Itens demonstrativos conciliados ao total da conta
                  </caption>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Item</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthAccount.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.kind}</td>
                        <td>{item.label}</td>
                        <td>{money(item.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>Total</th>
                      <td>{money(invoice.amountCents)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </details>
          </section>
        )}
        <h3>Histórico da conta</h3>
        <ol className="timeline">
          <li>
            <span className="timeline-point" />
            <div>
              <time>{dateLabel(invoice.billedDate)}</time>
              <strong>Conta faturada</strong>
              <span>{money(invoice.amountCents)}</span>
            </div>
          </li>
          {events.map((event) => (
            <li key={event.id}>
              <span className="timeline-point" />
              <div>
                <time>{dateLabel(event.date)}</time>
                <strong>{names[event.type]}</strong>
                <span>
                  {money(event.amountCents)}
                  {event.reason ? ` · ${event.reason}` : ""}
                  {event.recoveredCents
                    ? ` · Recuperação de glosa: ${money(event.recoveredCents)}`
                    : ""}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <p className="fine-print">
          Glosas em disputa: {money(invoice.disputedCents)} · Baixas
          definitivas: {money(invoice.writtenOffCents)}. Eventos posteriores à
          posição selecionada não entram nesta leitura.
        </p>
      </div>
    </dialog>
  );
}
