import { Graph, GridGraph, GenericGraph, EditableGraphComponent, } from "@/lib/graphs/graph"
import { renderValue } from "@/lib/strings/pretty"
import { useCallback, useEffect, useState } from "react";
import VisGraph, { GraphData, Options as VisGraphOptions } from "react-vis-graph-wrapper"
import DebugStepper from "@/app/components/controls/debugStepper";
import { Font, NodeOptions } from "vis-network";
import * as vis from 'vis-network'
import { colorWithAlpha } from "@/lib/utils/colors";
import { dangerButtonStyleClassNames, getButtonStyleClassNamesForColor } from "@/lib/statics/styleConstants";
import { PropertyInspector } from "@/app/components/editors/propertyEditor";
import { ensureError } from "@/lib/errors/error";
import { toast } from "react-toastify";
import { showConfirmation } from "@/app/components/dialogs/comfirm";
import { showInspectorDialog } from "@/app/components/dialogs/inspectorDialog";
import { ItemProperty } from "@/lib/utils/properties";
import { GraphEvents } from '../../../../lib/graphs/vis-events';

import "./graphView.css"
import { GraphEdge, GraphEdgeSimple, GraphNode } from "@/lib/graphs/components";

const minEdgeWidth = 1.5;
const maxEdgeWidth = 15;
function getVisOptions(graph: Graph | null = null): VisGraphOptions {
    let fontColor = "#7777ff";
    let fontStrokeColor = "#000000";
    let fontData : Font = {
        size: 14,
        color: fontColor,
        strokeWidth: 1,
        strokeColor: fontStrokeColor,
    };

    let base: VisGraphOptions = {
        edges: {
            labelHighlightBold: true,
            font: fontData,
            color: "white"
        },
        nodes: {
            font: fontData,
            scaling: {
                label: true
            }
        },
        height: "100%",
        interaction: {
            hover: true
        }
    }
    if (graph instanceof GridGraph) {
        base.physics = {
            barnesHut: {
                gravitationalConstant: 0,
                springConstant: 0,
                springLength: GRIDGRAPH_SCALE_FACTOR,
                centralGravity: 0.4
            }
        }
    }
    if (graph instanceof GenericGraph) {
        base.edges!.smooth = {
            enabled: true,
            type: "dynamic",
            roundness: 0.5
        }
        base.physics = {
            barnesHut: {
                gravitationalConstant: -2000,
                springConstant: 0.006,
                springLength: 60,
                centralGravity: 0.4,
            }
        }
    }
    return base;
};

export const GRIDGRAPH_SCALE_FACTOR = 50;
function getColorByState(state: string | undefined): string {
    switch (state) {
        case "visited":
            return "#ffff00";
        case "expanded":
            return "#66ff66";
        default:
            return "#999999";
    }
}

function getNodeAttributes(node: GraphNode, globals: VisGraphOptions): NodeOptions {
    let result : NodeOptions = {};
    let c;
    switch (node.graph.searchResult) {
        case "success":
            c = "#3333ff";
            break;
        case "failure":
            c = "#ff3333";
            break;
        default:
            c = getColorByState(node.data.state);
            break;      
    } 

    let traversabilityAlpha = node.traversable ? 0xff : 0x70;
    c = colorWithAlpha(c, traversabilityAlpha);
    let borderColor = node.data["highlighted"] ? "#ff0000" : c;
    result.borderWidth = node.data["highlighted"] ? 3 : 1;
    let held = node.graph.context.heldNode?.id === node.id;
    let hovered = node.graph.context.hoveredNode?.id === node.id;
    result.fixed = held;
    if (held) {
        borderColor = "#00ff00"; 
        result.borderWidth *= 2;
    } else if (hovered) {
        borderColor = "#0000ff";
    }
    if (node.graph instanceof GridGraph) {
        result.fixed = true;
    }
    result.color = {border: borderColor, background: c, highlight: {border: borderColor}};
    result.font = {
        "color": colorWithAlpha((globals.nodes!.font! as Font).color!, traversabilityAlpha),
        "strokeColor": colorWithAlpha((globals.nodes!.font! as Font).strokeColor!, traversabilityAlpha),
    };

    result.physics = node.graph?.physicsEnabled && node.graph.context.draggingNode != node; 

    if (node.graph instanceof GridGraph) {
        result.shape = "box";
        result.x = node.x * GRIDGRAPH_SCALE_FACTOR;
        result.y = node.y * GRIDGRAPH_SCALE_FACTOR;
        
    } else {
        result.shape = "dot";
        result.size = 8;
    }

    if (node.graph.startNode?.id === node.id) {
        result.shape = "diamond";
        result.size = 15;
    }
    if (node.graph.endNode?.id === node.id) {
        result.shape = "star";
        result.size = 15;
    }
    return result;
}

