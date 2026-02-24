// Feel free to implement a more efficient version of a Priority Queue, this is used for brevety.
class PriorityQueue{
    constructor(){
        this.values = [];
    }
    
    enqueue(node, priority){
        var flag = false;
        for(let i = 0; i < this.values.length; i++){
            if(this.values[i].priority > priority){
                this.values.splice(i, 0, {node, priority})
                flag = true;
                break;
            }
        }
        if(!flag){
            this.values.push({node, priority})
        }
    }
    
    dequeue() {
        let {node, priority} = this.values.shift()
        return node;
    }
    
    size() {
        return this.values.length;
    }
}

class HeuristicChecker {
    constructor(graph) {
        this.graph = graph;
    }
    
    reverseDijkstra(origin) {
        let distances = {};
        for (let n of this.graph.getAllNodes()) {
            distances[n.id] = Number.POSITIVE_INFINITY;
        }

        let queue = new PriorityQueue();
        queue.enqueue(origin, 0);
        distances[origin.id] = 0;
        while (queue.size() > 0) {
            let current = queue.dequeue();
            let neighbors = Array.from(this.graph.getIncomingEdges(current));
            for (let edge of neighbors) {
                let newDist = distances[current.id] + edge.weight;
                // Note that the obtained edges are reversed, so the "target" and "source" are swapped.
                // Alternatively, edge.reverse().target can be used.
                let adj = edge.source;
                if (newDist >= distances[adj.id]) {continue;}
                distances[adj.id] = newDist;
                queue.enqueue(adj, newDist);
            }
        }

        return distances;
    }

    checkAdmissibility(nodes, distancesToGoal) {
        let inadmissible = [];
        for (let n of nodes) {
            let h = n.heuristic;
            if (h > distancesToGoal[n.id]) {
                inadmissible.push({node: n, heuristic: h, distance: distancesToGoal[n.id]});
            }
        }
        return inadmissible;
    }

    checkConsistency(edges) {
        let inconsistent = [];
        // We use a small epsilon to avoid floating point errors.
        const EPSILON = 1e-6;
        for (let e of edges) {
            for (let subedge of [e, e.reverse()]) {
                if (!subedge.traversable()) {continue;}
                let h = subedge.source.heuristic;
                let w = subedge.weight;
                let h2 = subedge.target.heuristic;
                if (h - w - EPSILON > h2) {
                    inconsistent.push({edge: subedge, heuristic1: h, weight: w, heuristic2: h2});
                }
            }
        }
        return inconsistent;
    }

    solve(start, goal) {
        let distancesToGoal = this.reverseDijkstra(goal);
        this.log("Distances to goal: " + Object.keys(distancesToGoal).map(k => `${k}: ${distancesToGoal[k]}`).join(", "));
        let inadmissible = this.checkAdmissibility(this.graph.getAllNodes(), distancesToGoal);
        let inconsistent = this.checkConsistency(this.graph.getAllEdges());
        let badComponents = [...inadmissible.map(a => a.node), ...inconsistent.map(c => c.edge)];
        let analysis = []
        for (let {node, heuristic, distance} of inadmissible) {
            analysis.push(`Node ${node.id} has heuristic ${heuristic} but is ${distance} away from the goal.`);
        }
        for (let {edge, heuristic1, weight, heuristic2} of inconsistent) {
            analysis.push(`Edge ${edge.source.id} -> ${edge.target.id} has heuristic delta ${Math.abs(heuristic1 - heuristic2)} but weight ${weight}. H: ${heuristic1} -> ${heuristic2}.`);
        }
        if (analysis.length === 0) {
            analysis.push("Heuristic is admissible and consistent.");
        }
        this.highlight(badComponents, analysis.join("\n"));
        if (badComponents.length > 0) {
            return this.failure();
        } else {
            return this.success();
        }
    }
}
HeuristicChecker.prototype;