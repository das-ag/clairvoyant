// CLRS-style Red-Black Tree — Insert & Delete with full visualization.
// Structure follows CLRS Chapter 13 (4th ed.) but adapted to JavaScript
// and the project's eval/prototype visualization pattern.

class RBTSolution {
    constructor(tree) {
        this.tree = tree;
    }

    // ── LEFT-ROTATE (CLRS LEFT-ROTATE) ───────────────────────────────

    leftRotate(x, msg) {
        this.logStep(msg);
        let y = x.right;
        this.linkRight(x, y.left,
            `x.right = y.left (${y.left === this.tree.NIL ? "NIL" : y.left.key})`);
        if (y.left !== this.tree.NIL)
            this.linkParent(y.left, x, `y.left.parent = x (${x.key})`);
        this.linkParent(y, x.parent,
            `y.parent = x.parent (${x.parent === this.tree.NIL ? "NIL" : x.parent.key})`);
        if (x.parent === this.tree.NIL)
            this.setRoot(y, `y (${y.key}) becomes root`);
        else if (x === x.parent.left)
            this.linkLeft(x.parent, y, `x.parent.left = y (${y.key})`);
        else
            this.linkRight(x.parent, y, `x.parent.right = y (${y.key})`);
        this.linkLeft(y, x, `y.left = x (${x.key})`);
        this.linkParent(x, y, `x.parent = y (${y.key})`);
    }

    // ── RIGHT-ROTATE (CLRS RIGHT-ROTATE) ─────────────────────────────

    rightRotate(y, msg) {
        this.logStep(msg);
        let x = y.left;
        this.linkLeft(y, x.right,
            `y.left = x.right (${x.right === this.tree.NIL ? "NIL" : x.right.key})`);
        if (x.right !== this.tree.NIL)
            this.linkParent(x.right, y, `x.right.parent = y (${y.key})`);
        this.linkParent(x, y.parent,
            `x.parent = y.parent (${y.parent === this.tree.NIL ? "NIL" : y.parent.key})`);
        if (y.parent === this.tree.NIL)
            this.setRoot(x, `x (${x.key}) becomes root`);
        else if (y === y.parent.left)
            this.linkLeft(y.parent, x, `y.parent.left = x (${x.key})`);
        else
            this.linkRight(y.parent, x, `y.parent.right = x (${x.key})`);
        this.linkRight(x, y, `x.right = y (${y.key})`);
        this.linkParent(y, x, `y.parent = x (${x.key})`);
    }

    // ── RB-TRANSPLANT (CLRS RB-TRANSPLANT) ───────────────────────────

    transplant(u, v, msg) {
        this.logStep(msg);
        let vLabel = v === this.tree.NIL ? "NIL" : v.key;
        if (u.parent === this.tree.NIL)
            this.setRoot(v, `v (${vLabel}) becomes root`);
        else if (u === u.parent.left)
            this.linkLeft(u.parent, v, `u.parent.left = v (${vLabel})`);
        else
            this.linkRight(u.parent, v, `u.parent.right = v (${vLabel})`);
        this.linkParent(v, u.parent,
            `v.parent = u.parent (${u.parent === this.tree.NIL ? "NIL" : u.parent.key})`);
    }

    // ── INSERT (CLRS RB-INSERT) ──────────────────────────────────────

    insert(key) {
        let z = this.tree.makeNode(key);
        let y = this.tree.NIL;
        let x = this.tree.root;

        this.logStep(`Begin inserting key ${key}`);

        while (x !== this.tree.NIL) {
            y = x;
            this.trackPointer("y", y, `y = ${y.key}`);
            if (z.key < x.key) {
                x = x.left;
            } else {
                x = x.right;
            }
            this.trackPointer("x", x,
                `x = ${x === this.tree.NIL ? "NIL" : x.key}`);
        }

        this.insertNode(z,
            `Insert node ${z.key} as ${y === this.tree.NIL ? "root" : (z.key < y.key ? "left" : "right") + " child of " + y.key}`);
        this.recolor(z, "RED", `Color new node ${z.key} RED`);
        this.trackPointer("z", z, `z = ${z.key}`);
        this.clearPointer("x");
        this.clearPointer("y");

        this.insertFixup(z);
        this.done(`Insert of ${key} complete`);
    }

