class BFSSolution {
    constructor(graph) {
        this.visited = {};
        this.graph = graph;
    }
    
    solve(start, goal) {
        this.visited[start.id] = true;
        if (this.bfs(start, goal)) {
            return this.success(); // Success is a function in GraphSearchSolution that enables visualization
        } else {
            return this.failure(); // Failure is a function in GraphSearchSolution that enables visualization
        }
    }

    bfs(start, goal) {        
        let queue = [start];
        while (queue.length > 0) {
            let current = queue.shift();
            let neighbors = Array.from(this.graph.getAdjacentNodes(current));
            let message = "Expanding node " + current.id + " with neighbors " + neighbors.map(n => n.id).join(", ");
            this.expand(current, message) // Expand is a function in GraphSearchSolution that enables visualization
            if (current.id === goal.id) {
                return true;
            }
            for (let adj of neighbors) {
                if (adj.id in this.visited) {continue;}
                let message = "Visiting node " + adj.id + ", list of nodes to expand: [" + queue.map(n => n.id).join(", ") + "]";
                this.visit(adj, message) // Visit is a function in GraphSearchSolution that enables visualization
                this.visited[adj.id] = true;
                queue.push(adj);
            }
        }

        return false;
    }
}
BFSSolution.prototype;