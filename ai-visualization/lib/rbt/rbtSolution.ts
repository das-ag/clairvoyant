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
import {
    ResolvedAnnotationMap,
    BranchScopeMap,
    evaluateTemplate,
} from "./rbtAnnotations";

// ── Step ────────────────────────────────────────────────────────────────

export class RBTStep {
    debugValue: any;
    command?: Command<RBTree>;
    sourceLine: number | null;
    isTerminal: boolean;
    /** Snapshot of pointer labels at this step (for watch panel). */
    pointerSnapshot: Record<string, string>;
    question?: string;
    answer?: string;

    constructor(
        debugValue: any = null,
        command?: Command<RBTree>,
        isTerminal = false,
        sourceLine: number | null = null,
        pointerSnapshot: Record<string, string> = {},
        question?: string,
        answer?: string,
    ) {
        this.debugValue = debugValue;
        this.command = command;
        this.isTerminal = isTerminal;
        this.sourceLine = sourceLine;
        this.pointerSnapshot = pointerSnapshot;
        this.question = question;
        this.answer = answer;
    }
}

// ── Solution Base ───────────────────────────────────────────────────────

export class RBTSolutionBase {
    tree!: RBTree;
    private __steps: RBTStep[] = [];
    private _annotations: ResolvedAnnotationMap = new Map();
    private _branchScope: BranchScopeMap = new Map();
    private _lastBranchLine: number | null = null;

    setAnnotations(annotations: ResolvedAnnotationMap): void {
        this._annotations = annotations;
    }

    setBranchScopeMap(scope: BranchScopeMap): void {
        this._branchScope = scope;
    }

    // ── Context builder ─────────────────────────────────────────────

    private _pointerSnapshot(): Record<string, string> {
        const snap: Record<string, string> = {};
        for (const [name, node] of this.tree.pointers) {
            snap[name] = node.isNil ? "NIL" : `${node.key} (${node.color})`;
        }
        return snap;
    }

    /** Build a template evaluation context from tracked pointers + extras. */
    private _buildContext(extras?: Record<string, any>): Record<string, any> {
        const ctx: Record<string, any> = {
            tree: this.tree,
            NIL: this.tree.NIL,
        };
        for (const [name, node] of this.tree.pointers) {
            ctx[name] = node;
        }
        if (extras) Object.assign(ctx, extras);
        return ctx;
    }

    // ── Core step emission ──────────────────────────────────────────

    private _emitBranchIfNeeded(line: number | null): void {
        if (line === null) return;
        const branchLine = this._branchScope.get(line);
        if (branchLine === undefined || branchLine === this._lastBranchLine) return;
        this._lastBranchLine = branchLine;

        const ann = this._annotations.get(branchLine);
        if (!ann || (!ann.question && !ann.answer)) return;

        const ctx = this._buildContext();
        const q = ann.question ? evaluateTemplate(ann.question, ctx) : undefined;
        const a = ann.answer ? evaluateTemplate(ann.answer, ctx) : undefined;
        this.__steps.push(
            new RBTStep(undefined, undefined, false, branchLine, this._pointerSnapshot(), q, a),
        );
    }

    private _resolveMsg(
        line: number | null,
        autoMsg: string,
        extras?: Record<string, any>,
    ): string {
        if (line !== null) {
            const ann = this._annotations.get(line);
            if (ann?.msg) {
                return evaluateTemplate(ann.msg, this._buildContext(extras));
            }
        }
        return autoMsg;
    }