    // ── INSERT-FIXUP (CLRS RB-INSERT-FIXUP) ──────────────────────────

    insertFixup(z) {
        while (z.parent.color === "RED") {
            if (z.parent === z.parent.parent.left) {
                // z.parent is a LEFT child
                let uncle = z.parent.parent.right;
                this.trackPointer("uncle", uncle,
                    `uncle = ${uncle === this.tree.NIL ? "NIL" : uncle.key}`);

                if (uncle.color === "RED") {
                    // ── Case 1: uncle is RED ──
                    this.recolor(z.parent, "BLACK",
                        `Case 1: recolor parent ${z.parent.key} BLACK`);
                    this.recolor(uncle, "BLACK",
                        `Case 1: recolor uncle ${uncle.key} BLACK`);
                    this.recolor(z.parent.parent, "RED",
                        `Case 1: recolor grandparent ${z.parent.parent.key} RED`);
                    z = z.parent.parent;
                    this.trackPointer("z", z,
                        `Case 1: z moves up to ${z.key}`);
                } else {
                    if (z === z.parent.right) {
                        // ── Case 2: z is a RIGHT child → left-rotate to reduce to Case 3 ──
                        z = z.parent;
                        this.trackPointer("z", z,
                            `Case 2: z = z.parent = ${z.key}`);
                        this.leftRotate(z,
                            `Case 2: left-rotate on ${z.key}`);
                    }
                    // ── Case 3: z is a LEFT child ──
                    this.recolor(z.parent, "BLACK",
                        `Case 3: recolor parent ${z.parent.key} BLACK`);
                    this.recolor(z.parent.parent, "RED",
                        `Case 3: recolor grandparent ${z.parent.parent.key} RED`);
                    this.rightRotate(z.parent.parent,
                        `Case 3: right-rotate on ${z.parent.parent.key}`);
                }
            } else {
                // z.parent is a RIGHT child (symmetric)
                let uncle = z.parent.parent.left;
                this.trackPointer("uncle", uncle,
                    `uncle = ${uncle === this.tree.NIL ? "NIL" : uncle.key}`);

                if (uncle.color === "RED") {
                    // ── Case 1 (symmetric) ──
                    this.recolor(z.parent, "BLACK",
                        `Case 1 (sym): recolor parent ${z.parent.key} BLACK`);
                    this.recolor(uncle, "BLACK",
                        `Case 1 (sym): recolor uncle ${uncle.key} BLACK`);
                    this.recolor(z.parent.parent, "RED",
                        `Case 1 (sym): recolor grandparent ${z.parent.parent.key} RED`);
                    z = z.parent.parent;
                    this.trackPointer("z", z,
                        `Case 1 (sym): z moves up to ${z.key}`);
                } else {
                    if (z === z.parent.left) {
                        // ── Case 2 (symmetric) ──
                        z = z.parent;
                        this.trackPointer("z", z,
                            `Case 2 (sym): z = z.parent = ${z.key}`);
                        this.rightRotate(z,
                            `Case 2 (sym): right-rotate on ${z.key}`);
                    }
                    // ── Case 3 (symmetric) ──
                    this.recolor(z.parent, "BLACK",
                        `Case 3 (sym): recolor parent ${z.parent.key} BLACK`);
                    this.recolor(z.parent.parent, "RED",
                        `Case 3 (sym): recolor grandparent ${z.parent.parent.key} RED`);
                    this.leftRotate(z.parent.parent,
                        `Case 3 (sym): left-rotate on ${z.parent.parent.key}`);
                }
            }
        }
        this.recolor(this.tree.root, "BLACK", "Ensure root is BLACK");
        this.clearPointer("uncle");
    }

