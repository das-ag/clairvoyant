class DFSSolution {
    constructor(graph) {
        this.visited = {};
        this.graph = graph;
    }
    
    solve(start, goal) {
        this.visited[start.id] = true;
        if (this.dfs(start, goal)) {
            return this.success(); // Success is a function in GraphSearchSolution that enables visualization
        } else {
            return this.failure(); // Failure is a function in GraphSearchSolution that enables visualization
        }
    }

    dfs(current, goal) {
        if (current.id == goal.id) {
            return true;
        }
        
        let neighbors = Array.from(this.graph.getAdjacentNodes(current));
        let message = "Expanding node " + current.id + " with neighbors " + neighbors.map(n => n.id).join(", ");
        this.expand(current, message) // Expand is a function in GraphSearchSolution that enables visualization
        for (let adj of neighbors) {
            if (adj.id in this.visited) {continue;}
            this.visit(adj) // Visit is a function in GraphSearchSolution that enables visualization
            this.visited[adj.id] = true;
            if (this.dfs(adj, goal, this.graph)) {
                return true;
            }
        }

        return false;
    }
}
DFSSolution.prototype;