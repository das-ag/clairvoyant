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
    CompoundCommand,
} from "./rbtCommands";
import { RBColor, RBNode, RBTree } from "./rbtree";
import {
    ResolvedAnnotationMap,
    BranchScopeMap,
    evaluateTemplate,
} from "./rbtAnnotations";
import { computeLayout, computeLayoutMetrics, NodePosition } from "./rbtLayout";

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
    /** Fixup case label (e.g. "Insert Case 1") when entering a new case. */
    caseLabel?: string;
    renderPlan?: StepRenderPlan;

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

export interface RenderEdge {
    parentUid: number;
    childUid: number;
    side: "left" | "right";
}

export type RenderAnchor =
    | { kind: "node"; uid: number }
    | { kind: "slot"; parentUid: number; side: "left" | "right" };

export interface RenderEdgeMotion {
    fromParentUid: number;
    toParentUid: number;
    fromChild: RenderAnchor;
    toChild: RenderAnchor;
    side: "left" | "right";
}

export interface EdgeMotionRenderPlan {
    kind: "rotation" | "transplant" | "rewire";
    startLayout: Record<number, NodePosition>;
    endLayout: Record<number, NodePosition>;
    startEdges: RenderEdge[];
    endEdges: RenderEdge[];
    edgeMotions: RenderEdgeMotion[];
    edgePhaseDurationMs: number;
    layoutPhaseDurationMs: number;
    carryNodeUids: number[];
}

export interface RotationRenderPlan extends EdgeMotionRenderPlan {
    kind: "rotation";
}

export interface TransplantRenderPlan extends EdgeMotionRenderPlan {
    kind: "transplant";
}

export interface RewireRenderPlan extends EdgeMotionRenderPlan {
    kind: "rewire";
}

export type StepRenderPlan = RotationRenderPlan | TransplantRenderPlan | RewireRenderPlan;

// ── Solution Base ───────────────────────────────────────────────────────

export class RBTSolutionBase {
    tree!: RBTree;
    private __steps: RBTStep[] = [];
    private _annotations: ResolvedAnnotationMap = new Map();
    private _branchScope: BranchScopeMap = new Map();
    private _lastBranchLine: number | null = null;
    private _methodParams: Record<string, any> = {};
    private _visualLayoutByUid: Record<number, NodePosition> = {};

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

    /** Cache the current method's parameters so all viz methods can interpolate them. */
    __setMethodParams(params: Record<string, any>): void {
        this._methodParams = params;
    }

    /** Build a template evaluation context from method params, tracked pointers, and extras. */
    private _buildContext(extras?: Record<string, any>): Record<string, any> {
        const ctx: Record<string, any> = {
            tree: this.tree,
            NIL: this.tree.NIL,
            ...this._methodParams,
        };
        for (const [name, node] of this.tree.pointers) {
            ctx[name] = node;
        }
        if (extras) Object.assign(ctx, extras);
        return ctx;
    }

    // ── Core step emission ──────────────────────────────────────────

    private _emitBranchIfNeeded(line: number | null): void {
        if (line === null || !this._branchScope) return;
        const branchLine = this._branchScope.get(line);
        if (branchLine === undefined || branchLine === this._lastBranchLine) return;
        this._lastBranchLine = branchLine;

        const ann = this._annotations.get(branchLine);
        if (!ann) return;

        const ctx = this._buildContext();
        if (ann.question || ann.answer) {
            const q = ann.question ? evaluateTemplate(ann.question, ctx) : undefined;
            const a = ann.answer ? evaluateTemplate(ann.answer, ctx) : undefined;
            this.__steps.push(
                new RBTStep(undefined, undefined, false, branchLine, this._pointerSnapshot(), q, a),
            );
        } else if (ann.msg) {
            const msg = evaluateTemplate(ann.msg, ctx);
            this.__steps.push(
                new RBTStep(msg, undefined, false, branchLine, this._pointerSnapshot()),
            );
        }
    }

    private _resolveMsg(
        line: number | null,
        autoMsg: string,
        extras?: Record<string, any>,
    ): string {
        if (line !== null && this._annotations) {
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
    ): RBTStep {
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, autoMsg, extras);
        const step = new RBTStep(msg, cmd, terminal, line, this._pointerSnapshot());
        this.__steps.push(step);
        this._visualLayoutByUid = this._captureLayoutRecord();
        return step;
    }

