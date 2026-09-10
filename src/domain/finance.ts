import type {
  AlertItem,
  Bucket,
  Dashboard,
  Dataset,
  Filters,
  FinancialEvent,
  Invoice,
  InvoicePosition,
  MonthlyPoint,
  PayerSummary,
} from "./types";

const DAY = 86_400_000;
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const inRange = (date: string, start: string, end: string) =>
  date >= start && date <= end;
const monthStart = (month: string) => `${month}-01`;
const monthEnd = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );
const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
const isMonth = (value: string) =>
  /^\d{4}-\d{2}$/.test(value) && isDate(`${value}-01`);

function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endYear = Number(end.slice(0, 4));
  const endMonth = Number(end.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

function effectiveAsOf(data: Dataset, filters: Filters): string {
  if (!isMonth(filters.startMonth) || !isMonth(filters.endMonth))
    throw new RangeError(
      "Os filtros devem usar meses válidos no formato YYYY-MM.",
    );
  if (filters.startMonth > filters.endMonth)
    throw new RangeError("O mês inicial não pode ser posterior ao mês final.");
  if (!isDate(data.snapshotDate))
    throw new RangeError("A data de corte do conjunto é inválida.");
  const asOf =
    monthEnd(filters.endMonth) < data.snapshotDate
      ? monthEnd(filters.endMonth)
      : data.snapshotDate;
  if (monthStart(filters.startMonth) > asOf)
    throw new RangeError(
      "O período selecionado começa depois da data de corte disponível.",
    );
  return asOf;
}

function selected(invoice: Invoice, filters: Filters): boolean {
  return (
    (filters.unitId === "all" || invoice.unitId === filters.unitId) &&
    (filters.payerId === "all" || invoice.payerId === filters.payerId)
  );
}

function eventTotals(events: FinancialEvent[]) {
  return {
    paid: sum(
      events.filter((e) => e.type === "payment").map((e) => e.amountCents),
    ),
    glosa: sum(
      events.filter((e) => e.type === "glosa").map((e) => e.amountCents),
    ),
    reversal: sum(
      events
        .filter((e) => e.type === "glosa_reversal")
        .map((e) => e.amountCents),
    ),
    writtenOff: sum(
      events.filter((e) => e.type === "write_off").map((e) => e.amountCents),
    ),
  };
}

/** Returns the financial position visible on `asOf`; events after that date are excluded. */
export function getInvoicePosition(
  data: Dataset,
  invoice: Invoice,
  asOf: string,
): InvoicePosition {
  const knownEvents = data.events.filter(
    (event) => event.invoiceId === invoice.id && event.date <= asOf,
  );
  const totals = eventTotals(knownEvents);
  const paidCents = totals.paid;
  const writtenOffCents = totals.writtenOff;
  const openCents = Math.max(
    0,
    invoice.amountCents - paidCents - writtenOffCents,
  );
  // Payment allocation is not modeled; a dispute can never exceed what remains open.
  const disputedCents = Math.min(
    openCents,
    Math.max(0, totals.glosa - totals.reversal - writtenOffCents),
  );
  const overdueDays =
    invoice.dueDate < asOf && openCents > 0
      ? daysBetween(invoice.dueDate, asOf)
      : 0;
  let status: InvoicePosition["status"];
  if (openCents === 0) status = writtenOffCents > 0 ? "Baixado" : "Pago";
  else if (disputedCents > 0) status = "Em disputa";
  else if (invoice.dueDate < asOf) status = "Vencido";
  else status = "Em dia";
  return {
    ...invoice,
    unitName:
      data.units.find((unit) => unit.id === invoice.unitId)?.name ??
      invoice.unitId,
    payerName:
      data.payers.find((payer) => payer.id === invoice.payerId)?.name ??
      invoice.payerId,
    paidCents,
    openCents,
    disputedCents,
    writtenOffCents,
    overdueDays,
    status,
  };
}

function buildMonth(
  data: Dataset,
  filters: Filters,
  month: string,
  asOf: string,
): MonthlyPoint {
  const start = monthStart(month);
  const end = monthEnd(month) < asOf ? monthEnd(month) : asOf;
  if (start > asOf)
    return {
      month,
      billedCents: 0,
      receivedCents: 0,
      costCents: 0,
      targetCents: 0,
      resultCents: 0,
    };
  const scopedInvoices = data.invoices.filter((invoice) =>
    selected(invoice, filters),
  );
  const cohort = scopedInvoices.filter((invoice) =>
    inRange(invoice.billedDate, start, end),
  );
  const events = data.events.filter((event) => {
    const invoice = scopedInvoices.find((item) => item.id === event.invoiceId);
    return Boolean(invoice) && inRange(event.date, start, end);
  });
  const receivedCents = sum(
    events
      .filter((event) => event.type === "payment")
      .map((event) => event.amountCents),
  );
  const writeOffCents = sum(
    events
      .filter((event) => event.type === "write_off")
      .map((event) => event.amountCents),
  );
  const payerScoped = filters.payerId !== "all";
  const costs = payerScoped
    ? 0
    : sum(
        data.costs
          .filter(
            (cost) =>
              cost.month === month &&
              (filters.unitId === "all" || cost.unitId === filters.unitId),
          )
          .map((cost) => cost.amountCents),
      );
  const targets = payerScoped
    ? null
    : data.targets.filter(
        (target) =>
          target.month === month &&
          (filters.unitId === "all" || target.unitId === filters.unitId),
      );
  return {
    month,
    billedCents: sum(cohort.map((invoice) => invoice.amountCents)),
    receivedCents,
    costCents: costs,
    targetCents: targets ? sum(targets.map((target) => target.billedCents)) : 0,
    resultCents: payerScoped
      ? 0
      : sum(cohort.map((invoice) => invoice.amountCents)) -
        writeOffCents -
        costs,
  };
}

function makeAging(positions: InvoicePosition[]): Bucket[] {
  const definitions: Array<
    [string, (days: number, position: InvoicePosition) => boolean]
  > = [
    ["A vencer", (days) => days === 0],
    ["1–30 dias", (days) => days >= 1 && days <= 30],
    ["31–60 dias", (days) => days >= 31 && days <= 60],
    ["61–90 dias", (days) => days >= 61 && days <= 90],
    ["90+ dias", (days) => days >= 91],
  ];
  return definitions.map(([name, matches]) => {
    const items = positions.filter(
      (position) =>
        position.openCents > 0 && matches(position.overdueDays, position),
    );
    return {
      name,
      amountCents: sum(items.map((item) => item.openCents)),
      count: items.length,
    };
  });
}

function makeAlerts(metrics: Dashboard["metrics"]): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (metrics.overdueCents > 0)
    alerts.push({
      id: "overdue",
      level: "warning",
      title: "Saldo vencido em aberto",
      description:
        "Há contas com vencimento anterior à data de corte. O painel não atribui uma causa a esse saldo.",
      page: "receivables",
    });
  if (metrics.disputedCents > 0)
    alerts.push({
      id: "disputed",
      level: "warning",
      title: "Glosas ainda em disputa",
      description:
        "Parte do valor glosado ainda não foi revertida nem baixada na data de corte.",
      page: "glosas",
    });
  if (metrics.resultCents !== null && metrics.resultCents < 0)
    alerts.push({
      id: "result",
      level: "danger",
      title: "Resultado gerencial negativo",
      description:
        "No período, faturamento menos baixas definitivas e custos de competência ficou abaixo de zero.",
      page: "costs",
    });
  if (
    metrics.billedTargetCents !== null &&
    metrics.billedCents < metrics.billedTargetCents
  )
    alerts.push({
      id: "target",
      level: "info",
      title: "Faturamento abaixo da meta",
      description:
        "O faturamento observado é menor que a meta cadastrada para o mesmo recorte de unidades e meses.",
      page: "revenue",
    });
  return alerts;
}

