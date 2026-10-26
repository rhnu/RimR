import type { ReactNode } from 'react';
import { parseSteamBbcode, type SteamBbcodeNode } from '@/lib/steamBbcode';
import { cn } from '@/lib/utils';

interface SteamBbcodeProps {
  children: string;
  className?: string;
}

function renderNodes(nodes: Array<SteamBbcodeNode>, prefix: string): Array<ReactNode> {
  return nodes.map((node, index) => renderNode(node, `${prefix}-${index}`));
}

function renderNode(node: SteamBbcodeNode, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'heading':
      return renderHeading(node, key);
    case 'strong':
      return (
        <strong key={key} className="font-semibold text-foreground">
          {renderNodes(node.children, key)}
        </strong>
      );
    case 'emphasis':
      return <em key={key}>{renderNodes(node.children, key)}</em>;
    case 'underline':
      return (
        <span key={key} className="underline underline-offset-2">
          {renderNodes(node.children, key)}
        </span>
      );
    case 'strike':
      return <del key={key}>{renderNodes(node.children, key)}</del>;
    case 'spoiler':
      return (
        <span key={key} className="rounded-slight bg-muted px-1 text-muted-foreground">
          {renderNodes(node.children, key)}
        </span>
      );
    case 'link':
      return (
        <a key={key} href={node.href} target="_blank" rel="noreferrer" className="text-primary">
          {renderNodes(node.children, key)}
        </a>
      );
    case 'image':
      return renderImage(node, key);
    case 'quote':
      return renderQuote(node, key);
    case 'code':
      return (
        <pre key={key} className="max-w-full overflow-x-auto rounded-slight border bg-muted p-2">
          <code className="whitespace-pre-wrap break-words font-mono text-xs">{node.text}</code>
        </pre>
      );
    case 'thematicBreak':
      return <hr key={key} className="border-border" />;
    case 'list':
      return renderList(node, key);
    case 'listItem':
      return <li key={key}>{renderNodes(node.children, key)}</li>;
    case 'table':
      return renderTable(node, key);
    case 'tableRow':
      return <tr key={key}>{renderNodes(node.children, key)}</tr>;
    case 'tableCell':
      return renderTableCell(node, key);
  }
}

function renderHeading(
  node: Extract<SteamBbcodeNode, { type: 'heading' }>,
  key: string,
): ReactNode {
  const children = renderNodes(node.children, key);
  if (node.level === 1) {
    return (
      <h1 key={key} className="text-base font-semibold text-foreground">
        {children}
      </h1>
    );
  }
  if (node.level === 2) {
    return (
      <h2 key={key} className="text-sm font-semibold text-foreground">
        {children}
      </h2>
    );
  }
  return (
    <h3 key={key} className="text-sm font-semibold text-foreground">
      {children}
    </h3>
  );
}

function renderImage(node: Extract<SteamBbcodeNode, { type: 'image' }>, key: string): ReactNode {
  return (
    <a key={key} href={node.src} target="_blank" rel="noreferrer" className="block max-w-full">
      <img
        src={node.src}
        alt={node.src}
        className="max-h-64 max-w-full object-contain"
        loading="lazy"
      />
    </a>
  );
}

function renderQuote(node: Extract<SteamBbcodeNode, { type: 'quote' }>, key: string): ReactNode {
  return (
    <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">
      {node.author ? (
        <div className="text-xs text-foreground">Originally posted by {node.author}:</div>
      ) : null}
      <div>{renderNodes(node.children, key)}</div>
    </blockquote>
  );
}

function renderList(node: Extract<SteamBbcodeNode, { type: 'list' }>, key: string): ReactNode {
  return node.ordered ? (
    <ol key={key} className="list-decimal pl-5">
      {renderNodes(node.children, key)}
    </ol>
  ) : (
    <ul key={key} className="list-disc pl-5">
      {renderNodes(node.children, key)}
    </ul>
  );
}

function renderTable(node: Extract<SteamBbcodeNode, { type: 'table' }>, key: string): ReactNode {
  return (
    <div key={key} className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-xs">{renderNodes(node.children, key)}</table>
    </div>
  );
}

function renderTableCell(
  node: Extract<SteamBbcodeNode, { type: 'tableCell' }>,
  key: string,
): ReactNode {
  const className = 'border border-border px-2 py-1 align-top';
  return node.header ? (
    <th key={key} className={className}>
      {renderNodes(node.children, key)}
    </th>
  ) : (
    <td key={key} className={className}>
      {renderNodes(node.children, key)}
    </td>
  );
}

export function SteamBbcode({ children, className }: SteamBbcodeProps) {
  const nodes = parseSteamBbcode(children);

  return (
    <div
      className={cn(
        'min-w-0 max-w-full space-y-1 overflow-hidden whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]',
        '[&_a]:underline-offset-4 [&_a]:hover:underline',
        className,
      )}
    >
      {renderNodes(nodes, 'steam-bbcode')}
    </div>
  );
}