    // ── DELETE (CLRS RB-DELETE) ──────────────────────────────────────

    delete(key) {
        let z = this.tree.search(key);
        if (z === this.tree.NIL) {
            this.logStep(`Key ${key} not found in the tree`);
            this.done(`Delete of ${key} aborted: not found`);
            return;
        }

        this.logStep(`Begin deleting key ${key}`);
        this.trackPointer("z", z, `z = ${z.key}`);

        let y = z;
        let yOriginalColor = y.color;
        let x;

        if (z.left === this.tree.NIL) {
            x = z.right;
            this.trackPointer("x", x,
                `x = z.right = ${x === this.tree.NIL ? "NIL" : x.key}`);
            this.transplant(z, z.right,
                `Transplant ${z.key} with its right child`);
        } else if (z.right === this.tree.NIL) {
            x = z.left;
            this.trackPointer("x", x,
                `x = z.left = ${x === this.tree.NIL ? "NIL" : x.key}`);
            this.transplant(z, z.left,
                `Transplant ${z.key} with its left child`);
        } else {
            y = this.tree.minimum(z.right);
            this.trackPointer("y", y, `y = successor = ${y.key}`);
            yOriginalColor = y.color;
            x = y.right;
            this.trackPointer("x", x,
                `x = y.right = ${x === this.tree.NIL ? "NIL" : x.key}`);

            if (y.parent === z) {
                this.linkParent(x, y, `Set x.parent = y (successor is direct child)`);
            } else {
                this.transplant(y, y.right,
                    `Transplant successor ${y.key} with its right child`);
                this.linkRight(y, z.right, `Set y.right = z.right (${z.right.key})`);
                this.linkParent(y.right, y, `Set y.right.parent = y`);
            }
            this.transplant(z, y,
                `Transplant ${z.key} with successor ${y.key}`);
            this.linkLeft(y, z.left, `Set y.left = z.left (${z.left.key})`);
            this.linkParent(y.left, y, `Set y.left.parent = y`);
            this.recolor(y, z.color,
                `Copy deleted node's color (${z.color}) to successor ${y.key}`);
        }

        this.removeNode(z, `Remove node ${z.key} from tree`);
        this.clearPointer("z");

        if (yOriginalColor === "BLACK") {
            this.logStep(`Original color was BLACK — fixup needed`);
            this.deleteFixup(x);
        }

        this.clearPointer("x");
        this.clearPointer("y");
        this.clearPointer("w");
        this.done(`Delete of ${key} complete`);
    }

    // ── DELETE-FIXUP (CLRS RB-DELETE-FIXUP) ──────────────────────────

