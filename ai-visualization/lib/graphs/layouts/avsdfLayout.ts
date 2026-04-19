import cytoscape from "cytoscape";
// @ts-expect-error — cytoscape-avsdf has no TS types
import avsdf from "cytoscape-avsdf";
import { GenericGraph } from "../graph";
import { LayoutOptions } from "../webcolaLayout";

let registered = false;
function ensureRegistered() {
    if (registered) return;
    cytoscape.use(avsdf);
    registered = true;
}

/**
 * AVSDF (Adjacent Vertices Defined Spreading Force) places nodes on
 * concentric circles. Useful for graphs with strong cyclical structure;
 * deterministic, so seedBatch is ignored.
 *
 * Implemented by spinning up a headless cytoscape instance, running its
 * layout extension, then extracting positions and tearing down. Returns
 * positions in the same logical coordinate space as the Cola layout so
 * vis-network's auto-fit handles them uniformly.
 */
export function computeAvsdfLayout(
    graph: GenericGraph,
    opts: LayoutOptions = {},
): Promise<Map<string, { x: number; y: number }>> {
    ensureRegistered();
    const nodeSize = opts.nodeSize ?? 180;
    // Default spacing lines up with Cola's default linkDistance so all three
    // layouts respond to the same Options slider on the same scale.
    const spacing = opts.spacing ?? 260;

    const allNodes = graph.getAllNodes();
    if (allNodes.length === 0) return Promise.resolve(new Map());

    // AVSDF sizes the ring from each node's cytoscape width/height. Without
    // styleEnabled it assumes the 30px default, which clumps large rendered
    // nodes (54–120 px) on top of each other. Enable styling and declare
    // widths that match the vis-network render footprint so rings space out
    // proportionally to what the user actually sees.
    const cy = cytoscape({
        headless: true,
        styleEnabled: true,
        style: [
            {
                selector: "node",
                style: { width: nodeSize, height: nodeSize },
            },
        ],
        elements: [
            ...allNodes.map(n => ({ data: { id: n.id } })),
            ...graph.getAllEdges().map(e => ({
                data: { id: String(e.id), source: e.source.id, target: e.target.id },
            })),
        ],
    });

    return new Promise(resolve => {
        const layout = cy.layout({
            name: "avsdf",
            // nodeSeparation is the gap between adjacent nodes on the ring;
            // feeding the global "spacing" target straight in lets the
            // Options slider control every layout on the same px scale.
            nodeSeparation: spacing,
            animate: false,
            fit: false,
        } as any);
        layout.one("layoutstop", () => {
            const out = new Map<string, { x: number; y: number }>();
            cy.nodes().forEach(n => {
                const p = n.position();
                out.set(n.id(), { x: p.x, y: p.y });
            });
            cy.destroy();
            resolve(out);
        });
        layout.run();
    });
}
