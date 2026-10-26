export type SteamBbcodeNode =
  | { type: 'text'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; children: Array<SteamBbcodeNode> }
  | { type: 'strong'; children: Array<SteamBbcodeNode> }
  | { type: 'emphasis'; children: Array<SteamBbcodeNode> }
  | { type: 'underline'; children: Array<SteamBbcodeNode> }
  | { type: 'strike'; children: Array<SteamBbcodeNode> }
  | { type: 'spoiler'; children: Array<SteamBbcodeNode> }
  | { type: 'link'; href: string; children: Array<SteamBbcodeNode> }
  | { type: 'image'; src: string }
  | { type: 'quote'; author?: string; children: Array<SteamBbcodeNode> }
  | { type: 'code'; text: string }
  | { type: 'thematicBreak' }
  | { type: 'list'; ordered: boolean; children: Array<SteamBbcodeNode> }
  | { type: 'listItem'; children: Array<SteamBbcodeNode> }
  | { type: 'table'; children: Array<SteamBbcodeNode> }
  | { type: 'tableRow'; children: Array<SteamBbcodeNode> }
  | { type: 'tableCell'; header: boolean; children: Array<SteamBbcodeNode> };

type ContainerType = Exclude<SteamBbcodeNode['type'], 'text' | 'image' | 'code' | 'thematicBreak'>;

interface DraftNode {
  type: ContainerType | 'root';
  tag: string;
  children: Array<SteamBbcodeNode>;
  author?: string;
  header?: boolean;
  href?: string;
  level?: 1 | 2 | 3;
  ordered?: boolean;
}

function normalizeSteamInput(input: string): string {
  const literalBlocks: Array<string> = [];
  const stash = (value: string) => {
    const index = literalBlocks.push(value) - 1;
    return `__RIMR_STEAM_LITERAL_${index}__`;
  };

  const text = input
    .replace(/\r\n?/g, '\n')
    .replace(/\[(code|noparse)\]([\s\S]*?)\[\/\1\]/gi, stash)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.replace(/__RIMR_STEAM_LITERAL_(\d+)__/g, (_match, index) => {
    return literalBlocks[Number(index)] ?? '';
  });
}

function plainText(nodes: Array<SteamBbcodeNode>): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.text;
        case 'image':
          return node.src;
        case 'code':
          return node.text;
        case 'thematicBreak':
          return '\n';
        default:
          return plainText(node.children);
      }
    })
    .join('');
}

function decodeHtmlAttribute(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function sanitizeSteamUrl(value: string): string | undefined {
  const href = decodeHtmlAttribute(value).trim();
  if (!href || hasUnsafeUrlCharacter(href)) {
    return undefined;
  }
  if (/^(?:https?:\/\/|steam:\/\/)/i.test(href)) {
    return href;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return undefined;
  }
  return `https://${href}`;
}

function hasUnsafeUrlCharacter(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f || /\s/.test(char)) {
      return true;
    }
  }
  return false;
}

function appendNode(stack: Array<DraftNode>, node: SteamBbcodeNode) {
  stack[stack.length - 1]?.children.push(node);
}

function appendText(stack: Array<DraftNode>, text: string) {
  if (text.length === 0) {
    return;
  }
  appendNode(stack, { type: 'text', text });
}

function finalizeDraft(draft: DraftNode): SteamBbcodeNode | undefined {
  switch (draft.type) {
    case 'root':
      return undefined;
    case 'heading':
      return { type: 'heading', level: draft.level ?? 3, children: draft.children };
    case 'strong':
    case 'emphasis':
    case 'underline':
    case 'strike':
    case 'spoiler':
      return { type: draft.type, children: draft.children };
    case 'link': {
      const href = sanitizeSteamUrl(draft.href ?? plainText(draft.children));
      if (!href) {
        return { type: 'text', text: plainText(draft.children) };
      }
      return { type: 'link', href, children: draft.children };
    }
    case 'quote':
      return { type: 'quote', author: draft.author, children: draft.children };
    case 'list':
      return { type: 'list', ordered: draft.ordered ?? false, children: draft.children };
    case 'listItem':
      return { type: 'listItem', children: draft.children };
    case 'table':
      return { type: 'table', children: draft.children };
    case 'tableRow':
      return { type: 'tableRow', children: draft.children };
    case 'tableCell':
      return { type: 'tableCell', header: draft.header ?? false, children: draft.children };
  }
}

