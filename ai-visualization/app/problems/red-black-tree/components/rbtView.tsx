import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { RBColor, RBNode, RBTree } from "@/lib/rbt/rbtree";
import { computeLayout, NodePosition } from "@/lib/rbt/rbtLayout";
import { RBTStep } from "@/lib/rbt/rbtSolution";
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
const ORPHAN_OFFSET_X = -60;
const ORPHAN_OFFSET_Y = 70;
const OVERLAP_THRESHOLD = NODE_RADIUS * 2.5;

function orphanPosition(
    prev: NodePosition,
    reachableLayout: Map<RBNode, NodePosition>,
): NodePosition {
    for (const [, rPos] of reachableLayout) {
        if (Math.abs(rPos.x - prev.x) < OVERLAP_THRESHOLD &&
            Math.abs(rPos.y - prev.y) < OVERLAP_THRESHOLD) {
            return { x: prev.x + ORPHAN_OFFSET_X, y: prev.y + ORPHAN_OFFSET_Y };
        }
    }
    return { ...prev };
}

function easeOut(t: number): number {
    if (t >= 1) return 1;
    return 1 - Math.pow(1 - t, 3);
}

interface AnimState {
    startPositions: Map<number, NodePosition>;
    endPositions: Map<number, NodePosition>;
    oldEdgeParents: Map<number, number>;
    startTime: number;
}

interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

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

