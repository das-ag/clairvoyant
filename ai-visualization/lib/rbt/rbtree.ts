export enum RBColor {
    RED = "RED",
    BLACK = "BLACK",
}

let _nodeIdCounter = 0;

export class RBNode {
    key: number;
    color: RBColor;
    parent: RBNode;
    left: RBNode;
    right: RBNode;
    /** Internal id, unique per node instance (NOT the key). */
    readonly uid: number;
    /** Pointer-variable labels currently pointing at this node (for visualization). */
    pointerLabels: Set<string> = new Set();
    /** True only for the shared sentinel. */
    readonly isNil: boolean;

    constructor(key: number, color: RBColor, isNil = false) {
        this.key = key;
        this.color = color;
        this.isNil = isNil;
        this.uid = _nodeIdCounter++;
        // Parent / left / right are set to `this` for the sentinel and
        // overwritten immediately after construction for real nodes.
        this.parent = this as RBNode;
        this.left = this as RBNode;
        this.right = this as RBNode;
    }

    toString(): string {
        if (this.isNil) return "NIL";
        return `${this.key}(${this.color})`;
    }
}

export class RBTree {
    readonly NIL: RBNode;
    root: RBNode;
    /** Named pointer variables for visualization (z, x, uncle, w, …). */
    pointers: Map<string, RBNode> = new Map();
    /** All living (non-deleted) nodes, independent of root-reachability. */
    _trackedNodes: Set<RBNode> = new Set();

    constructor() {
        this.NIL = new RBNode(0, RBColor.BLACK, true);
        this.NIL.parent = this.NIL;
        this.NIL.left = this.NIL;
        this.NIL.right = this.NIL;
        this.root = this.NIL;
    }

    /** Create a new RED node with both children and parent set to NIL. */
    makeNode(key: number): RBNode {
        const node = new RBNode(key, RBColor.RED);
        node.parent = this.NIL;
        node.left = this.NIL;
        node.right = this.NIL;
        this._trackedNodes.add(node);
        return node;
    }

    untrackNode(node: RBNode): void {
        this._trackedNodes.delete(node);
    }

    allTrackedNodes(): RBNode[] {
        return [...this._trackedNodes];
    }

    /** Standard BST search; returns NIL if not found. */
    search(key: number): RBNode {
        let x = this.root;
        while (x !== this.NIL) {
            if (key === x.key) return x;
            x = key < x.key ? x.left : x.right;
        }
        return this.NIL;
    }

    minimum(x: RBNode): RBNode {
        while (x.left !== this.NIL) x = x.left;
        return x;
    }

    maximum(x: RBNode): RBNode {
        while (x.right !== this.NIL) x = x.right;
        return x;
    }

    // ── Direct mutation helpers (used by Command execute / revert) ──────

    directSetLeft(parent: RBNode, child: RBNode) {
        parent.left = child;
    }
    directSetRight(parent: RBNode, child: RBNode) {
        parent.right = child;
    }
    directSetParent(child: RBNode, parent: RBNode) {
        child.parent = parent;
    }
    directSetRoot(node: RBNode) {
        this.root = node;
    }
    directSetColor(node: RBNode, color: RBColor) {
        node.color = color;
    }

    // ── Traversal helpers ───────────────────────────────────────────────

    /** In-order traversal returning real (non-NIL) nodes. */
    inOrderTraversal(): RBNode[] {
        const result: RBNode[] = [];
        const walk = (n: RBNode) => {
            if (n === this.NIL) return;
            walk(n.left);
            result.push(n);
            walk(n.right);
        };
        walk(this.root);
        return result;
    }

    /** Collect all real nodes via pre-order. */
    allNodes(): RBNode[] {
        const result: RBNode[] = [];
        const walk = (n: RBNode) => {
            if (n === this.NIL) return;
            result.push(n);
            walk(n.left);
            walk(n.right);
        };
        walk(this.root);
        return result;
    }

    /** Remove all pointer labels from every node and clear the pointer map. */
    resetPointers() {
        for (const [, node] of this.pointers) {
            if (node && !node.isNil) node.pointerLabels.clear();
        }
        this.pointers.clear();
    }
}
