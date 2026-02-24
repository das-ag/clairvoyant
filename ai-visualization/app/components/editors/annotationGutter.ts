import { StateEffect, StateField, RangeSet } from "@codemirror/state";
import { gutter, GutterMarker, EditorView } from "@codemirror/view";
import type { ResolvedAnnotationMap } from "@/lib/rbt/rbtAnnotations";

// ── Effects ─────────────────────────────────────────────────────────────

export const setAnnotationsEffect = StateEffect.define<ResolvedAnnotationMap>();
export const annotationClickEffect = StateEffect.define<number>();

// ── State field: current annotations ────────────────────────────────────

const annotationsField = StateField.define<ResolvedAnnotationMap>({
    create() {
        return new Map();
    },
    update(value, tr) {
        for (const e of tr.effects) {
            if (e.is(setAnnotationsEffect)) return e.value;
        }
        return value;
    },
});

// ── Branch-line detection ───────────────────────────────────────────────

const BRANCH_LINE_RE =
    /^\s*(\}\s*)?(else\s+)?if\s*\(|^\s*(\}\s*)?else\s*(\{|$)/;

function isBranchLine(text: string): boolean {
    return BRANCH_LINE_RE.test(text);
}

// ── Gutter markers ─────────────────────────────────────────────────────

class AnnotationMarker extends GutterMarker {
    constructor(
        readonly isBranch: boolean,
        readonly hasAnnotation: boolean,
    ) {
        super();
    }

    eq(other: GutterMarker): boolean {
        return (
            other instanceof AnnotationMarker &&
            other.isBranch === this.isBranch &&
            other.hasAnnotation === this.hasAnnotation
        );
    }

    toDOM(): HTMLElement {
        const span = document.createElement("span");
        span.className = "cm-annotation-marker";

        if (this.hasAnnotation) {
            span.textContent = this.isBranch ? "◆" : "●";
            span.classList.add("cm-annotation-filled");
        } else {
            span.textContent = "+";
            span.classList.add("cm-annotation-empty");
        }
        if (this.isBranch) {
            span.classList.add("cm-annotation-branch");
        }
        return span;
    }
}

// ── Gutter definition ──────────────────────────────────────────────────

const annotationGutter = gutter({
    class: "cm-annotation-gutter",
    markers(view) {
        const annos = view.state.field(annotationsField);
        const builder: { from: number; marker: GutterMarker }[] = [];

        for (let i = 1; i <= view.state.doc.lines; i++) {
            const line = view.state.doc.line(i);
            const text = line.text;
            if (!text.trim()) continue;
            const branch = isBranchLine(text);
            const has = annos.has(i);
            if (has || branch) {
                builder.push({ from: line.from, marker: new AnnotationMarker(branch, has) });
            }
        }

        return RangeSet.of(
            builder.map((b) => b.marker.range(b.from)),
            true,
        );
    },
    domEventHandlers: {
        click(view, line) {
            const lineNum = view.state.doc.lineAt(line.from).number;
            view.dispatch({ effects: annotationClickEffect.of(lineNum) });
            return true;
        },
    },
});

// ── Theme ──────────────────────────────────────────────────────────────

const annotationGutterTheme = EditorView.baseTheme({
    ".cm-annotation-gutter": {
        width: "18px",
        cursor: "pointer",
        "& .cm-gutterElement": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
        },
    },
    ".cm-annotation-marker": {
        fontSize: "10px",
        lineHeight: "1",
        userSelect: "none",
    },
    ".cm-annotation-filled": {
        color: "#4fc3f7",
    },
    ".cm-annotation-empty": {
        color: "transparent",
        transition: "color 0.15s",
    },
    ".cm-annotation-gutter .cm-gutterElement:hover .cm-annotation-empty": {
        color: "#666",
    },
    ".cm-annotation-branch.cm-annotation-filled": {
        color: "#ffd54f",
    },
    ".cm-annotation-branch.cm-annotation-empty": {
        color: "transparent",
    },
    ".cm-annotation-gutter .cm-gutterElement:hover .cm-annotation-branch.cm-annotation-empty": {
        color: "#998a33",
    },
});

// ── Public extension bundle ─────────────────────────────────────────────

export function annotationGutterExtension(): [
    typeof annotationsField,
    typeof annotationGutter,
    typeof annotationGutterTheme,
] {
    return [annotationsField, annotationGutter, annotationGutterTheme];
}
