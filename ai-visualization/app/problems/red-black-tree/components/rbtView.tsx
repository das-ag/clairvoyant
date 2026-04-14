import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { RBColor, RBNode, RBTree } from "@/lib/rbt/rbtree";
import { computeLayout, LEVEL_HEIGHT, MIN_NODE_GAP, NodePosition } from "@/lib/rbt/rbtLayout";
import {
    EdgeMotionRenderPlan,
    RBTStep,
    RenderAnchor,
    RenderEdge,
    StepRenderPlan,
} from "@/lib/rbt/rbtSolution";
import "./rbtView.css";

const NODE_RADIUS = 20;

const POINTER_COLORS: Record<string, string> = {
    z: "#f59e0b",
    x: "#eab308",
    y: "#a855f7",
    uncle: "#22c55e",
    w: "#22c55e",
};

const ZOOM_SENSITIVITY = 0.001;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ANIM_DURATION = 600;

function easeOut(t: number): number {
    if (t >= 1) return 1;
    return 1 - Math.pow(1 - t, 3);
}

interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface VisualFrame {
    positions: Map<number, NodePosition>;
    edges: RenderEdge[];
}

interface RenderedEdge {
    key: string;
    start: NodePosition;
    end: NodePosition;
}

interface SimpleAnimState {
    kind: "simple";
    startFrame: VisualFrame;
    endFrame: VisualFrame;
    startTime: number;
    durationMs: number;
}

interface PlannedAnimState {
    kind: "planned";
    plan: StepRenderPlan;
    startTime: number;
    totalDurationMs: number;
}

type AnimState = SimpleAnimState | PlannedAnimState;

function pointerStrokeColor(labels: Set<string>): string | null {
    for (const name of labels) {
        if (POINTER_COLORS[name]) return POINTER_COLORS[name];
    }
    if (labels.size > 0) return "#38bdf8";
    return null;
}

function nodeFill(node: RBNode): string {
    return node.color === RBColor.RED ? "#dc2626" : "#1e293b";
}

interface RBTViewProps {
    tree: RBTree | null;
    renderKey: number;
    currentStep?: RBTStep;
    currentStepIndex?: number;
    onFitRef?: React.MutableRefObject<(() => void) | null>;
}

function computeBoundsViewBox(layout: Map<RBNode, NodePosition>, pad = 50): ViewBox {
    if (layout.size === 0) return { x: -200, y: -50, w: 400, h: 300 };
    const positions = [...layout.values()];
    const allXs = positions.map((p) => p.x);
    const allYs = positions.map((p) => p.y);
    const minX = Math.min(...allXs) - pad;
    const maxX = Math.max(...allXs) + pad;
    const minY = Math.min(...allYs) - pad;
    const maxY = Math.max(...allYs) + pad;
    
    let w = maxX - minX;
    let h = maxY - minY;
    
    const minW = 600;
    const minH = 400;
    
    let x = minX;
    let y = minY;
    
    if (w < minW) {
        x -= (minW - w) / 2;
        w = minW;
    }
    if (h < minH) {
        y -= (minH - h) / 2;
        h = minH;
    }
    
    return { x, y, w, h };
}

function clonePositions(positions: Map<number, NodePosition>): Map<number, NodePosition> {
    return new Map([...positions.entries()].map(([uid, pos]) => [uid, { x: pos.x, y: pos.y }]));
}

function layoutRecordToMap(record: Record<number, NodePosition>): Map<number, NodePosition> {
    return new Map(
        Object.entries(record).map(([uid, pos]) => [Number(uid), { x: pos.x, y: pos.y }]),
    );
}

function buildFrame(
    tree: RBTree | null,
    carryPositions: Map<number, NodePosition> = new Map(),
    carryNodeUids: Set<number> = new Set(),
): VisualFrame {
    if (!tree || tree.root === tree.NIL) {
        return { positions: new Map(), edges: [] };
    }

    const positions = new Map<number, NodePosition>();
    for (const [node, pos] of computeLayout(tree)) {
        positions.set(node.uid, { x: pos.x, y: pos.y });
    }

    const edges: RenderEdge[] = [];
    for (const node of tree.allNodes()) {
        if (node.left !== tree.NIL) edges.push({ parentUid: node.uid, childUid: node.left.uid, side: "left" });
        if (node.right !== tree.NIL) edges.push({ parentUid: node.uid, childUid: node.right.uid, side: "right" });
    }

    for (const node of tree.allTrackedNodes()) {
        if (positions.has(node.uid)) continue;
        if (!carryNodeUids.has(node.uid)) continue;
        const carryPos = carryPositions.get(node.uid);
        if (carryPos) {
            positions.set(node.uid, { ...carryPos });
        }
    }

    return { positions, edges };
}

