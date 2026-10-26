import { describe, it, expect } from 'vitest';
import { parseSteamBbcode, steamBbcodeNodesToPlainText, type SteamBbcodeNode } from './steamBbcode';

function collectTypes(nodes: Array<SteamBbcodeNode>): Array<SteamBbcodeNode['type']> {
  const types: Array<SteamBbcodeNode['type']> = [];

  const visit = (node: SteamBbcodeNode) => {
    if (node.type === 'text' && node.text.trim() === '') {
      return;
    }
    types.push(node.type);
    if ('children' in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return types;
}

describe('parseSteamBbcode', () => {
  it('parses official steam bbcode tags without markdown conversion', () => {
    const nodes = parseSteamBbcode(
      [
        '[h1][b]Features[/b][/h1]',
        '[list]',
        '[*][url=store.steampowered.com]Store[/url]',
        '[*][spoiler]hidden[/spoiler]',
        '[/list]',
        '[quote=Author]Quoted[/quote]',
        '[hr][/hr]',
        '[img]https://example.com/preview.png[/img]',
      ].join('\n'),
    );

    expect(collectTypes(nodes)).toEqual([
      'heading',
      'strong',
      'text',
      'list',
      'listItem',
      'link',
      'text',
      'listItem',
      'spoiler',
      'text',
      'quote',
      'text',
      'thematicBreak',
      'image',
    ]);
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('Features');
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('Store');
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('Quoted');
  });

  it('treats plain markdown-like description text as text', () => {
    const nodes = parseSteamBbcode(
      [
        '\t[h1][b]简介：[/b][/h1]',
        '\t-Vanilla Races Expanded - Saurid：',
        '\t原版异种扩展——爬蜥种',
        '\t添加了新的异种人——爬蜥种，以及相关的新基因和派系。',
        '',
        '\tVanilla Races Expanded - Pigskin:',
        '\t原版异种扩展——猪猡种',
      ].join('\n'),
    );

    expect(collectTypes(nodes)).not.toContain('code');
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('-Vanilla Races Expanded - Saurid：');
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('Vanilla Races Expanded - Pigskin:');
  });

  it('only creates code nodes for explicit steam code tags', () => {
    const nodes = parseSteamBbcode('\tplain indented line\n[code]\n  fixed\n[/code]');

    expect(collectTypes(nodes).filter((type) => type === 'code')).toHaveLength(1);
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('plain indented line');
    expect(steamBbcodeNodesToPlainText(nodes)).toContain('  fixed');
  });

  it('escapes html-like input as text because steam community formatting is bbcode', () => {
    const nodes = parseSteamBbcode('<b>not bold</b> [b]bold[/b]');

    expect(steamBbcodeNodesToPlainText(nodes)).toContain('<b>not bold</b>');
    expect(collectTypes(nodes)).toContain('strong');
  });
});
