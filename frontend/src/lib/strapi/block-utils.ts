import type { DynamicZoneBlock } from './types';

/**
 * Type guard to narrow a DynamicZoneBlock to a specific block type.
 * Usage: if (isBlockType(block, 'blocks.hero-banner')) { block.title }
 */
export function isBlockType<T extends DynamicZoneBlock['__component']>(
  block: DynamicZoneBlock,
  componentName: T
): block is Extract<DynamicZoneBlock, { __component: T }> {
  return block.__component === componentName;
}

/**
 * Check if dynamic zone blocks are populated (migration helper).
 * Returns true only if blocks is a non-empty array.
 * Returns false for null, undefined, and empty arrays — triggering legacy rendering.
 */
export function hasDynamicZoneBlocks(
  blocks: DynamicZoneBlock[] | null | undefined
): blocks is DynamicZoneBlock[] {
  return Array.isArray(blocks) && blocks.length > 0;
}
