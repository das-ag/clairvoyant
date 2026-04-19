import { GenericGraph } from "../graph";
import { computeBestLayout, LayoutOptions } from "../webcolaLayout";
import { computeAvsdfLayout } from "./avsdfLayout";
import { computeElkLayout } from "./elkLayout";

export type LayoutKind = "cola" | "avsdf" | "elk";
export type LayoutPositions = Map<string, { x: number; y: number }>;

export interface ComputeLayoutOptions extends LayoutOptions {
    /** Cycle through alternate Cola seeds; ignored by deterministic layouts. */
    seedBatch?: number;
    /**
     * Target distance (in logical px) between adjacent/linked nodes. Feeds
     * directly into Cola's linkDistance, AVSDF's nodeSeparation, and ELK's
     * nodeNode spacing (layer spacing scales at 1.5x). Default 260.
     */
    spacing?: number;
}

/**
 * Dispatch layout computation by kind. All layouts return positions in the
 * same logical coordinate space so vis-network's auto-fit handles them
 * uniformly. Async because ELK's solver runs through a worker-style promise
 * API even when invoked on the main thread.
 */
export async function computeLayout(
    graph: GenericGraph,
    kind: LayoutKind,
    opts: ComputeLayoutOptions = {},
): Promise<LayoutPositions> {
    switch (kind) {
        case "cola":
            return computeBestLayout(graph, opts);
        case "avsdf":
            return computeAvsdfLayout(graph, opts);
        case "elk":
            return computeElkLayout(graph, opts);
    }
}

export const LAYOUT_OPTIONS: { value: LayoutKind; label: string }[] = [
    { value: "cola", label: "Cola (best-of-N)" },
    { value: "avsdf", label: "AVSDF (circular)" },
    { value: "elk", label: "ELK (layered)" },
];
