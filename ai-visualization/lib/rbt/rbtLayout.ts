import { RBNode, RBTree } from "./rbtree";

export interface NodePosition {
    x: number;
    y: number;
}

const LEVEL_HEIGHT = 70;
const MIN_NODE_GAP = 50;

interface LayoutShape {
    positions: Map<RBNode, NodePosition>;
    width: number;
}

export interface LayoutMetrics {
    minNodeDistance: number;
    hasOverlaps: boolean;
}

export function computeLayout(tree: RBTree): Map<RBNode, NodePosition> {
    if (tree.root === tree.NIL) return new Map();

    const layoutSubtree = (node: RBNode, depth: number): LayoutShape => {
        if (node === tree.NIL) {
            return { positions: new Map(), width: 0 };
        }

        const left = layoutSubtree(node.left, depth + 1);
        const right = layoutSubtree(node.right, depth + 1);
        const positions = new Map<RBNode, NodePosition>();

        let leftOffset = 0;
        let rightOffset = 0;
        let width = MIN_NODE_GAP;

        if (left.width > 0 && right.width > 0) {
            leftOffset = -(MIN_NODE_GAP / 2 + right.width / 2);
            rightOffset = MIN_NODE_GAP / 2 + left.width / 2;
            width = left.width + MIN_NODE_GAP + right.width;
        } else if (left.width > 0) {
            leftOffset = -MIN_NODE_GAP / 2;
            width = Math.max(MIN_NODE_GAP, left.width + MIN_NODE_GAP);
        } else if (right.width > 0) {
            rightOffset = MIN_NODE_GAP / 2;
            width = Math.max(MIN_NODE_GAP, right.width + MIN_NODE_GAP);
        }

        positions.set(node, { x: 0, y: depth * LEVEL_HEIGHT });
        for (const [child, pos] of left.positions) {
            positions.set(child, { x: pos.x + leftOffset, y: pos.y });
        }
        for (const [child, pos] of right.positions) {
            positions.set(child, { x: pos.x + rightOffset, y: pos.y });
        }

        return { positions, width };
    };

    return layoutSubtree(tree.root, 0).positions;
}

export function computeLayoutMetrics(
    layout: Map<RBNode, NodePosition> | Map<number, NodePosition>,
): LayoutMetrics {
    const positions = [...layout.values()];
    let minNodeDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
            const dx = positions[i].x - positions[j].x;
            const dy = positions[i].y - positions[j].y;
            minNodeDistance = Math.min(minNodeDistance, Math.hypot(dx, dy));
        }
    }

    if (!isFinite(minNodeDistance)) {
        minNodeDistance = Number.POSITIVE_INFINITY;
    }

    return {
        minNodeDistance,
        hasOverlaps: minNodeDistance < MIN_NODE_GAP * 0.9,
    };
}

export { LEVEL_HEIGHT, MIN_NODE_GAP };
