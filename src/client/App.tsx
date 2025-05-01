import { useSync } from "@tldraw/sync";
import {
  AssetRecordType,
  Editor,
  TLAssetStore,
  TLBookmarkAsset,
  TLEditorComponents,
  Tldraw,
  TldrawUiIcon,
  getHashForString,
  track,
  uniqueId,
  useEditor,
} from "tldraw";

const WORKER_URL = `${window.location.protocol}//${window.location.hostname}:5858`;

// In this example, the room ID is hard-coded. You can set this however you like though.
const roomId = "test-room";

const MOUNTAINS = [
  { value: "mountain", image: "mountain.webp" },
  { value: "mountain-half", image: "mountain.webp" },
  { value: "mountain-full", image: "mountain.webp" },
  { value: "none", image: "" },
] as const;

type MountainState = (typeof MOUNTAINS)[number]["value"];

const mountainsToImages = Object.fromEntries(
  MOUNTAINS.map((mountain) => [mountain.value, mountain.image])
);

const addMountainPseudoElements = (editor: Editor) => {
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
				background-image: url('/${mountainsToImages[state]}');
				content: ' ';
				background-size: contain;
				background-position: center center;
				background-repeat: no-repeat;
				position:relative;
				z-index:100000;
				left: -50px;
				top: -40px;
				display: block;
				width: 40px;
				height: 40px;
			}
		`;
  }
  document.getElementById("terrible-hack")!.innerHTML = css;
};

// [1]
const ContextToolbarComponent = track(() => {
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

  const pageCoordinates = editor.pageToViewport(selectionRotatedPageBounds.point);

  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "all",
        top: pageCoordinates.y - 42,
        left: pageCoordinates.x,
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
                background: isActive ? "gray" : "transparent",
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
                addMountainPseudoElements(editor);
              }}
            >
              {image ? (
                <img style={{ height: 30, width: 30 }} src="/mountain.webp" />
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

const components: TLEditorComponents = {
  InFrontOfTheCanvas: ContextToolbarComponent,
};

function App() {
  // Create a store connected to multiplayer.
  const store = useSync({
    // We need to know the websocket's URI...
    uri: `${WORKER_URL}/connect/${roomId}`,
    // ...and how to handle static assets like images & videos
    assets: multiplayerAssets,

    // custom stuff
    // shapeUtils: useMemo(() => [TextShapeUtil, ...defaultShapeUtils], []),
    // bindingUtils: useMemo(() => [...customBindingUtils, ...defaultBindingUtils], []),
  });

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        // we can pass the connected store into the Tldraw component which will handle
        // loading states & enable multiplayer UX like cursors & a presence menu
        store={store}
        onMount={(editor) => {
          // @ts-expect-error
          window.editor = editor;
          // when the editor is ready, we need to register out bookmark unfurling service
          editor.registerExternalAssetHandler("url", unfurlBookmarkUrl);
          addMountainPseudoElements(editor);
          editor.store.listen((thing) => {
            if (
              Object.values(thing.changes.updated).some(
                ([from, to]) => from.meta.mountain !== to.meta.mountain
              )
            ) {
              console.log("remote mountain change");
              addMountainPseudoElements(editor);
            }
          });
        }}
        components={components}
        // shapeUtils={[TextShapeUtil]}
      />
    </div>
  );
}

// How does our server handle assets like images and videos?
const multiplayerAssets: TLAssetStore = {
  // to upload an asset, we prefix it with a unique id, POST it to our worker, and return the URL
  async upload(_asset, file) {
    const id = uniqueId();

    const objectName = `${id}-${file.name}`;
    const url = `${WORKER_URL}/uploads/${encodeURIComponent(objectName)}`;

    const response = await fetch(url, {
      method: "PUT",
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload asset: ${response.statusText}`);
    }

    return { src: url };
  },
  // to retrieve an asset, we can just use the same URL. you could customize this to add extra
  // auth, or to serve optimized versions / sizes of the asset.
  resolve(asset) {
    return asset.props.src;
  },
};

// How does our server handle bookmark unfurling?
async function unfurlBookmarkUrl({ url }: { url: string }): Promise<TLBookmarkAsset> {
  const asset: TLBookmarkAsset = {
    id: AssetRecordType.createId(getHashForString(url)),
    typeName: "asset",
    type: "bookmark",
    meta: {},
    props: {
      src: url,
      description: "",
      image: "",
      favicon: "",
      title: "",
    },
  };

  try {
    const response = await fetch(`${WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    asset.props.description = data?.description ?? "";
    asset.props.image = data?.image ?? "";
    asset.props.favicon = data?.favicon ?? "";
    asset.props.title = data?.title ?? "";
  } catch (e) {
    console.error(e);
  }

  return asset;
}

export default App;
