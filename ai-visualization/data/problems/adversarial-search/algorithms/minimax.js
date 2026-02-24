(SolverBase, game) => {
    const FLOAT_EPSILON = 1e-10;

    class Minimax extends SolverBase {
        constructor(game) {
            super(game);
        }
    
        // this function should use the generated expansions to find out node utilities
        // expand() should not be called in this function
        // yield this.algoStep() to provide a "step" to the visualizer
        *runAlgorithm(root) {
            yield* this.dfsMinimax(root, new Set());
            console.log(`Utility from node: ${root.utility}`);
        }

        // this function should prepare the position tree for the play algorithm
        // call and yield the result of this.expand() to interactively let the user expand nodes
        *runExpansion(root) {
            // Breadth-first-search approach by levels
            // Usually, expansion on these types of algorithms would use Iterative Deepening to conserve memory.
            // Since, for visualization, we have to store all positions in memory; BFS is more efficient, to avoid re-expansions.
            let nextLevelNodes = [root];
            let visitedNodes = new Set([root]);
            while (nextLevelNodes.length > 0) {
                let newNodes = [];
                for (let node of nextLevelNodes) {
                    // using expand creates the "moves" field in the node. 
                    // moves have an "action" field and a "position" field, 
                    // the "position" field has a reference to the resulting position after that move is taken.
                    yield this.expand(node);
                    for (let move of node.moves) {
                        let nextPos = move.position;
                        // this ensures we only ever add a position to the queue once
                        if (visitedNodes.has(nextPos.id)) continue;
                        visitedNodes.add(nextPos.id);
                        newNodes.push(nextPos);
                    }
                }
                nextLevelNodes = newNodes;
            }
        }

        // you may extend expansion logic, but you should always return the result of super.expand
        expand(node) {
            let result = super.expand(node);
            // you can add additional data to the node here
            node.data["accessiblePositions"] = node.moves.map(m => m.position.id);
            return result;
        }

        /** 
         * @param {Position} node
         * @param {Set<string>} visited
         */
        *dfsMinimax(node, visited) {
            // This value is used to render the best move(s) from any given position
            let nodeId = node.id;
            if (visited.has(nodeId)) {
                // case for infinite loops, assume a draw
                if (node.utility < Number.MIN_SAFE_INTEGER || node.utility > Number.MAX_SAFE_INTEGER) {
                    node.utility = 0;
                    console.log(`Found node with possible draw by repetition: ${nodeId}`);
                } else {
                    //console.log(`Repeated: utility = ${node.utility}, ID = ${nodeId}`);
                }
                return;
            }
            visited.add(nodeId);
            node.bestMoves = [];

            if (node.isTerminal()) {
                node.utility = node.getScore();
                yield this.algoStep();
                return;
            }

            // expansion budget unavailable for this node
            if (node.moves === undefined || node.moves.length == 0) {
                // here, you can return a heuristic value for the node
                // or you can just return 0 to assume a draw
                node.utility = 0;
                if (typeof node.getHeuristic === "function") {
                    node.utility = node.getHeuristic();
                }
                //console.log(`Calculated heuristic utility of ${node.id} = ${node.utility}`);
                yield this.algoStep();
                return;
            }

            let currentPlayer = node.getPlayer();
            let maximizingPlayer;
            if (currentPlayer === 1) {
                maximizingPlayer = true;
            } else if (currentPlayer === -1) {
                maximizingPlayer = false;
            } else {
                throw new Error(`Invalid player for minimax algorithm: ${currentPlayer}`);
            }

            node.utility = maximizingPlayer ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
            let bestMoves = [];
            for (let move of node.moves) {
                yield* this.dfsMinimax(move.position, visited);
                let score = move.position.utility;
                if (Math.abs(score - node.utility) < FLOAT_EPSILON) {
                    bestMoves.push(move);
                } else if (maximizingPlayer ? score > node.utility : score < node.utility) {
                    node.utility = score;
                    bestMoves = [move];
                }
            }
            node.bestMoves = bestMoves;
            yield this.algoStep();
        }
    }

    return new Minimax(game);
}