import { ensureError } from "../errors/error";
import { getEvalCallerLine } from "../utils/stackTrace";
import { GraphNode } from "../graphs/components";
import { GenericGraph } from "../graphs/graph";
import {
    ResolvedAnnotationMap,
    BranchScopeMap,
    evaluateTemplate,
} from "../rbt/rbtAnnotations";

// ── Queue entry (for PriorityQueuePanel) ────────────────────────────────────

export interface QueueEntry {
    nodeId: string;
    dist: number;
    /** True on the step where this node is being extracted from Q. */
    isBeingExtracted: boolean;
}

// ── Step command ──────────────────────────────────────────────────────────────
// A simple reversible operation that closes over the nodes it mutates.
// Using a plain interface rather than the generic Command<T> avoids the need
// to thread a context type through every layer.

export interface StepCommand {
    execute(): void;
    revert(): void;
}

// ── Step ──────────────────────────────────────────────────────────────────────

export class DijkstraStep {
    debugValue: any;
    command?: StepCommand;
    sourceLine: number | null;
    isTerminal: boolean;
    /** Snapshot of dist[] / prev[] values for the WatchPanel. */
    pointerSnapshot: Record<string, string>;
    /** Current priority-queue state for PriorityQueuePanel. */
    queueSnapshot: QueueEntry[];
    question?: string;
    answer?: string;
    /**
     * If this step is a relaxEdge call, the IDs of the edge being checked.
     * Used by DijkstraGraphView for transient highlight (not in graph state).
     */
    relaxingEdge?: { fromId: string; toId: string };
    /**
     * If this step is an extractMin call, the ID of the node being extracted.
     * Used by DijkstraGraphView for transient highlight.
     */
    extractingNodeId?: string;

    constructor(
        debugValue: any = null,
        command?: StepCommand,
        isTerminal = false,
        sourceLine: number | null = null,
        pointerSnapshot: Record<string, string> = {},
        queueSnapshot: QueueEntry[] = [],
        question?: string,
        answer?: string,
    ) {
        this.debugValue = debugValue;
        this.command = command;
        this.isTerminal = isTerminal;
        this.sourceLine = sourceLine;
        this.pointerSnapshot = pointerSnapshot;
        this.queueSnapshot = queueSnapshot;
        this.question = question;
        this.answer = answer;
    }
}

// ── Node-data mutation command ────────────────────────────────────────────────

interface DataChange {
    node: GraphNode;
    key: string;
    oldVal: any;
    newVal: any;
}

function makeDataCommand(changes: DataChange[]): StepCommand {
    let done = false;
    return {
        execute() {
            if (done) throw new Error("Command already executed.");
            for (const c of changes) {
                c.node.data[c.key] = c.newVal;
                c.node.graph.markDirtyRender();
            }
            done = true;
        },
        revert() {
            if (!done) throw new Error("Command not yet executed.");
            for (const c of changes) {
                c.node.data[c.key] = c.oldVal;
                c.node.graph.markDirtyRender();
            }
            done = false;
        },
    };
}

// ── Solution Base ─────────────────────────────────────────────────────────────

export class DijkstraSolutionBase {
    graph!: GenericGraph;
    private __steps: DijkstraStep[] = [];
    private _annotations: ResolvedAnnotationMap = new Map();
    private _branchScope: BranchScopeMap = new Map();
    private _lastBranchLine: number | null = null;
    private _methodParams: Record<string, any> = {};

    /** Internal distance map — mirrors d[] in CLRS. */
    private _distMap: Map<string, number> = new Map();
    /** Internal predecessor map — mirrors π[] in CLRS. */
    private _prevMap: Map<string, string | null> = new Map();
    /** IDs of nodes still in the priority queue (not yet settled). */
    private _queuedSet: Set<string> = new Set();

    setAnnotations(a: ResolvedAnnotationMap): void { this._annotations = a; }
    setBranchScopeMap(b: BranchScopeMap): void { this._branchScope = b; }

    // ── Context helpers ──────────────────────────────────────────────────────

    __setMethodParams(params: Record<string, any>): void {
        this._methodParams = params;
    }

    private _buildContext(extras?: Record<string, any>): Record<string, any> {
        const ctx: Record<string, any> = {
            graph: this.graph,
            getDist: (v: GraphNode) => this._distMap.get(v.id) ?? Infinity,
            ...this._methodParams,
        };
        if (extras) Object.assign(ctx, extras);
        return ctx;
    }

    // ── Snapshot helpers ─────────────────────────────────────────────────────

