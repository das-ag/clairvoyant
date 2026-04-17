"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VisGraph, { GraphData, Options as VisGraphOptions } from "react-vis-graph-wrapper";
import * as vis from "vis-network";
import { Font, NodeOptions } from "vis-network";
import { GenericGraph } from "@/lib/graphs/graph";
import { GraphNode } from "@/lib/graphs/components";
import { DijkstraStep } from "@/lib/dijkstra/dijkstraSolution";

// ── vis.js options ────────────────────────────────────────────────────────────

const FONT_COLOR = "#aaaadd";
const FONT_STROKE = "#000000";

const BASE_FONT: Font = {
    size: 13,
    color: FONT_COLOR,
    strokeWidth: 2,
    strokeColor: FONT_STROKE,
};

const EDGE_LABEL_FONT: Font = {
    size: 15,
    color: "#ffffff",
    strokeWidth: 0,
    background: "#1f2937",
    face: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const VIS_OPTIONS: VisGraphOptions = {
    edges: {
        font: EDGE_LABEL_FONT,
        color: { color: "#666688", highlight: "#ffffff" },
        smooth: { enabled: true, type: "dynamic", roundness: 0.4 },
        arrows: { to: { enabled: true, scaleFactor: 0.6 } },
    },
    nodes: {
        font: BASE_FONT,
        shape: "dot",
        size: 14,
    },
    physics: {
        barnesHut: {
            gravitationalConstant: -2000,
            springConstant: 0.006,
            springLength: 80,
            centralGravity: 0.4,
        },
    },
    height: "100%",
    interaction: {
        hover: true,
        dragNodes: true,
        zoomView: true,
        dragView: true,
    },
};

// ── Node / edge colour helpers ────────────────────────────────────────────────

function nodeColor(state: string | undefined, isExtracting: boolean): string {
    if (isExtracting) return "#f59e0b"; // amber — being extracted
    switch (state) {
        case "settled": return "#22c55e"; // green
        case "relaxed": return "#facc15"; // yellow
        default:        return "#64748b"; // slate — unvisited
    }
}

function nodeLabel(node: GraphNode): string {
    const distLabel: string | undefined = node.data["dist_label"];
    return distLabel !== undefined ? `${node.id}\n${distLabel}` : node.id;
}

function getNodeOptions(
    node: GraphNode,
    isSource: boolean,
    isExtracting: boolean,
): NodeOptions {
    const state: string = node.data["state"] ?? "";
    const bg = nodeColor(state, isExtracting);
    return {
        label: nodeLabel(node),
        color: {
            background: bg,
            border: isSource ? "#ffffff" : bg,
            highlight: { background: bg, border: "#ffffff" },
        },
        borderWidth: isSource ? 3 : 1,
        shape: isSource ? "diamond" : "dot",
        size: isSource ? 18 : 14,
        font: {
            ...BASE_FONT,
            color: state === "settled" || isExtracting ? "#000000" : FONT_COLOR,
            strokeColor: state === "settled" || isExtracting ? "#00000080" : FONT_STROKE,
        },
    };
}

function getEdgeOptions(
    edge: { id: number; source: GraphNode; target: GraphNode; weight: number; isBidirectional: boolean },
    isRelaxing: boolean,
): Record<string, any> {
    const minW = 1.5, maxW = 10;
    const width = Math.min(maxW, minW + Math.max(0, Math.log2(Math.abs(edge.weight) + 1)));
    return {
        color: isRelaxing ? "#f59e0b" : undefined, // amber when relaxing, default otherwise
        width: isRelaxing ? width + 1.5 : width,
        label: String(edge.weight),
        arrows: edge.isBidirectional ? "" : "to",
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DijkstraGraphViewProps {
    graph: GenericGraph | null;
    renderKey: number;
    currentStep?: DijkstraStep;
    onFitRef?: React.MutableRefObject<(() => void) | null>;
}

export default function DijkstraGraphView({
    graph,
    renderKey,
    currentStep,
    onFitRef,
}: DijkstraGraphViewProps) {
    const [visData, setVisData] = useState<GraphData>({ nodes: [], edges: [] });
    const networkRef = useRef<vis.Network | null>(null);

    const rebuildVisData = useCallback(() => {
        if (!graph) { setVisData({ nodes: [], edges: [] }); return; }

        const sourceId = graph.startNode?.id;
        const extractingId = currentStep?.extractingNodeId;
        const relaxingEdge = currentStep?.relaxingEdge;

        const nodes = graph.getAllNodes().map((node) => {
            const isSource = node.id === sourceId;
            const isExtracting = node.id === extractingId;
            return {
                id: node.id,
                ...getNodeOptions(node, isSource, isExtracting),
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
                ...getEdgeOptions(edge, isRelaxing),
            };
        });

        setVisData({ nodes, edges });
    }, [graph, currentStep]);

    useEffect(() => {
        rebuildVisData();
    }, [rebuildVisData, renderKey]);

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
                options={VIS_OPTIONS}
                getNetwork={(network: vis.Network) => {
                    networkRef.current = network;
                    if (onFitRef) {
                        onFitRef.current = () => {
                            network.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
                        };
                    }
                }}
            />
        </div>
    );
}
