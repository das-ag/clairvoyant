import ReactCodeMirror, { EditorView, Extension, ReactCodeMirrorProps } from "@uiw/react-codemirror"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { StateEffect, StateField } from "@codemirror/state"
import { Decoration, DecorationSet } from "@codemirror/view"
import type { ResolvedAnnotationMap, LineAnnotation } from "@/lib/rbt/rbtAnnotations"
import { annotationGutterExtension, setAnnotationsEffect, annotationClickEffect } from "./annotationGutter"
import AnnotationPopover from "./annotationPopover"

const setActiveLineEffect = StateEffect.define<number | null>();

const activeLineDecoration = Decoration.line({ class: "cm-active-algorithm-line" });

const activeLineField = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(decorations, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setActiveLineEffect)) {
                if (effect.value === null || effect.value <= 0) return Decoration.none;
                try {
                    const line = tr.state.doc.line(effect.value);
                    return Decoration.set([activeLineDecoration.range(line.from)]);
                } catch {
                    return Decoration.none;
                }
            }
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f),
});

const BRANCH_LINE_RE = /^\s*(\}\s*)?(else\s+)?if\s*\(|^\s*(\}\s*)?else\s*(\{|$)/;

type PopoverState = {
    line: number;
    top: number;
    left: number;
    isBranch: boolean;
} | null;

type CodeViewProps = {
    activeLine?: number | null;
    annotations?: ResolvedAnnotationMap;
    defaultAnnotations?: ResolvedAnnotationMap;
    onAnnotationEdit?: (line: number, annotation: LineAnnotation | null) => void;
    containerClassName?: string;
} & ReactCodeMirrorProps

export default function CodeView(props: CodeViewProps) {
    let containerRef = React.useRef<HTMLDivElement>(null)
    let editorViewRef = useRef<EditorView | null>(null);
    let { extensions, activeLine, annotations, defaultAnnotations, onAnnotationEdit, containerClassName, ...codeMirrorProps } = props
    let [fontSize, setFontSize] = React.useState(14);
    let [extraExtensions, setExtraExtensions] = React.useState<Extension[]>([]);
    let [popover, setPopover] = useState<PopoverState>(null);

    const onAnnotationEditRef = useRef(onAnnotationEdit);
    onAnnotationEditRef.current = onAnnotationEdit;

    const annotationsRef = useRef(annotations);
    annotationsRef.current = annotations;

    const defaultAnnotationsRef = useRef(defaultAnnotations);
    defaultAnnotationsRef.current = defaultAnnotations;

    const showGutter = !!annotations;
    const gutterExt = useRef(showGutter ? annotationGutterExtension() : null);
    if (showGutter && !gutterExt.current) {
        gutterExt.current = annotationGutterExtension();
    }

    useEffect(() => {
        let listener = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                let newFontSize = fontSize - e.deltaY / 100;
                setFontSize(newFontSize);
                setExtraExtensions([
                    EditorView.theme({
                        "&": {fontSize: `${newFontSize}px`}
                    })
                ])
            }
        }
        if (containerRef.current) {
            containerRef.current.addEventListener("wheel", listener);
        }
        let oldRef = containerRef.current;
        return () => {
            if (oldRef) {
                oldRef.removeEventListener("wheel", listener);
            }
        }
    }, [containerRef, fontSize])

    useEffect(() => {
        const view = editorViewRef.current;
        if (!view) return;

        view.dispatch({ effects: setActiveLineEffect.of(activeLine ?? null) });

        if (activeLine && activeLine > 0) {
            try {
                const line = view.state.doc.line(activeLine);
                view.dispatch({
                    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
                });
            } catch { /* line out of range */ }
        }
    }, [activeLine]);

    useEffect(() => {
        const view = editorViewRef.current;
        if (view && annotations) {
            view.dispatch({ effects: setAnnotationsEffect.of(annotations) });
        }
    }, [annotations]);

    const handleAnnotationClick = useCallback((lineNum: number) => {
        const view = editorViewRef.current;
        const container = containerRef.current;
        if (!view || !container) return;

        try {
            const line = view.state.doc.line(lineNum);
            const coords = view.coordsAtPos(line.from);
            if (!coords) return;
            const containerRect = container.getBoundingClientRect();
            const isBranch = BRANCH_LINE_RE.test(line.text);
            setPopover({
                line: lineNum,
                top: coords.top - containerRect.top + 24,
                left: 40,
                isBranch,
            });
        } catch { /* line out of range */ }
    }, []);

    const handlePopoverSave = useCallback((line: number, annotation: LineAnnotation | null) => {
        onAnnotationEditRef.current?.(line, annotation);
    }, []);

    const handlePopoverClose = useCallback(() => {
        setPopover(null);
    }, []);

    const handleUpdate = useCallback((update: any) => {
        for (const tr of update.transactions) {
            for (const e of tr.effects) {
                if (e.is(annotationClickEffect)) {
                    handleAnnotationClick(e.value);
                }
            }
        }
    }, [handleAnnotationClick]);

    const allExtensions = React.useMemo(() => {
        const exts: Extension[] = [activeLineField];
        if (gutterExt.current) exts.push(...gutterExt.current);
        if (extensions) exts.push(...(Array.isArray(extensions) ? extensions : [extensions]));
        exts.push(extraExtensions);
        return exts;
    }, [extensions, extraExtensions, showGutter]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div ref={containerRef} className={containerClassName ?? "relative"}>
            <ReactCodeMirror
                extensions={allExtensions}
                onCreateEditor={(view) => { editorViewRef.current = view; }}
                onUpdate={showGutter ? handleUpdate : undefined}
                {...codeMirrorProps}
            />
            {popover && (
                <AnnotationPopover
                    line={popover.line}
                    isBranch={popover.isBranch}
                    current={annotationsRef.current?.get(popover.line)}
                    defaultAnnotation={defaultAnnotationsRef.current?.get(popover.line)}
                    top={popover.top}
                    left={popover.left}
                    onSave={handlePopoverSave}
                    onClose={handlePopoverClose}
                />
            )}
        </div>
    )
}
