import ELK from "elkjs/lib/elk.bundled.js";
import { GenericGraph } from "../graph";
import { LayoutOptions } from "../webcolaLayout";

const elk = new ELK();

/**
 * ELK's "layered" algorithm — Sugiyama-style hierarchical placement, ideal
 * for DAGs / mostly-DAG graphs. Deterministic; seedBatch is ignored.
 *
 * ELK reports positions as the top-left of each node's bounding box; we
 * shift to centers because vis-network's `x`/`y` refer to centers. Falls
 * back to an empty map if ELK rejects the input (e.g. malformed graph).
 */
export async function computeElkLayout(
    graph: GenericGraph,
    opts: LayoutOptions = {},
): Promise<Map<string, { x: number; y: number }>> {
    const nodeSize = opts.nodeSize ?? 180;
    const spacing = opts.spacing ?? 260;

    const allNodes = graph.getAllNodes();
    if (allNodes.length === 0) return new Map();

    const elkGraph = {
        id: "root",
        layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "RIGHT",
            // Feed the shared spacing target directly; layers get 1.5x extra
            // so hierarchical depth still reads as wider than sibling gaps.
            "elk.spacing.nodeNode": String(spacing),
            "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing * 1.5),
        },
        children: allNodes.map(n => ({
            id: n.id,
            width: nodeSize,
            height: nodeSize,
        })),
        edges: graph.getAllEdges().map(e => ({
            id: String(e.id),
            sources: [e.source.id],
            targets: [e.target.id],
        })),
    };

    try {
        const result = await elk.layout(elkGraph as any);
        const out = new Map<string, { x: number; y: number }>();
        for (const child of result.children ?? []) {
            const x = (child.x ?? 0) + (child.width ?? nodeSize) / 2;
            const y = (child.y ?? 0) + (child.height ?? nodeSize) / 2;
            out.set(child.id!, { x, y });
        }
        return out;
    } catch {
        return new Map();
    }
}
