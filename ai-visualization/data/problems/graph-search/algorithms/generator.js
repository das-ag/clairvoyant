class GraphGenerator {
    constructor(graph) {
        this.graph = graph;
    }
    
    solve(start, goal) {
        this.create(`
            GRID 2x2
            1 0
            1 1
            
            START 0 0
            GOAL 1 1
        `)

        return this.success();
    }
}
GraphGenerator.prototype;