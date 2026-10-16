import { createZodDto } from 'nestjs-zod';

import {
  AccountAdjustmentSchema,
  AccountEnvelopeSchema,
  AccountListEnvelopeSchema,
  BalancesReportEnvelopeSchema,
  BalancesReportQuerySchema,
  CashFlowEnvelopeSchema,
  CashFlowQuerySchema,
  CategoryBreakdownEnvelopeSchema,
  CategoryBreakdownQuerySchema,
  CategoryEnvelopeSchema,
  CategoryListEnvelopeSchema,
  CancelDebtSchema,
  CancelTransactionSchema,
  CloseAccountSchema,
  ConfirmOccurrenceSchema,
  ConfirmReconciliationSchema,
  CounterpartyEnvelopeSchema,
  CounterpartyListEnvelopeSchema,
  CreateAccountSchema,
  CreateCategorySchema,
  CreateCounterpartySchema,
  CreateDebtSchema,
  CreateRecurringTransactionSchema,
  CreateRepaymentSchema,
  CreateTransactionSchema,
  CreateTransferSchema,
  DebtEnvelopeSchema,
  DebtListEnvelopeSchema,
  DebtRepaymentParamSchema,
  DebtSummaryEnvelopeSchema,
  FinanceSummaryEnvelopeSchema,
  FinanceSummaryQuerySchema,
  IdParamSchema,
  ListAccountsQuerySchema,
  ListCategoriesQuerySchema,
  ListCounterpartiesQuerySchema,
  ListDebtsQuerySchema,
  ListOccurrencesQuerySchema,
  ListRecurringTransactionsQuerySchema,
  ListTransactionsQuerySchema,
  MergeCounterpartySchema,
  ReconciliationQuerySchema,
  ReconciliationResultEnvelopeSchema,
  ReconciliationStatusEnvelopeSchema,
  RecurringOccurrenceEnvelopeSchema,
  RecurringOccurrenceListEnvelopeSchema,
  RecurringTransactionEnvelopeSchema,
  RecurringTransactionListEnvelopeSchema,
  ReopenAccountSchema,
  RepaymentEnvelopeSchema,
  RepaymentListEnvelopeSchema,
  SkipOccurrenceSchema,
  TransactionEnvelopeSchema,
  TransactionListEnvelopeSchema,
  TransferEnvelopeSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
  UpdateCounterpartySchema,
  UpdateDebtSchema,
  UpdateRecurringTransactionSchema,
  UpdateTransactionDetailsSchema,
  WriteOffDebtSchema,
} from '@orbit/contracts';

export class IdParamDto extends createZodDto(IdParamSchema) {}

export class CreateAccountDto extends createZodDto(CreateAccountSchema) {}
export class UpdateAccountDto extends createZodDto(UpdateAccountSchema) {}
export class CloseAccountDto extends createZodDto(CloseAccountSchema) {}
export class ReopenAccountDto extends createZodDto(ReopenAccountSchema) {}
export class ListAccountsQueryDto extends createZodDto(ListAccountsQuerySchema) {}

export class AccountEnvelopeDto extends createZodDto(AccountEnvelopeSchema) {}
export class AccountListEnvelopeDto extends createZodDto(AccountListEnvelopeSchema) {}

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
export class ListCategoriesQueryDto extends createZodDto(ListCategoriesQuerySchema) {}

export class CategoryEnvelopeDto extends createZodDto(CategoryEnvelopeSchema) {}
export class CategoryListEnvelopeDto extends createZodDto(CategoryListEnvelopeSchema) {}

export class CreateCounterpartyDto extends createZodDto(CreateCounterpartySchema) {}
export class UpdateCounterpartyDto extends createZodDto(UpdateCounterpartySchema) {}
export class MergeCounterpartyDto extends createZodDto(MergeCounterpartySchema) {}
export class ListCounterpartiesQueryDto extends createZodDto(ListCounterpartiesQuerySchema) {}

export class CounterpartyEnvelopeDto extends createZodDto(CounterpartyEnvelopeSchema) {}
export class CounterpartyListEnvelopeDto extends createZodDto(CounterpartyListEnvelopeSchema) {}

