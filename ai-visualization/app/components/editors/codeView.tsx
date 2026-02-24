import ReactCodeMirror, { EditorView, Extension, ReactCodeMirrorProps } from "@uiw/react-codemirror"
import React, { useEffect, useRef } from "react"
import { StateEffect, StateField } from "@codemirror/state"
import { Decoration, DecorationSet } from "@codemirror/view"

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

type CodeViewProps = {
    activeLine?: number | null;
} & ReactCodeMirrorProps

export default function CodeView(props: CodeViewProps) {
    let containerRef = React.useRef<HTMLDivElement>(null)
    let editorViewRef = useRef<EditorView | null>(null);
    let { extensions, activeLine, ...codeMirrorProps } = props
    let [fontSize, setFontSize] = React.useState(14);
    let [extraExtensions, setExtraExtensions] = React.useState<Extension[]>([]);

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

    return (
        <div ref={containerRef}>
            <ReactCodeMirror
                extensions={[activeLineField, ...extensions ?? [], extraExtensions]}
                onCreateEditor={(view) => { editorViewRef.current = view; }}
                {...codeMirrorProps}
            />
        </div>
    )
}