    private _pointerSnapshot(): Record<string, string> {
        const snap: Record<string, string> = {};
        for (const [id, dist] of this._distMap) {
            snap[`dist[${id}]`] = dist === Infinity ? "∞" : String(dist);
        }
        for (const [id, prev] of this._prevMap) {
            snap[`prev[${id}]`] = prev ?? "NIL";
        }
        return snap;
    }

    private _queueSnapshot(extractingId?: string): QueueEntry[] {
        const entries: QueueEntry[] = [];
        for (const id of this._queuedSet) {
            entries.push({
                nodeId: id,
                dist: this._distMap.get(id) ?? Infinity,
                isBeingExtracted: id === extractingId,
            });
        }
        entries.sort((a, b) => a.dist - b.dist);
        return entries;
    }

    // ── Core step emission ────────────────────────────────────────────────────

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
                new DijkstraStep(undefined, undefined, false, branchLine,
                    this._pointerSnapshot(), this._queueSnapshot(), q, a),
            );
        } else if (ann.msg) {
            const msg = evaluateTemplate(ann.msg, ctx);
            this.__steps.push(
                new DijkstraStep(msg, undefined, false, branchLine,
                    this._pointerSnapshot(), this._queueSnapshot()),
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
        cmd: StepCommand | undefined,
        terminal: boolean,
        line: number | null,
        extras?: Record<string, any>,
        extractingId?: string,
    ): DijkstraStep {
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, autoMsg, extras);
        const step = new DijkstraStep(
            msg, cmd, terminal, line,
            this._pointerSnapshot(),
            this._queueSnapshot(extractingId),
        );
        this.__steps.push(step);
        return step;
    }

    // ── Lightweight tick injected by instrumentCode ──────────────────────────

    __tick(line: number, extras?: Record<string, any>): void {
        if (!this.__steps) return;
        this._emitBranchIfNeeded(line);
        const ann = this._annotations.get(line);
        if (!ann) return;
        const msg = this._resolveMsg(line, "", extras);
        this.__steps.push(
            new DijkstraStep(msg, undefined, false, line,
                this._pointerSnapshot(), this._queueSnapshot()),
        );
    }

    // ── Visualization methods (called from user pseudocode) ──────────────────

    /** Read current distance for a node. Pure — no step emitted. */
    getDist(v: GraphNode): number {
        return this._distMap.get(v.id) ?? Infinity;
    }

    /**
     * Update dist[v] and prev[v]. Issues a graph command to visually mark v
     * as relaxed and update its distance label.
     */
    updateDist(v: GraphNode, newDist: number, u: GraphNode | null): void {
        const line = getEvalCallerLine();
        const oldState = v.data["state"] ?? "";
        const oldLabel = v.data["dist_label"];

        this._distMap.set(v.id, newDist);
        this._prevMap.set(v.id, u?.id ?? null);

        // Ensure node is tracked as queued (unless it was already settled)
        if (!this._queuedSet.has(v.id) && oldState !== "settled") {
            this._queuedSet.add(v.id);
        }

        const newState = oldState === "settled" ? "settled" : "relaxed";
        const newLabel = newDist === Infinity ? "∞" : String(newDist);

        const cmd = makeDataCommand([
            { node: v, key: "state", oldVal: oldState, newVal: newState },
            { node: v, key: "dist_label", oldVal: oldLabel, newVal: newLabel },
        ]);
        cmd.execute();

        const prevLabel = u ? u.id : "NIL";
        this._pushStep(
            `d[${v.id}] = ${newLabel}, π[${v.id}] = ${prevLabel}`,
            cmd, false, line,
            { v, u, newDist },
        );
    }

    /**
     * Emit a step highlighting edge (u→v) during the relaxation check.
     * No durable graph state change — edge IDs are stored in step metadata
     * and rendered transiently by DijkstraGraphView.
     */
    relaxEdge(u: GraphNode, v: GraphNode, w: number): void {
        const line = getEvalCallerLine();
        const step = this._pushStep(
            `Checking edge (${u.id} → ${v.id}), weight = ${w}`,
            undefined, false, line,
            { u, v, w },
        );
        step.relaxingEdge = { fromId: u.id, toId: v.id };
    }

    /**
     * Extract the minimum-distance node from Q (a plain array).
     * Removes the node from Q in place and emits a step.
     */
    extractMin(Q: GraphNode[]): GraphNode {
        const line = getEvalCallerLine();
        let minIdx = 0;
        let minDist = this._distMap.get(Q[0].id) ?? Infinity;
        for (let i = 1; i < Q.length; i++) {
            const d = this._distMap.get(Q[i].id) ?? Infinity;
            if (d < minDist) { minDist = d; minIdx = i; }
        }
        const u = Q[minIdx];
        Q.splice(minIdx, 1);

        this._emitBranchIfNeeded(line);
        const distLabel = minDist === Infinity ? "∞" : String(minDist);
        const msg = this._resolveMsg(
            line, `Extract min: u = ${u.id}, d[u] = ${distLabel}`, { u });
        const step = new DijkstraStep(
            msg, undefined, false, line,
            this._pointerSnapshot(),
            this._queueSnapshot(u.id),
        );
        step.extractingNodeId = u.id;
        this.__steps.push(step);
        return u;
    }

    /**
     * Mark node u as finalized (settled). Issues a graph command to
     * visually distinguish u from queued nodes.
     */
    settle(u: GraphNode): void {
        const line = getEvalCallerLine();
        const oldState = u.data["state"] ?? "";
        this._queuedSet.delete(u.id);

        const cmd = makeDataCommand([
            { node: u, key: "state", oldVal: oldState, newVal: "settled" },
        ]);
        cmd.execute();

        this._pushStep(`Add ${u.id} to settled set S`, cmd, false, line, { u });
    }

    /** Emit a log step with annotation support. */
    logStep(ctx?: Record<string, any>): void {
        const line = getEvalCallerLine();
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, "", ctx);
        this.__steps.push(
            new DijkstraStep(msg, undefined, false, line,
                this._pointerSnapshot(), this._queueSnapshot()),
        );
    }

    /** Emit a terminal step — algorithm is finished. */
    done(ctx?: Record<string, any>): void {
        const line = getEvalCallerLine();
        this._emitBranchIfNeeded(line);
        const msg = this._resolveMsg(line, "Dijkstra complete", ctx);
        this.__steps.push(
            new DijkstraStep(msg, undefined, true, line,
                this._pointerSnapshot(), this._queueSnapshot()),
        );
    }

    // ── Step retrieval ────────────────────────────────────────────────────────

    getSolveSteps(source: GraphNode): DijkstraStep[] {
        this.__steps = [];
        this._lastBranchLine = null;
        this._distMap = new Map();
        this._prevMap = new Map();
        this._queuedSet = new Set();
        (this as any).solve(source);
        return this._finalizeSteps();
    }

    private _finalizeSteps(): DijkstraStep[] {
        const steps = [...this.__steps];
        // Revert commands in reverse order to restore graph visual state to
        // pre-algorithm appearance.
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].command) steps[i].command!.revert();
        }
        this._distMap = new Map();
        this._prevMap = new Map();
        this._queuedSet = new Set();
        return steps;
    }
}