function openDraftForTag(tag: string, attr?: string): DraftNode | undefined {
  switch (tag) {
    case 'h1':
      return { type: 'heading', tag, level: 1, children: [] };
    case 'h2':
      return { type: 'heading', tag, level: 2, children: [] };
    case 'h3':
      return { type: 'heading', tag, level: 3, children: [] };
    case 'b':
      return { type: 'strong', tag, children: [] };
    case 'i':
      return { type: 'emphasis', tag, children: [] };
    case 'u':
      return { type: 'underline', tag, children: [] };
    case 'strike':
    case 's':
      return { type: 'strike', tag, children: [] };
    case 'spoiler':
      return { type: 'spoiler', tag, children: [] };
    case 'url':
      return { type: 'link', tag, href: attr, children: [] };
    case 'quote':
      return {
        type: 'quote',
        tag,
        author: attr
          ?.split(';')[0]
          ?.trim()
          .replace(/^["']|["']$/g, ''),
        children: [],
      };
    case 'list':
      return { type: 'list', tag, ordered: attr !== undefined, children: [] };
    case 'olist':
      return { type: 'list', tag, ordered: true, children: [] };
    case 'table':
      return { type: 'table', tag, children: [] };
    case 'tr':
      return { type: 'tableRow', tag, children: [] };
    case 'td':
    case 'th':
      return { type: 'tableCell', tag, header: tag === 'th', children: [] };
    default:
      return undefined;
  }
}

function closeTopDraft(stack: Array<DraftNode>) {
  const draft = stack.pop();
  if (!draft) {
    return;
  }

  const node = finalizeDraft(draft);
  if (node) {
    appendNode(stack, node);
  }
}

function closeDraftByTag(stack: Array<DraftNode>, tag: string): boolean {
  let index = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]?.tag === tag) {
      index = i;
      break;
    }
  }
  if (index <= 0) {
    return false;
  }

  while (stack.length - 1 >= index) {
    closeTopDraft(stack);
  }
  return true;
}

function startListItem(stack: Array<DraftNode>): boolean {
  let listIndex = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]?.type === 'list') {
      listIndex = i;
      break;
    }
  }
  if (listIndex <= 0) {
    return false;
  }

  while (stack.length - 1 > listIndex) {
    closeTopDraft(stack);
  }
  stack.push({ type: 'listItem', tag: '*', children: [] });
  return true;
}

export function parseSteamBbcode(input: string): Array<SteamBbcodeNode> {
  const text = normalizeSteamInput(input);
  const root: DraftNode = { type: 'root', tag: 'root', children: [] };
  const stack: Array<DraftNode> = [root];
  const tagPattern = /\[(\/?)([a-z*][a-z0-9]*)(?:=([^\]]*))?\]/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(text)) !== null) {
    const [rawTag, closing, rawName, attr] = match;
    const tag = rawName.toLowerCase();
    appendText(stack, text.slice(cursor, match.index));
    cursor = tagPattern.lastIndex;

    if (closing) {
      if (tag === 'hr') {
        continue;
      }
      if (tag === 'list' || tag === 'olist') {
        while (stack[stack.length - 1]?.type === 'listItem') {
          closeTopDraft(stack);
        }
      }
      if (!closeDraftByTag(stack, tag)) {
        appendText(stack, rawTag);
      }
      continue;
    }

    if (tag === '*') {
      if (!startListItem(stack)) {
        appendText(stack, rawTag);
      }
      continue;
    }

    if (tag === 'hr') {
      appendNode(stack, { type: 'thematicBreak' });
      continue;
    }

    if (tag === 'code' || tag === 'noparse' || tag === 'img') {
      const closeTag = `[/${tag}]`;
      const closeIndex = text.toLowerCase().indexOf(closeTag, cursor);
      if (closeIndex === -1) {
        appendText(stack, rawTag);
        continue;
      }

      const content = text.slice(cursor, closeIndex);
      cursor = closeIndex + closeTag.length;
      tagPattern.lastIndex = cursor;

      if (tag === 'code') {
        appendNode(stack, { type: 'code', text: content.replace(/^\n+|\n+$/g, '') });
      } else if (tag === 'img') {
        const src = sanitizeSteamUrl(content.trim());
        if (src) {
          appendNode(stack, { type: 'image', src });
        }
      } else {
        appendText(stack, content);
      }
      continue;
    }

    const draft = openDraftForTag(tag, attr);
    if (draft) {
      stack.push(draft);
    } else {
      appendText(stack, rawTag);
    }
  }

  appendText(stack, text.slice(cursor));
  while (stack.length > 1) {
    closeTopDraft(stack);
  }

  return root.children;
}

export function steamBbcodeNodesToPlainText(nodes: Array<SteamBbcodeNode>): string {
  return plainText(nodes);
}
