import { z } from 'zod';

import { CurrencyCodeSchema, PositiveMoneyStringSchema } from '../common/amount';
import { CivilDateSchema, InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { PaginationQuerySchema } from '../common/pagination';
import { optionalText, text } from '../organization/common';

export const DEBT_TYPES = ['PAYABLE', 'RECEIVABLE'] as const;
export const DebtTypeSchema = z.enum(DEBT_TYPES);
export type DebtType = z.infer<typeof DebtTypeSchema>;

export const DEBT_STATUSES = ['OPEN', 'CANCELLED', 'WRITTEN_OFF'] as const;
export const DebtStatusSchema = z.enum(DEBT_STATUSES);
export type DebtStatus = z.infer<typeof DebtStatusSchema>;

export const SETTLEMENT_STATUSES = ['UNPAID', 'PARTIALLY_SETTLED', 'SETTLED'] as const;
export const SettlementStatusSchema = z.enum(SETTLEMENT_STATUSES);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const DebtInitialMovementSchema = z
  .object({
    accountId: z.uuid(),
    valueDate: CivilDateSchema.optional(),
  })
  .strict();
export type DebtInitialMovement = z.infer<typeof DebtInitialMovementSchema>;

export const CreateDebtSchema = z
  .object({
    type: DebtTypeSchema,
    counterpartyId: z.uuid(),
    title: text(1, 160),
    description: optionalText(2000).optional(),
    principalMinor: PositiveMoneyStringSchema,
    currency: CurrencyCodeSchema,
    openedOn: CivilDateSchema,
    dueDate: CivilDateSchema.optional(),
    notes: optionalText(2000).optional(),
    initialMovement: DebtInitialMovementSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.dueDate && data.dueDate < data.openedOn) {
        return false;
      }
      return true;
    },
    {
      message: "La date d'échéance doit être postérieure ou égale à la date d'ouverture.",
      path: ['dueDate'],
    },
  );
export type CreateDebt = z.infer<typeof CreateDebtSchema>;
export type CreateDebtInput = z.input<typeof CreateDebtSchema>;

export const UpdateDebtSchema = z
  .object({
    title: text(1, 160).optional(),
    description: optionalText(2000).optional(),
    dueDate: CivilDateSchema.nullable().optional(),
    notes: optionalText(2000).optional(),
  })
  .strict();
export type UpdateDebt = z.infer<typeof UpdateDebtSchema>;

export const CancelDebtSchema = z
  .object({
    closingReason: text(3, 500),
  })
  .strict();
export type CancelDebt = z.infer<typeof CancelDebtSchema>;
export type CancelDebtInput = z.input<typeof CancelDebtSchema>;

export const WriteOffDebtSchema = z
  .object({
    closingReason: text(3, 500),
  })
  .strict();
export type WriteOffDebt = z.infer<typeof WriteOffDebtSchema>;
export type WriteOffDebtInput = z.input<typeof WriteOffDebtSchema>;

export const ListDebtsQuerySchema = PaginationQuerySchema.extend({
  type: DebtTypeSchema.optional(),
  status: DebtStatusSchema.optional(),
  overdue: z.coerce.boolean().optional(),
  counterpartyId: z.uuid().optional(),
  from: CivilDateSchema.optional(),
  to: CivilDateSchema.optional(),
});
export type ListDebtsQuery = z.infer<typeof ListDebtsQuerySchema>;

export const DebtResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  type: DebtTypeSchema,
  counterpartyId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  principalMinor: PositiveMoneyStringSchema,
  currency: CurrencyCodeSchema,
  openedOn: CivilDateSchema,
  dueDate: CivilDateSchema.nullable(),
  status: DebtStatusSchema,
  cancelledAt: InstantSchema.nullable(),
  writtenOffAt: InstantSchema.nullable(),
  closingReason: z.string().nullable(),
  notes: z.string().nullable(),
  totalRepaidMinor: z.string(),
  remainingMinor: z.string(),
  settlementStatus: SettlementStatusSchema,
  isOverdue: z.boolean(),
  counterparty: z
    .object({
      id: z.uuid(),
      name: z.string(),
      kind: z.string(),
    })
    .optional(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type DebtResponse = z.infer<typeof DebtResponseSchema>;

export const CreateRepaymentSchema = z
  .object({
    accountId: z.uuid().optional(),
    transactionId: z.uuid().optional(),
    amountMinor: PositiveMoneyStringSchema,
    date: CivilDateSchema.optional(),
    notes: optionalText(500).optional(),
  })
  .strict()
  .refine((data) => !(data.accountId && data.transactionId), {
    message: 'Fournir accountId (création) OU transactionId (rattachement), pas les deux.',
    path: ['transactionId'],
  })
  .refine((data) => Boolean(data.accountId ?? data.transactionId), {
    message: 'accountId (nouvelle transaction) ou transactionId (rattachement) est obligatoire.',
    path: ['accountId'],
  });
export type CreateRepayment = z.infer<typeof CreateRepaymentSchema>;
export type CreateRepaymentInput = z.input<typeof CreateRepaymentSchema>;

export const RepaymentResponseSchema = z.object({
  id: z.uuid(),
  debtId: z.uuid(),
  transactionId: z.uuid(),
  amountMinor: PositiveMoneyStringSchema,
  currency: CurrencyCodeSchema,
  notes: z.string().nullable(),
  createdAt: InstantSchema,
  transaction: z
    .object({
      id: z.uuid(),
      occurredAt: InstantSchema,
      valueDate: CivilDateSchema,
      status: z.string(),
      amountMinor: PositiveMoneyStringSchema,
      currency: CurrencyCodeSchema,
    })
    .optional(),
});
export type RepaymentResponse = z.infer<typeof RepaymentResponseSchema>;

export const DebtRepaymentParamSchema = z
  .object({
    id: z.uuid(),
    repaymentId: z.uuid(),
  })
  .strict();
export type DebtRepaymentParam = z.infer<typeof DebtRepaymentParamSchema>;

export const DebtSummaryByCurrencySchema = z.object({
  currency: CurrencyCodeSchema,
  totalPayableMinor: z.string(),
  totalReceivableMinor: z.string(),
  remainingPayableMinor: z.string(),
  remainingReceivableMinor: z.string(),
  overduePayableMinor: z.string(),
  overdueReceivableMinor: z.string(),
});
export type DebtSummaryByCurrency = z.infer<typeof DebtSummaryByCurrencySchema>;

export const DebtSummaryResponseSchema = z.object({
  currencies: z.array(DebtSummaryByCurrencySchema),
});
export type DebtSummaryResponse = z.infer<typeof DebtSummaryResponseSchema>;

export const DebtEnvelopeSchema = dataEnvelope(DebtResponseSchema);
export type DebtEnvelope = z.infer<typeof DebtEnvelopeSchema>;

export const DebtListEnvelopeSchema = listEnvelope(DebtResponseSchema);
export type DebtListEnvelope = z.infer<typeof DebtListEnvelopeSchema>;

export const RepaymentEnvelopeSchema = dataEnvelope(RepaymentResponseSchema);
export type RepaymentEnvelope = z.infer<typeof RepaymentEnvelopeSchema>;

export const RepaymentListEnvelopeSchema = listEnvelope(RepaymentResponseSchema);
export type RepaymentListEnvelope = z.infer<typeof RepaymentListEnvelopeSchema>;

export const DebtSummaryEnvelopeSchema = dataEnvelope(DebtSummaryResponseSchema);
export type DebtSummaryEnvelope = z.infer<typeof DebtSummaryEnvelopeSchema>;
