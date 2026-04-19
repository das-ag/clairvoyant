"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VisGraph, { GraphData, Options as VisGraphOptions } from "react-vis-graph-wrapper";
import * as vis from "vis-network";
import { Font, NodeOptions } from "vis-network";
import { GenericGraph } from "@/lib/graphs/graph";
import { GraphNode } from "@/lib/graphs/components";
import { computeLayout, LayoutKind, LayoutPositions } from "@/lib/graphs/layouts";
import { DijkstraStep } from "@/lib/dijkstra/dijkstraSolution";

// ── vis.js options ────────────────────────────────────────────────────────────

const NODE_FONT_COLOR = "#0b0b0b";
const NODE_MIN_WIDTH = 54;
const NODE_MIN_HEIGHT = 54;
const SOURCE_DIAMOND_WIDTH = 120;
const SOURCE_DIAMOND_HEIGHT = 120;

const BASE_FONT: Font = {
    size: 18,
    color: NODE_FONT_COLOR,
    strokeWidth: 0,
    face: "ui-sans-serif, system-ui, -apple-system, sans-serif",
};

const EDGE_LABEL_FONT: Font = {
    size: 22,
    color: "#ffffff",
    strokeWidth: 0,
    background: "#1f2937",
    face: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

function buildVisOptions(physicsEnabled: boolean): VisGraphOptions {
    return {
        edges: {
            font: EDGE_LABEL_FONT,
            color: { color: "#94a3b8", highlight: "#ffffff" },
            smooth: { enabled: true, type: "curvedCW", roundness: 0.2 },
            arrows: { to: { enabled: true, scaleFactor: 0.6 } },
        },
        nodes: {
            font: BASE_FONT,
            shape: "circle",
            widthConstraint: { minimum: NODE_MIN_WIDTH },
            heightConstraint: { minimum: NODE_MIN_HEIGHT, valign: "middle" },
            margin: { top: 8, right: 12, bottom: 8, left: 12 },
        } as any,
        // When physics is off the layout positions (set as x/y on each node)
        // are authoritative. When on, vis-network relaxes from those positions
        // — dragging a node propagates through edges via spring forces.
        //
        // barnesHut with strong centralGravity + capped maxVelocity keeps the
        // system bounded; forceAtlas2Based with avoidOverlap lets our 120px
        // source diamond fling neighbors out faster than springs can pull back.
        physics: physicsEnabled
            ? {
                enabled: true,
                solver: "barnesHut",
                barnesHut: {
                    gravitationalConstant: -8000,
                    centralGravity: 0.3,
                    springLength: 200,
                    springConstant: 0.04,
                    damping: 0.6,
                    avoidOverlap: 0.2,
                },
                maxVelocity: 40,
                minVelocity: 0.75,
                timestep: 0.35,
                stabilization: { enabled: true, iterations: 200, fit: false },
            }
            : { enabled: false },
        height: "100%",
        interaction: {
            hover: true,
            dragNodes: true,
            zoomView: true,
            dragView: true,
        },
    };
}

// ── Node / edge colour helpers ────────────────────────────────────────────────

// Palette picked from Wong's 8-class colorblind-safe set so that the four
// node states remain pairwise distinguishable under deuteranopia/protanopia
// and so none of them collide with the source's thick white border ring.
function nodeColor(state: string | undefined, isExtracting: boolean): string {
    if (isExtracting) return "#D55E00"; // vermilion — being extracted
    switch (state) {
        case "settled": return "#009E73"; // teal-green
        case "relaxed": return "#F0E442"; // pure yellow
        default:        return "#56B4E9"; // sky blue — unvisited
    }
}

function nodeLabel(node: GraphNode): string {
    const distLabel: string | undefined = node.data["dist_label"];
    return distLabel !== undefined ? `${node.id}\n${distLabel}` : node.id;
}

const EXPLORING_BORDER = "#22d3ee"; // cyan-400 — distinct from source white and every fill
const SELECTED_BORDER = "#EC4899"; // pink-500 — user-selected node; chosen to
                                   // avoid clash with fills, cyan exploring,
                                   // white source, and red/green edge glows.

// Direction-aware glow for adjacent edges when a node is selected. Rendered as
// vis-network edge shadows so the base line color stays intact. Saturated pure
// red/green — nudged away from the vermilion extracting/relaxing color
// (#D55E00) and the teal settled-node color (#009E73) to avoid collisions.
const INCOMING_EDGE_GLOW = "#16A34A"; // green-600 — "into this node"
const OUTGOING_EDGE_GLOW = "#DC2626"; // red-600 — "out of this node"

/**
 * Render the source vertex as a true diamond (rotated square) with the id,
 * the fixed distance 0, and "(Start)" stacked inside. vis-network's built-in
 * "diamond" shape positions the label outside the node, so we drop down to
 * a custom ctxRenderer and own the canvas drawing.
 */
function makeSourceNode(
    id: string,
    fill: string,
    strokeColor: string,
): any {
    const lines = [id, "0", "(Start)"];
    const width = SOURCE_DIAMOND_WIDTH;
    const height = SOURCE_DIAMOND_HEIGHT;
    const face = (BASE_FONT as any).face ?? "sans-serif";
    return {
        id,
        shape: "custom",
        label: undefined,
        ctxRenderer: ({ ctx, x, y }: { ctx: CanvasRenderingContext2D; x: number; y: number }) => ({
            drawNode() {
                const hw = width / 2;
                const hh = height / 2;
                ctx.save();
                // Rhombus path
                ctx.beginPath();
                ctx.moveTo(x, y - hh);
                ctx.lineTo(x + hw, y);
                ctx.lineTo(x, y + hh);
                ctx.lineTo(x - hw, y);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                ctx.lineWidth = 5;
                ctx.strokeStyle = strokeColor;
                ctx.stroke();

                // Three stacked label lines. Keep the id and 0 at the same
                // size as non-source nodes; shrink "(Start)" so it fits the
                // narrowing bottom half of the diamond.
                ctx.fillStyle = NODE_FONT_COLOR;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const lineH = 22;
                const startY = y - lineH;
                for (let i = 0; i < lines.length; i++) {
                    ctx.font = i === 2
                        ? `500 13px ${face}`
                        : `600 18px ${face}`;
                    ctx.fillText(lines[i], x, startY + i * lineH);
                }
                ctx.restore();
            },
            nodeDimensions: { width, height },
        }),
    };
}

function getNodeOptions(
    node: GraphNode,
    isExtracting: boolean,
    isExploring: boolean,
    isSelected: boolean,
): NodeOptions {
    const state: string = node.data["state"] ?? "";
    const bg = nodeColor(state, isExtracting);
    // Selection wins over exploring as the user-driven signal — the
    // exploring border is a step-driven hint; the pink ring answers
    // "this is what I clicked."
    const border = isSelected ? SELECTED_BORDER : isExploring ? EXPLORING_BORDER : "#0b1220";
    const borderWidth = isSelected || isExploring ? 5 : 2;
    return {
        label: nodeLabel(node),
        color: {
            background: bg,
            border,
            highlight: { background: bg, border: isSelected ? SELECTED_BORDER : isExploring ? EXPLORING_BORDER : "#ffffff" },
        },
        borderWidth,
        shape: "circle",
        widthConstraint: { minimum: NODE_MIN_WIDTH },
        heightConstraint: {
            minimum: NODE_MIN_HEIGHT,
            valign: "middle",
        },
    } as NodeOptions;
}

function getEdgeOptions(
    edge: { id: string | number; source: GraphNode; target: GraphNode; weight: number; isBidirectional: boolean },
    isRelaxing: boolean,
    selectedNodeId: string | null,
): Record<string, any> {
    const minW = 1.5, maxW = 10;
    const width = Math.min(maxW, minW + Math.max(0, Math.log2(Math.abs(edge.weight) + 1)));
    const isIncoming = selectedNodeId !== null && edge.target.id === selectedNodeId;
    const isOutgoing = selectedNodeId !== null && edge.source.id === selectedNodeId;
    const glowColor = isIncoming ? INCOMING_EDGE_GLOW : isOutgoing ? OUTGOING_EDGE_GLOW : null;
    return {
        color: isRelaxing
            ? { color: "#D55E00", highlight: "#D55E00" }
            : undefined,
        width: isRelaxing ? Math.max(width + 3, 5) : width,
        label: String(edge.weight),
        font: isRelaxing
            ? { ...EDGE_LABEL_FONT, background: "#D55E00" }
            : EDGE_LABEL_FONT,
        arrows: edge.isBidirectional ? "" : "to",
        shadow: glowColor
            ? { enabled: true, color: glowColor, size: 14, x: 0, y: 0 }
            : { enabled: false },
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DijkstraGraphViewProps {
    graph: GenericGraph | null;
    renderKey: number;
    currentStep?: DijkstraStep;
    onFitRef?: React.MutableRefObject<(() => void) | null>;
    /**
     * Bumping this seed re-runs the layout. For Cola this advances the
     * best-of-N seed batch; for AVSDF/ELK (deterministic) it just recomputes.
     */
    layoutSeed?: number;
    /** Which layout algorithm to use to seed positions. */
    layoutKind?: LayoutKind;
    /**
     * When true, vis-network physics relaxes from the seeded positions, so
     * dragging a node propagates through the spring network. When false,
     * nodes stay fixed where the layout placed them.
     */
    physicsEnabled?: boolean;
    /** Multiplier on the chosen layout's natural spacing. Default 1. */
    layoutSpacing?: number;
    /** Node currently selected across the SSSP UI (graph, PQ, vertex panel). */
    selectedNodeId?: string | null;
    /** Emit the new selection; null clears. Toggling is the parent's job. */
    onSelectedNodeChange?: (id: string | null) => void;
    /**
     * Transient hover from any linked panel. Drives the edge-direction glow
     * (hover overrides selection for glow, but selection still owns the
     * pink node border).
     */
    hoveredNodeId?: string | null;
    onHoveredNodeChange?: (id: string | null) => void;
    /**
     * Pixel insets that fit() should treat as reserved (e.g. floating UI
     * panels sitting on top of the canvas). The canvas itself still fills
     * the full container so nodes can be drawn everywhere — only the
     * initial centering/zoom avoids these regions.
     */
    fitInsets?: { top?: number; right?: number; bottom?: number; left?: number };
}

export default function DijkstraGraphView({
    graph,
    renderKey,
    currentStep,
    onFitRef,
    layoutSeed,
    layoutKind = "cola",
    physicsEnabled = false,
    layoutSpacing = 1,
    selectedNodeId = null,
    onSelectedNodeChange,
    hoveredNodeId = null,
    onHoveredNodeChange,
    fitInsets,
}: DijkstraGraphViewProps) {
    const [visData, setVisData] = useState<GraphData>({ nodes: [], edges: [] });
    const [positions, setPositions] = useState<LayoutPositions>(new Map());
    const networkRef = useRef<vis.Network | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const fitInsetsRef = useRef(fitInsets);
    fitInsetsRef.current = fitInsets;
    // getNetwork() fires once; refs keep the click handler reading the
    // latest selectedNodeId / change callback without re-subscribing.
    const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
    selectedNodeIdRef.current = selectedNodeId;
    const onSelectedNodeChangeRef = useRef(onSelectedNodeChange);
    onSelectedNodeChangeRef.current = onSelectedNodeChange;
    const onHoveredNodeChangeRef = useRef(onHoveredNodeChange);
    onHoveredNodeChangeRef.current = onHoveredNodeChange;

    // Hover wins over selection for the directional edge glow — when the
    // user hovers another node we want to preview its neighbors without
    // forgetting the committed selection's pink border.
    const glowSourceId = hoveredNodeId ?? selectedNodeId;

    const visOptions = useMemo(() => buildVisOptions(physicsEnabled), [physicsEnabled]);

    useEffect(() => {
        if (!graph) {
            setPositions(new Map());
            return;
        }
        let cancelled = false;
        const seedBatch = Math.max(0, (layoutSeed ?? 1) - 1);
        computeLayout(graph, layoutKind, { seedBatch, spacing: layoutSpacing }).then(p => {
            if (!cancelled) setPositions(p);
        });
        return () => { cancelled = true; };
    }, [graph, layoutKind, layoutSeed, layoutSpacing]);

    const rebuildVisData = useCallback(() => {
        if (!graph) { setVisData({ nodes: [], edges: [] }); return; }

        const sourceId = graph.startNode?.id;
        const extractingId = currentStep?.extractingNodeId;
        const exploringId = currentStep?.exploringNodeId;
        const relaxingEdge = currentStep?.relaxingEdge;

        const nodes = graph.getAllNodes().map((node) => {
            const isSource = node.id === sourceId;
            const isExtracting = node.id === extractingId;
            const isExploring = node.id === exploringId;
            const isSelected = node.id === selectedNodeId;
            const pos = positions.get(node.id);
            if (isSource) {
                const state: string = node.data["state"] ?? "";
                const fill = nodeColor(state, isExtracting);
                const stroke = isSelected ? SELECTED_BORDER : isExploring ? EXPLORING_BORDER : "#ffffff";
                return { ...makeSourceNode(node.id, fill, stroke), x: pos?.x, y: pos?.y };
            }
            return {
                id: node.id,
                x: pos?.x,
                y: pos?.y,
                ...getNodeOptions(node, isExtracting, isExploring, isSelected),
            };
        });

        const edges = graph.getAllEdges().map((edge) => {
            const isRelaxing =
                relaxingEdge?.fromId === edge.source.id &&
                relaxingEdge?.toId === edge.target.id;
            return {
                id: edge.id,
                from: edge.source.id,
                to: edge.target.id,
                ...getEdgeOptions(edge, isRelaxing, glowSourceId),
            };
        });

        setVisData({ nodes, edges });
    }, [graph, currentStep, positions, selectedNodeId, glowSourceId]);

    useEffect(() => {
        rebuildVisData();
    }, [rebuildVisData, renderKey]);

    // Fit that respects the inset regions reserved for floating UI (right
    // rail, bottom-left stepper). The canvas itself fills the container so
    // drags/hovers work anywhere; we just shift the camera + shrink the
    // scale so default centering lands in the visible "clear" rectangle.
    const fitWithInsets = useCallback((animate: boolean) => {
        const net = networkRef.current;
        const vp = viewportRef.current;
        if (!net || !vp) return;
        // Prefer the React-owned layout positions over net.getPositions() —
        // when switching cases, vis-network can still hold stale positions
        // from the previous graph for a frame, which shifts the fit bbox
        // off-screen.
        const layoutIds = Array.from(positions.keys());
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (layoutIds.length > 0) {
            for (const id of layoutIds) {
                const p = positions.get(id)!;
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
        } else {
            const positionsById = net.getPositions();
            const ids = Object.keys(positionsById);
            if (ids.length === 0) return;
            for (const id of ids) {
                const p = positionsById[id];
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
        }
        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);
        const bboxCx = (minX + maxX) / 2;
        const bboxCy = (minY + maxY) / 2;

        const insets = fitInsetsRef.current ?? {};
        const top = insets.top ?? 0, right = insets.right ?? 0;
        const bottom = insets.bottom ?? 0, left = insets.left ?? 0;

        const canvasW = vp.clientWidth;
        const canvasH = vp.clientHeight;
        const clearW = Math.max(50, canvasW - left - right);
        const clearH = Math.max(50, canvasH - top - bottom);

        // Only consume 80% of the clear region so nodes (up to 120 px for
        // the source diamond) have breathing room on every side, and cap
        // the zoom at 1× so tiny graphs don't balloon to fill the viewport.
        const USABLE = 0.8;
        const rawScale = Math.min(
            (clearW * USABLE) / bboxW,
            (clearH * USABLE) / bboxH,
        );
        const scale = Math.min(1, rawScale);

        // Offset in DOM pixels from the canvas center to the clear-region
        // center. vis-network applies this after scaling, so the bbox center
        // lands at the center of the clear rectangle.
        const offsetX = (left - right) / 2;
        const offsetY = (top - bottom) / 2;

        net.moveTo({
            position: { x: bboxCx, y: bboxCy },
            scale: Math.max(0.05, scale),
            offset: { x: offsetX, y: offsetY },
            animation: animate ? { duration: 300, easingFunction: "easeInOutQuad" } : false,
        } as any);
    }, [positions]);

    // Re-fit whenever the layout itself changes (new graph or fresh webcola
    // seed). One-shot afterDrawing guarantees we read the committed node
    // coordinates, not the previous frame's.
    useEffect(() => {
        const net = networkRef.current;
        if (!net) return;
        const onFit = () => fitWithInsets(true);
        net.once("afterDrawing", onFit);
        return () => { net.off("afterDrawing", onFit); };
    }, [positions, fitWithInsets]);

    // Expose fit function through the ref
    useEffect(() => {
        if (onFitRef) {
            onFitRef.current = () => fitWithInsets(true);
        }
    }, [onFitRef, fitWithInsets]);

    return (
        <div ref={viewportRef} className="w-full h-full">
            <VisGraph
                style={{ height: "100%", width: "100%" }}
                graph={visData}
                options={visOptions}
                getNetwork={(network: vis.Network) => {
                    networkRef.current = network;
                    // Fit once the very first paint lands — the effect
                    // below handles subsequent layout changes.
                    network.once("afterDrawing", () => {
                        fitWithInsets(false);
                    });
                    // Toggle direction-aware glow on click; clicking the
                    // already-selected node (or empty canvas) clears it.
                    // Parent owns the state so the PQ and Vertex panels
                    // stay in sync.
                    network.on("click", (params: { nodes: string[] }) => {
                        const clicked = params.nodes[0] ?? null;
                        const prev = selectedNodeIdRef.current;
                        onSelectedNodeChangeRef.current?.(clicked && clicked !== prev ? clicked : null);
                        network.unselectAll();
                    });
                    // Preview edge direction on hover. Mirrors the same
                    // shared hover channel the PQ and Vertex panels emit.
                    network.on("hoverNode", (params: { node: string }) => {
                        onHoveredNodeChangeRef.current?.(params.node);
                    });
                    network.on("blurNode", () => {
                        onHoveredNodeChangeRef.current?.(null);
                    });
                }}
            />
        </div>
    );
}
