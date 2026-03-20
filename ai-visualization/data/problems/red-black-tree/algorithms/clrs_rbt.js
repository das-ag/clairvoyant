// CLRS-style Red-Black Tree — Insert & Delete
// Follows CLRS Chapter 13 (4th edition).

class RBTSolution {
    constructor(tree) {
        this.tree = tree;
    }

    // ── LEFT-ROTATE (CLRS 13.2) ─────────────────────────────────────

    leftRotate(x) {
        this.logStep({x});
        this.trackPointer("lr.x", x);
        let y = this.trackPointer("lr.y", x.right);
        this.rotateLeftTransaction(x, y);
        this.clearPointer("lr.x");
        this.clearPointer("lr.y");
    }

    // ── RIGHT-ROTATE (CLRS 13.2) ────────────────────────────────────

    rightRotate(y) {
        this.logStep({y});
        this.trackPointer("rr.y", y);
        let x = this.trackPointer("rr.x", y.left);
        this.rotateRightTransaction(y, x);
        this.clearPointer("rr.x");
        this.clearPointer("rr.y");
    }

    // ── RB-TRANSPLANT (CLRS 13.4) ──────────────────────────────────

    transplant(u, v) {
        this.trackPointer("u", u);
        this.trackPointer("v", v);
        this.transplantTransaction(u, v);
        this.clearPointer("u");
        this.clearPointer("v");
    }

    // ── RB-INSERT (CLRS 13.3) ───────────────────────────────────────

    insert(key) {
        this.logStep({key});
        let z = this.trackPointer("z", this.tree.makeNode(key));
        let y = this.tree.NIL;
        let x = this.trackPointer("x", this.tree.root);

        // Walk down the tree to find the insertion point
        while (x !== this.tree.NIL) {
            y = this.trackPointer("y", x);
            if (z.key < x.key) {
                x = this.trackPointer("x", x.left);
            } else {
                x = this.trackPointer("x", x.right);
            }
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
                let uncle = this.trackPointer("uncle", z.parent.parent.right);

                if (uncle.color === "RED") {
                    // Case 1: uncle is red — recolor and move z up
                    this.logCase("Insert Case 1");
                    this.recolor(z.parent, "BLACK");
                    this.recolor(uncle, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    z = this.trackPointer("z", z.parent.parent);
                } else {
                    if (z === z.parent.right) {
                        // Case 2: z is a right child — rotate to reduce to Case 3
                        this.logCase("Insert Case 2");
                        z = this.trackPointer("z", z.parent);
                        this.leftRotate(z);
                    }
                    // Case 3: recolor and right-rotate
                    this.logCase("Insert Case 3");
                    this.recolor(z.parent, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    this.rightRotate(z.parent.parent);
                }
            } else {
                // Symmetric: z.parent is a right child
                let uncle = this.trackPointer("uncle", z.parent.parent.left);

                if (uncle.color === "RED") {
                    // Case 1 (sym)
                    this.logCase("Insert Case 1");
                    this.recolor(z.parent, "BLACK");
                    this.recolor(uncle, "BLACK");
                    this.recolor(z.parent.parent, "RED");
                    z = this.trackPointer("z", z.parent.parent);
                } else {
                    if (z === z.parent.left) {
                        // Case 2 (sym)
                        this.logCase("Insert Case 2");
                        z = this.trackPointer("z", z.parent);
                        this.rightRotate(z);
                    }
                    // Case 3 (sym)
                    this.logCase("Insert Case 3");
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

        let y = this.trackPointer("y", z);
        let yOriginalColor = y.color;
        let x;

        if (z.left === this.tree.NIL) {
            // No left child — replace z with its right child
            x = this.trackPointer("x", z.right);
            this.transplant(z, z.right);
        } else if (z.right === this.tree.NIL) {
            // No right child — replace z with its left child
            x = this.trackPointer("x", z.left);
            this.transplant(z, z.left);
        } else {
            // Two children — find in-order successor
            y = this.trackPointer("y", this.tree.minimum(z.right));
            yOriginalColor = y.color;
            x = this.trackPointer("x", y.right);

            if (y.parent === z) {
                this.moveEdgeTransaction(y, "right", x);
            } else {
                this.transplant(y, y.right);
                this.moveEdgeTransaction(y, "right", z.right, [y]);
            }
            this.transplant(z, y);
            this.moveEdgeTransaction(y, "left", z.left, [z]);
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
                let w = this.trackPointer("w", x.parent.right);

                if (w.color === "RED") {
                    // Case 1: sibling w is red
                    this.logCase("Delete Case 1");
                    this.recolor(w, "BLACK");
                    this.recolor(x.parent, "RED");
                    this.leftRotate(x.parent);
                    w = this.trackPointer("w", x.parent.right);
                }

                if (w.left.color === "BLACK" && w.right.color === "BLACK") {
                    // Case 2: both of w's children are black
                    this.logCase("Delete Case 2");
                    this.recolor(w, "RED");
                    x = this.trackPointer("x", x.parent);
                } else {
                    if (w.right.color === "BLACK") {
                        // Case 3: w.right is black — rotate to set up Case 4
                        this.logCase("Delete Case 3");
                        this.recolor(w.left, "BLACK");
                        this.recolor(w, "RED");
                        this.rightRotate(w);
                        w = this.trackPointer("w", x.parent.right);
                    }
                    // Case 4: w.right is red — final fix
                    this.logCase("Delete Case 4");
                    this.recolor(w, x.parent.color);
                    this.recolor(x.parent, "BLACK");
                    this.recolor(w.right, "BLACK");
                    this.leftRotate(x.parent);
                    x = this.trackPointer("x", this.tree.root);
                }
            } else {
                // Symmetric: x is a right child
                let w = this.trackPointer("w", x.parent.left);

                if (w.color === "RED") {
                    // Case 1 (sym)
                    this.logCase("Delete Case 1");
                    this.recolor(w, "BLACK");
                    this.recolor(x.parent, "RED");
                    this.rightRotate(x.parent);
                    w = this.trackPointer("w", x.parent.left);
                }

                if (w.right.color === "BLACK" && w.left.color === "BLACK") {
                    // Case 2 (sym)
                    this.logCase("Delete Case 2");
                    this.recolor(w, "RED");
                    x = this.trackPointer("x", x.parent);
                } else {
                    if (w.left.color === "BLACK") {
                        // Case 3 (sym)
                        this.logCase("Delete Case 3");
                        this.recolor(w.right, "BLACK");
                        this.recolor(w, "RED");
                        this.leftRotate(w);
                        w = this.trackPointer("w", x.parent.left);
                    }
                    // Case 4 (sym)
                    this.logCase("Delete Case 4");
                    this.recolor(w, x.parent.color);
                    this.recolor(x.parent, "BLACK");
                    this.recolor(w.left, "BLACK");
                    this.rightRotate(x.parent);
                    x = this.trackPointer("x", this.tree.root);
                }
            }
        }
        this.recolor(x, "BLACK");
    }
}
RBTSolution.prototype;
