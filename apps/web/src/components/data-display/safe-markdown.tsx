import { Fragment, useMemo, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';

import { parseMarkdown, type Block, type Inline } from './markdown-blocks';

function renderInline(nodes: readonly Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.value}</Fragment>;
      case 'code':
        return (
          <code key={index} className="rounded-sm bg-surface-muted px-1 font-mono text-small">
            {node.value}
          </code>
        );
      case 'strong':
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case 'em':
        return <em key={index}>{renderInline(node.children)}</em>;
      case 'link':
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline underline-offset-2"
          >
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

const HEADING_CLASSES = ['text-h2', 'text-h3', 'text-body font-semibold'];

function Heading({ level, children }: Readonly<{ level: number; children: ReactNode }>): JSX.Element {
  // Un titre de note commence au niveau 2 : la page porte déjà le h1.
  const Tag = (['h2', 'h3', 'h4', 'h5', 'h6', 'h6'] as const)[level - 1] ?? 'h6';
  return <Tag className={HEADING_CLASSES[level - 1] ?? 'text-body font-semibold'}>{children}</Tag>;
}

function BlockView({ block }: Readonly<{ block: Block }>): JSX.Element {
  const { t } = useTranslation('organization');
  switch (block.type) {
    case 'heading':
      return <Heading level={block.level}>{renderInline(block.inline)}</Heading>;
    case 'paragraph':
      return <p>{renderInline(block.inline)}</p>;
    case 'quote':
      return (
        <blockquote className="border-l-4 border-border pl-3 text-muted-foreground">
          {renderInline(block.inline)}
        </blockquote>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-small">
          <code>{block.value}</code>
        </pre>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className={cn('flex flex-col gap-1 pl-6', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </List>
      );
    }
    case 'checklist':
      return (
        <ul className="flex flex-col gap-1">
          {block.items.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <input type="checkbox" checked={item.checked} readOnly disabled className="mt-1 size-4" />
              <span className={cn(item.checked && 'text-muted-foreground line-through')}>
                {renderInline(item.inline)}
              </span>
              <span className="sr-only">
                {item.checked ? t('markdown.checked') : t('markdown.unchecked')}
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * Rendu sûr d'un contenu Markdown non fiable (PHASE-04 T11, SECURITY.md) : aucun HTML interprété, liens
 * limités à http(s) et mailto, ouverts avec `rel="noopener noreferrer"`.
 */
export function SafeMarkdown({
  source,
  className,
}: Readonly<{ source: string; className?: string }>): JSX.Element {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className={cn('flex flex-col gap-3 break-words text-body', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
