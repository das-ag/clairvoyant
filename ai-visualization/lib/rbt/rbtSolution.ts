import { ensureError } from "../errors/error";
import { Command } from "../utils/commands";
import { getEvalCallerLine } from "../utils/stackTrace";
import {
    RecolorCommand,
    SetPointerCommand,
    SetRootCommand,
    InsertNodeCommand,
    SetChildCommand,
    SetParentCommand,
    UntrackNodeCommand,
} from "./rbtCommands";
import { RBColor, RBNode, RBTree } from "./rbtree";

// ── Step ────────────────────────────────────────────────────────────────

export class RBTStep {
    debugValue: any;
    command?: Command<RBTree>;
    sourceLine: number | null;
    isTerminal: boolean;
    /** Snapshot of pointer labels at this step (for watch panel). */
    pointerSnapshot: Record<string, string>;

    constructor(
        debugValue: any = null,
        command?: Command<RBTree>,
        isTerminal = false,
        sourceLine: number | null = null,
        pointerSnapshot: Record<string, string> = {},
    ) {
        this.debugValue = debugValue;
        this.command = command;
        this.isTerminal = isTerminal;
        this.sourceLine = sourceLine;
        this.pointerSnapshot = pointerSnapshot;
    }
}

// ── Solution Base ───────────────────────────────────────────────────────

export class RBTSolutionBase {
    tree!: RBTree;
    private __steps: RBTStep[] = [];

    // ── Visualization methods (called by algorithm code) ────────────

    private _pointerSnapshot(): Record<string, string> {
        const snap: Record<string, string> = {};
        for (const [name, node] of this.tree.pointers) {
            snap[name] = node.isNil ? "NIL" : `${node.key} (${node.color})`;
        }
        return snap;
    }

    private _pushStep(msg: string | undefined, cmd: Command<RBTree> | undefined, terminal = false, callerLine: number | null = null) {
        this.__steps.push(new RBTStep(msg, cmd, terminal, callerLine, this._pointerSnapshot()));
    }

    trackPointer(name: string, node: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        const oldTarget = this.tree.pointers.get(name) ?? null;
        const cmd = new SetPointerCommand(name, oldTarget, node);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    clearPointer(name: string, msg?: string): void {
        const line = getEvalCallerLine();
        const oldTarget = this.tree.pointers.get(name) ?? null;
        const cmd = new SetPointerCommand(name, oldTarget, null);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    recolor(node: RBNode, color: RBColor | string, msg?: string): void {
        const line = getEvalCallerLine();
        const c = color as RBColor;
        const cmd = new RecolorCommand(node, c);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    setRoot(node: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        const cmd = new SetRootCommand(this.tree, node);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    insertNode(z: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        // Walk BST to find insertion point
        let y = this.tree.NIL;
        let x = this.tree.root;
        while (x !== this.tree.NIL) {
            y = x;
            x = z.key < x.key ? x.left : x.right;
        }
        const cmd = new InsertNodeCommand(this.tree, z, y);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    linkLeft(parent: RBNode, child: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        const cmd = new SetChildCommand(parent, child, "left");
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    linkRight(parent: RBNode, child: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        const cmd = new SetChildCommand(parent, child, "right");
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    linkParent(child: RBNode, parent: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        const cmd = new SetParentCommand(child, parent);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    removeNode(z: RBNode, msg?: string): void {
        const line = getEvalCallerLine();
        const cmd = new UntrackNodeCommand(z);
        cmd.execute(this.tree);
        this._pushStep(msg, cmd, false, line);
    }

    logStep(msg: string): void {
        const line = getEvalCallerLine();
        this._pushStep(msg, undefined, false, line);
    }

    done(msg?: string): void {
        const line = getEvalCallerLine();
        this._pushStep(msg ?? "Operation complete", undefined, true, line);
    }

    // ── Step retrieval ──────────────────────────────────────────────

    getInsertSteps(key: number): RBTStep[] {
        this.__steps = [];
        (this as any).insert(key);
        return this._finalizeSteps();
    }

    getDeleteSteps(key: number): RBTStep[] {
        this.__steps = [];
        (this as any).delete(key);
        return this._finalizeSteps();
    }

    /** Bulk-insert without recording steps (for initial array load). */
    bulkInsert(keys: number[]): void {
        for (const key of keys) {
            this.__steps = [];
            (this as any).insert(key);
            // Steps were recorded; just discard them but keep the tree mutations
        }
    }

    private _finalizeSteps(): RBTStep[] {
        const steps = [...this.__steps];
        // Revert all commands in reverse order to restore pre-operation tree state
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].command) steps[i].command!.revert(this.tree);
        }
        this.tree.resetPointers();
        return steps;
    }
}

// ── Build from eval'd algorithm code ────────────────────────────────────

export function buildRBTSolution(code: string, tree: RBTree): RBTSolutionBase {
    let result: RBTSolutionBase;
    try {
        "use strict";
        const solverClass: any = eval?.(code);
        if (solverClass === undefined) {
            throw new Error("Received undefined on eval. Ensure the last line evaluates to the prototype of your class.");
        }
        Object.setPrototypeOf(solverClass, RBTSolutionBase.prototype);
        const solver = Object.create(solverClass);
        const finalProto = Object.getPrototypeOf(solver);

        if (!Object.hasOwn(finalProto, "constructor")) {
            throw new Error("constructor function is not defined.");
        }
        if (!Object.hasOwn(finalProto, "insert")) {
            throw new Error("insert method is not defined.");
        }
        if (!Object.hasOwn(finalProto, "delete")) {
            throw new Error("delete method is not defined.");
        }

        result = new solver.constructor(tree);
    } catch (e) {
        const err = ensureError(e);
        throw new Error("Error evaluating algorithm code: " + (err.stack ?? err.message));
    }
    return result;
}