function getEdgeAttributes(edge: GraphEdge): Record<string, any> {
    let result : Record<string, any> = {};
    let c = "#ffffff";
    if (edge.getProp("highlighted")) {
        c = "#ff0000";
    }
    if (!edge.traversable() && !edge.reverse().traversable()) {
        c = colorWithAlpha(c, 0x10);
    }
    result.width = Math.min(maxEdgeWidth, minEdgeWidth + Math.max(0, Math.log2(edge.weight)));
    result.color = c;
    return result;
}

export function GraphComponentInspector({components, onChanges, onDeletionRequested, showDelete = true}: {
    components: EditableGraphComponent[], 
    onChanges: (property: string, oldValue: any, newValue: any) => void,
    onDeletionRequested: () => void,
    showDelete?: boolean
}) {
    if (components.length === 0) {
        return <></>
    }
    if (components.length > 1) {
        return <p>Multi-editing is not yet supported</p>
    }
    let name: string;
    try {
        name = components[0].getProp("id");
    } catch {
        name = "Unknown"
    }

    return <>
        <div className="flex flex-row justify-center mb-2">
            <h2 className="text-xl">{name}</h2>
        </div>
        <PropertyInspector properties={components[0].properties} onChange={onChanges} />
        { showDelete ?
            (<div className="flex flex-row justify-end my-1">
                <button className={`${dangerButtonStyleClassNames} px-1`} onClick={onDeletionRequested}>Delete</button>
            </div>) :
            <></>
        }
    </>
}

const nodeCreationProperties: ItemProperty[] = [
    {name: "id", type: "string", value: "", dynamic: true},
]

