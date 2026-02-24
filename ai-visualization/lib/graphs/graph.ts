import { ParsingError, RuntimeError } from "../errors/error";
import { CommandHandler } from "../utils/commands";
import { EditableComponent, ItemProperty, canSetProps } from "../utils/properties";
import { genericGraphFromNotation, graphFromRaw, gridGraphFromNotation, notationFromGenericGraph, notationFromGridGraph, preprocessGraphNotation, RawGraph } from "./parsing";
import { GraphEdge, GraphEdgeSimple, GraphNode } from "./components";
export type { GraphEdge };
export { GraphEdgeSimple, GraphNode };

export const DIAGONAL_WEIGHT_DISABLED = -1;
export const DIAGONAL_WEIGHT_CHEBYSHEV = 1;
export const DIAGONAL_WEIGHT_EUCLIDEAN = 1.4142135623730951;
export const DIAGONAL_WEIGHT_MANHATTAN = 2;
export const DIAG_WEIGHT_TERMS: Record<string, number> = {
    "disabled": DIAGONAL_WEIGHT_DISABLED,
    "manhattan": DIAGONAL_WEIGHT_MANHATTAN,
    "euclidean": DIAGONAL_WEIGHT_EUCLIDEAN,
    "chebyshev": DIAGONAL_WEIGHT_CHEBYSHEV
}

export const ADJACENT_DELTAS_ORTHO: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0]
];
export const ADJACENT_DELTAS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]
];

export interface GraphUIContext {
    heldNode?: GraphNode;
    heldEdge?: GraphEdge;
    hoveredNode?: GraphNode;
    hoveredEdge?: GraphEdge;
    draggingNode?: GraphNode;
}

export class GraphContext {
    private _graphs: Graph[] = [];
    private _graph: Graph | null = null;
    private _commandHandler: CommandHandler<GraphContext> = new CommandHandler<GraphContext>();

    constructor(graph: Graph | null) {
        if (graph) this.push(graph);
    }

    get length() {
        return this._graphs.length;
    }

    get graph() {
        return this._graph;
    }

    get commandHandler() {
        return this._commandHandler;
    }

    public push(graph: Graph) {
        this._graphs.push(graph);
        this._graph = graph;
    }
    public pop(): Graph | undefined {
        const result = this._graphs.pop();
        this._graph = this._graphs.length === 0 ?
            null : this._graphs[this._graphs.length - 1];
        return result;
    }
    public update(graph: Graph) {
        if (this._graphs.length === 0) this.push(graph);
        this._graphs[this._graphs.length - 1] = graph;
        this._graph = graph;
    }
}

export abstract class Graph implements EditableComponent {
    protected _nodeLookup = new Map<string, GraphNode>(); // Used for data/existence access
    protected _edgeLookup = new Map<string, GraphEdge[]>(); // Used to look up connections to/from nodes
    protected _edgeIdLookup = new Map<number, GraphEdge>(); // Used to look up edges by id
    protected isDirtyLookup: boolean = false;
    protected isDirtyRender: boolean = false;
    protected _startNode: GraphNode | null = null;
    protected _endNode: GraphNode | null = null;
    protected _searchResult: string = "";
    public defaultBidirectional: boolean = false;
    public physicsEnabled: boolean = true;
    public context: GraphUIContext = {};

    get isDirty() {return this.isDirtyLookup || this.isDirtyRender;}
    get dirtyRender() {return this.isDirtyRender}
    get dirtyLookup() {return this.isDirtyLookup}
    get searchResult() {return this._searchResult}

    get id(): string | number {
        return 0;
    }
    get properties(): ItemProperty[] {
        return [
            {name: "start", type: "string", value: this.startNode?.id},
            {name: "end", type: "string", value: this.endNode?.id},
            {name: "physics_enabled", type: "boolean", value: this.physicsEnabled},
            {name: "default_bidirectional", type: "boolean", value: this.defaultBidirectional, description: "Whether to make newly created edges bidirectional by default"}
        ]
    }
    getProp(name: string) {
        let properties = this.properties;
        let prop = properties.find(p => p.name === name);
        if (!prop) throw new Error(`Property ${name} is not implemented for Graph`);
        return prop.value;
    }
    setProp(name: string, value: any): boolean {
        let analysis = canSetProps(this.properties, {[name]: value});
        if (!analysis.success) throw new Error(analysis.errors.join("\n"));

        if (name === "start") {
            let n = this.getNodeById(value);
            if (n === undefined) throw new Error(`Node ${value} does not exist in the graph.`);
            this.startNode = n;
        } else if (name === "end") {
            let n = this.getNodeById(value);
            if (n === undefined) throw new Error(`Node ${value} does not exist in the graph.`);
            this.endNode = n;
        } else if (name === "default_bidirectional") {
            this.defaultBidirectional = value;
        } else if (name === "physics_enabled") {
            this.physicsEnabled = value;
        } else {
            return false;
        }
        return true;
    }

