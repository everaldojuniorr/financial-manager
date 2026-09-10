import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    description: text("description").notNull(),
    categoryId: text("category_id").notNull(),
    method: text("method").notNull(),
    amount: doublePrecision("amount").notNull(),
    type: text("type").notNull(),
    tag: text("tag").notNull().default(""),
    note: text("note").notNull().default(""),
    recurring: boolean("recurring").notNull().default(false),
    invoiceId: uuid("invoice_id"),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_user_invoice_idx").on(table.userId, table.invoiceId),
  ]
)

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    competence: text("competence").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("aberta"),
    paidAt: text("paid_at"),
    paymentTransactionId: uuid("payment_transaction_id"),
    statedTotal: doublePrecision("stated_total"),
  },
  (table) => [
    uniqueIndex("invoices_user_label_competence_idx").on(
      table.userId,
      table.label,
      table.competence
    ),
    index("invoices_user_idx").on(table.userId),
  ]
)

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    categoryId: text("category_id").notNull(),
    amount: doublePrecision("amount").notNull(),
    installmentCurrent: integer("installment_current").notNull().default(1),
    installmentTotal: integer("installment_total").notNull().default(1),
    tag: text("tag").notNull().default(""),
  },
  (table) => [
    index("invoice_items_user_invoice_idx").on(table.userId, table.invoiceId),
  ]
)

export const obligations = pgTable(
  "obligations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    segment: text("segment").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("obligations_user_kind_idx").on(table.userId, table.kind),
    index("obligations_user_idx").on(table.userId),
  ]
)

export const obligationEntries = pgTable(
  "obligation_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    obligationId: uuid("obligation_id")
      .notNull()
      .references(() => obligations.id, { onDelete: "cascade" }),
    competence: text("competence").notNull(),
    amount: doublePrecision("amount"),
    paid: boolean("paid").notNull().default(false),
    paidAt: text("paid_at"),
  },
  (table) => [
    uniqueIndex("obligation_entries_obligation_competence_idx").on(
      table.obligationId,
      table.competence
    ),
    index("obligation_entries_user_competence_idx").on(
      table.userId,
      table.competence
    ),
  ]
)

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default("Casa"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("household_members_household_idx").on(table.householdId)]
)

export const householdInvites = pgTable(
  "household_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pendente"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("household_invites_invitee_status_idx").on(table.inviteeId, table.status),
    index("household_invites_household_idx").on(table.householdId),
  ]
)

export type UserRow = typeof users.$inferSelect
export type TransactionRow = typeof transactions.$inferSelect
export type InvoiceRow = typeof invoices.$inferSelect
export type InvoiceItemRow = typeof invoiceItems.$inferSelect