export default function GraphView({graph, logData, stepIndex, totalSteps, onGraphChanged, stepHandler, explanation}: {
    graph: Graph | null,
    logData: any,
    stepIndex: number,
    totalSteps: number,
    onGraphChanged: (graph: Graph, visual: boolean) => void,
    stepHandler: (step: number) => void,
    explanation?: string,
}) {
    const stringifySteps = () => {
        return `${stepIndex}/${totalSteps}`
    }

    let [visGraphData, setVisGraphData] = useState<GraphData>({nodes: [], edges: []});
    let [visGraphOptions, setVisGraphOptions] = useState(getVisOptions(graph));
    let [visNetwork, setVisNetwork] = useState<vis.Network | undefined>(undefined);

    const renderGraph = useCallback(() => {
        if (graph) {
            setVisGraphData({
                nodes: graph.getAllNodes().map((node, _idx) => {
                    return {id: node.id, label: node.getProp("label"), ...getNodeAttributes(node, visGraphOptions)}
                }),
                edges: graph.getAllEdges().map((edge, _idx) => {
                    let [source, target] = edge.data["flipped"] ? [edge.target.id, edge.source.id] : [edge.source.id, edge.target.id];
                    return {id: edge.id, from: source, to: target, arrows: (edge.isBidirectional ? '' : 'to'), ...getEdgeAttributes(edge)}
                })
            });
            let oldOptions = visGraphOptions;
            let newOptions = getVisOptions(graph);
            if (JSON.stringify(oldOptions) === JSON.stringify(newOptions)) return;
            setVisGraphOptions(newOptions);
        }
        console.log("Re-rendering graph")
    }, [graph, visGraphOptions])

    useEffect(() => {
        renderGraph();
    }, [renderGraph, stepIndex])

    const graphChangedCallback = useCallback((graph: Graph, visual: boolean) => {
        onGraphChanged(graph, visual);
        renderGraph();
    }, [onGraphChanged, renderGraph])
    const handleStepCallback = useCallback((step: number) => {
        stepHandler(step);
        // Using effect to ensure that the graph is re-rendered after the step is handled
    }, [stepHandler])
    
    const createNodeRequested = useCallback(async (options: {x?: number, y?: number} = {}) => {
        if (!graph) {
            toast.error("No valid graph loaded."); return;
        }
        let newData = await showInspectorDialog(nodeCreationProperties, "Node ID", "Enter the ID for the new node");
        if (newData === null) {return;} // cancelled
        if (!newData) {
            toast.error("No data entered, node creation cancelled."); return;
        }
        if (!newData.id) {
            toast.error("No ID entered, node creation cancelled."); return;
        }
        if (graph.getNodeById(newData.id)) {
            toast.error("Node with that ID already exists."); return;
        }
        let newNode = new GraphNode(graph, newData.id, options.x ?? 0, options.y ?? 0);
        graph.addNode(newNode);
        graphChangedCallback(graph, false);
    }, [graph, graphChangedCallback])

    //console.log(visGraphData);
    const [selectedComponents, setSelectedComponents] = useState<EditableGraphComponent[]>([]);
    const visGraphEvents: GraphEvents = {
        select: (event) => {
            if (!graph) return;
            let { nodes, edges } = event;
            let selectedNodes = nodes.map((node: string | number) => graph.getNodeById(node as string)!);
            if (selectedNodes.length > 0) { setSelectedComponents(selectedNodes); return; }
            else {setSelectedComponents(edges.map((edge: string | number) => graph.getEdgeById(edge as number)!))};
        },
        doubleClick: (event) => {
            if (!graph) return;
            let { nodes, edges, pointer } = event;
            let selectedNodes: GraphNode[] = nodes.map((node: string | number) => graph.getNodeById(node as string)!);
            if (selectedNodes.length > 0) {
                for (let node of selectedNodes) {
                    if (node) {
                        node.setProp("traversable", !node.traversable);
                    }
                    graphChangedCallback(graph, false);
                }
            } else if (selectedNodes.length === 0 && edges.length > 0) {
                for (let edgeId of edges) {
                    let edge = graph.getEdgeById(edgeId as number);
                    if (edge) {
                        edge.setProp("forbidden", !edge.getProp("forbidden"));
                    }
                    graphChangedCallback(graph, false);
                }
            } else {
                // double click on empty space
                if (graph instanceof GenericGraph) {
                    createNodeRequested({x: pointer.canvas.x, y: pointer.canvas.y});
                }
            }
        },
        hold: (event) => {
            if (!graph) return;
            if (graph instanceof GridGraph) return; // no edge creation in grid graphs
            //toast.info("Hold event triggered for node " + event.nodes[0] + " and edge " + event.edges[0]);
            if (event.nodes.length > 0) { graph.context.heldNode = graph.getNodeById(event.nodes[0] as string)}
            else if (event.edges.length > 0) { graph.context.heldEdge = graph.getEdgeById(event.edges[0] as number)}
            graphChangedCallback(graph, true);
        },
        hoverEdge(event) {
            if (!graph) return;
            graph.context.hoveredEdge = graph.getEdgeById(event.edge as number);
            graphChangedCallback(graph, true);
        },
        hoverNode(event) {
            if (!graph) return;
            graph.context.hoveredNode = graph.getNodeById(event.node as string);
            graphChangedCallback(graph, true);
        },
        blurEdge(event) {
            if (!graph) return;
            graph.context.hoveredEdge = undefined;
            graphChangedCallback(graph, true);
        },
        blurNode(event) {
            if (!graph) return;
            graph.context.hoveredNode = undefined;
            graphChangedCallback(graph, true);
        },
        dragStart: (event) => {
            if (!graph) return;
            if (graph instanceof GridGraph) return; // No edge creation for grid graphs
            graph.context.draggingNode = event.nodes.length === 0 ? undefined : graph.getNodeById(event.nodes[0] as string);
            graphChangedCallback(graph, true);
        },
        release: (event) => {
            if (!graph) return;
            let visual = true;
            // No edge creation for grid graphs
            if (!(graph instanceof GridGraph) && graph.context.heldNode && graph.context.hoveredNode) {
                let edge = new GraphEdgeSimple(graph.getNextEdgeIdentifier(), graph.context.heldNode, graph.context.hoveredNode, graph.getProp("default_bidirectional"));
                graph.addEdge(edge);
                visual = false;
            }
            graph.context.draggingNode = undefined;
            graph.context.heldEdge = undefined;
            graph.context.heldNode = undefined;
            graphChangedCallback(graph, visual);
        }
    }

    const gridOnly = graph instanceof GridGraph ? "" : "hidden";
    const genericOnly = graph instanceof GenericGraph ? "" : "hidden";
    const hideIfNothingSelected = selectedComponents.length > 0 ? "" : "hidden";

    return ( 
    <div className="flex flex-col h-full">
        <div className="flex-grow relative">
            <VisGraph
                style={{height: "100%", maxHeight: "75vh"}}
                graph={visGraphData}
                options={visGraphOptions}
                events={visGraphEvents}
                getNetwork={(network: vis.Network) => {
                    setVisNetwork(network);
                }}
            ></VisGraph>
            <div className={`graph-helper bg-secondary-100 dark:bg-secondary-900 rounded-xl px-2 py-1`}>
                <PropertyInspector properties={graph?.properties ?? []} onChange={(propertyName: string, oldValue: any, newValue: any) => {
                    try {
                        graph?.setProp(propertyName, newValue);
                        graphChangedCallback(graph!, false);
                    } catch (e) {
                        let err = ensureError(e);
                        toast.error(err.message);
                    }
                }} />
                <div className={`${genericOnly} flex flex-col items-end`}>
                    <button className={`${getButtonStyleClassNamesForColor("primary")} px-2 py-1 rounded-xl`} onClick={() => createNodeRequested()}>Create Node</button>
                </div>
            </div>
            <div className={`edit-menu bg-secondary-100 dark:bg-secondary-900 rounded-xl px-2 py-1 ${hideIfNothingSelected}`}>
                <GraphComponentInspector components={selectedComponents} showDelete={!(graph instanceof GridGraph)} onChanges={(property: string, oldValue: any, newValue: any) => {
                    // Will have to be edited to support undo/redo
                    console.log("Changing property", property, "from", oldValue, "to", newValue)
                    for (let component of selectedComponents) {
                        component.setProp(property, newValue);
                    }
                    graphChangedCallback(graph!, false);
                }} onDeletionRequested={async () => {
                    let confirm = await showConfirmation(`Are you sure you want to delete the selected components (${selectedComponents.map(c => c.id).join(", ")})?`)
                    if (!confirm) return;

                    for (let component of selectedComponents) {
                        component.delete();
                    }
                    setSelectedComponents([]);
                    graphChangedCallback(graph!, false);
                }} />
            </div>
        </div>
        <div className="h-16">
            {logData !== undefined && logData !== null ? (<div className="flex max-h-16 overflow-auto flex-row items-stretch rounded-xl border-2 p-1 border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950">
                {renderValue(logData)}
            </div>) : <></>}
        </div>
        <DebugStepper onStepChange={handleStepCallback} step={stepIndex} maxSteps={totalSteps} explanation={explanation} />
    </div>
    )
}