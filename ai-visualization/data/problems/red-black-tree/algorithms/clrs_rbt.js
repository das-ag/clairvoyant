// CLRS-style Red-Black Tree — Insert & Delete
// Follows CLRS Chapter 13 (4th edition).

class RBTSolution {
    constructor(tree) {
        this.tree = tree;
    }

    // ── LEFT-ROTATE (CLRS 13.2) ─────────────────────────────────────

    leftRotate(x) {
        this.logStep({x});
        let y = x.right;
        // Turn y's left subtree into x's right subtree
        this.linkRight(x, y.left);
        if (y.left !== this.tree.NIL)
            this.linkParent(y.left, x);
        // Link y to x's parent
        this.linkParent(y, x.parent);
        if (x.parent === this.tree.NIL) {
            this.setRoot(y);
        } else if (x === x.parent.left) {
            this.linkLeft(x.parent, y);
        } else {
            this.linkRight(x.parent, y);
        }
        // Put x on y's left
        this.linkLeft(y, x);
        this.linkParent(x, y);
    }

    // ── RIGHT-ROTATE (CLRS 13.2) ────────────────────────────────────

    rightRotate(y) {
        this.logStep({y});
        let x = y.left;
        // Turn x's right subtree into y's left subtree
        this.linkLeft(y, x.right);
        if (x.right !== this.tree.NIL)
            this.linkParent(x.right, y);
        // Link x to y's parent
        this.linkParent(x, y.parent);
        if (y.parent === this.tree.NIL) {
            this.setRoot(x);
        } else if (y === y.parent.left) {
            this.linkLeft(y.parent, x);
        } else {
            this.linkRight(y.parent, x);
        }
        // Put y on x's right
        this.linkRight(x, y);
        this.linkParent(y, x);
    }

    // ── RB-TRANSPLANT (CLRS 13.4) ──────────────────────────────────

    transplant(u, v) {
        this.logStep({u, v});
        if (u.parent === this.tree.NIL) {
            this.setRoot(v);
        } else if (u === u.parent.left) {
            this.linkLeft(u.parent, v);
        } else {
            this.linkRight(u.parent, v);
        }
        this.linkParent(v, u.parent);
    }

    // ── RB-INSERT (CLRS 13.3) ───────────────────────────────────────

    insert(key) {
        let z = this.tree.makeNode(key);
        let y = this.tree.NIL;
        let x = this.tree.root;

        this.logStep({key});
        this.trackPointer("z", z);
        this.trackPointer("x", x);

        // Walk down the tree to find the insertion point
        while (x !== this.tree.NIL) {
            y = x;
            this.trackPointer("y", y);
            if (z.key < x.key) {
                x = x.left;
            } else {
                x = x.right;
            }
            this.trackPointer("x", x);
        }

        // Insert z as a child of y
        this.insertNode(z);
        this.recolor(z, "RED");
        this.clearPointer("x");
        this.clearPointer("y");

        this.insertFixup(z);
        this.done({key});
    }

    // ── RB-INSERT-FIXUP (CLRS 13.3) ────────────────────────────────

