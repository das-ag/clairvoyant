"use client"

import { DocsClass } from "@/app/components/docs/docsClass";
import { DocsContainer } from "@/app/components/docs/docsContainer";
import { DocsFunction } from "@/app/components/docs/docsFunction";
import DocsProperty from "@/app/components/docs/docsProperty";
import DocsRef from "@/app/components/docs/docsReference";
import { DocsWarning } from "@/app/components/docs/docsSections";
import Header from "@/app/components/header";
import { ConstDocAny, ConstDocBoolean, ConstDocNumber, ConstDocString, ConstDocVoid, IDocType, docArrayOf } from "@/lib/docs/doclib";

const RBTreeType = new IDocType("RBTree", "", "RBTree");
const RBNodeType = new IDocType("RBNode", "", "RBNode");
const RBColorType = new IDocType("RBColor", "", "RBColor");

export default function RedBlackTreeDocs() {
    return (
        <div>
            <Header selectedPage="redblacktree"></Header>
            <DocsContainer title={"Red-Black Tree Documentation"}>
                <div>
                    <p>
                        This documentation refers to the Red-Black Tree problem. Your solution class
                        will <b>automatically</b> extend <a href="#RBTSolution">RBTSolution</a>,
                        and must implement the following methods:
                    </p>
                    <ul className="list-disc *:ml-5">
                        <li><a href="#RBTSolution.constructor">constructor</a></li>
                        <li><a href="#RBTSolution.insert">insert</a></li>
                        <li><a href="#RBTSolution.delete">delete</a></li>
                    </ul>
                    <p>
                        Your script should evaluate to the prototype of your defined class.
                    </p>
                </div>
                <DocsWarning>At present, your code is run as-is on your web client. <b>Long-running or infinite</b> loops will therefore crash your web client. Take appropriate actions to mitigate this issue when writing custom code.</DocsWarning>

                <DocsClass clazzName="RBTSolution">
                    <DocsFunction clazzName="RBTSolution" functionName="constructor" hideReturnType args={[
                        { name: "tree", type: RBTreeType }
                    ]}>
                        <p>The constructor receives the <DocsRef refs="RBTree">RBTree</DocsRef> instance. Use it to store a reference to the tree for later use.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="insert" args={[
                        { name: "key", type: ConstDocNumber }
                    ]}>
                        <p>Called when the user requests an insertion. You should implement the full RB-INSERT algorithm including the fixup procedure.</p>
                        <p>Use <code>this.tree.makeNode(key)</code> to create a new node, then use the visualization methods below to animate each step.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="delete" args={[
                        { name: "key", type: ConstDocNumber }
                    ]}>
                        <p>Called when the user requests a deletion. You should implement the full RB-DELETE algorithm including the fixup procedure.</p>
                        <p>Use <code>this.tree.search(key)</code> to find the node to delete.</p>
                    </DocsFunction>

                    <h3 className="text-lg font-semibold mt-6 mb-2">Visualization Methods</h3>
                    <p className="mb-3 opacity-80">These methods are inherited from the base class. Call them from your algorithm to animate operations step by step.</p>

                    <DocsFunction clazzName="RBTSolution" functionName="insertNode" args={[
                        { name: "z", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Inserts a node into the tree using standard BST insertion (walks the tree to find the correct position). The insertion is animated in the visualizer.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="removeNode" args={[
                        { name: "z", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Marks a node as removed from the tree. The node will fade out in the visualizer.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="recolor" args={[
                        { name: "node", type: RBNodeType },
                        { name: "color", type: RBColorType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Changes the color of a node. Use <code>&quot;RED&quot;</code> or <code>&quot;BLACK&quot;</code> as the color value.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="linkLeft" args={[
                        { name: "parent", type: RBNodeType },
                        { name: "child", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Sets <code>parent.left = child</code>. Use this for rotation and transplant implementations.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="linkRight" args={[
                        { name: "parent", type: RBNodeType },
                        { name: "child", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Sets <code>parent.right = child</code>. Use this for rotation and transplant implementations.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="linkParent" args={[
                        { name: "child", type: RBNodeType },
                        { name: "parent", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Sets <code>child.parent = parent</code>. Use this for rotation and transplant implementations.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="setRoot" args={[
                        { name: "node", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Sets the tree&apos;s root to the given node.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="trackPointer" args={[
                        { name: "name", type: ConstDocString },
                        { name: "node", type: RBNodeType },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Highlights a node in the visualizer with a labeled pointer (e.g. &quot;z&quot;, &quot;x&quot;, &quot;uncle&quot;). The label appears above the node and is shown in the watch panel.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="clearPointer" args={[
                        { name: "name", type: ConstDocString },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Removes a previously tracked pointer label.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="branch" args={[
                        { name: "question", type: ConstDocString },
                        { name: "answer", type: ConstDocString },
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Records a branching decision. The question and answer are displayed together in the debugger&apos;s explanation panel, providing intuition for why a particular case was selected.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="logStep" args={[
                        { name: "msg", type: ConstDocString }
                    ]}>
                        <p>Logs an explanatory message as a step without performing any tree mutation.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="done" args={[
                        { name: "msg", type: ConstDocString, default: undefined, showDefault: true }
                    ]}>
                        <p>Marks the operation as complete. Call this at the end of insert and delete.</p>
                    </DocsFunction>
                </DocsClass>

                <DocsClass clazzName="RBTree">
                    <p>The red-black tree instance. Accessed via <code>this.tree</code> in your solution.</p>
                    <DocsProperty property={{ name: "root", type: RBNodeType }}>
                        <p>The root node of the tree. Equals <code>tree.NIL</code> when the tree is empty.</p>
                    </DocsProperty>
                    <DocsProperty property={{ name: "NIL", type: RBNodeType }}>
                        <p>The sentinel NIL node. All leaf pointers and the root&apos;s parent point to this node. Its color is always BLACK.</p>
                    </DocsProperty>
                    <DocsFunction clazzName="RBTree" functionName="makeNode" args={[
                        { name: "key", type: ConstDocNumber }
                    ]} returnType={RBNodeType}>
                        <p>Creates a new node with the given key. The node starts with both children and parent set to NIL.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTree" functionName="search" args={[
                        { name: "key", type: ConstDocNumber }
                    ]} returnType={RBNodeType}>
                        <p>Searches for a node with the given key. Returns the node if found, or <code>tree.NIL</code> if not found.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTree" functionName="minimum" args={[
                        { name: "node", type: RBNodeType }
                    ]} returnType={RBNodeType}>
                        <p>Returns the node with the smallest key in the subtree rooted at the given node.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTree" functionName="allNodes" returnType={docArrayOf(RBNodeType)}>
                        <p>Returns an array of all reachable nodes in the tree (excluding NIL).</p>
                    </DocsFunction>
                </DocsClass>

                <DocsClass clazzName="RBNode">
                    <p>A node in the red-black tree.</p>
                    <DocsProperty property={{ name: "key", type: ConstDocNumber }}>
                        <p>The integer key stored in this node.</p>
                    </DocsProperty>
                    <DocsProperty property={{ name: "color", type: RBColorType }}>
                        <p>The color of this node: <code>&quot;RED&quot;</code> or <code>&quot;BLACK&quot;</code>.</p>
                    </DocsProperty>
                    <DocsProperty property={{ name: "left", type: RBNodeType }}>
                        <p>The left child. Equals <code>tree.NIL</code> if there is no left child.</p>
                    </DocsProperty>
                    <DocsProperty property={{ name: "right", type: RBNodeType }}>
                        <p>The right child. Equals <code>tree.NIL</code> if there is no right child.</p>
                    </DocsProperty>
                    <DocsProperty property={{ name: "parent", type: RBNodeType }}>
                        <p>The parent node. Equals <code>tree.NIL</code> for the root node.</p>
                    </DocsProperty>
                    <DocsProperty property={{ name: "isNil", type: ConstDocBoolean }}>
                        <p>Returns <code>true</code> if this node is the NIL sentinel.</p>
                    </DocsProperty>
                </DocsClass>
            </DocsContainer>
        </div>
    )
}