    markDirtyLookup() {
        this.isDirtyLookup = true;
    }
    markDirtyRender() {
        this.isDirtyRender = true;
    }
    markDirtyAll() {
        this.markDirtyLookup();
        this.markDirtyRender();
    }
    markCleanRender() {
        this.isDirtyRender = false;
    }
    ensureLookupClean() {
        if (this.isDirtyLookup) {
            this.isDirtyLookup = false;
            const allEdges: GraphEdge[] = [];
            for (let edge of Object.values(this._edgeIdLookup)) {
                if (edge.isRef) continue;
                allEdges.push(edge);
            }
            this._edgeLookup.clear();
            for (let edge of allEdges) {
                this.addEdge(edge);
            }
        }
    }

    // Node Operations
    public addNode(node: GraphNode) {
        if (this._nodeLookup.has(node.id)) throw new Error(`Node with id \"${node.id}\" already exists in the graph.`);
        this._nodeLookup.set(node.id, node);
        //console.log(JSON.stringify([...this._nodeLookup.entries()]));
        this.markDirtyRender();
    }
    public removeNode(node: GraphNode): boolean;
    public removeNode(nodeId: string): boolean;
    public removeNode(val: GraphNode | string): boolean {
        if (val instanceof GraphNode) {val = val.id;}
        if (!this._nodeLookup.has(val)) return false;
        this.clearAllEdgesWith(val);
        this._nodeLookup.delete(val);
        this.markDirtyRender();
        return true;
    }

    get startNode() {return this._startNode}
    set startNode(node) {this._startNode = node; this.markDirtyRender();}
    get endNode() {return this._endNode}
    set endNode(node) {this._endNode = node; this.markDirtyRender();}

    complete() {
        this._searchResult = "success"
    }
    uncomplete() {
        this._searchResult = ""
    }
    fail() {
        this._searchResult = "failure"
    }
    unfail() {
        this._searchResult = ""
    }
    setNodeState(node: GraphNode, state: any) {
        node.data["state"] = state;
        this.markDirtyRender();
    }

    public resetStepData() {
        for (let node of this.getAllNodes()) {
            this.setNodeState(node, "");
            node.data["highlighted"] = false;
        }
        for (let edge of this.getAllEdges()) {
            edge.data["highlighted"] = false;
        }
        this._searchResult = "";
    }

    // Edge operations
    public clearAllEdgesWith(nodeId: string) {
        this.ensureLookupClean();
        if (!(nodeId in this._edgeLookup)) return;
        for (let edge of this._edgeLookup.get(nodeId)!) {
            this._edgeLookup.set(edge.target.id, this._edgeLookup.get(edge.target.id)!.filter(e => {
                e.target.id != nodeId;
            }))
        }
        this._edgeLookup.delete(nodeId);
        this.markDirtyRender();
    }

    protected ensureEdgeLookupExists(id: string) {
        if (!this._edgeLookup.has(id)) {
            this._edgeLookup.set(id, [])
        }
    }

    public addEdge(edgeData: GraphEdge) {
        this._edgeIdLookup.set(edgeData.id as number, edgeData);
        this.ensureEdgeLookupExists(edgeData.source.id);
        this._edgeLookup.get(edgeData.source.id)!.push(edgeData);
        this.ensureEdgeLookupExists(edgeData.target.id);
        this._edgeLookup.get(edgeData.target.id)!.push(edgeData.reverse());
        this.markDirtyRender();
    }

    public removeEdge(edgeData: GraphEdge) {
        this.ensureLookupClean();
        const srcEdgeList = this._edgeLookup.get(edgeData.source.id)!
        srcEdgeList.splice(srcEdgeList.indexOf(edgeData), 1);
        const tarEdgeList = this._edgeLookup.get(edgeData.target.id)!
        tarEdgeList.splice(tarEdgeList.indexOf(edgeData.reverse()), 1);
        this._edgeIdLookup.delete(edgeData.id as number);
        this.markDirtyRender();
    }