    private _captureLayoutRecord(): Record<number, NodePosition> {
        const layout = computeLayout(this.tree);
        const record: Record<number, NodePosition> = {};
        for (const [node, pos] of layout) {
            record[node.uid] = { x: pos.x, y: pos.y };
        }
        for (const node of this.tree.allTrackedNodes()) {
            if (record[node.uid]) continue;
            const prev = this._visualLayoutByUid[node.uid];
            if (prev) record[node.uid] = { ...prev };
        }
        return record;
    }

    private _captureEdges(): RenderEdge[] {
        const edges: RenderEdge[] = [];
        for (const node of this.tree.allNodes()) {
            if (node.left !== this.tree.NIL) {
                edges.push({ parentUid: node.uid, childUid: node.left.uid, side: "left" });
            }
            if (node.right !== this.tree.NIL) {
                edges.push({ parentUid: node.uid, childUid: node.right.uid, side: "right" });
            }
        }
        return edges;
    }

    private _nodeAnchor(node: RBNode): RenderAnchor {
        return { kind: "node", uid: node.uid };
    }

    private _slotAnchor(parent: RBNode, side: "left" | "right"): RenderAnchor {
        return { kind: "slot", parentUid: parent.uid, side };
    }

    private _buildEdgeMotionPlan(
        kind: StepRenderPlan["kind"],
        startLayout: Record<number, NodePosition>,
        startEdges: RenderEdge[],
        endLayout: Record<number, NodePosition>,
        endEdges: RenderEdge[],
        edgeMotions: RenderEdgeMotion[],
        carryNodeUids: number[] = [],
    ): StepRenderPlan | undefined {
        const metrics = computeLayoutMetrics(new Map(
            Object.entries(startLayout).map(([uid, pos]) => [Number(uid), pos]),
        ));
        if (metrics.hasOverlaps) return undefined;

        return {
            kind,
            startLayout,
            endLayout,
            startEdges,
            endEdges,
            edgeMotions,
            edgePhaseDurationMs: 220,
            layoutPhaseDurationMs: 320,
            carryNodeUids,
        };
    }

    // ── Visualization methods ───────────────────────────────────────

    private _nodeLabel(n: RBNode): string {
        return n.isNil ? "NIL" : String(n.key);
    }

