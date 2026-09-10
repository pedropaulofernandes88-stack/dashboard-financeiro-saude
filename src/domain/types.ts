export interface Entity {
  id: string;
  name: string;
}
export interface Invoice {
  id: string;
  unitId: string;
  payerId: string;
  service: string;
  serviceDate: string;
  billedDate: string;
  dueDate: string;
  amountCents: number;
}
export type EventType = "payment" | "glosa" | "glosa_reversal" | "write_off";
export interface FinancialEvent {
  id: string;
  invoiceId: string;
  date: string;
  type: EventType;
  amountCents: number;
  reason?: string;
  recoveredCents?: number;
}
export interface Cost {
  id: string;
  unitId: string;
  month: string;
  category: string;
  amountCents: number;
}
export interface Target {
  unitId: string;
  month: string;
  billedCents: number;
  receivedCents: number;
  costCents: number;
}
export interface Dataset {
  invoices: Invoice[];
  events: FinancialEvent[];
  costs: Cost[];
  targets: Target[];
  units: Entity[];
  payers: Entity[];
  snapshotDate: string;
}
export interface Filters {
  startMonth: string;
  endMonth: string;
  unitId: string;
  payerId: string;
}
export type InvoiceStatus =
  | "Pago"
  | "Em dia"
  | "Vencido"
  | "Em disputa"
  | "Baixado";
export interface InvoicePosition extends Invoice {
  unitName: string;
  payerName: string;
  paidCents: number;
  openCents: number;
  disputedCents: number;
  writtenOffCents: number;
  overdueDays: number;
  status: InvoiceStatus;
}
export interface MonthlyPoint {
  month: string;
  billedCents: number;
  receivedCents: number;
  costCents: number;
  targetCents: number;
  resultCents: number;
}
export interface PayerSummary {
  id: string;
  name: string;
  billedCents: number;
  receivedCents: number;
  openCents: number;
  overdueCents: number;
  disputedCents: number;
}
export interface Bucket {
  name: string;
  amountCents: number;
  count: number;
}
export interface AlertItem {
  id: string;
  level: "warning" | "danger" | "info";
  title: string;
  description: string;
  page: "receivables" | "glosas" | "costs" | "revenue";
}
export interface Dashboard {
  asOf: string;
  metrics: {
    billedCents: number;
    receivedCents: number;
    openCents: number;
    overdueCents: number;
    disputedCents: number;
    glosaCents: number;
    recoveredCents: number;
    writeOffCents: number;
    costCents: number | null;
    resultCents: number | null;
    marginPct: number | null;
    billedTargetCents: number | null;
    receivedTargetCents: number | null;
    costTargetCents: number | null;
    glosaRatePct: number | null;
    invoiceCount: number;
    averageDaysToPay: number | null;
  };
  monthly: MonthlyPoint[];
  positions: InvoicePosition[];
  payers: PayerSummary[];
  aging: Bucket[];
  costCategories: Bucket[];
  glosaReasons: Bucket[];
  alerts: AlertItem[];
}
