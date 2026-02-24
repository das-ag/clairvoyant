import { Command } from "../utils/commands";
import { RBColor, RBNode, RBTree } from "./rbtree";

// ── Recolor ─────────────────────────────────────────────────────────────

export class RecolorCommand extends Command<RBTree> {
    private node: RBNode;
    private oldColor: RBColor;
    private newColor: RBColor;

    constructor(node: RBNode, newColor: RBColor) {
        const oldColor = node.color;
        super(
            `Recolor ${node} → ${newColor}`,
            (tree) => tree.directSetColor(this.node, this.newColor),
            (tree) => tree.directSetColor(this.node, this.oldColor),
        );
        this.node = node;
        this.oldColor = oldColor;
        this.newColor = newColor;
    }
}

// ── Set Pointer (visual only) ───────────────────────────────────────────

export class SetPointerCommand extends Command<RBTree> {
    constructor(name: string, oldTarget: RBNode | null, newTarget: RBNode | null) {
        super(
            `SetPointer ${name}`,
            (tree) => {
                if (oldTarget && !oldTarget.isNil) oldTarget.pointerLabels.delete(name);
                if (newTarget && !newTarget.isNil) newTarget.pointerLabels.add(name);
                if (newTarget) tree.pointers.set(name, newTarget);
                else tree.pointers.delete(name);
            },
            (tree) => {
                if (newTarget && !newTarget.isNil) newTarget.pointerLabels.delete(name);
                if (oldTarget && !oldTarget.isNil) oldTarget.pointerLabels.add(name);
                if (oldTarget) tree.pointers.set(name, oldTarget);
                else tree.pointers.delete(name);
            },
        );
    }
}

// ── Set Root ────────────────────────────────────────────────────────────

export class SetRootCommand extends Command<RBTree> {
    constructor(tree: RBTree, newRoot: RBNode) {
        const oldRoot = tree.root;
        super(
            `SetRoot = ${newRoot}`,
            (t) => { t.root = newRoot; },
            (t) => { t.root = oldRoot; },
        );
    }
}

// ── Insert Node (structural: link into tree) ────────────────────────────

export class InsertNodeCommand extends Command<RBTree> {
    private z: RBNode;
    private parent: RBNode;
    private asLeftChild: boolean;
    private asRoot: boolean;

    constructor(tree: RBTree, z: RBNode, parent: RBNode) {
        const asRoot = parent === tree.NIL;
        const asLeftChild = !asRoot && z.key < parent.key;

        super(
            `InsertNode(${z})`,
            (t) => {
                this.z.parent = this.parent;
                this.z.left = t.NIL;
                this.z.right = t.NIL;
                if (this.asRoot) {
                    t.root = this.z;
                } else if (this.asLeftChild) {
                    this.parent.left = this.z;
                } else {
                    this.parent.right = this.z;
                }
            },
            (t) => {
                if (this.asRoot) {
                    t.root = t.NIL;
                } else if (this.asLeftChild) {
                    this.parent.left = t.NIL;
                } else {
                    this.parent.right = t.NIL;
                }
                this.z.parent = t.NIL;
                this.z.left = t.NIL;
                this.z.right = t.NIL;
            },
        );
        this.z = z;
        this.parent = parent;
        this.asLeftChild = asLeftChild;
        this.asRoot = asRoot;
    }
}

// ── Set Child (parent.left / parent.right) ──────────────────────────────

export class SetChildCommand extends Command<RBTree> {
    constructor(parent: RBNode, newChild: RBNode, side: "left" | "right") {
        const oldChild = side === "left" ? parent.left : parent.right;
        super(
            `Set ${parent}.${side} = ${newChild}`,
            () => {
                if (side === "left") parent.left = newChild;
                else parent.right = newChild;
            },
            () => {
                if (side === "left") parent.left = oldChild;
                else parent.right = oldChild;
            },
        );
    }
}

// ── Set Parent (child.parent) ───────────────────────────────────────────

export class SetParentCommand extends Command<RBTree> {
    constructor(child: RBNode, newParent: RBNode) {
        const oldParent = child.parent;
        super(
            `Set ${child}.parent = ${newParent}`,
            () => { child.parent = newParent; },
            () => { child.parent = oldParent; },
        );
    }
}

// ── Untrack Node (marks a node as deleted for rendering) ────────────────

export class UntrackNodeCommand extends Command<RBTree> {
    private node: RBNode;

    constructor(node: RBNode) {
        super(
            `Untrack ${node}`,
            (tree) => tree.untrackNode(this.node),
            (tree) => { tree._trackedNodes.add(this.node); },
        );
        this.node = node;
    }
}

// ── Compound Command ────────────────────────────────────────────────────

export class CompoundCommand extends Command<RBTree> {
    private commands: Command<RBTree>[];

    constructor(name: string, commands: Command<RBTree>[]) {
        super(
            name,
            (tree) => {
                for (const cmd of this.commands) cmd.execute(tree);
            },
            (tree) => {
                for (let i = this.commands.length - 1; i >= 0; i--) {
                    this.commands[i].revert(tree);
                }
            },
        );
        this.commands = commands;
    }
}
