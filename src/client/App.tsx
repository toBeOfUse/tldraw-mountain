import { useSync } from "@tldraw/sync";
import {
  AssetRecordType,
  DefaultColorThemePalette,
  DefaultMainMenu,
  DefaultMainMenuContent,
  Editor,
  TLAssetStore,
  TLBookmarkAsset,
  TLComponents,
  TextShapeUtil,
  Tldraw,
  TldrawUiIcon,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  getHashForString,
  track,
  uniqueId,
  useEditor,
} from "tldraw";
import { useEffect, useState } from "react";

const WORKER_URL = `${window.location.protocol}//${window.location.hostname}${
  window.location.protocol === "http:" ? ":5858" : ""
}`;

// In this example, the room ID is hard-coded. You can set this however you like though.
const roomId = "test-room";

import valleyDataUrl from "./assets/valley.svg?base64";
import mountainDataUrl from "./assets/mountain.svg?base64";
import mountainHalfDataUrl from "./assets/mountain-half.svg?base64";
import mountainFullDataUrl from "./assets/mountain-full.svg?base64";

import valley from "./assets/valley.svg";
import mountain from "./assets/mountain.svg";
import mountainHalf from "./assets/mountain-half.svg";
import mountainFull from "./assets/mountain-full.svg";

const MOUNTAINS = [
  { value: "valley", image: valley, dataUrl: valleyDataUrl },
  { value: "mountain", image: mountain, dataUrl: mountainDataUrl },
  { value: "mountain-half", image: mountainHalf, dataUrl: mountainHalfDataUrl },
  { value: "mountain-full", image: mountainFull, dataUrl: mountainFullDataUrl },
  { value: "none", image: "", dataUrl: "" },
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

// repurpose this palette option to match the continents in our bg
DefaultColorThemePalette.lightMode["light-violet"].solid = "#e7e7e7";
DefaultColorThemePalette.lightMode["light-violet"].fill = "#e7e7e7";
DefaultColorThemePalette.lightMode["light-violet"].semi = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].solid = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].fill = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].semi = "#e7e7e7";

// TODO: adjust handle geometry to allow for dragging the mountain itself around

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
                // this triggers the listen() listener on the store that's added
                // in Tldraw's onMount
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

function MainMenuWithLogout() {
  return (
    <DefaultMainMenu>
      <DefaultMainMenuContent />
      <div>
        <TldrawUiMenuGroup id="example">
          <TldrawUiMenuItem
            id="logout"
            label="Log out"
            readonlyOk
            onSelect={() => {
              fetch("/logout", { method: "POST" }).then(() => {
                window.location.reload();
              });
            }}
          />
        </TldrawUiMenuGroup>
      </div>
    </DefaultMainMenu>
  );
}

const components: TLComponents = {
  InFrontOfTheCanvas: ContextToolbarComponent,
  MainMenu: MainMenuWithLogout,
};

function TLDrawCanvas() {
  // Create a store connected to multiplayer.
  const store = useSync({
    // We need to know the websocket's URI...
    uri: `${WORKER_URL}/connect/${roomId}`,
    // ...and how to handle static assets like images & videos
    assets: multiplayerAssets,
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
        }}
        components={components}
      />
    </div>
  );
}

function App() {
  const [amIn, setAmIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${WORKER_URL}/isauthenticated`).then(async (res) => {
      const result = await res.text();
      if (result === "yes") {
        setAmIn(true);
      } else {
        setAmIn(false);
      }
    });
  }, []);

  if (amIn) {
    return <TLDrawCanvas />;
  } else if (amIn === null) {
    return <p>Authenticating...</p>;
  } else {
    const params = new URLSearchParams(window.location.search);
    return (
      <div>
        {!!params.get("error") && <p>Error: {params.get("error")}</p>}
        <a href={`${WORKER_URL}/login/github`}>Login with Github</a>
      </div>
    );
  }
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