function framesEqual(a: VisualFrame, b: VisualFrame): boolean {
    if (a.positions.size !== b.positions.size || a.edges.length !== b.edges.length) return false;
    for (const [uid, pos] of a.positions) {
        const other = b.positions.get(uid);
        if (!other || other.x !== pos.x || other.y !== pos.y) return false;
    }
    for (let i = 0; i < a.edges.length; i++) {
        const left = a.edges[i];
        const right = b.edges[i];
        if (
            left.parentUid !== right.parentUid ||
            left.childUid !== right.childUid ||
            left.side !== right.side
        ) {
            return false;
        }
    }
    return true;
}

function interpolatePosition(a: NodePosition, b: NodePosition, t: number): NodePosition {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    };
}

function slotAnchor(parent: NodePosition, side: "left" | "right"): NodePosition {
    return {
        x: parent.x + (side === "left" ? -MIN_NODE_GAP / 2 : MIN_NODE_GAP / 2),
        y: parent.y + LEVEL_HEIGHT,
    };
}

function renderEdgesFromFrame(frame: VisualFrame): RenderedEdge[] {
    return frame.edges.flatMap((edge) => {
        const parent = frame.positions.get(edge.parentUid);
        const child = frame.positions.get(edge.childUid);
        if (!parent || !child) return [];
        return [{
            key: `${edge.parentUid}-${edge.side}-${edge.childUid}`,
            start: parent,
            end: child,
        }];
    });
}

function applyCompletedMotion(edges: RenderEdge[], motion: EdgeMotionRenderPlan["edgeMotions"][number]): RenderEdge[] {
    const next = edges.filter((edge) => {
        if (motion.fromChild.kind !== "node") return true;
        return !(
            edge.parentUid === motion.fromParentUid &&
            edge.childUid === motion.fromChild.uid &&
            edge.side === motion.side
        );
    });

    if (motion.toChild.kind === "node") {
        next.push({
            parentUid: motion.toParentUid,
            childUid: motion.toChild.uid,
            side: motion.side,
        });
    }

    return next;
}

function resolveAnchor(
    anchor: RenderAnchor,
    positions: Map<number, NodePosition>,
): NodePosition | null {
    if (anchor.kind === "node") {
        return positions.get(anchor.uid) ?? null;
    }
    const parent = positions.get(anchor.parentUid);
    return parent ? slotAnchor(parent, anchor.side) : null;
}