    private _pushStep(
        autoMsg: string,
        cmd: Command<RBTree> | undefined,
        terminal: boolean,
        line: number | null,
        extras?: Record<string, any>,
    ) {
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, autoMsg, extras);
        this.__steps.push(new RBTStep(msg, cmd, terminal, line, this._pointerSnapshot()));
    }

    // ── Visualization methods ───────────────────────────────────────

    private _nodeLabel(n: RBNode): string {
        return n.isNil ? "NIL" : String(n.key);
    }

    trackPointer(name: string, node: RBNode): void {
        const line = getEvalCallerLine();
        const oldTarget = this.tree.pointers.get(name) ?? null;
        const cmd = new SetPointerCommand(name, oldTarget, node);
        cmd.execute(this.tree);
        this._pushStep(`${name} = ${this._nodeLabel(node)}`, cmd, false, line);
    }

    clearPointer(name: string): void {
        const line = getEvalCallerLine();
        const oldTarget = this.tree.pointers.get(name) ?? null;
        const cmd = new SetPointerCommand(name, oldTarget, null);
        cmd.execute(this.tree);
        this._pushStep(`Clear ${name}`, cmd, false, line);
    }

    recolor(node: RBNode, color: RBColor | string): void {
        const line = getEvalCallerLine();
        const c = color as RBColor;
        const cmd = new RecolorCommand(node, c);
        cmd.execute(this.tree);
        this._pushStep(
            `Recolor ${this._nodeLabel(node)} → ${c}`,
            cmd, false, line,
            { node, color: c },
        );
    }

    setRoot(node: RBNode): void {
        const line = getEvalCallerLine();
        const cmd = new SetRootCommand(this.tree, node);
        cmd.execute(this.tree);
        this._pushStep(`Root ← ${this._nodeLabel(node)}`, cmd, false, line, { node });
    }

    insertNode(z: RBNode): void {
        const line = getEvalCallerLine();
        let y = this.tree.NIL;
        let x = this.tree.root;
        while (x !== this.tree.NIL) {
            y = x;
            x = z.key < x.key ? x.left : x.right;
        }
        const cmd = new InsertNodeCommand(this.tree, z, y);
        cmd.execute(this.tree);
        this._pushStep(`Insert node ${z.key}`, cmd, false, line, { z });
    }

    linkLeft(parent: RBNode, child: RBNode): void {
        const line = getEvalCallerLine();
        const cmd = new SetChildCommand(parent, child, "left");
        cmd.execute(this.tree);
        this._pushStep(
            `${this._nodeLabel(parent)}.left ← ${this._nodeLabel(child)}`,
            cmd, false, line,
            { parent, child },
        );
    }

    linkRight(parent: RBNode, child: RBNode): void {
        const line = getEvalCallerLine();
        const cmd = new SetChildCommand(parent, child, "right");
        cmd.execute(this.tree);
        this._pushStep(
            `${this._nodeLabel(parent)}.right ← ${this._nodeLabel(child)}`,
            cmd, false, line,
            { parent, child },
        );
    }

    linkParent(child: RBNode, parent: RBNode): void {
        const line = getEvalCallerLine();
        const cmd = new SetParentCommand(child, parent);
        cmd.execute(this.tree);
        this._pushStep(
            `${this._nodeLabel(child)}.parent ← ${this._nodeLabel(parent)}`,
            cmd, false, line,
            { child, parent },
        );
    }

    removeNode(z: RBNode): void {
        const line = getEvalCallerLine();
        const cmd = new UntrackNodeCommand(z);
        cmd.execute(this.tree);
        this._pushStep(`Remove node ${z.key}`, cmd, false, line, { z });
    }

    logStep(ctx?: Record<string, any>): void {
        const line = getEvalCallerLine();
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, "", ctx);
        this.__steps.push(new RBTStep(msg, undefined, false, line, this._pointerSnapshot()));
    }

    done(ctx?: Record<string, any>): void {
        const line = getEvalCallerLine();
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, "Operation complete", ctx);
        this.__steps.push(new RBTStep(msg, undefined, true, line, this._pointerSnapshot()));
    }

    // ── Step retrieval ──────────────────────────────────────────────

    getInsertSteps(key: number): RBTStep[] {
        this.__steps = [];
        this._lastBranchLine = null;
        (this as any).insert(key);
        return this._finalizeSteps();
    }

    getDeleteSteps(key: number): RBTStep[] {
        this.__steps = [];
        this._lastBranchLine = null;
        (this as any).delete(key);
        return this._finalizeSteps();
    }

    /** Bulk-insert without recording steps (for initial array load). */
    bulkInsert(keys: number[]): void {
        for (const key of keys) {
            this.__steps = [];
            this._lastBranchLine = null;
            (this as any).insert(key);
        }
    }

    private _finalizeSteps(): RBTStep[] {
        const steps = [...this.__steps];
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].command) steps[i].command!.revert(this.tree);
        }
        this.tree.resetPointers();
        return steps;
    }
}

// ── Build from eval'd algorithm code ────────────────────────────────────

export function buildRBTSolution(
    code: string,
    tree: RBTree,
    annotations?: ResolvedAnnotationMap,
    branchScope?: BranchScopeMap,
): RBTSolutionBase {
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

    if (annotations) result.setAnnotations(annotations);
    if (branchScope) result.setBranchScopeMap(branchScope);

    return result;
}