    public getEdge(sourceNode: GraphNode, targetNode: GraphNode, includeUntraversable: boolean = false): GraphEdge | undefined {
        let candidates = this.getEdges(sourceNode, targetNode, includeUntraversable);
        let first = candidates.next();
        if (first.done) return undefined;
        return first.value;
    }

    public *getEdges(sourceNode: GraphNode, targetNode: GraphNode, includeUntraversable: boolean = false): Generator<GraphEdge> {
        this.ensureLookupClean();
        let edges = this._edgeLookup.get(sourceNode.id);
        if (!edges) return;
        for (let edge of edges) {
            if (edge.target.id === targetNode.id && (edge.traversable() || includeUntraversable)) yield edge;
        }
    }

    public getEdgeById(id: number): GraphEdge | undefined {
        return this._edgeIdLookup.get(id);
    }

    public getAllEdges(): GraphEdge[] {
        return [...this._edgeIdLookup.values()].filter(e => !e.isRef);
    }

    public getAllNodes(): GraphNode[] {
        return [...this._nodeLookup.values()];
    }

    // Useful functions for algorithms
    /// Generates nodes which are adjacent to the given node
    public *getAdjacentNodes(node: GraphNode): Generator<GraphNode> {
        for (let edge of this.getAdjacentEdges(node)) {
            yield edge.target;
        }
    }
    public *getIncomingNodes(node: GraphNode): Generator<GraphNode> {
        for (let edge of this.getIncomingEdges(node)) {
            yield edge.source;
        }
    }

    public *getAdjacentEdges(node: GraphNode, includeUntraversable = false): Generator<GraphEdge> {
        this.ensureLookupClean();
        //console.log(this._edgeLookup.keys())
        if (!this._edgeLookup.has(node.id)) return;
        let adjEdges = this._edgeLookup.get(node.id) || [];
        //console.log("Adjacent edges: ", adjEdges);
        for (let edge of adjEdges) {
            //console.log("Edge: ", edge, "Traversable: ", edge.traversable());
            if (!includeUntraversable && !edge.traversable()) continue;
            yield edge;
        }
    }
    public *getIncomingEdges(node: GraphNode, includeUntraversable = false): Generator<GraphEdge> {
        this.ensureLookupClean();
        if (!this._edgeLookup.has(node.id)) return;
        let adjEdges = this._edgeLookup.get(node.id) || [];
        for (let edge of adjEdges) {
            let rev = edge.reverse();
            if (!includeUntraversable && !rev.traversable()) continue;
            yield rev;
        }
    }

    public getNodeById(id: string): GraphNode | undefined {
        if (!this._nodeLookup.has(id)) return undefined;
        return this._nodeLookup.get(id);
    }

    public getNextNodeIdentifier() {
        let potentialIdNum = Object.keys(this._nodeLookup).length;
        while (this._nodeLookup.has(String(potentialIdNum))) {potentialIdNum++;}
        return String(potentialIdNum);
    }
    private _edgeIdCounter: number = 1;
    public getNextEdgeIdentifier(): number {
        return this._edgeIdCounter++;
    }

    // Graph notation functions
    public static fromNotation(text: string): Graph {
        const lines = preprocessGraphNotation(text);
        if (lines.length === 0) throw new ParsingError("The graph expression must have at least 1 line indicating the graph type.", 0, 0);
        const firstLine = lines[0];
        if (firstLine.startsWith("GENERIC")) {
            return GenericGraph.fromNotationPreprocessed(lines);
        } else if (firstLine.startsWith("GRID")) {
            return GridGraph.fromNotationPreprocessed(lines);
        } else {
            throw new ParsingError(`Unable to find graph type "${firstLine}", currently supported graph types are ${GRAPH_TYPE_NAMES.join(", ")}`, 0, 0);
        }
    }

    public static fromRaw(rawGraph: RawGraph): Graph {
        return graphFromRaw(rawGraph);
    }

    abstract stringify(): string;
}

export const GRAPH_TYPE_NAMES: string[] = ["GRID", "GENERIC"];

export class GridGraph extends Graph {
    width: number;
    height: number;
    diagonalWeights: number;

    constructor(width: number, height: number, diagonalWeights: number = DIAGONAL_WEIGHT_DISABLED) {
        super()
        this.width = width;
        this.height = height;
        this.diagonalWeights = diagonalWeights;
    }