function sampleEdgeMotionDisplay(plan: EdgeMotionRenderPlan, elapsedMs: number): { positions: Map<number, NodePosition>; edges: RenderedEdge[] } {
    const startPositions = layoutRecordToMap(plan.startLayout);
    const endPositions = layoutRecordToMap(plan.endLayout);
    const edgePhaseCount = plan.edgeMotions.length;
    const edgeDuration = plan.edgePhaseDurationMs;
    const layoutStart = edgePhaseCount * edgeDuration;

    if (elapsedMs >= layoutStart + plan.layoutPhaseDurationMs) {
        return {
            positions: endPositions,
            edges: renderEdgesFromFrame({ positions: endPositions, edges: plan.endEdges }),
        };
    }

    if (elapsedMs >= layoutStart) {
        const t = easeOut(Math.min((elapsedMs - layoutStart) / plan.layoutPhaseDurationMs, 1));
        const positions = new Map<number, NodePosition>();
        const uids = new Set([...startPositions.keys(), ...endPositions.keys()]);
        for (const uid of uids) {
            const start = startPositions.get(uid);
            const end = endPositions.get(uid);
            if (!start && !end) continue;
            if (!start) {
                positions.set(uid, { ...end! });
            } else if (!end) {
                positions.set(uid, { ...start });
            } else {
                positions.set(uid, interpolatePosition(start, end, t));
            }
        }
        return {
            positions,
            edges: renderEdgesFromFrame({ positions, edges: plan.endEdges }),
        };
    }

    const phaseIndex = Math.min(Math.floor(elapsedMs / edgeDuration), Math.max(edgePhaseCount - 1, 0));
    const phaseStart = phaseIndex * edgeDuration;
    const phaseT = easeOut(Math.min((elapsedMs - phaseStart) / edgeDuration, 1));
    let edges = [...plan.startEdges];
    for (let i = 0; i < phaseIndex; i++) {
        edges = applyCompletedMotion(edges, plan.edgeMotions[i]);
    }

    const positions = startPositions;
    const renderedEdges = edges.flatMap((edge) => {
        const motion = plan.edgeMotions[phaseIndex];
        const isMovingFromNode =
            motion &&
            motion.fromChild.kind === "node" &&
            edge.parentUid === motion.fromParentUid &&
            edge.childUid === motion.fromChild.uid &&
            edge.side === motion.side;
        if (isMovingFromNode) return [];

        const parent = positions.get(edge.parentUid);
        const child = positions.get(edge.childUid);
        if (!parent || !child) return [];
        return [{
            key: `${edge.parentUid}-${edge.side}-${edge.childUid}`,
            start: parent,
            end: child,
        }];
    });

    const motion = plan.edgeMotions[phaseIndex];
    if (motion) {
        const startParent = positions.get(motion.fromParentUid);
        const endParent = positions.get(motion.toParentUid);
        const startChild = resolveAnchor(motion.fromChild, positions);
        const endChild = resolveAnchor(motion.toChild, positions);

        if (startParent && endParent && startChild && endChild) {
            renderedEdges.push({
                key: `motion-${phaseIndex}`,
                start: interpolatePosition(startParent, endParent, phaseT),
                end: interpolatePosition(startChild, endChild, phaseT),
            });
        }
    }

    return { positions, edges: renderedEdges };
}

function sampleAnimDisplay(anim: AnimState | null, fallback: VisualFrame, now: number): { positions: Map<number, NodePosition>; edges: RenderedEdge[] } {
    if (!anim) {
        return {
            positions: fallback.positions,
            edges: renderEdgesFromFrame(fallback),
        };
    }

    if (anim.kind === "planned") {
        return sampleEdgeMotionDisplay(anim.plan, now - anim.startTime);
    }

    const t = easeOut(Math.min((now - anim.startTime) / anim.durationMs, 1));
    const positions = new Map<number, NodePosition>();
    const uids = new Set([...anim.startFrame.positions.keys(), ...anim.endFrame.positions.keys()]);
    for (const uid of uids) {
        const start = anim.startFrame.positions.get(uid);
        const end = anim.endFrame.positions.get(uid);
        if (!start && !end) continue;
        if (!start) {
            positions.set(uid, { ...end! });
        } else if (!end) {
            positions.set(uid, { ...start });
        } else {
            positions.set(uid, interpolatePosition(start, end, t));
        }
    }

    return {
        positions,
        edges: renderEdgesFromFrame({ positions, edges: anim.endFrame.edges }),
    };
}

