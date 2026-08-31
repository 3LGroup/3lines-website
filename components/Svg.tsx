import { createElement, type ReactNode } from 'react';
import type { SvgNode } from '@/lib/blocks';

/**
 * Render an ingested SVG tree as real React elements.
 *
 * Deliberately not `dangerouslySetInnerHTML` on a wrapper: the source CSS
 * targets decorative artwork with child combinators, so the <svg> has to be an
 * actual direct child of its container.
 */
export default function Svg({ node }: { node: SvgNode | null | undefined }): ReactNode {
  if (!node) return null;
  return build(node, 0);
}

function build(node: SvgNode, key: number): ReactNode {
  if (node.tag === '#text') return node.attrs.text ?? null;
  return createElement(
    node.tag,
    { ...node.attrs, key },
    node.children.length ? node.children.map((c, i) => build(c, i)) : undefined
  );
}

