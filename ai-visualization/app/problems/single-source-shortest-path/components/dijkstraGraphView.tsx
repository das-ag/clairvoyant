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
): NodeOptions {
    const state: string = node.data["state"] ?? "";
    const bg = nodeColor(state, isExtracting);
    const border = isExploring ? EXPLORING_BORDER : "#0b1220";
    const borderWidth = isExploring ? 5 : 2;
    return {
        label: nodeLabel(node),
        color: {
            background: bg,
            border,
            highlight: { background: bg, border: isExploring ? EXPLORING_BORDER : "#ffffff" },
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
}: DijkstraGraphViewProps) {
    const [visData, setVisData] = useState<GraphData>({ nodes: [], edges: [] });
    const [positions, setPositions] = useState<LayoutPositions>(new Map());
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const networkRef = useRef<vis.Network | null>(null);

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
            const pos = positions.get(node.id);
            if (isSource) {
                const state: string = node.data["state"] ?? "";
                const fill = nodeColor(state, isExtracting);
                const stroke = isExploring ? EXPLORING_BORDER : "#ffffff";
                return { ...makeSourceNode(node.id, fill, stroke), x: pos?.x, y: pos?.y };
            }
            return {
                id: node.id,
                x: pos?.x,
                y: pos?.y,
                ...getNodeOptions(node, isExtracting, isExploring),
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
                ...getEdgeOptions(edge, isRelaxing, selectedNodeId),
            };
        });

        setVisData({ nodes, edges });
    }, [graph, currentStep, positions, selectedNodeId]);

    useEffect(() => {
        rebuildVisData();
    }, [rebuildVisData, renderKey]);

    // Fit the viewport whenever the layout itself changes (new graph or a
    // fresh webcola seed). Using a one-shot "afterDrawing" listener
    // guarantees fit runs only after vis-network has drawn the new node
    // coordinates — a rAF callback races the data commit and fits the old
    // positions, leaving the graph off-screen.
    useEffect(() => {
        const net = networkRef.current;
        if (!net) return;
        const onFit = () => net.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
        net.once("afterDrawing", onFit);
        return () => { net.off("afterDrawing", onFit); };
    }, [positions]);

    // Expose fit function through the ref
    useEffect(() => {
        if (onFitRef) {
            onFitRef.current = () => {
                networkRef.current?.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
            };
        }
    }, [onFitRef]);

    return (
        <div className="w-full h-full">
            <VisGraph
                style={{ height: "100%", width: "100%" }}
                graph={visData}
                options={visOptions}
                getNetwork={(network: vis.Network) => {
                    networkRef.current = network;
                    // Fit once the very first paint lands — the effect
                    // below handles subsequent layout changes.
                    network.once("afterDrawing", () => {
                        network.fit({ animation: false });
                    });
                    if (onFitRef) {
                        onFitRef.current = () => {
                            network.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
                        };
                    }
                    // Toggle direction-aware glow on click; clicking the
                    // already-selected node (or empty canvas) clears it.
                    network.on("click", (params: { nodes: string[] }) => {
                        const clicked = params.nodes[0] ?? null;
                        setSelectedNodeId(prev => (clicked && clicked !== prev ? clicked : null));
                        network.unselectAll();
                    });
                }}
            />
        </div>
    );
}
