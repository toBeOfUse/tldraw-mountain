// custom mountains ui. this is all incredibly stupid

import valleyDataUrl from "./assets/valley.svg?base64";
import mountainDataUrl from "./assets/mountain.svg?base64";
import mountainHalfDataUrl from "./assets/mountain-half.svg?base64";
import mountainFullDataUrl from "./assets/mountain-full.svg?base64";

import valley from "./assets/valley.svg";
import mountain from "./assets/mountain.svg";
import mountainHalf from "./assets/mountain-half.svg";
import mountainFull from "./assets/mountain-full.svg";

import { Editor, TextShapeUtil, TldrawUiIcon, track, useEditor } from "tldraw";

// TODO: adjust handle geometry to allow for dragging the mountain itself around

const MOUNTAINS = [
  { value: "valley", image: valley, dataUrl: valleyDataUrl },
  { value: "mountain", image: mountain, dataUrl: mountainDataUrl },
  { value: "mountain-half", image: mountainHalf, dataUrl: mountainHalfDataUrl },
  { value: "mountain-full", image: mountainFull, dataUrl: mountainFullDataUrl },
  { value: "none", image: "", dataUrl: "" },
] as const;

export type MountainState = (typeof MOUNTAINS)[number]["value"];

const mountainsToImages = Object.fromEntries(
  MOUNTAINS.map((mountain) => [mountain.value, mountain.image])
);

export const addMountainPseudoElements = (editor: Editor) => {
  const idsToMountainState = Object.fromEntries(
    editor
      .getCurrentPageShapes()
      .filter((shape) => !!shape.meta.mountain)
      .map((shape) => [shape.id, shape.meta.mountain as MountainState])
  );
  let css = "";
  for (const [id, state] of Object.entries(idsToMountainState)) {
    css += `
            [data-shape-id="${id}"]::after {
                background-image: url('${mountainsToImages[state]}');
                content: ' ';
                background-size: contain;
                background-position: center center;
                background-repeat: no-repeat;
                position: absolute;
                z-index: 100000;
                left: -50px;
                top: 50%;
                transform: translateY(-55%);
                display: block;
                width: 40px;
                height: 50px;
            }
        `;
  }
  document.getElementById("terrible-hack")!.innerHTML = css;
};

const originalToSvg = TextShapeUtil.prototype.toSvg;
TextShapeUtil.prototype.toSvg = function (shape, ctx) {
  const base = originalToSvg.call(this, shape, ctx);
  const imageUrl = MOUNTAINS.find((m) => m.value === shape.meta.mountain)?.dataUrl;

  // TODO: widths & heights are hard-coded independently all over the place,
  // here and in addMountainPseudoElements

  // find the offset to center the image vertically with the text. you want to
  // move it up by half the amount that it's taller than the text by
  const geometry = this.getGeometry(shape, {});
  const imageHeight = 50;
  const offset = -((imageHeight - geometry.getBounds().height) / 2);
  return (
    <g>
      {!!imageUrl && (
        <image
          href={`data:image/svg+xml;base64,${imageUrl}`}
          transform={`translate(-50 ${offset})`}
          height="50"
          width="40"
        />
      )}
      {base}
    </g>
  );
};

export const mountMountainsOnEditor = (editor: Editor) => {
  addMountainPseudoElements(editor);

  editor.store.listen((thing) => {
    if (
      Object.values(thing.changes.updated).some(
        ([from, to]) => from.meta.mountain !== to.meta.mountain
      ) ||
      Object.values(thing.changes.added).some((newThing) => newThing.meta.mountain) ||
      Object.values(thing.changes.updated).some(
        ([from, to]) =>
          "currentPageId" in from &&
          "currentPageId" in to &&
          from.currentPageId !== to.currentPageId
      )
    ) {
      addMountainPseudoElements(editor);
    }
  });
};

export const MountainToolbar = track(() => {
  const editor = useEditor();
  const showToolbar =
    editor.isIn("select.idle") &&
    !editor.getSelectedShapes().some((shape) => shape.type !== "text");
  if (!showToolbar) return null;
  const selectionRotatedPageBounds = editor.getSelectionRotatedPageBounds();
  if (!selectionRotatedPageBounds) return null;

  let selected: MountainState | null = null;
  const mountains = new Set(
    editor.getSelectedShapes().map((shape) => shape.meta.mountain as MountainState)
  );
  if (mountains.size == 1) {
    selected = Array.from(mountains)[0];
  }

  const viewportCoordinates = editor.pageToViewport(selectionRotatedPageBounds.point);

  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "all",
        top: viewportCoordinates.y - 42,
        left: viewportCoordinates.x,
        width: selectionRotatedPageBounds.width * editor.getZoomLevel(),
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          borderRadius: 8,
          display: "flex",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)",
          background: "var(--color-panel)",
          width: "fit-content",
          alignItems: "center",
        }}
      >
        {MOUNTAINS.map(({ value, image }) => {
          const isActive = value === selected && value !== "none";
          return (
            <div
              key={value}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 32,
                width: 32,
                background: isActive ? "lightgray" : "transparent",
              }}
              onClick={() => {
                editor.updateShapes(
                  editor.getSelectedShapes().map((shape) => ({
                    id: shape.id,
                    type: shape.type,
                    meta: {
                      mountain: value,
                    },
                  }))
                );
              }}
            >
              {image ? (
                <img style={{ height: 30, width: 30, objectFit: "contain" }} src={image} />
              ) : (
                <TldrawUiIcon icon="cross-circle" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
