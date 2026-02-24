import { AdversarialSearchCase, AdversarialSearchPosition, requiredGameMethods, requiredPositionMethods } from "./adversarialCase";
import { canSetProps, EditableComponent, ItemProperty } from "../../lib/utils/properties";
import { GenericGraph, GraphEdgeSimple, GraphNode } from "../graphs/graph";
import { ensureError } from "../errors/error";
import { Queue } from "../collections/queue";
import { getEvalCallerLine } from "../utils/stackTrace";

export interface AdversarialSearchAction {
    name?: string;
    [key: string]: any;
}

export interface AdversarialSearchMove {
    position: AdversarialSearchPosition;
    action: AdversarialSearchAction;
}

export class AdversarialExpansion {
    position: AdversarialSearchPosition;
    moves: AdversarialSearchMove[];
    constructor(position: AdversarialSearchPosition, moves: AdversarialSearchMove[]) {
        this.position = position;
        this.moves = moves;
    }
}

export type AdversarialAlgorithmStep = {
    value: any;
    sourceLine: number | null;
};

export abstract class AdversarialSearchSolution implements EditableComponent {
    game!: AdversarialSearchCase;
    gameTree!: GenericGraph; 
    expansionBudget: number = 0;
    algorithmBudget: number = 0;
    initialized: boolean = false;
    bestAction?: AdversarialSearchAction;
    constructor(game: AdversarialSearchCase) {
        if (!this.initialized) {
            this.initialize(game);
        }
    }
    initialize(game: AdversarialSearchCase) {
        if (this.initialized) return;
        this.game = game;
        this.gameTree = new GenericGraph();
        let initPosition = game.getInitialPosition();
        let startNode = new GraphNode(this.gameTree, initPosition.id, 0, 0, {position: initPosition, expanded: false});
        this.gameTree.addNode(startNode);
        this.gameTree.startNode = startNode;
        this.gameTree.endNode = startNode;
        this.initialized = true;
    }
    get id(): string | number {
        return "";
    }
    get properties(): ItemProperty[] {
        return [];
    }
    getProp(name: string): any {
        let props = this.properties;
        for (let prop of props) {
            if (prop.name === name) {
                return prop.value;
            }
        }
        throw new Error("Property not found: " + name);
    }
    setProp(name: string, value: any): boolean {
        let analysis = canSetProps(this.properties, {[name]: value});
        if (!analysis.success) throw new Error(analysis.errors.join("\n"));

        return false;
    }

    abstract runAlgorithm(position: AdversarialSearchPosition): Generator<AdversarialAlgorithmStep>;
    abstract runExpansion(position: AdversarialSearchPosition): Generator<AdversarialExpansion>;
    expand(position: AdversarialSearchPosition): AdversarialExpansion {
        // Already expanded and cached to position
        if (position.moves && position.moves.length > 0) {
            return {position: position, moves: position.moves};
        }
        
        let posId = position.id;
        let curNode = this.gameTree.getNodeById(posId);
        if (!curNode) {
            curNode = new GraphNode(this.gameTree, posId, 0, 0, {position: position, expanded: false});
            this.gameTree.addNode(curNode);
        }

        // already expanded
        if (curNode.data["expanded"]) {            
            let cache = [...this.gameTree.getAdjacentEdges(curNode)];
            let moves = cache.map(edge => {return {position: edge.target.data["position"], action: edge.data["action"]}});
            position.moves = moves;
            return {position: position, moves: moves};
        }

        if (this.expansionBudget-- === 0) {
            this.expansionBudget = 0;
            return {position: position, moves: []};
        }

        let actions = this.game.getActions(position);
        let moves = actions.map(action => {
            let result = this.game.getResult(position, action);
            let move = {position: result, action: action};
            return move;
        });

        // this can double-count leaf nodes if they're reached via different paths (consider this transpositions)
        let addedPaths = moves.length - 1;
        // for terminal nodes, we consider no added paths:
        if (position.isTerminal()) {
            addedPaths = 0;
        }

        for (let s of moves) {
            // In case of converging lines, we need to check if the node already exists
            let nextNode = this.gameTree.getNodeById(s.position.id);
            if (!nextNode) {
                nextNode = new GraphNode(this.gameTree, s.position.id, 0, 0, {position: s.position, expanded: false});
                this.gameTree.addNode(nextNode);
            } else {
                // make sure move points to already-existing position
                s.position = nextNode.data["position"];
            }
            let edge = new GraphEdgeSimple(this.gameTree.getNextEdgeIdentifier(), curNode, nextNode, false, {action: s.action});
            this.gameTree.addEdge(edge);
        }

        // update child counts, we'll use BFS to save on stack depth
        let visited = new Set([curNode.id]);
        this.gameTree.getIncomingNodes(curNode);
        curNode.data["pathCount"] = (curNode.data["pathCount"] ?? 1) + addedPaths;
        let q = new Queue<GraphNode>();
        q.enqueue(curNode);
        while (!q.isEmpty()) {
            let next = q.dequeue();
            let parents = [...this.gameTree.getIncomingNodes(next)];
            // console.log(`Iteration starting from ${curNode.id} at ${next.id}, queue size: ${q.length}, parent count: ${parents.length}`);
            // console.log({"child": next, "parents": parents});
            for (let parent of parents) {
                if (visited.has(parent.id)) continue;
                visited.add(parent.id);
                parent.data["pathCount"] = (parent.data["pathCount"] ?? 1) + addedPaths;
                q.enqueue(parent);
            }
        }

        curNode.data["expanded"] = true;
        position.moves = moves;
        return {position: position, moves: moves};
    }

