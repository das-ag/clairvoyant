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
    /**
     * Target node-to-node distance in logical px; if provided, overrides
     * linkDistance directly. Default unset.
     */
    spacing?: number;
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
    const linkDistance = opts.spacing ?? opts.linkDistance ?? 260;
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
 * Compute several candidate layouts with different seeds and return the one
 * with the fewest edge crossings (tie-broken by maximum minimum pairwise
 * node distance). Each `seedBatch` click advances to a new slice of seeds,
 * so "Re-layout" reliably finds a *different* best-of-N layout instead of
 * cycling through the same deterministic ones.
 *
 * Cost is `numCandidates × computeWebcolaLayout`, i.e. ~8 × ≤10ms = ~80ms
 * on graphs with V ≤ 20. Called once per layout change, never per step.
 */
export function computeBestLayout(
    graph: GenericGraph,
    opts: LayoutOptions & {
        numCandidates?: number;
        seedBatch?: number;
    } = {},
): Map<string, { x: number; y: number }> {
    const numCandidates = opts.numCandidates ?? 8;
    const seedBatch = opts.seedBatch ?? 0;

    let best: Map<string, { x: number; y: number }> | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < numCandidates; i++) {
        const jitterSeed = seedBatch * numCandidates + i + 1;
        const positions = computeWebcolaLayout(graph, { ...opts, jitterSeed });
        const score = scoreLayout(graph, positions);
        if (score < bestScore) {
            bestScore = score;
            best = positions;
        }
    }
    return best ?? new Map();
}

/**
 * Lower is better. Edge crossings dominate (the user's primary complaint);
 * minimum pairwise node distance is the tiebreaker so when several
 * candidates tie on crossings we pick the most spread-out.
 */
function scoreLayout(
    graph: GenericGraph,
    positions: Map<string, { x: number; y: number }>,
): number {
    const crossings = countEdgeCrossings(graph, positions);
    const minDist = minPairwiseDistance(positions);
    return crossings * 1_000_000 - minDist;
}

function countEdgeCrossings(
    graph: GenericGraph,
    positions: Map<string, { x: number; y: number }>,
): number {
    const edges = graph.getAllEdges().map(e => ({
        from: e.source.id,
        to: e.target.id,
        p1: positions.get(e.source.id),
        p2: positions.get(e.target.id),
    })).filter(e => e.p1 && e.p2);

    let crossings = 0;
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const a = edges[i];
            const b = edges[j];
            // Skip pairs that share an endpoint — they meet at a node, not
            // a crossing.
            if (a.from === b.from || a.from === b.to ||
                a.to === b.from || a.to === b.to) continue;
            if (segmentsIntersect(a.p1!, a.p2!, b.p1!, b.p2!)) {
                crossings++;
            }
        }
    }
    return crossings;
}

function minPairwiseDistance(
    positions: Map<string, { x: number; y: number }>,
): number {
    const coords = [...positions.values()];
    let min = Infinity;
    for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
            const dx = coords[i].x - coords[j].x;
            const dy = coords[i].y - coords[j].y;
            const d = Math.hypot(dx, dy);
            if (d < min) min = d;
        }
    }
    return min === Infinity ? 0 : min;
}

type Pt = { x: number; y: number };

function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return false;
}

function direction(a: Pt, b: Pt, c: Pt): number {
    return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
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