export class CreateTransactionDto extends createZodDto(CreateTransactionSchema) {}
export class UpdateTransactionDetailsDto extends createZodDto(UpdateTransactionDetailsSchema) {}
export class CancelTransactionDto extends createZodDto(CancelTransactionSchema) {}
export class ListTransactionsQueryDto extends createZodDto(ListTransactionsQuerySchema) {}

export class TransactionEnvelopeDto extends createZodDto(TransactionEnvelopeSchema) {}
export class TransactionListEnvelopeDto extends createZodDto(TransactionListEnvelopeSchema) {}

export class CreateTransferDto extends createZodDto(CreateTransferSchema) {}
export class TransferEnvelopeDto extends createZodDto(TransferEnvelopeSchema) {}

export class AccountAdjustmentDto extends createZodDto(AccountAdjustmentSchema) {}
export class ReconciliationQueryDto extends createZodDto(ReconciliationQuerySchema) {}
export class ConfirmReconciliationDto extends createZodDto(ConfirmReconciliationSchema) {}
export class ReconciliationStatusEnvelopeDto extends createZodDto(ReconciliationStatusEnvelopeSchema) {}
export class ReconciliationResultEnvelopeDto extends createZodDto(ReconciliationResultEnvelopeSchema) {}

export class FinanceSummaryQueryDto extends createZodDto(FinanceSummaryQuerySchema) {}
export class FinanceSummaryEnvelopeDto extends createZodDto(FinanceSummaryEnvelopeSchema) {}

export class BalancesReportQueryDto extends createZodDto(BalancesReportQuerySchema) {}
export class BalancesReportEnvelopeDto extends createZodDto(BalancesReportEnvelopeSchema) {}

export class CashFlowQueryDto extends createZodDto(CashFlowQuerySchema) {}
export class CashFlowEnvelopeDto extends createZodDto(CashFlowEnvelopeSchema) {}

export class CategoryBreakdownQueryDto extends createZodDto(CategoryBreakdownQuerySchema) {}
export class CategoryBreakdownEnvelopeDto extends createZodDto(CategoryBreakdownEnvelopeSchema) {}

export class CreateDebtDto extends createZodDto(CreateDebtSchema) {}
export class UpdateDebtDto extends createZodDto(UpdateDebtSchema) {}
export class CancelDebtDto extends createZodDto(CancelDebtSchema) {}
export class WriteOffDebtDto extends createZodDto(WriteOffDebtSchema) {}
export class ListDebtsQueryDto extends createZodDto(ListDebtsQuerySchema) {}
export class DebtEnvelopeDto extends createZodDto(DebtEnvelopeSchema) {}
export class DebtListEnvelopeDto extends createZodDto(DebtListEnvelopeSchema) {}
export class DebtSummaryEnvelopeDto extends createZodDto(DebtSummaryEnvelopeSchema) {}

export class CreateRepaymentDto extends createZodDto(CreateRepaymentSchema) {}
export class RepaymentEnvelopeDto extends createZodDto(RepaymentEnvelopeSchema) {}
export class RepaymentListEnvelopeDto extends createZodDto(RepaymentListEnvelopeSchema) {}
export class DebtRepaymentParamDto extends createZodDto(DebtRepaymentParamSchema) {}

export class CreateRecurringTransactionDto extends createZodDto(CreateRecurringTransactionSchema) {}
export class UpdateRecurringTransactionDto extends createZodDto(UpdateRecurringTransactionSchema) {}
export class ListRecurringTransactionsQueryDto extends createZodDto(ListRecurringTransactionsQuerySchema) {}
export class RecurringTransactionEnvelopeDto extends createZodDto(RecurringTransactionEnvelopeSchema) {}
export class RecurringTransactionListEnvelopeDto extends createZodDto(
  RecurringTransactionListEnvelopeSchema,
) {}

export class ConfirmOccurrenceDto extends createZodDto(ConfirmOccurrenceSchema) {}
export class SkipOccurrenceDto extends createZodDto(SkipOccurrenceSchema) {}
export class ListOccurrencesQueryDto extends createZodDto(ListOccurrencesQuerySchema) {}
export class RecurringOccurrenceEnvelopeDto extends createZodDto(RecurringOccurrenceEnvelopeSchema) {}
export class RecurringOccurrenceListEnvelopeDto extends createZodDto(RecurringOccurrenceListEnvelopeSchema) {}