    algoStep(debugValue: any = undefined): AdversarialAlgorithmStep {
        this.algorithmBudget--;
        return { value: debugValue, sourceLine: getEvalCallerLine() };
    }

    resetAlgorithmState() {
        for (let node of this.gameTree.getAllNodes()) {
            (node.data["position"] as AdversarialSearchPosition).utility = undefined;
        }
    }
}

const requiredSolverMethods = [
    {name: "runExpansion", args: 1},
    {name: "runAlgorithm", args: 1}
]

export class AdversarialSearchBuildError extends Error {
    fault: string;
    constructor(message: string, fault: string) {
        super(message);
        this.fault = fault;
    }
}

export function buildAdversarialSolution(solutionCode: string, gameCode: string) : [AdversarialSearchSolution, AdversarialSearchCase] {
    let solver: AdversarialSearchSolution;
    let game: AdversarialSearchCase;
    try {
        "use strict";
        let gameBuilder: (clazz1: any, clazz2: any) => AdversarialSearchCase = eval?.(gameCode);
        game = gameBuilder(AdversarialSearchCase, AdversarialSearchPosition);
        let gameProto = Object.getPrototypeOf(game);
        let initialPosition = game.getInitialPosition();
        let posProto = Object.getPrototypeOf(initialPosition);

        for (let method of requiredGameMethods) {
            if (!Object.hasOwn(gameProto, method.name) || gameProto[method.name].length !== method.args) {
                throw new Error(`${method.name} method is not defined in the Case class or has the wrong number of arguments, it should expect ${method.args} argument${method.args === 1 ? "" : "s"}.`);
            }
        }
        for (let method of requiredPositionMethods) {
            if (!Object.hasOwn(posProto, method.name) || posProto[method.name].length !== method.args) {
                throw new Error(`${method.name} method is not defined in the Position class returned from getInitialPosition or has the wrong number of arguments, it should expect ${method.args} argument${method.args === 1 ? "" : "s"}.`);
            }
        }
    }
    catch (e) {
        let err = ensureError(e);
        throw new AdversarialSearchBuildError(`Error evaluating code: ${err.stack}`, "case");
    }

    try {
        "use strict";
        let solverBuilder: (base: any, game: AdversarialSearchCase) => AdversarialSearchSolution = eval?.(solutionCode);
        solver = solverBuilder(AdversarialSearchSolution, game);
        let solverProto = Object.getPrototypeOf(solver);

        for (let method of requiredSolverMethods) {
            if (!Object.hasOwn(solverProto, method.name) || solverProto[method.name].length !== method.args) {
                throw new Error(`${method.name} method is not defined in the Solution class or has the wrong number of arguments, it should expect ${method.args} argument${method.args === 1 ? "" : "s"}.`);
            }
        }
    } catch (e) {
        throw new AdversarialSearchBuildError("Error evaluating code: " + e, "solver");
    }

    return [solver, game];
}
