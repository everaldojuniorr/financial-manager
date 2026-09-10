import type { Invoice, InvoiceItem } from "./types"

/** Sample invoices so the new panels are not empty on first boot. */
export function buildSeedInvoices(): {
  invoices: Invoice[]
  invoiceItems: InvoiceItem[]
} {
  const invoices: Invoice[] = [
    {
      id: "inv_0001",
      label: "Nubank",
      competence: "2026-09",
      dueDate: "2026-09-10",
      status: "aberta",
      paidAt: null,
      paymentTransactionId: null,
    },
    {
      id: "inv_0002",
      label: "Nubank",
      competence: "2026-08",
      dueDate: "2026-08-10",
      status: "paga",
      paidAt: "2026-08-09",
      paymentTransactionId: null,
    },
  ]

  const invoiceItems: InvoiceItem[] = [
    {
      id: "ii_0001",
      invoiceId: "inv_0001",
      description: "Mercado Pão de Açúcar",
      categoryId: "alimentacao",
      amount: 287.4,
      installment: { current: 1, total: 1 },
      tag: "mercado",
    },
    {
      id: "ii_0002",
      invoiceId: "inv_0001",
      description: "TV Samsung 55\"",
      categoryId: "compras",
      amount: 200,
      installment: { current: 5, total: 12 },
      tag: "varejo",
    },
    {
      id: "ii_0003",
      invoiceId: "inv_0001",
      description: "iFood — jantar",
      categoryId: "alimentacao",
      amount: 62.9,
      installment: { current: 1, total: 1 },
      tag: "delivery",
    },
    {
      id: "ii_0004",
      invoiceId: "inv_0002",
      description: "Mercado do mês",
      categoryId: "alimentacao",
      amount: 412.5,
      installment: { current: 1, total: 1 },
      tag: "mercado",
    },
    {
      id: "ii_0005",
      invoiceId: "inv_0002",
      description: "Fone bluetooth",
      categoryId: "compras",
      amount: 189.9,
      installment: { current: 4, total: 6 },
      tag: "varejo",
    },
  ]

  return { invoices, invoiceItems }
}
