import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { CategoryKind, CategoryResponse } from '@orbit/contracts';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';

import { useFinanceCategories } from '../api/hooks';
import { PageHeader } from '../components/common';
import { CreateCategoryDialog } from '../components/create-category-dialog';

function CategoryItem({ category }: Readonly<{ category: CategoryResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <li className="flex items-center justify-between p-3 hover:bg-surface-elevated">
      <div className="flex items-center gap-3">
        {category.color ? (
          <span
            className="size-4 rounded-full border border-border"
            style={{ backgroundColor: category.color }}
            aria-hidden="true"
          />
        ) : null}
        <span className="text-body font-medium">{category.name}</span>
        {category.isSystem && <Badge tone="neutral">{t('categories.systemBadge')}</Badge>}
      </div>
    </li>
  );
}

function CategoryList({
  categories,
  kind,
}: Readonly<{
  categories: readonly CategoryResponse[];
  kind: CategoryKind;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const filtered = categories.filter((c) => c.kind === kind);

  if (filtered.length === 0) {
    return <EmptyState title={t('categories.title')} body={t('transactions.emptyBody')} />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
      {filtered.map((cat) => (
        <CategoryItem key={cat.id} category={cat} />
      ))}
    </ul>
  );
}

export function CategoriesPage(): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [selectedKind, setSelectedKind] = useState<CategoryKind>('EXPENSE');
  const [createOpen, setCreateOpen] = useState(false);
  const categoriesQuery = useFinanceCategories();

  if (categoriesQuery.isPending) return <LoadingState />;
  if (categoriesQuery.isError) return <ErrorState error={categoriesQuery.error} />;

  const categories = categoriesQuery.data.data;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('categories.title')}>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          {t('categories.new')}
        </Button>
      </PageHeader>
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={selectedKind === 'EXPENSE' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setSelectedKind('EXPENSE');
          }}
        >
          {t('categories.expense')}
        </Button>
        <Button
          variant={selectedKind === 'INCOME' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setSelectedKind('INCOME');
          }}
        >
          {t('categories.income')}
        </Button>
      </div>
      <CategoryList categories={categories} kind={selectedKind} />
      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} defaultKind={selectedKind} />
    </section>
  );
}
