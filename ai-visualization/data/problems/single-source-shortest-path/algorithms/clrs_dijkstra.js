// Dijkstra's algorithm — CLRS 4th edition, Section 24.3
//
// Visualization methods provided by the base class:
//   this.initializeSingleSource(source)  — set d[s]=0, d[v]=∞ for all v≠s
//   this.extractMin(Q)                   — remove & return min-dist node from array Q
//   this.relaxEdge(u, v, w)              — highlight edge (u,v) during relaxation check
//   this.updateDist(v, newDist, u)       — update d[v] and π[v], show in watch panel
//   this.settle(u)                       — mark u as finalized (added to set S)
//   this.getDist(v)                      — read current d[v] (no step emitted)
//   this.logStep(ctx)                    — emit a log step with annotation support
//   this.done(ctx)                       — emit terminal step

class DijkstraSolution {
    constructor(graph) {
        this.graph = graph;
    }

    // INITIALIZE-SINGLE-SOURCE(G, s)  [CLRS 24.3]
    initializeSingleSource(source) {
        for (let v of this.graph.getAllNodes()) {
            this.updateDist(v, Infinity, null);
        }
        this.updateDist(source, 0, null);
    }

    // RELAX(u, v, w)  [CLRS 24.3]
    relax(u, v, w) {
        this.relaxEdge(u, v, w);
        if (this.getDist(v) > this.getDist(u) + w) {
            this.updateDist(v, this.getDist(u) + w, u);
        }
    }

    // DIJKSTRA(G, w, s)  [CLRS 24.3]
    solve(source) {
        this.logStep({ source });
        this.initializeSingleSource(source);
        let S = [];
        let Q = this.graph.getAllNodes().slice();
        while (Q.length > 0) {
            let u = this.extractMin(Q);
            S.push(u);
            this.settle(u);
            for (let edge of this.graph.getAdjacentEdges(u)) {
                let v = edge.target;
                this.relax(u, v, edge.weight);
            }
        }
        this.done({ source });
    }
}
DijkstraSolution.prototype;