    insertFixup(z) {
        while (z.parent.color === "RED") {
            if (z.parent === z.parent.parent.left) {
                let uncle = z.parent.parent.right;
                this.trackPointer("uncle", uncle);

                if (uncle.color === "RED") {
                    // Case 1: uncle is red — recolor and move z up
                    this.recolor(z.parent, "BLACK");
                    this.recolor(uncle, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    z = z.parent.parent;
                    this.trackPointer("z", z);
                } else {
                    if (z === z.parent.right) {
                        // Case 2: z is a right child — rotate to reduce to Case 3
                        z = z.parent;
                        this.trackPointer("z", z);
                        this.leftRotate(z);
                    }
                    // Case 3: recolor and right-rotate
                    this.recolor(z.parent, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    this.rightRotate(z.parent.parent);
                }
            } else {
                // Symmetric: z.parent is a right child
                let uncle = z.parent.parent.left;
                this.trackPointer("uncle", uncle);

                if (uncle.color === "RED") {
                    // Case 1 (sym)
                    this.recolor(z.parent, "BLACK");
                    this.recolor(uncle, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    z = z.parent.parent;
                    this.trackPointer("z", z);
                } else {
                    if (z === z.parent.left) {
                        // Case 2 (sym)
                        z = z.parent;
                        this.trackPointer("z", z);
                        this.rightRotate(z);
                    }
                    // Case 3 (sym)
                    this.recolor(z.parent, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    this.leftRotate(z.parent.parent);
                }
            }
        }
        this.recolor(this.tree.root, "BLACK");
        this.clearPointer("uncle");
    }

    // ── RB-DELETE (CLRS 13.4) ───────────────────────────────────────

    delete(key) {
        let z = this.tree.search(key);
        if (z === this.tree.NIL) {
            this.logStep({key});
            this.done({key});
            return;
        }

        this.logStep({key});
        this.trackPointer("z", z);

        let y = z;
        let yOriginalColor = y.color;
        let x;

        if (z.left === this.tree.NIL) {
            // No left child — replace z with its right child
            x = z.right;
            this.trackPointer("x", x);
            this.transplant(z, z.right);
        } else if (z.right === this.tree.NIL) {
            // No right child — replace z with its left child
            x = z.left;
            this.trackPointer("x", x);
            this.transplant(z, z.left);
        } else {
            // Two children — find in-order successor
            y = this.tree.minimum(z.right);
            this.trackPointer("y", y);
            yOriginalColor = y.color;
            x = y.right;
            this.trackPointer("x", x);

            if (y.parent === z) {
                this.linkParent(x, y);
            } else {
                this.transplant(y, y.right);
                this.linkRight(y, z.right);
                this.linkParent(y.right, y);
            }
            this.transplant(z, y);
            this.linkLeft(y, z.left);
            this.linkParent(y.left, y);
            this.recolor(y, z.color);
        }

        this.removeNode(z);
        this.clearPointer("z");

        if (yOriginalColor === "BLACK") {
            this.deleteFixup(x);
        }

        this.clearPointer("x");
        this.clearPointer("y");
        this.clearPointer("w");
        this.done({key});
    }

    // ── RB-DELETE-FIXUP (CLRS 13.4) ────────────────────────────────

    deleteFixup(x) {
        while (x !== this.tree.root && x.color === "BLACK") {
            if (x === x.parent.left) {
                let w = x.parent.right;
                this.trackPointer("w", w);

                if (w.color === "RED") {
                    // Case 1: sibling w is red
                    this.recolor(w, "BLACK");
                    this.recolor(x.parent, "RED");
                    this.leftRotate(x.parent);
                    w = x.parent.right;
                    this.trackPointer("w", w);
                }

                if (w.left.color === "BLACK" && w.right.color === "BLACK") {
                    // Case 2: both of w's children are black
                    this.recolor(w, "RED");
                    x = x.parent;
                    this.trackPointer("x", x);
                } else {
                    if (w.right.color === "BLACK") {
                        // Case 3: w.right is black — rotate to set up Case 4
                        this.recolor(w.left, "BLACK");
                        this.recolor(w, "RED");
                        this.rightRotate(w);
                        w = x.parent.right;
                        this.trackPointer("w", w);
                    }
                    // Case 4: w.right is red — final fix
                    this.recolor(w, x.parent.color);
                    this.recolor(x.parent, "BLACK");
                    this.recolor(w.right, "BLACK");
                    this.leftRotate(x.parent);
                    x = this.tree.root;
                    this.trackPointer("x", x);
                }
            } else {
                // Symmetric: x is a right child
                let w = x.parent.left;
                this.trackPointer("w", w);

                if (w.color === "RED") {
                    // Case 1 (sym)
                    this.recolor(w, "BLACK");
                    this.recolor(x.parent, "RED");
                    this.rightRotate(x.parent);
                    w = x.parent.left;
                    this.trackPointer("w", w);
                }

                if (w.right.color === "BLACK" && w.left.color === "BLACK") {
                    // Case 2 (sym)
                    this.recolor(w, "RED");
                    x = x.parent;
                    this.trackPointer("x", x);
                } else {
                    if (w.left.color === "BLACK") {
                        // Case 3 (sym)
                        this.recolor(w.right, "BLACK");
                        this.recolor(w, "RED");
                        this.leftRotate(w);
                        w = x.parent.left;
                        this.trackPointer("w", w);
                    }
                    // Case 4 (sym)
                    this.recolor(w, x.parent.color);
                    this.recolor(x.parent, "BLACK");
                    this.recolor(w.left, "BLACK");
                    this.rightRotate(x.parent);
                    x = this.tree.root;
                    this.trackPointer("x", x);
                }
            }
        }
        this.recolor(x, "BLACK");
    }
}
RBTSolution.prototype;