export default function RBTView({ tree, renderKey, currentStep, currentStepIndex, onFitRef }: RBTViewProps) {
    // Zoom/pan state
    const [viewBox, setViewBox] = useState<ViewBox>({ x: -200, y: -50, w: 400, h: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ mx: number; my: number; vbx: number; vby: number } | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const userTransformedRef = useRef(false);

    // ── Animation state ─────────────────────────────────────────────
    const animRef = useRef<AnimState | null>(null);
    const settledFrameRef = useRef<VisualFrame>({ positions: new Map(), edges: [] });
    const carriedNodeUidsRef = useRef<Set<number>>(new Set());
    const lastPlannedStepIndexRef = useRef<number | null>(null);
    const rafRef = useRef(0);
    const [, forceRender] = useReducer((x: number) => x + 1, 0);

    const finalFrame = useMemo(() => {
        void renderKey;
        return buildFrame(tree, settledFrameRef.current.positions, carriedNodeUidsRef.current);
    }, [tree, renderKey]);

    const finalLayout = useMemo(() => {
        const map = new Map<RBNode, NodePosition>();
        if (!tree) return map;
        const reachableByUid = new Map(tree.allNodes().map((node) => [node.uid, node]));
        for (const [uid, pos] of finalFrame.positions) {
            const node = reachableByUid.get(uid);
            if (node) map.set(node, pos);
        }
        return map;
    }, [tree, finalFrame]);

    const fitToContent = useCallback(() => {
        const vb = computeBoundsViewBox(finalLayout);
        setViewBox(vb);
        userTransformedRef.current = false;
    }, [finalLayout]);

    useEffect(() => {
        if (onFitRef) onFitRef.current = fitToContent;
    }, [onFitRef, fitToContent]);

    // Auto-fit viewBox when layout changes (unless user has manually panned/zoomed)
    useEffect(() => {
        if (finalLayout.size === 0) return;
        if (!userTransformedRef.current) {
            setViewBox(computeBoundsViewBox(finalLayout));
        }
    }, [finalLayout]);

    // ── Animation loop ──────────────────────────────────────────────
    useEffect(() => {
        const now = performance.now();
        const currentDisplay = sampleAnimDisplay(
            animRef.current,
            settledFrameRef.current.positions.size > 0 ? settledFrameRef.current : finalFrame,
            now,
        );
        const startFrame: VisualFrame = {
            positions: clonePositions(currentDisplay.positions),
            edges: currentStep?.renderPlan
                ? finalFrame.edges
                : [...(animRef.current?.kind === "simple" ? animRef.current.endFrame.edges : settledFrameRef.current.edges)],
        };

        cancelAnimationFrame(rafRef.current);

        if (currentStep?.renderPlan) {
            if (
                currentStepIndex != null &&
                lastPlannedStepIndexRef.current === currentStepIndex &&
                (
                    animRef.current?.kind === "planned" ||
                    framesEqual(settledFrameRef.current, finalFrame)
                )
            ) {
                return;
            }
            const totalDurationMs =
                currentStep.renderPlan.edgeMotions.length * currentStep.renderPlan.edgePhaseDurationMs +
                currentStep.renderPlan.layoutPhaseDurationMs;
            animRef.current = {
                kind: "planned",
                plan: currentStep.renderPlan,
                startTime: now,
                totalDurationMs,
            };
            lastPlannedStepIndexRef.current = currentStepIndex ?? null;
        } else if (!framesEqual(startFrame, finalFrame)) {
            animRef.current = {
                kind: "simple",
                startFrame,
                endFrame: finalFrame,
                startTime: now,
                durationMs: ANIM_DURATION,
            };
        } else {
            animRef.current = null;
            settledFrameRef.current = finalFrame;
            return;
        }

        const tick = () => {
            const anim = animRef.current;
            if (!anim) return;
            const elapsed = performance.now() - anim.startTime;
            const done = anim.kind === "planned"
                ? elapsed >= anim.totalDurationMs
                : elapsed >= anim.durationMs;
            if (done) {
                if (anim.kind === "planned") {
                    carriedNodeUidsRef.current = new Set(anim.plan.carryNodeUids);
                    settledFrameRef.current = {
                        positions: layoutRecordToMap(anim.plan.endLayout),
                        edges: anim.plan.endEdges,
                    };
                } else {
                    settledFrameRef.current = finalFrame;
                }
                animRef.current = null;
                forceRender();
                return;
            }
            forceRender();
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(rafRef.current); };
    }, [currentStep, currentStepIndex, finalFrame]);

    // ── Zoom (wheel) ────────────────────────────────────────────────

    const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;

        const delta = e.deltaY * ZOOM_SENSITIVITY;
        const factor = 1 + delta;

        setViewBox((vb) => {
            const newW = Math.max(vb.w * MIN_ZOOM, Math.min(vb.w * MAX_ZOOM, vb.w * factor));
            const newH = Math.max(vb.h * MIN_ZOOM, Math.min(vb.h * MAX_ZOOM, vb.h * factor));
            const scaleX = newW / vb.w;
            const scaleY = newH / vb.h;
            return {
                x: vb.x + (1 - scaleX) * mx * vb.w,
                y: vb.y + (1 - scaleY) * my * vb.h,
                w: newW,
                h: newH,
            };
        });
        userTransformedRef.current = true;
    }, []);

    // ── Pan (drag) ──────────────────────────────────────────────────

    const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        dragStartRef.current = { mx: e.clientX, my: e.clientY, vbx: viewBox.x, vby: viewBox.y };
    }, [viewBox.x, viewBox.y]);

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDragging || !dragStartRef.current || !svgRef.current) return;
        const start = dragStartRef.current;
        const rect = svgRef.current.getBoundingClientRect();
        const dx = (e.clientX - start.mx) / rect.width * viewBox.w;
        const dy = (e.clientY - start.my) / rect.height * viewBox.h;
        setViewBox((vb) => ({
            ...vb,
            x: start.vbx - dx,
            y: start.vby - dy,
        }));
        userTransformedRef.current = true;
    }, [isDragging, viewBox.w, viewBox.h]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    // Release drag if mouse leaves the SVG
    const handleMouseLeave = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            dragStartRef.current = null;
        }
    }, [isDragging]);

    // ── Touch pan ───────────────────────────────────────────────────
    const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        setIsDragging(true);
        dragStartRef.current = { mx: touch.clientX, my: touch.clientY, vbx: viewBox.x, vby: viewBox.y };
    }, [viewBox.x, viewBox.y]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    // touchmove must be registered as non-passive so e.preventDefault() can
    // block the browser's scroll while the user is panning the canvas.
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onTouchMove = (e: TouchEvent) => {
            if (!dragStartRef.current || !svgRef.current || e.touches.length !== 1) return;
            e.preventDefault();
            const touch = e.touches[0];
            const start = dragStartRef.current;
            const rect = svgRef.current.getBoundingClientRect();
            const dx = (touch.clientX - start.mx) / rect.width * viewBox.w;
            const dy = (touch.clientY - start.my) / rect.height * viewBox.h;
            setViewBox((vb) => ({ ...vb, x: start.vbx - dx, y: start.vby - dy }));
            userTransformedRef.current = true;
        };
        svg.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => svg.removeEventListener('touchmove', onTouchMove);
    }, [viewBox.w, viewBox.h]);

    if (!tree || finalLayout.size === 0) {
        return (
            <div className="flex items-center justify-center h-full opacity-40 text-sm">
                No tree loaded. Use &quot;Run&quot; to build from the case array.
            </div>
        );
    }

    const visibleNodes = tree.allTrackedNodes();
    const display = sampleAnimDisplay(
        animRef.current,
        animRef.current?.kind === "simple" ? animRef.current.endFrame : finalFrame,
        performance.now(),
    );

    const containerClass = `rbt-svg-container${isDragging ? " dragging" : ""}`;

    return (
        <div className={containerClass}>
            <svg
                ref={svgRef}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: "100%", height: "100%" }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Edges */}
                {display.edges.map((edge) => (
                    <line
                        key={edge.key}
                        className="rbt-edge"
                        x1={edge.start.x}
                        y1={edge.start.y + NODE_RADIUS}
                        x2={edge.end.x}
                        y2={edge.end.y - NODE_RADIUS}
                        stroke="#64748b"
                    />
                ))}

                {/* Nodes */}
                {visibleNodes.map((node) => {
                    const pos = display.positions.get(node.uid);
                    if (!pos) return null;
                    const fill = nodeFill(node);
                    const ptrColor = pointerStrokeColor(node.pointerLabels);
                    const strokeColor = ptrColor ?? (node.color === RBColor.RED ? "#991b1b" : "#0f172a");
                    const strokeWidth = ptrColor ? 4 : 2;
                    const labels = [...node.pointerLabels];

                    return (
                        <g
                            key={node.uid}
                            className="rbt-node-group"
                            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                        >
                            <circle
                                className="rbt-node-circle"
                                r={NODE_RADIUS}
                                fill={fill}
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                            />
                            <text
                                className="rbt-node-text"
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="white"
                            >
                                {node.key}
                            </text>
                            {labels.map((label, i) => (
                                <text
                                    key={label}
                                    className="rbt-pointer-label"
                                    x={0}
                                    y={-NODE_RADIUS - 6 - i * 12}
                                    textAnchor="middle"
                                    fill={POINTER_COLORS[label] ?? "#38bdf8"}
                                >
                                    {label}
                                </text>
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