/** Builds period flows and an end-of-snapshot receivables position. All amounts are integer cents. */
export function calculateDashboard(data: Dataset, filters: Filters): Dashboard {
  const asOf = effectiveAsOf(data, filters);
  const start = monthStart(filters.startMonth);
  const end = asOf;
  const scopedInvoices = data.invoices.filter((invoice) =>
    selected(invoice, filters),
  );
  const cohort = scopedInvoices.filter((invoice) =>
    inRange(invoice.billedDate, start, end),
  );
  const periodEvents = data.events.filter((event) => {
    const invoice = scopedInvoices.find((item) => item.id === event.invoiceId);
    return Boolean(invoice) && inRange(event.date, start, end);
  });
  const positions = scopedInvoices
    .filter((invoice) => invoice.billedDate <= asOf)
    .map((invoice) => getInvoicePosition(data, invoice, asOf));
  const payerScoped = filters.payerId !== "all";
  const billedCents = sum(cohort.map((invoice) => invoice.amountCents));
  const receivedCents = sum(
    periodEvents
      .filter((event) => event.type === "payment")
      .map((event) => event.amountCents),
  );
  const glosaCents = sum(
    periodEvents
      .filter((event) => event.type === "glosa")
      .map((event) => event.amountCents),
  );
  const recoveredCents = sum(
    periodEvents
      .filter((event) => event.type === "payment")
      .map((event) => event.recoveredCents ?? 0),
  );
  const writeOffCents = sum(
    periodEvents
      .filter((event) => event.type === "write_off")
      .map((event) => event.amountCents),
  );
  const costs = payerScoped
    ? null
    : sum(
        data.costs
          .filter(
            (cost) =>
              inRange(cost.month, filters.startMonth, asOf.slice(0, 7)) &&
              (filters.unitId === "all" || cost.unitId === filters.unitId),
          )
          .map((cost) => cost.amountCents),
      );
  const targets = payerScoped
    ? null
    : data.targets.filter(
        (target) =>
          inRange(target.month, filters.startMonth, asOf.slice(0, 7)) &&
          (filters.unitId === "all" || target.unitId === filters.unitId),
      );
  const firstGlosaCents = sum(
    cohort
      .flatMap((invoice) =>
        data.events
          .filter(
            (event) =>
              event.invoiceId === invoice.id &&
              event.type === "glosa" &&
              event.date <= asOf,
          )
          .sort(
            (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
          )
          .slice(0, 1),
      )
      .map((event) => event.amountCents),
  );
  const completedPayments = scopedInvoices
    .filter((invoice) => invoice.billedDate <= asOf)
    .map((invoice) => {
      const payments = data.events
        .filter(
          (event) =>
            event.invoiceId === invoice.id &&
            event.type === "payment" &&
            event.date <= asOf,
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      const fullyPaidAt = payments.find(
        (_, index) =>
          sum(payments.slice(0, index + 1).map((event) => event.amountCents)) >=
          invoice.amountCents,
      );
      return fullyPaidAt && inRange(fullyPaidAt.date, start, end)
        ? daysBetween(invoice.billedDate, fullyPaidAt.date)
        : null;
    })
    .filter((days): days is number => days !== null);
  const metrics: Dashboard["metrics"] = {
    billedCents,
    receivedCents,
    openCents: sum(positions.map((position) => position.openCents)),
    overdueCents: sum(
      positions
        .filter((position) => position.overdueDays > 0)
        .map((position) => position.openCents),
    ),
    disputedCents: sum(positions.map((position) => position.disputedCents)),
    glosaCents,
    recoveredCents,
    writeOffCents,
    costCents: costs,
    resultCents: costs === null ? null : billedCents - writeOffCents - costs,
    marginPct:
      costs === null || billedCents === 0
        ? null
        : ((billedCents - writeOffCents - costs) / billedCents) * 100,
    billedTargetCents:
      targets === null
        ? null
        : sum(targets.map((target) => target.billedCents)),
    receivedTargetCents:
      targets === null
        ? null
        : sum(targets.map((target) => target.receivedCents)),
    costTargetCents:
      targets === null ? null : sum(targets.map((target) => target.costCents)),
    glosaRatePct:
      billedCents === 0 ? null : (firstGlosaCents / billedCents) * 100,
    invoiceCount: cohort.length,
    averageDaysToPay: completedPayments.length
      ? sum(completedPayments) / completedPayments.length
      : null,
  };
  const payers: PayerSummary[] = data.payers
    .map((payer) => {
      const payerInvoices = scopedInvoices.filter(
        (invoice) => invoice.payerId === payer.id,
      );
      const payerCohort = payerInvoices.filter((invoice) =>
        inRange(invoice.billedDate, start, end),
      );
      const payerEvents = periodEvents.filter((event) =>
        payerInvoices.some((invoice) => invoice.id === event.invoiceId),
      );
      const payerPositions = positions.filter(
        (position) => position.payerId === payer.id,
      );
      return {
        id: payer.id,
        name: payer.name,
        billedCents: sum(payerCohort.map((invoice) => invoice.amountCents)),
        receivedCents: sum(
          payerEvents
            .filter((event) => event.type === "payment")
            .map((event) => event.amountCents),
        ),
        openCents: sum(payerPositions.map((position) => position.openCents)),
        overdueCents: sum(
          payerPositions
            .filter((position) => position.overdueDays > 0)
            .map((position) => position.openCents),
        ),
        disputedCents: sum(
          payerPositions.map((position) => position.disputedCents),
        ),
      };
    })
    .filter(
      (payer) => filters.payerId === "all" || payer.id === filters.payerId,
    )
    .filter(
      (payer) => payer.billedCents + payer.receivedCents + payer.openCents > 0,
    );
  const costCategories: Bucket[] = payerScoped
    ? []
    : Object.entries(
        data.costs
          .filter(
            (cost) =>
              inRange(cost.month, filters.startMonth, asOf.slice(0, 7)) &&
              (filters.unitId === "all" || cost.unitId === filters.unitId),
          )
          .reduce<Record<string, Bucket>>((all, cost) => {
            const bucket = all[cost.category] ?? {
              name: cost.category,
              amountCents: 0,
              count: 0,
            };
            bucket.amountCents += cost.amountCents;
            bucket.count += 1;
            all[cost.category] = bucket;
            return all;
          }, {}),
      )
        .map(([, bucket]) => bucket)
        .sort((a, b) => b.amountCents - a.amountCents);
  const glosaReasons = Object.entries(
    periodEvents
      .filter((event) => event.type === "glosa")
      .reduce<Record<string, Bucket>>((all, event) => {
        const name = event.reason ?? "Sem classificação";
        const bucket = all[name] ?? { name, amountCents: 0, count: 0 };
        bucket.amountCents += event.amountCents;
        bucket.count += 1;
        all[name] = bucket;
        return all;
      }, {}),
  )
    .map(([, bucket]) => bucket)
    .sort((a, b) => b.amountCents - a.amountCents);
  return {
    asOf,
    metrics,
    monthly: monthsBetween(filters.startMonth, asOf.slice(0, 7)).map((month) =>
      buildMonth(data, filters, month, asOf),
    ),
    positions,
    payers,
    aging: makeAging(positions),
    costCategories,
    glosaReasons,
    alerts: makeAlerts(metrics),
  };
}

/** Checks structural and arithmetic invariants. An empty result means the dataset can be calculated safely. */
export function validateDataset(data: Dataset): string[] {
  const errors: string[] = [];
  if (!isDate(data.snapshotDate)) errors.push("snapshotDate inválida.");
  const duplicateEntityIds = (items: Dataset["units"], label: string) => {
    const ids = new Set<string>();
    items.forEach((item) => {
      if (!item.id.trim() || !item.name.trim())
        errors.push(`${label} sem identificação válida.`);
      else if (ids.has(item.id))
        errors.push(
          `${label} ${label === "Pagador" ? "duplicado" : "duplicada"}: ${item.id}.`,
        );
      else ids.add(item.id);
    });
  };
  duplicateEntityIds(data.units, "Unidade");
  duplicateEntityIds(data.payers, "Pagador");
  const unitIds = new Set(data.units.map((item) => item.id));
  const payerIds = new Set(data.payers.map((item) => item.id));
  const invoiceIds = new Set<string>();
  data.invoices.forEach((invoice) => {
    if (!invoice.id.trim()) errors.push("Fatura sem identificação válida.");
    else if (invoiceIds.has(invoice.id))
      errors.push(`Fatura duplicada: ${invoice.id}.`);
    else invoiceIds.add(invoice.id);
    if (!unitIds.has(invoice.unitId))
      errors.push(`Unidade desconhecida na fatura ${invoice.id}.`);
    if (!payerIds.has(invoice.payerId))
      errors.push(`Pagador desconhecido na fatura ${invoice.id}.`);
    if (
      ![invoice.serviceDate, invoice.billedDate, invoice.dueDate].every(isDate)
    )
      errors.push(`Data inválida na fatura ${invoice.id}.`);
    if (
      invoice.serviceDate > invoice.billedDate ||
      invoice.billedDate > invoice.dueDate
    )
      errors.push(`Ordem de datas inválida na fatura ${invoice.id}.`);
    if (invoice.billedDate > data.snapshotDate)
      errors.push(`Fatura futura: ${invoice.id}.`);
    if (!Number.isInteger(invoice.amountCents) || invoice.amountCents <= 0)
      errors.push(`Valor inválido na fatura ${invoice.id}.`);
  });
  const eventIds = new Set<string>();
  data.events.forEach((event) => {
    if (!event.id.trim()) errors.push("Evento sem identificação válida.");
    else if (eventIds.has(event.id))
      errors.push(`Evento duplicado: ${event.id}.`);
    else eventIds.add(event.id);
    const invoice = data.invoices.find((item) => item.id === event.invoiceId);
    if (!invoice) errors.push(`Evento sem fatura: ${event.id}.`);
    else if (
      event.date < invoice.billedDate ||
      event.date > data.snapshotDate ||
      !isDate(event.date)
    )
      errors.push(`Data inválida no evento ${event.id}.`);
    if (
      !["payment", "glosa", "glosa_reversal", "write_off"].includes(event.type)
    )
      errors.push(`Tipo inválido no evento ${event.id}.`);
    if (!Number.isInteger(event.amountCents) || event.amountCents <= 0)
      errors.push(`Valor inválido no evento ${event.id}.`);
    if (
      event.recoveredCents !== undefined &&
      (!Number.isInteger(event.recoveredCents) ||
        event.recoveredCents < 0 ||
        event.recoveredCents > event.amountCents ||
        event.type !== "payment")
    )
      errors.push(`Recuperação inválida no evento ${event.id}.`);
  });
  data.invoices.forEach((invoice) => {
    const priority: Record<FinancialEvent["type"], number> = {
      glosa: 0,
      glosa_reversal: 1,
      write_off: 2,
      payment: 3,
    };
    const events = data.events
      .filter((event) => event.invoiceId === invoice.id)
      .slice()
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          priority[a.type] - priority[b.type] ||
          a.id.localeCompare(b.id),
      );
    let paid = 0;
    let glosa = 0;
    let reversal = 0;
    let writtenOff = 0;
    let recovered = 0;
    events.forEach((event) => {
      if (
        !Number.isInteger(event.amountCents) ||
        event.amountCents <= 0 ||
        !priority.hasOwnProperty(event.type)
      )
        return;
      if (event.type === "glosa") glosa += event.amountCents;
      if (event.type === "glosa_reversal") {
        if (event.amountCents > glosa - reversal - writtenOff)
          errors.push(
            `Reversão acima da disputa disponível em ${invoice.id}, evento ${event.id}.`,
          );
        reversal += event.amountCents;
      }
      if (event.type === "write_off") {
        if (event.amountCents > glosa - reversal - writtenOff)
          errors.push(
            `Baixa acima da disputa disponível em ${invoice.id}, evento ${event.id}.`,
          );
        writtenOff += event.amountCents;
      }
      if (event.type === "payment") {
        paid += event.amountCents;
        const recovery = event.recoveredCents ?? 0;
        if (recovery > reversal - recovered)
          errors.push(
            `Recuperação acima das reversões disponíveis em ${invoice.id}, evento ${event.id}.`,
          );
        recovered += recovery;
      }
      const open = invoice.amountCents - paid - writtenOff;
      const disputed = glosa - reversal - writtenOff;
      if (paid + writtenOff > invoice.amountCents)
        errors.push(
          `Liquidação acima do faturado em ${invoice.id}, evento ${event.id}.`,
        );
      if (disputed < 0)
        errors.push(`Disputa negativa em ${invoice.id}, evento ${event.id}.`);
      if (disputed > open)
        errors.push(
          `Disputa acima do saldo aberto em ${invoice.id}, evento ${event.id}.`,
        );
    });
  });
  const costIds = new Set<string>();
  data.costs.forEach((cost) => {
    if (!cost.id.trim()) errors.push("Custo sem identificação válida.");
    else if (costIds.has(cost.id)) errors.push(`Custo duplicado: ${cost.id}.`);
    else costIds.add(cost.id);
    if (
      !unitIds.has(cost.unitId) ||
      !isMonth(cost.month) ||
      cost.month > data.snapshotDate.slice(0, 7) ||
      !cost.category.trim() ||
      !Number.isInteger(cost.amountCents) ||
      cost.amountCents < 0
    )
      errors.push(`Custo inválido: ${cost.id}.`);
  });
  const targetKeys = new Set<string>();
  data.targets.forEach((target) => {
    const key = `${target.unitId}/${target.month}`;
    if (targetKeys.has(key)) errors.push(`Meta duplicada: ${key}.`);
    else targetKeys.add(key);
    if (
      !unitIds.has(target.unitId) ||
      !isMonth(target.month) ||
      target.month > data.snapshotDate.slice(0, 7) ||
      [target.billedCents, target.receivedCents, target.costCents].some(
        (value) => !Number.isInteger(value) || value < 0,
      )
    )
      errors.push(`Meta inválida: ${key}.`);
  });
  return errors;
}
