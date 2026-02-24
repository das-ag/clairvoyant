import { ensureError } from "../errors/error";
import { Command, PropertyChangeCommand } from "../utils/commands";
import { ItemPropertySet } from "../utils/properties";
import { getEvalCallerLine } from "../utils/stackTrace";
import { GraphNode } from "./components";
import { EditableGraphComponent, Graph, GraphContext } from "./graph";
import { GraphFailureCommand, GraphSuccessCommand, LayerGraphCommand } from "./graphcommands";
import { RawGraph } from "./parsing";

export class GraphSearchResult {
    debugValue: any;
    command?: Command<GraphContext>;
    isTerminal: boolean;
    sourceLine: number | null;

    constructor(debugValue: any = null, command?: Command<GraphContext>, isTerminal = false, sourceLine: number | null = null) {
        this.debugValue = debugValue;
        this.command = command;
        this.isTerminal = isTerminal;
        this.sourceLine = sourceLine;
    }
}

export class GraphSearchSolution {
    private __steps: GraphSearchResult[] = [];
    private __propertyStore: Map<EditableGraphComponent, Record<string, any>> = new Map();

    constructor(graph: Graph | null = null) { }

    solve(start: GraphNode, end: GraphNode): boolean {
        return this.failure();
    }

    getSolutionSteps(start: GraphNode, end: GraphNode): GraphSearchResult[] {
        this.__steps = [];
        this.solve(start, end);
        if (this.__steps.length === 0) { 
            throw new Error("No steps were recorded. Did you invoke failure or success?");
        }
        let lastStep = this.__steps[this.__steps.length - 1];
        if (!lastStep.isTerminal) {
            throw new Error("Last step is not a terminal step. Ensure you finish solving by returning a success or failure.");
        }
        console.log("Solution steps: ", this.__steps);
        return this.__steps;
    }

    failure(debugValue: any = null): boolean {
        const line = getEvalCallerLine();
        this.__steps.push(new GraphSearchResult(debugValue, new GraphFailureCommand(), true, line));
        return false;
    }
    success(debugValue: any = null): boolean {
        const line = getEvalCallerLine();
        this.__steps.push(new GraphSearchResult(debugValue, new GraphSuccessCommand(), true, line));
        return true;
    }
    visit(cell: GraphNode, debugValue: any = null): void {
        this.alter([{target: cell, property: "state", value: "visited"}], debugValue, getEvalCallerLine());
    }
    expand(cell: GraphNode, debugValue: any = null): void {
        this.alter([{target: cell, property: "state", value: "expanded"}], debugValue, getEvalCallerLine());
    }
    highlight(components: EditableGraphComponent[], debugValue: any = null): void {
        this.alter(components.map(c => {return {target: c, property: "highlighted", value: true}}), debugValue, getEvalCallerLine());
    }
    unhighlight(components: EditableGraphComponent[], debugValue: any = null): void {
        this.alter(components.map(c => {return {target: c, property: "highlighted", value: false}}), debugValue, getEvalCallerLine());
    }
    alter(changes: ItemPropertySet<EditableGraphComponent>[], debugValue: any = null, callerLine: number | null = null): void {
        if (!this.__propertyStore) this.__propertyStore = new Map();
        let contextfulChanges = changes.map(change => {
            let oldValue = this.__propertyStore.get(change.target)?.[change.property] ?? change.target.getProp(change.property);
            return {oldValue: oldValue, newValue: change.value, property: change.property, target: change.target};            
        });
        for (let change of changes) {
            let store = this.__propertyStore.get(change.target) ?? {};
            store[change.property] = change.value;
            this.__propertyStore.set(change.target, store);
        }
        this.__steps.push(new GraphSearchResult(debugValue, new PropertyChangeCommand(contextfulChanges), false, callerLine));
    }
    log(debugValue: any): void {
        const line = getEvalCallerLine();
        this.__steps.push(new GraphSearchResult(debugValue, undefined, false, line));
    }

    create(rawGraph: string | RawGraph, debugValue: any): Graph {
        const line = getEvalCallerLine();
        let graphResult;
        if (typeof(rawGraph) === "string") {
            graphResult = Graph.fromNotation(rawGraph);
        } else {
            graphResult = Graph.fromRaw(rawGraph);
        }
        
        this.__steps.push(new GraphSearchResult(debugValue, new LayerGraphCommand(graphResult), false, line));
        return graphResult;
    }
}

export function buildGraphSearchSolution(code: string, graph: Graph) : GraphSearchSolution {
    let result;
    try {
        "use strict";
        let solverClass: any = eval?.(code);
        if (solverClass === undefined) {
            throw new Error("Received undefined on eval. Ensure the last line of your algorithm evaluates to the prototype of your solver class.");
        }
        Object.setPrototypeOf(solverClass, GraphSearchSolution.prototype);
        let solver = Object.create(solverClass);
        let finalProto = Object.getPrototypeOf(solver);
        console.log(finalProto);
        if (!Object.hasOwn(finalProto, "constructor")) {
            throw new Error("constructor function is not defined.");
        }
        if (solver.constructor!.length !== 1) {
            throw new Error("constructor must accept only the graph as a parameter.");
        }
        if (!Object.hasOwn(finalProto, "solve")) {
            throw new Error("solve method is not defined.");
        }
        if (solver.solve.length !== 2) {
            throw new Error("solve method must accept exactly two parameters.");
        }
        console.log("Checks succeeded!");
        result = new solver.constructor(graph);
    } catch (e) {
        let err = ensureError(e);
        throw new Error("Error evaluating code: " + (err.stack ?? err.message));
    }
    
    return result;
}