export default function RBTView({ tree, renderKey, currentStep, onFitRef }: RBTViewProps) {
    // Zoom/pan state
    const [viewBox, setViewBox] = useState<ViewBox>({ x: -200, y: -50, w: 400, h: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ mx: number; my: number; vbx: number; vby: number } | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const userTransformedRef = useRef(false);

    // ── Animation state ─────────────────────────────────────────────
    const prevLayoutByUid = useRef(new Map<number, NodePosition>());
    const prevEdgeParents = useRef(new Map<number, number>());
    const animRef = useRef<AnimState | null>(null);
    const rafRef = useRef(0);
    const [, forceRender] = useReducer((x: number) => x + 1, 0);

    const finalLayout = useMemo(() => {
        if (!tree || tree.root === tree.NIL) return new Map<RBNode, NodePosition>();
        return computeLayout(tree);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tree, renderKey]);

    const finalLayoutByUid = useMemo(() => {
        const map = new Map<number, NodePosition>();
        for (const [node, pos] of finalLayout) {
            map.set(node.uid, pos);
        }
        if (tree) {
            for (const node of tree.allTrackedNodes()) {
                if (!map.has(node.uid)) {
                    const prev = prevLayoutByUid.current.get(node.uid);
                    if (prev) map.set(node.uid, orphanPosition(prev, finalLayout));
                }
            }
        }
        return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finalLayout, renderKey]);

    const currentEdgeParents = useMemo(() => {
        const map = new Map<number, number>();
        if (!tree || tree.root === tree.NIL) return map;
        const allNodes = tree.allNodes();
        for (const n of allNodes) {
            if (n.left !== tree.NIL) map.set(n.left.uid, n.uid);
            if (n.right !== tree.NIL) map.set(n.right.uid, n.uid);
        }
        return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tree, renderKey]);

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
        const oldPositions = prevLayoutByUid.current;
        const oldEdgeParentMap = prevEdgeParents.current;

        const newPositions = new Map<number, NodePosition>();
        for (const [node, pos] of finalLayout) {
            newPositions.set(node.uid, { x: pos.x, y: pos.y });
        }
        if (tree) {
            for (const node of tree.allTrackedNodes()) {
                if (!newPositions.has(node.uid)) {
                    const prev = prevLayoutByUid.current.get(node.uid);
                    if (prev) newPositions.set(node.uid, orphanPosition(prev, finalLayout));
                }
            }
        }

        let startPositions: Map<number, NodePosition>;
        if (animRef.current) {
            const a = animRef.current;
            const elapsed = performance.now() - a.startTime;
            const t = easeOut(Math.min(elapsed / ANIM_DURATION, 1));
            startPositions = new Map<number, NodePosition>();
            const allUids = new Set([...a.startPositions.keys(), ...a.endPositions.keys()]);
            for (const uid of allUids) {
                const s = a.startPositions.get(uid);
                const e = a.endPositions.get(uid);
                if (s && e) {
                    startPositions.set(uid, {
                        x: s.x + (e.x - s.x) * t,
                        y: s.y + (e.y - s.y) * t,
                    });
                } else if (e) {
                    startPositions.set(uid, { ...e });
                } else if (s) {
                    startPositions.set(uid, { ...s });
                }
            }
            cancelAnimationFrame(rafRef.current);
        } else {
            startPositions = new Map(oldPositions);
        }

        if (startPositions.size > 0 && newPositions.size > 0) {
            animRef.current = {
                startPositions,
                endPositions: newPositions,
                oldEdgeParents: new Map(oldEdgeParentMap),
                startTime: performance.now(),
            };

            const tick = () => {
                const a = animRef.current;
                if (!a) return;
                const elapsed = performance.now() - a.startTime;
                if (elapsed >= ANIM_DURATION) {
                    animRef.current = null;
                    forceRender();
                    return;
                }
                forceRender();
                rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        }

        prevLayoutByUid.current = newPositions;
        prevEdgeParents.current = new Map(currentEdgeParents);

        return () => { cancelAnimationFrame(rafRef.current); };
    }, [finalLayout, currentEdgeParents]);

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
        const rect = svgRef.current.getBoundingClientRect();
        const dx = (e.clientX - dragStartRef.current.mx) / rect.width * viewBox.w;
        const dy = (e.clientY - dragStartRef.current.my) / rect.height * viewBox.h;
        setViewBox((vb) => ({
            ...vb,
            x: dragStartRef.current!.vbx - dx,
            y: dragStartRef.current!.vby - dy,
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

    if (!tree || finalLayout.size === 0) {
        return (
            <div className="flex items-center justify-center h-full opacity-40 text-sm">
                No tree loaded. Use &quot;Run&quot; to build from the case array.
            </div>
        );
    }

    const trackedNodes = tree.allTrackedNodes();
    const reachableNodes = tree.allNodes();

    // ── Interpolation helpers ────────────────────────────────────
    const anim = animRef.current;
    let animT = 1;
    if (anim) {
        const elapsed = performance.now() - anim.startTime;
        animT = easeOut(Math.min(elapsed / ANIM_DURATION, 1));
    }

    function getNodeAnimPos(uid: number): NodePosition | null {
        if (!anim || animT >= 1) return finalLayoutByUid.get(uid) ?? null;
        const start = anim.startPositions.get(uid);
        const end = anim.endPositions.get(uid);
        if (!start && !end) return null;
        if (!start) return end!;
        if (!end) return start;
        return {
            x: start.x + (end.x - start.x) * animT,
            y: start.y + (end.y - start.y) * animT,
        };
    }

    function getEdgeTopAnchor(childUid: number, newParentUid: number): NodePosition | null {
        if (!anim || animT >= 1) return finalLayoutByUid.get(newParentUid) ?? null;
        const oldParentUid = anim.oldEdgeParents.get(childUid);
        if (oldParentUid === undefined || oldParentUid === newParentUid) {
            return getNodeAnimPos(newParentUid);
        }
        const startPos = anim.startPositions.get(oldParentUid);
        const endPos = anim.endPositions.get(newParentUid);
        if (!startPos) return endPos ?? null;
        if (!endPos) return startPos;
        return {
            x: startPos.x + (endPos.x - startPos.x) * animT,
            y: startPos.y + (endPos.y - startPos.y) * animT,
        };
    }

    // ── Edge computation ─────────────────────────────────────────

    const edges: { parent: RBNode; child: RBNode; side: "left" | "right" }[] = [];
    for (const node of reachableNodes) {
        if (node.left !== tree.NIL) edges.push({ parent: node, child: node.left, side: "left" });
        if (node.right !== tree.NIL) edges.push({ parent: node, child: node.right, side: "right" });
    }

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
            >
                {/* Edges */}
                {edges.map((e) => {
                    const pPos = getEdgeTopAnchor(e.child.uid, e.parent.uid);
                    const cPos = getNodeAnimPos(e.child.uid);
                    if (!pPos || !cPos) return null;

                    return (
                        <line
                            key={e.child.uid}
                            className="rbt-edge"
                            x1={pPos.x}
                            y1={pPos.y + NODE_RADIUS}
                            x2={cPos.x}
                            y2={cPos.y - NODE_RADIUS}
                            stroke="#64748b"
                        />
                    );
                })}

                {/* Nodes */}
                {trackedNodes.map((node) => {
                    const pos = getNodeAnimPos(node.uid);
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
