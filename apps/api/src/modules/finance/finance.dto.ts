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
  CloseAccountSchema,
  ConfirmReconciliationSchema,
  CounterpartyEnvelopeSchema,
  CounterpartyListEnvelopeSchema,
  CreateAccountSchema,
  CreateCategorySchema,
  CreateCounterpartySchema,
  CreateTransactionSchema,
  CancelTransactionSchema,
  CreateTransferSchema,
  FinanceSummaryEnvelopeSchema,
  FinanceSummaryQuerySchema,
  IdParamSchema,
  ListAccountsQuerySchema,
  ListCategoriesQuerySchema,
  ListCounterpartiesQuerySchema,
  ListTransactionsQuerySchema,
  MergeCounterpartySchema,
  ReconciliationQuerySchema,
  ReconciliationResultEnvelopeSchema,
  ReconciliationStatusEnvelopeSchema,
  ReopenAccountSchema,
  TransactionEnvelopeSchema,
  TransactionListEnvelopeSchema,
  TransferEnvelopeSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
  UpdateCounterpartySchema,
  UpdateTransactionDetailsSchema,
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