    trackPointer(name: string, node: RBNode): RBNode {
        const line = getEvalCallerLine();
        const oldTarget = this.tree.pointers.get(name) ?? null;
        const cmd = new SetPointerCommand(name, oldTarget, node);
        cmd.execute(this.tree);
        this._pushStep(`${name} = ${this._nodeLabel(node)}`, cmd, false, line);
        return node;
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

    moveEdge(parent: RBNode, side: "left" | "right", child: RBNode): void {
        const line = getEvalCallerLine();
        const cmds: Command<RBTree>[] = [
            new SetChildCommand(parent, child, side),
        ];
        if (!child.isNil) {
            cmds.push(new SetParentCommand(child, parent));
        }
        const cmd = new CompoundCommand(
            `${this._nodeLabel(parent)}.${side} ← ${this._nodeLabel(child)}`,
            cmds,
        );
        cmd.execute(this.tree);
        this._pushStep(
            `Move ${this._nodeLabel(parent)}.${side} edge to ${this._nodeLabel(child)}`,
            cmd, false, line,
            { parent, child },
        );
    }

    replaceInParent(oldNode: RBNode, newNode: RBNode): void {
        const line = getEvalCallerLine();
        const cmds: Command<RBTree>[] = [
            new SetParentCommand(newNode, oldNode.parent),
        ];
        if (oldNode.parent === this.tree.NIL) {
            cmds.push(new SetRootCommand(this.tree, newNode));
        } else if (oldNode === oldNode.parent.left) {
            cmds.push(new SetChildCommand(oldNode.parent, newNode, "left"));
        } else {
            cmds.push(new SetChildCommand(oldNode.parent, newNode, "right"));
        }
        const cmd = new CompoundCommand(
            `Replace ${this._nodeLabel(oldNode)} with ${this._nodeLabel(newNode)} in parent`,
            cmds,
        );
        cmd.execute(this.tree);
        this._pushStep(
            `Replace ${this._nodeLabel(oldNode)} with ${this._nodeLabel(newNode)} in parent`,
            cmd, false, line,
            { oldNode, newNode },
        );
    }

    transplantTransaction(oldNode: RBNode, newNode: RBNode): void {
        const line = getEvalCallerLine();
        const oldParent = oldNode.parent;
        const side = oldParent !== this.tree.NIL && oldNode === oldParent.left ? "left" : "right";
        const startLayout = this._captureLayoutRecord();
        const startEdges = this._captureEdges();

        const cmds: Command<RBTree>[] = [
            new SetParentCommand(newNode, oldParent),
        ];
        if (oldParent === this.tree.NIL) {
            cmds.push(new SetRootCommand(this.tree, newNode));
        } else {
            cmds.push(new SetChildCommand(oldParent, newNode, side));
        }
        const cmd = new CompoundCommand(
            `Transplant ${this._nodeLabel(oldNode)} with ${this._nodeLabel(newNode)}`,
            cmds,
        );
        cmd.execute(this.tree);

        const endLayout = this._captureLayoutRecord();
        const endEdges = this._captureEdges();
        const edgeMotions: RenderEdgeMotion[] = oldParent === this.tree.NIL ? [] : [{
            fromParentUid: oldParent.uid,
            toParentUid: oldParent.uid,
            fromChild: this._nodeAnchor(oldNode),
            toChild: newNode.isNil ? this._slotAnchor(oldParent, side) : this._nodeAnchor(newNode),
            side,
        }];

        const step = this._pushStep(
            `Transplant ${this._nodeLabel(oldNode)} with ${this._nodeLabel(newNode)}`,
            cmd,
            false,
            line,
            { oldNode, newNode },
        );
        step.renderPlan = this._buildEdgeMotionPlan(
            "transplant",
            startLayout,
            startEdges,
            endLayout,
            endEdges,
            edgeMotions,
            [oldNode.uid],
        );
    }

    moveEdgeTransaction(
        parent: RBNode,
        side: "left" | "right",
        child: RBNode,
        carryNodes: RBNode[] = [],
    ): void {
        const line = getEvalCallerLine();
        const oldChild = side === "left" ? parent.left : parent.right;
        const startLayout = this._captureLayoutRecord();
        const startEdges = this._captureEdges();

        const cmds: Command<RBTree>[] = [
            new SetChildCommand(parent, child, side),
        ];
        if (!child.isNil) {
            cmds.push(new SetParentCommand(child, parent));
        }
        const cmd = new CompoundCommand(
            `${this._nodeLabel(parent)}.${side} ← ${this._nodeLabel(child)}`,
            cmds,
        );
        cmd.execute(this.tree);

        const endLayout = this._captureLayoutRecord();
        const endEdges = this._captureEdges();
        const edgeMotions: RenderEdgeMotion[] =
            oldChild === child
                ? []
                : [{
                    fromParentUid: parent.uid,
                    toParentUid: parent.uid,
                    fromChild: oldChild.isNil ? this._slotAnchor(parent, side) : this._nodeAnchor(oldChild),
                    toChild: child.isNil ? this._slotAnchor(parent, side) : this._nodeAnchor(child),
                    side,
                }];

        const step = this._pushStep(
            `Move ${this._nodeLabel(parent)}.${side} edge to ${this._nodeLabel(child)}`,
            cmd,
            false,
            line,
            { parent, child },
        );
        step.renderPlan = this._buildEdgeMotionPlan(
            "rewire",
            startLayout,
            startEdges,
            endLayout,
            endEdges,
            edgeMotions,
            carryNodes.map((node) => node.uid),
        );
    }

    rotateLeftTransaction(x: RBNode, y: RBNode): void {
        const line = getEvalCallerLine();
        const beta = y.left;
        const oldParent = x.parent;
        const side = oldParent !== this.tree.NIL && x === oldParent.left ? "left" : "right";

        const startLayout = this._captureLayoutRecord();
        const startEdges = this._captureEdges();

        const cmds: Command<RBTree>[] = [new SetChildCommand(x, beta, "right")];
        if (!beta.isNil) {
            cmds.push(new SetParentCommand(beta, x));
        }
        cmds.push(new SetParentCommand(y, oldParent));
        if (oldParent === this.tree.NIL) {
            cmds.push(new SetRootCommand(this.tree, y));
        } else {
            cmds.push(new SetChildCommand(oldParent, y, side));
        }
        cmds.push(new SetChildCommand(y, x, "left"));
        cmds.push(new SetParentCommand(x, y));

        const cmd = new CompoundCommand(`Rotate left at ${this._nodeLabel(x)}`, cmds);
        cmd.execute(this.tree);

        const endLayout = this._captureLayoutRecord();
        const endEdges = this._captureEdges();
        const edgeMotions: RenderEdgeMotion[] = [
            {
                fromParentUid: x.uid,
                toParentUid: x.uid,
                fromChild: this._nodeAnchor(y),
                toChild: beta.isNil ? this._slotAnchor(x, "right") : this._nodeAnchor(beta),
                side: "right",
            },
            ...(oldParent === this.tree.NIL ? [] : [{
                fromParentUid: oldParent.uid,
                toParentUid: oldParent.uid,
                fromChild: this._nodeAnchor(x),
                toChild: this._nodeAnchor(y),
                side,
            } satisfies RenderEdgeMotion]),
            {
                fromParentUid: y.uid,
                toParentUid: y.uid,
                fromChild: beta.isNil ? this._slotAnchor(y, "left") : this._nodeAnchor(beta),
                toChild: this._nodeAnchor(x),
                side: "left",
            },
        ];

        const step = this._pushStep(
            `Rotate left at ${this._nodeLabel(x)}`,
            cmd,
            false,
            line,
            { x, y, beta, parent: oldParent },
        );
        step.renderPlan = this._buildEdgeMotionPlan("rotation", startLayout, startEdges, endLayout, endEdges, edgeMotions);
    }

    rotateRightTransaction(y: RBNode, x: RBNode): void {
        const line = getEvalCallerLine();
        const beta = x.right;
        const oldParent = y.parent;
        const side = oldParent !== this.tree.NIL && y === oldParent.left ? "left" : "right";

        const startLayout = this._captureLayoutRecord();
        const startEdges = this._captureEdges();

        const cmds: Command<RBTree>[] = [new SetChildCommand(y, beta, "left")];
        if (!beta.isNil) {
            cmds.push(new SetParentCommand(beta, y));
        }
        cmds.push(new SetParentCommand(x, oldParent));
        if (oldParent === this.tree.NIL) {
            cmds.push(new SetRootCommand(this.tree, x));
        } else {
            cmds.push(new SetChildCommand(oldParent, x, side));
        }
        cmds.push(new SetChildCommand(x, y, "right"));
        cmds.push(new SetParentCommand(y, x));

        const cmd = new CompoundCommand(`Rotate right at ${this._nodeLabel(y)}`, cmds);
        cmd.execute(this.tree);

        const endLayout = this._captureLayoutRecord();
        const endEdges = this._captureEdges();
        const edgeMotions: RenderEdgeMotion[] = [
            {
                fromParentUid: y.uid,
                toParentUid: y.uid,
                fromChild: this._nodeAnchor(x),
                toChild: beta.isNil ? this._slotAnchor(y, "left") : this._nodeAnchor(beta),
                side: "left",
            },
            ...(oldParent === this.tree.NIL ? [] : [{
                fromParentUid: oldParent.uid,
                toParentUid: oldParent.uid,
                fromChild: this._nodeAnchor(y),
                toChild: this._nodeAnchor(x),
                side,
            } satisfies RenderEdgeMotion]),
            {
                fromParentUid: x.uid,
                toParentUid: x.uid,
                fromChild: beta.isNil ? this._slotAnchor(x, "right") : this._nodeAnchor(beta),
                toChild: this._nodeAnchor(y),
                side: "right",
            },
        ];

        const step = this._pushStep(
            `Rotate right at ${this._nodeLabel(y)}`,
            cmd,
            false,
            line,
            { x, y, beta, parent: oldParent },
        );
        step.renderPlan = this._buildEdgeMotionPlan("rotation", startLayout, startEdges, endLayout, endEdges, edgeMotions);
    }

    removeNode(z: RBNode): void {
        const line = getEvalCallerLine();
        const cmd = new UntrackNodeCommand(z);
        cmd.execute(this.tree);
        this._pushStep(`Remove node ${z.key}`, cmd, false, line, { z });
    }

    /**
     * Lightweight step marker injected by instrumentCode for lines
     * that don't already contain a viz method call.
     */
    __tick(line: number, extras?: Record<string, any>): void {
        if (!this.__steps) return;
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, "", extras);
        this.__steps.push(new RBTStep(msg, undefined, false, line, this._pointerSnapshot()));
    }

