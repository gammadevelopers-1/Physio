import type { DynamicZoneBlock } from './types';

export type BlockPosition =
  | 'top'
  | 'after-section-1'
  | 'after-section-2'
  | 'after-section-3'
  | 'after-section-4'
  | 'after-section-5'
  | 'after-section-6'
  | 'bottom';

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
 * Get all dynamic zone blocks assigned to a specific position.
 * Returns an empty array if no blocks match or blocks is null/undefined.
 */
export function getBlocksAtPosition(
  blocks: DynamicZoneBlock[] | null | undefined,
  position: BlockPosition
): DynamicZoneBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter((b) => (b as any).position === position);
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
