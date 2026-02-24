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

class AStarSolution {
    constructor(graph) {
        this.graph = graph;
    }
    
    aStarSearch(start, goal) {
        // Initialize all distances to infinity
        let distances = {};
        let parents = {};
        for (let n of this.graph.getAllNodes()) {
            distances[n.id] = Number.POSITIVE_INFINITY;
        }

        let queue = new PriorityQueue();
        queue.enqueue(start, 0);
        distances[start.id] = 0;
        while (queue.size() > 0) {
            let current = queue.dequeue();
            let neighbors = Array.from(this.graph.getAdjacentEdges(current));
            let msg = `Expanding node ${current.id} with G = ${distances[current.id]}, neighbors ${neighbors.map(n => n.target.id).join(", ")}`;
            this.expand(current, msg);
            if (current.id === goal.id) {
                break;
            }
            for (let edge of neighbors) {
                let newDist = distances[current.id] + edge.weight;
                let adj = edge.target;
                // If we've already found a better path, skip this edge
                if (newDist >= distances[adj.id]) {continue;}
                distances[adj.id] = newDist;
                parents[adj.id] = current;
                let f = newDist + adj.heuristic;
                this.visit(adj, `Visiting node ${adj.id} with F = ${newDist} + ${adj.heuristic} = ${f}`);
                queue.enqueue(adj, f);
            }
        }

        return parents;
    }

    buildPath(start, goal, parents) {
        let nodes = [];
        let edges = [];
        let current = goal;
        while (current !== start) {
            let parent = parents[current.id];
            if (parent === undefined) break;
            let eligibleEdges = this.graph.getAdjacentEdges(parent);
            let bestEdge = undefined;
            let bestWeight = Number.POSITIVE_INFINITY;
            for (let edge of eligibleEdges) {
                if (edge.target.id === current.id && edge.weight < bestWeight) {
                    bestEdge = edge;
                    bestWeight = edge.weight;
                }
            }
            if (current)
                nodes.push(current);
            if (bestEdge)
                edges.push(bestEdge);
            current = parents[current.id];
        }
        nodes.push(start);
        nodes.reverse();
        edges.reverse();
        return {nodes, edges};
    }

    solve(start, goal) {
        let parents = this.aStarSearch(start, goal);
        if (parents[goal.id] === undefined) {
            return this.failure();
        } else {
            let {nodes, edges} = this.buildPath(start, goal, parents);
            let msg = "Path found: " + nodes.map(n => n.id).join(" -> ");
            this.highlight([...nodes, ...edges], msg);
            return this.success();
        }
    }
}
AStarSolution.prototype;