    logStep(ctx?: Record<string, any>): void {
        const line = getEvalCallerLine();
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, "", ctx);
        this.__steps.push(new RBTStep(msg, undefined, false, line, this._pointerSnapshot()));
    }

    logCase(label: string): void {
        const line = getEvalCallerLine();
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, label);
        const step = new RBTStep(msg, undefined, false, line, this._pointerSnapshot());
        step.caseLabel = label;
        this.__steps.push(step);
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
        this._visualLayoutByUid = {};
        (this as any).insert(key);
        return this._finalizeSteps();
    }

    getDeleteSteps(key: number): RBTStep[] {
        this.__steps = [];
        this._lastBranchLine = null;
        this._visualLayoutByUid = {};
        (this as any).delete(key);
        return this._finalizeSteps();
    }

    /** Bulk-insert without recording steps (for initial array load). */
    bulkInsert(keys: number[]): void {
        for (const key of keys) {
            this.__steps = [];
            this._lastBranchLine = null;
            this._visualLayoutByUid = {};
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

// ── Code instrumentation ────────────────────────────────────────────────

const VIZ_METHOD_RE =
    /\bthis\.(logStep|logCase|done|trackPointer|clearPointer|recolor|setRoot|insertNode|linkLeft|linkRight|linkParent|moveEdge|moveEdgeTransaction|replaceInParent|removeNode|rotateLeftTransaction|rotateRightTransaction|transplantTransaction)\s*\(/;

const INTERNAL_CALL_RE =
    /\bthis\.(leftRotate|rightRotate|transplant|insertFixup|deleteFixup)\s*\(/;

const IF_ELSE_RE =
    /^\s*(\}\s*)?(else\s+)?if\s*\(|^\s*(\}\s*)?else\s*(\{|$)/;

const WHILE_RE = /^(\s*)while\s*\(.*\)\s*\{\s*$/;

const SKIP_RE =
    /^\s*($|\/\/|[{})\]]+;?\s*$|class\s|return\b|break\b|continue\b)/;

const METHOD_DECL_RE = /^\s+(?!while\b|if\b|for\b)\w+\s*\(.*\)\s*\{/;

/**
 * Insert `this.__tick(lineNum, {params})` on lines that don't already
 * produce steps, so every meaningful line is visited by the stepper.
 * Function parameters are captured and forwarded so annotations can
 * reference them via template expressions (e.g. `${key}`).
 */
function instrumentCode(code: string): string {
    const lines = code.split("\n");
    let currentParams = "";

    const result = lines.map((line, i) => {
        const lineNum = i + 1;
        const trimmed = line.trim();

        if (SKIP_RE.test(trimmed)) return line;
        if (trimmed.endsWith(".prototype;")) return line;

        const methodMatch = line.match(METHOD_DECL_RE);
        if (methodMatch && !INTERNAL_CALL_RE.test(line)) {
            const paramStr = line.match(/\(([^)]*)\)/)?.[1] ?? "";
            const params = paramStr.split(",").map(p => p.trim()).filter(Boolean);
            currentParams = params.length ? `, {${params.join(", ")}}` : "";
            if (params.length) {
                return line.replace("{", `{ this.__setMethodParams({${params.join(", ")}});`);
            }
            return line;
        }

        if (VIZ_METHOD_RE.test(line)) return line;
        if (IF_ELSE_RE.test(trimmed)) return line;

        if (WHILE_RE.test(line)) {
            return line.replace("{", `{ this.__tick(${lineNum}${currentParams});`);
        }

        if (INTERNAL_CALL_RE.test(line)) {
            const indent = line.match(/^(\s*)/)?.[1] ?? "";
            return `${indent}this.__tick(${lineNum}${currentParams}); ${trimmed}`;
        }

        return `${line} this.__tick(${lineNum}${currentParams});`;
    });

    return result.join("\n");
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
        const instrumented = instrumentCode(code);
        const solverClass: any = eval?.(instrumented);
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