    static fromNotation(text: string): GridGraph {
        return GridGraph.fromNotationPreprocessed(preprocessGraphNotation(text));
    }
    static fromNotationPreprocessed(lines: string[]): GridGraph {
        return gridGraphFromNotation(lines);
    }

    static idFromCoords(x: number, y: number): string {
        return `${x}_${y}`;
    }

    override get properties(): ItemProperty[] {
        return [
            ...super.properties,
            {name: "width", type: "number", value: this.width, check: (v: any) => v > 0 && Math.floor(v) === v},
            {name: "height", type: "number", value: this.height, check: (v: any) => v > 0 && Math.floor(v) === v},
            {name: "diagonal_weights", type: "number", value: this.diagonalWeights}
        ]
    }

    override setProp(name: string, value: any): boolean {
        if (super.setProp(name, value)) return true;

        if (name === "width") {
            this.setDimensions(value, this.height);
        } else if (name === "height") {
            this.setDimensions(this.width, value);
        } else if (name === "diagonal_weights") {
            this.diagonalWeights = value;
            this.updateAllTraversableEdges();
        } else {
            return false;
        }
        return true;
    }

    createNode(x: number, y: number, data: Object = {}): GraphNode {
        let node = new GraphNode(this, GridGraph.idFromCoords(x, y), x, y, data);
        this.addNode(node);
        return node;
    }

    getNodeByCoords(x: number, y: number): GraphNode | undefined {
        return this.getNodeById(GridGraph.idFromCoords(x, y));
    }
    ensureGetNodeByCoords(x: number, y: number) : GraphNode {
        const node = this.getNodeByCoords(x, y);
        if (node === undefined) throw new RuntimeError(`Error during node fetching. Attempted to read node ${GridGraph.idFromCoords(x, y)}. Node lookup: ${JSON.stringify([...this._nodeLookup.entries()].map(([id, node]) => {return `${id}=>${JSON.stringify(node)}`}))}`);
        return node;
    }

    updateAllTraversableEdges() {
        for (let node of this.getAllNodes()) {
            this.updateBaseEdges(node);
        }
    }
    updateBaseEdges(node: GraphNode) {
        // Edge traversability is not DYNAMIC!
        // Edges don't need to be removed, they'll be grayed out if they're not usable
        // All we have to do is ensure that they exist.
        
        /*if (node.data["traversable"] === false) {
            this.clearAllEdgesWith(node.id);
            return;
        }*/
        for (let [dx, dy] of ADJACENT_DELTAS) {
            let nx = node.x + dx;
            let ny = node.y + dy;
            if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
            let target = this.ensureGetNodeByCoords(nx, ny);
            // if (!target.data["traversable"]) continue;
            let edge = this.getEdge(node, target, true)
            if (edge === undefined) {
                edge = new GraphEdgeSimple(this.getNextEdgeIdentifier(), node, target, true);
                this.addEdge(edge);
            }
            if (Math.abs(dx) + Math.abs(dy) > 1) {
                edge.data["w"] = this.diagonalWeights;
                edge.data["forbidden"] = this.diagonalWeights < 0;
            }
        }
    }

    stringify(): string {
        return notationFromGridGraph(this);
    }

    private setDimensions(newWidth: number, newHeight: number) {
        let nodes = this.getAllNodes();
        let nodesToRemove = nodes.filter(n => n.x >= newWidth || n.y >= newHeight);
        // Initial check
        for (let node of nodesToRemove) {
            if (node.id === this.startNode?.id || node.id === this.endNode?.id) {
                throw new Error("Cannot remove start or end node when resizing the grid graph.");
            }
        }
        // Add new nodes
        for (let x = 0; x < newWidth; x++) {
            for (let y = 0; y < newHeight; y++) {
                if (this.getNodeByCoords(x, y) === undefined) {
                    this.createNode(x, y);
                }
            }
        }
        // Remove bad nodes
        for (let node of nodesToRemove) {
            this.removeNode(node);
        }
        this.width = newWidth;
        this.height = newHeight;
        this.updateAllTraversableEdges();
    }
}

export class GenericGraph extends Graph {
    constructor() {
        super();
    }

    static fromNotation(text: string): GenericGraph {
        return GenericGraph.fromNotationPreprocessed(preprocessGraphNotation(text));
    }
    static fromNotationPreprocessed(lines: string[]) {
        return genericGraphFromNotation(lines);
    }

    stringify(): string {
        return notationFromGenericGraph(this);
    }
}

export interface EditableGraphComponent extends EditableComponent {
    delete(): void;
}