// ── Code instrumentation ──────────────────────────────────────────────────────
// Identical pattern to RBT's instrumentCode, adapted for Dijkstra method names.

const VIZ_METHOD_RE =
    /\bthis\.(logStep|done|updateDist|relaxEdge|extractMin|settle|getDist)\s*\(/;

const INTERNAL_CALL_RE =
    /\bthis\.(relax|initializeSingleSource)\s*\(/;

const IF_ELSE_RE =
    /^\s*(\}\s*)?(else\s+)?if\s*\(|^\s*(\}\s*)?else\s*(\{|$)/;

const WHILE_RE = /^(\s*)while\s*\(.*\)\s*\{\s*$/;

const SKIP_RE =
    /^\s*($|\/\/|[{})\]]+;?\s*$|class\s|return\b|break\b|continue\b)/;

const METHOD_DECL_RE = /^\s+(?!while\b|if\b|for\b)\w+\s*\(.*\)\s*\{/;

const LET_CONST_DECL_RE = /\b(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=/g;
const FOR_OF_IN_RE = /\bfor\s*\(\s*(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s+(?:of|in)\b/;
const FOR_CLASSIC_RE = /\bfor\s*\(\s*(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=/;

function instrumentCode(code: string): string {
    const lines = code.split("\n");
    // Stack of lexical scopes, outermost first. Each scope holds identifiers
    // that came into binding within that block and are thus safe to reference
    // from `__tick` extras while the scope is live.
    const scopes: Set<string>[] = [new Set<string>()];

    function currentParams(): string {
        const all = new Set<string>();
        for (const s of scopes) for (const id of s) all.add(id);
        if (all.size === 0) return "";
        return `, {${[...all].join(", ")}}`;
    }

    const result = lines.map((line, i) => {
        const lineNum = i + 1;
        const trimmed = line.trim();

        // ── Scope bookkeeping (runs for every line, regardless of emit path) ──
        const openBraces = (line.match(/\{/g) ?? []).length;
        const closeBraces = (line.match(/\}/g) ?? []).length;
        const net = openBraces - closeBraces;

        // Pop before push for lines that close then open (e.g. `} else {`).
        // For balanced single-line blocks (`constructor(g) { ...; }`) net === 0,
        // so we leave the stack alone — the binding that would have lived
        // inside that line's block has no subsequent line to observe it.
        if (net < 0) {
            for (let k = 0; k < -net; k++) {
                if (scopes.length > 1) scopes.pop();
            }
        }

        const methodMatch = line.match(METHOD_DECL_RE);
        const isMethodDecl = !!methodMatch && !INTERNAL_CALL_RE.test(line);
        const methodParamNames: string[] = isMethodDecl
            ? (line.match(/\(([^)]*)\)/)?.[1] ?? "")
                  .split(",")
                  .map(p => p.trim())
                  .filter(Boolean)
            : [];

        const forOfMatch = line.match(FOR_OF_IN_RE);
        const forClassicMatch = line.match(FOR_CLASSIC_RE);
        const forParam = forOfMatch?.[1] ?? forClassicMatch?.[1] ?? null;

        if (net > 0) {
            for (let k = 0; k < net; k++) scopes.push(new Set<string>());
            // Method params and for-loop binders live in the newly opened scope.
            const top = scopes[scopes.length - 1];
            for (const p of methodParamNames) top.add(p);
            if (forParam) top.add(forParam);
        }

        // Plain `let X = …` / `const X = …` outside any for-head attach to the
        // innermost live scope. Strip for-parens first to avoid picking up the
        // loop variable again.
        const declScannable = line.replace(/for\s*\([^)]*\)/g, "");
        LET_CONST_DECL_RE.lastIndex = 0;
        let declMatch: RegExpExecArray | null;
        while ((declMatch = LET_CONST_DECL_RE.exec(declScannable)) !== null) {
            scopes[scopes.length - 1].add(declMatch[1]);
        }

        // ── Emit (existing rewrite logic, now using dynamic scope) ────────────
        if (SKIP_RE.test(trimmed)) return line;
        if (trimmed.endsWith(".prototype;")) return line;

        if (isMethodDecl) {
            if (methodParamNames.length) {
                return line.replace(
                    "{",
                    `{ this.__setMethodParams({${methodParamNames.join(", ")}});`,
                );
            }
            return line;
        }

        if (VIZ_METHOD_RE.test(line)) return line;
        if (IF_ELSE_RE.test(trimmed)) return line;

        const params = currentParams();

        if (WHILE_RE.test(line)) {
            return line.replace("{", `{ this.__tick(${lineNum}${params});`);
        }

        if (INTERNAL_CALL_RE.test(line)) {
            const indent = line.match(/^(\s*)/)?.[1] ?? "";
            return `${indent}this.__tick(${lineNum}${params}); ${trimmed}`;
        }

        return `${line} this.__tick(${lineNum}${params});`;
    });

    return result.join("\n");
}

// ── Build from eval'd algorithm code ─────────────────────────────────────────

export function buildDijkstraSolution(
    code: string,
    graph: GenericGraph,
    annotations?: ResolvedAnnotationMap,
    branchScope?: BranchScopeMap,
): DijkstraSolutionBase {
    let result: DijkstraSolutionBase;
    try {
        "use strict";
        const instrumented = instrumentCode(code);
        const solverClass: any = eval?.(instrumented);
        if (solverClass === undefined) {
            throw new Error(
                "Received undefined on eval. Ensure the last line evaluates to the prototype of your class.",
            );
        }
        Object.setPrototypeOf(solverClass, DijkstraSolutionBase.prototype);
        const solver = Object.create(solverClass);
        const finalProto = Object.getPrototypeOf(solver);

        if (!Object.hasOwn(finalProto, "constructor")) {
            throw new Error("constructor is not defined.");
        }
        if (!Object.hasOwn(finalProto, "solve")) {
            throw new Error("solve method is not defined.");
        }
        if (solver.solve.length !== 1) {
            throw new Error("solve must accept exactly one parameter (source node).");
        }

        result = new solver.constructor(graph);
    } catch (e) {
        const err = ensureError(e);
        throw new Error("Error evaluating algorithm code: " + (err.stack ?? err.message));
    }

    if (annotations) result.setAnnotations(annotations);
    if (branchScope) result.setBranchScopeMap(branchScope);

    return result;
}
