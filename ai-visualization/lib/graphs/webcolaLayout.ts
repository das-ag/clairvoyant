import { Layout } from "webcola";
import { GenericGraph } from "./graph";

export interface LayoutOptions {
    /** Logical canvas width; default 1400. vis-network re-fits to viewport. */
    width?: number;
    /** Logical canvas height; default 1400. */
    height?: number;
    /** Preferred distance between linked nodes; default 260. */
    linkDistance?: number;
    /**
     * Bounding-box size webcola should treat each node as occupying for
     * overlap avoidance. Must be ≥ the rendered diameter — without this,
     * webcola treats nodes as points and packs them until the rendered
     * shapes collide. Default 180 matches our largest node (the 120px
     * source diamond) plus generous breathing room.
     */
    nodeSize?: number;
    /**
     * Seed for the initial-position PRNG. webcola's solver is largely
     * deterministic given fixed inputs — varying the jitter seed is what
     * produces alternate layouts for the "Re-layout" button.
     */
    jitterSeed?: number;
    /**
     * [unconstrained, userConstraint, overlap] iterations passed to
     * Layout.start. Defaults to [30, 20, 20] — sub-20ms on ≤20-node graphs.
     */
    iterations?: [number, number, number];
}

/**
 * Compute node positions for a GenericGraph via webcola's constraint-based
 * stress-majorization solver. Returns a map of node id → (x, y) in the
 * logical coordinate space defined by `width`/`height`.
 *
 * Pure function — no side effects on `graph`. Cheap enough (<20ms at V≤20)
 * to call synchronously from a React render via useMemo.
 */
export function computeWebcolaLayout(
    graph: GenericGraph,
    opts: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
    const width = opts.width ?? 1400;
    const height = opts.height ?? 1400;
    const linkDistance = opts.linkDistance ?? 260;
    const nodeSize = opts.nodeSize ?? 180;
    const iters = opts.iterations ?? [30, 20, 20];

    const allNodes = graph.getAllNodes();
    if (allNodes.length === 0) return new Map();

    const idxById = new Map<string, number>(
        allNodes.map((n, i) => [n.id, i]),
    );

    // Spread initial positions across the canvas rather than clustering
    // around the centre — webcola's solver converges to cleaner layouts
    // when the starting configuration already approximates a spread.
    const rand = mulberry32(opts.jitterSeed ?? 1);
    const nodes = allNodes.map(() => ({
        x: rand() * width,
        y: rand() * height,
        // width/height are the overlap-avoidance footprint. Giving each
        // node a size ≥ the rendered diameter prevents webcola from
        // packing them until the canvas paints a crushed layout.
        width: nodeSize,
        height: nodeSize,
    }));

    const links = graph.getAllEdges()
        .map(e => {
            const s = idxById.get(e.source.id);
            const t = idxById.get(e.target.id);
            if (s === undefined || t === undefined) return null;
            return { source: s, target: t };
        })
        .filter((l): l is { source: number; target: number } => l !== null);

    new Layout()
        .nodes(nodes as any)
        .links(links as any)
        .avoidOverlaps(true)
        .size([width, height])
        .linkDistance(linkDistance)
        .start(iters[0], iters[1], iters[2]);

    const out = new Map<string, { x: number; y: number }>();
    allNodes.forEach((n, i) => {
        const { x, y } = nodes[i];
        out.set(n.id, { x, y });
    });
    return out;
}

/**
 * Small, fast, seeded PRNG — good enough for perturbing initial positions
 * so the re-layout button can produce reproducible alternate layouts.
 */
function mulberry32(seed: number): () => number {
    let t = seed | 0;
    return () => {
        t = (t + 0x6D2B79F5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
