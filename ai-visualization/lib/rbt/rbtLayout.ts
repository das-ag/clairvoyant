import { RBNode, RBTree } from "./rbtree";

export interface NodePosition {
    x: number;
    y: number;
}

const LEVEL_HEIGHT = 70;
const MIN_NODE_GAP = 50;

/**
 * Computes (x, y) positions for every real node in the tree using a
 * simple in-order-index layout:
 *   y = depth * LEVEL_HEIGHT
 *   x = inOrderIndex * MIN_NODE_GAP
 *
 * Returns a Map from RBNode to {x, y}, centered around x = 0.
 */
export function computeLayout(tree: RBTree): Map<RBNode, NodePosition> {
    const positions = new Map<RBNode, NodePosition>();
    if (tree.root === tree.NIL) return positions;

    let inOrderIndex = 0;

    const walk = (node: RBNode, depth: number) => {
        if (node === tree.NIL) return;
        walk(node.left, depth + 1);
        positions.set(node, {
            x: inOrderIndex * MIN_NODE_GAP,
            y: depth * LEVEL_HEIGHT,
        });
        inOrderIndex++;
        walk(node.right, depth + 1);
    };

    walk(tree.root, 0);

    // Center around x = 0
    const allX = [...positions.values()].map((p) => p.x);
    const midX = (Math.min(...allX) + Math.max(...allX)) / 2;
    for (const pos of positions.values()) {
        pos.x -= midX;
    }

    return positions;
}

export { LEVEL_HEIGHT, MIN_NODE_GAP };
