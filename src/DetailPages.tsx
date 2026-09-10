import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  FileSearch,
  ReceiptText,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Bucket,
  Dashboard,
  Dataset,
  Filters,
  InvoicePosition,
  PayerSummary,
} from "./domain/types";
import { dateLabel, money, moneyCompact, monthLabel, percent } from "./format";
import "./pages.css";

type Page = "revenue" | "receivables" | "glosas" | "costs" | "guide";

interface Props {
  page: Page;
  dashboard: Dashboard;
  data: Dataset;
  filters: Filters;
  onSelectInvoice: (id: string) => void;
}

const chartCurrency = (value: number) => moneyCompact(value);

function CurrencyBarChart({
  data,
  first,
  second,
  firstLabel,
  secondLabel,
}: {
  data: Array<Record<string, string | number>>;
  first: string;
  second?: string;
  firstLabel: string;
  secondLabel?: string;
}) {
  return (
    <div
      className="pg-chart"
      role="img"
      aria-label={`${firstLabel}${secondLabel ? ` e ${secondLabel}` : ""} por período`}
    >
      <ResponsiveContainer width="100%" height={285}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, bottom: 0, left: 8 }}
        >
          <CartesianGrid vertical={false} stroke="#dce8e6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 14, fill: "#52716e" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={chartCurrency}
            tick={{ fontSize: 14, fill: "#52716e" }}
            axisLine={false}
            tickLine={false}
            width={74}
          />
          <Tooltip formatter={(value) => money(Number(value))} />
          {second && <Legend />}
          <Bar
            dataKey={first}
            name={firstLabel}
            fill="#087f72"
            radius={[4, 4, 0, 0]}
          />
          {second && (
            <Bar
              dataKey={second}
              name={secondLabel}
              fill="#65b9ad"
              radius={[4, 4, 0, 0]}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <FileSearch size={24} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function RevenuePage({ dashboard }: Pick<Props, "dashboard">) {
  const chartData = dashboard.monthly.map((point) => ({
    label: monthLabel(point.month),
    faturado: point.billedCents,
    recebido: point.receivedCents,
  }));
  return (
    <section className="pg-page">
      <p className="pg-page-summary">
        Faturamento por data de emissão e recebimentos por data de pagamento.
      </p>
      <div className="pg-metrics">
        <Metric
          icon={<ReceiptText />}
          label="Faturado no período"
          value={money(dashboard.metrics.billedCents)}
        />
        <Metric
          icon={<WalletCards />}
          label="Recebido no período"
          value={money(dashboard.metrics.receivedCents)}
        />
        <Metric
          icon={<CalendarClock />}
          label="Prazo médio de recebimento"
          value={
            dashboard.metrics.averageDaysToPay === null
              ? "Indisponível"
              : `${dashboard.metrics.averageDaysToPay.toFixed(1).replace(".", ",")} dias`
          }
          sub="Média simples das contas quitadas no período, da emissão à quitação; inclui contas antigas."
        />
      </div>
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>Faturamento x recebimentos</h2>
            <p className="muted">
              Faturamento por emissão; recebimentos por pagamento, em R$.
            </p>
          </div>
        </div>
        {chartData.length ? (
          <>
            <CurrencyBarChart
              data={chartData}
              first="faturado"
              second="recebido"
              firstLabel="Faturado"
              secondLabel="Recebido"
            />
            <MonthlyRevenueTable rows={chartData} />
          </>
        ) : (
          <Empty>Não há movimentação para os filtros selecionados.</Empty>
        )}
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>Pagadores</h2>
            <p className="muted">
              Abertos e vencidos ajudam a orientar o acompanhamento de cada
              contrato.
            </p>
          </div>
        </div>
        <PayerTable payers={dashboard.payers} />
      </article>
      <aside className="pg-note">
        <ShieldCheck size={19} aria-hidden="true" />
        <span>
          <strong>Marcos diferentes:</strong> faturado é o valor da conta
          conforme sua data de emissão; recebido é a baixa financeira conforme a
          data de pagamento. A distância entre ambos pode refletir prazos
          contratuais e ciclos de auditoria.
        </span>
      </aside>
    </section>
  );
}

function MonthlyRevenueTable({
  rows,
}: {
  rows: Array<Record<string, string | number>>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Valores de faturamento e recebimentos por mês</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Faturado</th>
            <th>Recebido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.label)}>
              <td>{row.label}</td>
              <td>{money(Number(row.faturado))}</td>
              <td>{money(Number(row.recebido))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayerTable({ payers }: { payers: PayerSummary[] }) {
  if (!payers.length)
    return (
      <Empty>Nenhum pagador encontrado para os filtros selecionados.</Empty>
    );
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Resumo financeiro por pagador</caption>
        <thead>
          <tr>
            <th>Pagador</th>
            <th>Faturado</th>
            <th>Recebido</th>
            <th>Em aberto</th>
            <th>Vencido</th>
          </tr>
        </thead>
        <tbody>
          {payers.map((payer) => (
            <tr key={payer.id}>
              <td>{payer.name}</td>
              <td>{money(payer.billedCents)}</td>
              <td>{money(payer.receivedCents)}</td>
              <td>{money(payer.openCents)}</td>
              <td>{money(payer.overdueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceivablesPage({
  dashboard,
  onSelectInvoice,
}: Pick<Props, "dashboard" | "onSelectInvoice">) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const records = useMemo(
    () =>
      dashboard.positions.filter(
        (position) =>
          position.openCents > 0 &&
          (status === "Todos" || position.status === status) &&
          `${position.id} ${position.payerName}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
      ),
    [dashboard.positions, search, status],
  );
  const pages = Math.max(1, Math.ceil(records.length / 12));
  const safePage = Math.min(currentPage, pages);
  const visible = records.slice((safePage - 1) * 12, safePage * 12);
  const changeStatus = (value: string) => {
    setStatus(value);
    setCurrentPage(1);
  };
  return (
    <section className="pg-page">
      <p className="pg-page-summary">
        Use vencimento e status para organizar a priorização financeira sem
        expor informações assistenciais.
      </p>
      <div className="pg-metrics">
        <Metric
          icon={<WalletCards />}
          label="Em aberto"
          value={money(dashboard.metrics.openCents)}
        />
        <Metric
          icon={<CalendarClock />}
          label="Vencido"
          value={money(dashboard.metrics.overdueCents)}
        />
        <Metric
          icon={<ArrowUpRight />}
          label="Em recurso"
          value={money(dashboard.metrics.disputedCents)}
        />
      </div>
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>Faixas de atraso</h2>
            <p className="muted">
              Saldo aberto agrupado conforme a idade do vencimento.
            </p>
          </div>
        </div>
        <BucketView rows={dashboard.aging} label="Saldo em aberto" />
      </article>
      <article className="panel">
        <div className="panel-head pg-table-toolbar">
          <div>
            <h2>Posições abertas</h2>
            <p className="muted">{records.length} contas encontradas.</p>
          </div>
          <div className="pg-controls">
            <label className="pg-search">
              <Search size={16} aria-hidden="true" />
              <span className="pg-sr-only">Pesquisar conta ou pagador</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Conta ou pagador"
              />
            </label>
            <label>
              <span className="pg-sr-only">Filtrar por status</span>
              <select
                value={status}
                onChange={(event) => changeStatus(event.target.value)}
              >
                <option>Todos</option>
                <option>Em dia</option>
                <option>Vencido</option>
                <option>Em recurso</option>
              </select>
            </label>
          </div>
        </div>
        {visible.length ? (
          <>
            <PositionsTable positions={visible} onSelect={onSelectInvoice} />
            <p className="pg-export-note">
              A exportação CSV considera os filtros globais do painel; a busca e
              o status desta tabela não alteram o arquivo.
            </p>
            <nav className="pg-pagination" aria-label="Paginação de posições">
              <span>
                Página {safePage} de {pages}
              </span>
              <button
                className="btn btn-secondary"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(safePage - 1)}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary"
                disabled={safePage === pages}
                onClick={() => setCurrentPage(safePage + 1)}
              >
                Próxima
              </button>
            </nav>
          </>
        ) : (
          <Empty>Nenhuma posição aberta corresponde à busca.</Empty>
        )}
      </article>
    </section>
  );
}

function PositionsTable({
  positions,
  onSelect,
}: {
  positions: InvoicePosition[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Contas em aberto</caption>
        <thead>
          <tr>
            <th>Conta</th>
            <th>Pagador</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th>Aberto</th>
            <th>
              <span className="pg-sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.payerName}</td>
              <td>{dateLabel(item.dueDate)}</td>
              <td>
                <span
                  className={`badge pg-status-${item.status.replaceAll(" ", "-").toLocaleLowerCase()}`}
                >
                  {item.status}
                </span>
              </td>
              <td>{money(item.openCents)}</td>
              <td>
                <button
                  className="btn btn-secondary"
                  onClick={() => onSelect(item.id)}
                  aria-label={`Ver conta ${item.id}`}
                >
                  Ver conta
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GlosasPage({
  dashboard,
  onSelectInvoice,
}: Pick<Props, "dashboard" | "onSelectInvoice">) {
  const disputed = dashboard.positions.filter((item) => item.disputedCents > 0);
  return (
    <section className="pg-page">
      <p className="pg-page-summary">
        Acompanhe a origem das glosas, os valores disputados e os pagamentos
        recuperados em caixa.
      </p>
      <div className="pg-metrics pg-metrics-four">
        <Metric
          icon={<ReceiptText />}
          label="Glosado no período"
          value={money(dashboard.metrics.glosaCents)}
        />
        <Metric
          icon={<ShieldCheck />}
          label="Taxa inicial da coorte"
          value={percent(dashboard.metrics.glosaRatePct)}
          sub="Glosas até a posição / contas faturadas no período."
        />
        <Metric
          icon={<ArrowUpRight />}
          label="Em recurso"
          value={money(dashboard.metrics.disputedCents)}
        />
        <Metric
          icon={<WalletCards />}
          label="Recuperado em caixa"
          value={money(dashboard.metrics.recoveredCents)}
        />
      </div>
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>Motivos de glosa</h2>
            <p className="muted">Valores registrados nos eventos do período.</p>
          </div>
        </div>
        <BucketView rows={dashboard.glosaReasons} label="Valor glosado" />
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>Posições em contestação</h2>
            <p className="muted">
              Contas que ainda têm parcela registrada em recurso.
            </p>
          </div>
        </div>
        {disputed.length ? (
          <PositionsTable positions={disputed} onSelect={onSelectInvoice} />
        ) : (
          <Empty>
            Não há posições em contestação para os filtros selecionados.
          </Empty>
        )}
      </article>
      <aside className="pg-note">
        <ShieldCheck size={19} aria-hidden="true" />
        <span>
          <strong>Leitura correta:</strong> a glosa continua dentro do saldo
          aberto enquanto estiver em disputa, portanto não deve ser somada
          novamente. Recuperação em caixa registra pagamento; não equivale, por
          si só, à reversão administrativa da glosa.
        </span>
      </aside>
    </section>
  );
}

function CostsPage({ dashboard }: Pick<Props, "dashboard">) {
  const unavailable = dashboard.metrics.costCents === null;
  return (
    <section className="pg-page">
      <p className="pg-page-summary">
        Custos por unidade e competência para acompanhar a sustentabilidade
        operacional.
      </p>
      {unavailable ? (
        <Empty>
          Custos e resultado não estão disponíveis com filtro de pagador, pois
          os custos não são rateados por fonte pagadora nesta visão.
        </Empty>
      ) : (
        <>
          <div className="pg-metrics">
            <Metric
              icon={<WalletCards />}
              label="Custos"
              value={money(dashboard.metrics.costCents)}
            />
            <Metric
              icon={<ArrowUpRight />}
              label="Resultado gerencial"
              value={money(dashboard.metrics.resultCents)}
            />
            <Metric
              icon={<ReceiptText />}
              label="Margem gerencial"
              value={percent(dashboard.metrics.marginPct)}
            />
          </div>
          <article className="panel">
            <div className="panel-head">
              <div>
                <h2>Composição dos custos</h2>
                <p className="muted">
                  Custos alocados pela competência selecionada.
                </p>
              </div>
            </div>
            <BucketView rows={dashboard.costCategories} label="Custo" />
          </article>
          <aside className="pg-note">
            <ShieldCheck size={19} aria-hidden="true" />
            <span>
              <strong>Fórmula:</strong> resultado gerencial = faturamento −
              baixas definitivas − custos de competência. A margem é o resultado
              dividido pelo faturamento, e deve ser lida junto aos critérios de
              competência e alocação.
            </span>
          </aside>
        </>
      )}
    </section>
  );
}

function GuidePage({ data }: Pick<Props, "data">) {
  return (
    <section className="pg-page">
      <p className="pg-page-summary">
        Referências para interpretar os indicadores desta demonstração.
      </p>
      <div className="pg-guide-grid">
        <GuideCard
          title="Faturamento"
          text="Soma das contas emitidas com data de faturamento no recorte. Não significa, por si só, entrada de caixa."
        />
        <GuideCard
          title="Recebimentos"
          text="Soma de eventos de pagamento no recorte. Um pagamento pode quitar uma conta de competência anterior."
        />
        <GuideCard
          title="Em aberto e vencido"
          text="Saldo de cada conta após pagamentos e baixas definitivas. Vencido considera a data de vencimento frente à data de posição; glosas em recurso permanecem dentro do aberto."
        />
        <GuideCard
          title="Glosa e recurso"
          text="Glosa é uma contestação financeira registrada por evento. Em recurso é a parcela da conta ainda disputada."
        />
        <GuideCard
          title="Custos e margem"
          text="Custos são lançamentos por unidade e competência. Margem = (faturamento − baixas definitivas − custos) / faturamento; sem impostos, não representa lucro contábil."
        />
        <GuideCard
          title="Fontes e versão"
          text={`Base demonstrativa sintética com ${data.invoices.length} contas, atualizada até ${dateLabel(data.snapshotDate)}. Modelo de dados v1.0; valores servem à demonstração de navegação e métricas.`}
        />
      </div>
      <article className="panel pg-guide-limits">
        <h2>Limites desta visão</h2>
        <ul>
          <li>
            Não há dados de pacientes, diagnósticos ou procedimentos
            individualizados.
          </li>
          <li>
            Rateios, impostos, provisões e conciliações contábeis exigem regras
            específicas antes de uso gerencial ou oficial.
          </li>
          <li>
            Os resultados dependem da integridade dos eventos e das datas
            cadastradas na fonte.
          </li>
        </ul>
      </article>
    </section>
  );
}

function GuideCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="panel pg-guide-card">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <article className="panel pg-metric">
      <span className="pg-metric-icon">{icon}</span>
      <p className="muted">{label}</p>
      <strong className="metric-value">{value}</strong>
      {sub && <span className="pg-metric-sub">{sub}</span>}
    </article>
  );
}

function BucketView({ rows, label }: { rows: Bucket[]; label: string }) {
  const data = rows.map((row) => ({ label: row.name, valor: row.amountCents }));
  if (!data.length)
    return <Empty>Não há valores para apresentar neste recorte.</Empty>;
  return (
    <>
      <CurrencyBarChart data={data} first="valor" firstLabel={label} />
      <div className="table-wrap">
        <table className="data-table">
          <caption>{label} por categoria</caption>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Quantidade</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count}</td>
                <td>{money(row.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function DetailPage(props: Props) {
  switch (props.page) {
    case "revenue":
      return <RevenuePage dashboard={props.dashboard} />;
    case "receivables":
      return (
        <ReceivablesPage
          dashboard={props.dashboard}
          onSelectInvoice={props.onSelectInvoice}
        />
      );
    case "glosas":
      return (
        <GlosasPage
          dashboard={props.dashboard}
          onSelectInvoice={props.onSelectInvoice}
        />
      );
    case "costs":
      return <CostsPage dashboard={props.dashboard} />;
    case "guide":
      return <GuidePage data={props.data} />;
  }
}