    deleteFixup(x) {
        while (x !== this.tree.root && x.color === "BLACK") {
            if (x === x.parent.left) {
                let w = x.parent.right;
                this.trackPointer("w", w,
                    `w (sibling) = ${w === this.tree.NIL ? "NIL" : w.key}`);

                if (w.color === "RED") {
                    // ── Case 1: sibling w is RED ──
                    this.recolor(w, "BLACK",
                        `Delete Case 1: recolor sibling ${w.key} BLACK`);
                    this.recolor(x.parent, "RED",
                        `Delete Case 1: recolor parent ${x.parent.key} RED`);
                    this.leftRotate(x.parent,
                        `Delete Case 1: left-rotate on ${x.parent.key}`);
                    w = x.parent.right;
                    this.trackPointer("w", w,
                        `Delete Case 1: new sibling w = ${w === this.tree.NIL ? "NIL" : w.key}`);
                }

                if (w.left.color === "BLACK" && w.right.color === "BLACK") {
                    // ── Case 2: both of w's children are BLACK ──
                    this.recolor(w, "RED",
                        `Delete Case 2: recolor sibling ${w.key} RED`);
                    x = x.parent;
                    this.trackPointer("x", x,
                        `Delete Case 2: x moves up to ${x.key}`);
                } else {
                    if (w.right.color === "BLACK") {
                        // ── Case 3: w's right child is BLACK ──
                        this.recolor(w.left, "BLACK",
                            `Delete Case 3: recolor w.left ${w.left.key} BLACK`);
                        this.recolor(w, "RED",
                            `Delete Case 3: recolor sibling ${w.key} RED`);
                        this.rightRotate(w,
                            `Delete Case 3: right-rotate on ${w.key}`);
                        w = x.parent.right;
                        this.trackPointer("w", w,
                            `Delete Case 3: new sibling w = ${w === this.tree.NIL ? "NIL" : w.key}`);
                    }
                    // ── Case 4: w's right child is RED ──
                    this.recolor(w, x.parent.color,
                        `Delete Case 4: recolor sibling ${w.key} to parent's color (${x.parent.color})`);
                    this.recolor(x.parent, "BLACK",
                        `Delete Case 4: recolor parent ${x.parent.key} BLACK`);
                    this.recolor(w.right, "BLACK",
                        `Delete Case 4: recolor w.right ${w.right.key} BLACK`);
                    this.leftRotate(x.parent,
                        `Delete Case 4: left-rotate on ${x.parent.key}`);
                    x = this.tree.root;
                    this.trackPointer("x", x,
                        `Delete Case 4: x = root (${x.key}), loop ends`);
                }
            } else {
                // Symmetric: x is a right child
                let w = x.parent.left;
                this.trackPointer("w", w,
                    `w (sibling) = ${w === this.tree.NIL ? "NIL" : w.key}`);

                if (w.color === "RED") {
                    this.recolor(w, "BLACK",
                        `Delete Case 1 (sym): recolor sibling ${w.key} BLACK`);
                    this.recolor(x.parent, "RED",
                        `Delete Case 1 (sym): recolor parent ${x.parent.key} RED`);
                    this.rightRotate(x.parent,
                        `Delete Case 1 (sym): right-rotate on ${x.parent.key}`);
                    w = x.parent.left;
                    this.trackPointer("w", w,
                        `Delete Case 1 (sym): new sibling w = ${w === this.tree.NIL ? "NIL" : w.key}`);
                }

                if (w.right.color === "BLACK" && w.left.color === "BLACK") {
                    this.recolor(w, "RED",
                        `Delete Case 2 (sym): recolor sibling ${w.key} RED`);
                    x = x.parent;
                    this.trackPointer("x", x,
                        `Delete Case 2 (sym): x moves up to ${x.key}`);
                } else {
                    if (w.left.color === "BLACK") {
                        this.recolor(w.right, "BLACK",
                            `Delete Case 3 (sym): recolor w.right ${w.right.key} BLACK`);
                        this.recolor(w, "RED",
                            `Delete Case 3 (sym): recolor sibling ${w.key} RED`);
                        this.leftRotate(w,
                            `Delete Case 3 (sym): left-rotate on ${w.key}`);
                        w = x.parent.left;
                        this.trackPointer("w", w,
                            `Delete Case 3 (sym): new sibling w = ${w === this.tree.NIL ? "NIL" : w.key}`);
                    }
                    this.recolor(w, x.parent.color,
                        `Delete Case 4 (sym): recolor sibling ${w.key} to parent's color (${x.parent.color})`);
                    this.recolor(x.parent, "BLACK",
                        `Delete Case 4 (sym): recolor parent ${x.parent.key} BLACK`);
                    this.recolor(w.left, "BLACK",
                        `Delete Case 4 (sym): recolor w.left ${w.left.key} BLACK`);
                    this.rightRotate(x.parent,
                        `Delete Case 4 (sym): right-rotate on ${x.parent.key}`);
                    x = this.tree.root;
                    this.trackPointer("x", x,
                        `Delete Case 4 (sym): x = root (${x.key}), loop ends`);
                }
            }
        }
        this.recolor(x, "BLACK", `Ensure x (${x === this.tree.NIL ? "NIL" : x.key}) is BLACK`);
    }
}
RBTSolution.prototype;
