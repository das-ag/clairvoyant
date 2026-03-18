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
const RecordType = new IDocType("object");

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
                    <p className="mb-3 opacity-80">
                        These methods are inherited from the base class. Call them from your algorithm to animate operations step by step.
                        Each method auto-generates a descriptive message from its arguments. You can override or customize these messages
                        using the <a href="#annotations">annotation system</a>.
                    </p>

                    <DocsFunction clazzName="RBTSolution" functionName="insertNode" args={[
                        { name: "z", type: RBNodeType }
                    ]}>
                        <p>Inserts a node into the tree using standard BST insertion (walks the tree to find the correct position). The insertion is animated in the visualizer.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="removeNode" args={[
                        { name: "z", type: RBNodeType }
                    ]}>
                        <p>Marks a node as removed from the tree. The node will fade out in the visualizer.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="recolor" args={[
                        { name: "node", type: RBNodeType },
                        { name: "color", type: RBColorType }
                    ]}>
                        <p>Changes the color of a node. Use <code>&quot;RED&quot;</code> or <code>&quot;BLACK&quot;</code> as the color value.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="linkLeft" args={[
                        { name: "parent", type: RBNodeType },
                        { name: "child", type: RBNodeType }
                    ]}>
                        <p>Sets <code>parent.left = child</code>. Use this for rotation and transplant implementations.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="linkRight" args={[
                        { name: "parent", type: RBNodeType },
                        { name: "child", type: RBNodeType }
                    ]}>
                        <p>Sets <code>parent.right = child</code>. Use this for rotation and transplant implementations.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="linkParent" args={[
                        { name: "child", type: RBNodeType },
                        { name: "parent", type: RBNodeType }
                    ]}>
                        <p>Sets <code>child.parent = parent</code>. Use this for rotation and transplant implementations.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="setRoot" args={[
                        { name: "node", type: RBNodeType }
                    ]}>
                        <p>Sets the tree&apos;s root to the given node.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="trackPointer" args={[
                        { name: "name", type: ConstDocString },
                        { name: "node", type: RBNodeType }
                    ]} returnType={RBNodeType}>
                        <p>Highlights a node in the visualizer with a labeled pointer (e.g. &quot;z&quot;, &quot;x&quot;, &quot;uncle&quot;). The label appears above the node and is shown in the watch panel.
                        Returns the <code>node</code> argument, so you can combine assignment and tracking in a single expression:</p>
                        <pre className="bg-black/20 rounded p-2 mt-1 mb-1 text-sm overflow-x-auto"><code>{"let w = this.trackPointer(\"w\", x.parent.right);"}</code></pre>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="clearPointer" args={[
                        { name: "name", type: ConstDocString }
                    ]}>
                        <p>Removes a previously tracked pointer label.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="logStep" args={[
                        { name: "ctx", type: RecordType, default: undefined, showDefault: true }
                    ]}>
                        <p>Records a narrative step without performing any tree mutation. The message is
                        pulled from the <a href="#annotations">line annotation</a> and evaluated with
                        the optional <code>ctx</code> object merged into the template context. Pass
                        local variables that should be available in the annotation template, e.g.
                        {" "}<code>{"this.logStep({key})"}</code>.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="logCase" args={[
                        { name: "label", type: ConstDocString }
                    ]}>
                        <p>Records a fixup case entry. The <code>label</code> (e.g. <code>&quot;Insert Case 1&quot;</code>)
                        is displayed in a color-coded badge in the top-right corner of the viewport.
                        The badge tracks all cases encountered during the current operation and can be
                        expanded to see the full history. Cases are cleared automatically when a new
                        insert or delete begins.</p>
                    </DocsFunction>
                    <DocsFunction clazzName="RBTSolution" functionName="done" args={[
                        { name: "ctx", type: RecordType, default: undefined, showDefault: true }
                    ]}>
                        <p>Marks the operation as complete. Call this at the end of insert and delete. Like <code>logStep</code>,
                        accepts an optional context object for the annotation template.</p>
                    </DocsFunction>
                </DocsClass>

                {/* ── Annotation System ─────────────────────────────────────── */}

                <div id="annotations">
                <DocsClass clazzName="Annotations">
                    <p className="mb-3">
                        The annotation system lets you add descriptive messages and branch explanations
                        to algorithm lines <b>without cluttering the code</b>. Messages are stored
                        separately and can be edited interactively.
                    </p>

                    <h4 className="font-semibold mt-4 mb-1">How it works</h4>
                    <ul className="list-disc *:ml-5 mb-3">
                        <li>Each visualization method auto-generates a message from its arguments
                            (e.g. <code>linkLeft(parent, child)</code> produces
                            {" "}<code>&quot;parent.key.left &larr; child.key&quot;</code>).</li>
                        <li>An annotation can <b>override</b> the auto-generated message for any line.</li>
                        <li>Annotations on <code>if</code>/<code>else if</code>/<code>else</code> lines
                            define branch Q&amp;A that is displayed automatically when execution enters
                            that branch.</li>
                        <li>Default annotations ship alongside the algorithm in a <code>.annotations.json</code> file.</li>
                    </ul>

                    <h4 className="font-semibold mt-4 mb-1">Using the gutter UI</h4>
                    <p className="mb-2">
                        A small icon column appears to the right of line numbers in the code editor:
                    </p>
                    <ul className="list-disc *:ml-5 mb-3">
                        <li><span style={{color:"#4fc3f7"}}>&#9679;</span> (blue dot) — this line has a message annotation.</li>
                        <li><span style={{color:"#ffd54f"}}>&#9670;</span> (yellow diamond) — this is a branch line with a Q&amp;A annotation.</li>
                        <li>Hover to reveal a <b>+</b> icon on unannotated lines.</li>
                        <li>Click any icon to open the popover editor.</li>
                    </ul>

                    <h4 className="font-semibold mt-4 mb-1">Template syntax</h4>
                    <p className="mb-2">
                        Annotation messages use JavaScript template literal syntax (<code>{"${...}"}</code>).
                        The following variables are available:
                    </p>
                    <ul className="list-disc *:ml-5 mb-3">
                        <li><b>Method arguments</b> — for viz methods, the parameter names are available
                            (e.g. <code>parent</code>, <code>child</code> for <code>linkLeft</code>).</li>
                        <li><b>Tracked pointers</b> — all currently tracked pointers by name
                            (e.g. <code>z</code>, <code>x</code>, <code>uncle</code>). These are
                            {" "}<DocsRef refs="RBNode">RBNode</DocsRef> objects, so you can
                            access <code>.key</code>, <code>.color</code>, <code>.isNil</code>, etc.</li>
                        <li><code>tree</code> — the <DocsRef refs="RBTree">RBTree</DocsRef> instance.</li>
                        <li><code>NIL</code> — the tree&apos;s NIL sentinel.</li>
                        <li>For <code>logStep</code> and <code>done</code>, any variables passed in
                            the <code>ctx</code> argument.</li>
                    </ul>
                    <p className="opacity-80 text-sm">
                        If a template expression throws an error, the raw template string is displayed as a fallback.
                    </p>

                    <h4 className="font-semibold mt-4 mb-1">Branch annotations</h4>
                    <p className="mb-2">
                        Branches are detected automatically from <code>if</code>/<code>else if</code>/<code>else</code> lines.
                        When a visualization method fires inside a branch body and there is an annotation on the
                        enclosing branch line with <b>question</b> and <b>answer</b> fields, a branch
                        step is automatically inserted before the visualization step. This replaces the
                        old <code>this.branch()</code> method.
                    </p>

                    <h4 className="font-semibold mt-4 mb-1">Annotation storage</h4>
                    <p>
                        Annotations are stored as content-anchored entries (keyed by function name and
                        trimmed line content, not line numbers), making them resilient to code edits.
                        User edits persist for the current session. Defaults can be restored via the
                        &quot;Reset&quot; button in the popover.
                    </p>
                </DocsClass>
                </div>

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
