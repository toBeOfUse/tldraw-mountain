import { useSync } from "@tldraw/sync";

import {
  DefaultColorThemePalette,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultToolbar,
  DefaultToolbarContent,
  StateNode,
  TLComponents,
  TLPointerEventInfo,
  TLUiOverrides,
  Tldraw,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
} from "tldraw";

import { ContextToolbarComponent, mountMountainsOnEditor } from "./mountain-handlers";
import { BACKEND_URL, roomId } from "./config";
import { multiplayerAssets, unfurlBookmarkUrl } from "./boilerplate";

// repurposing the "light-violet" palette option to match the continents in our bg
DefaultColorThemePalette.lightMode["light-violet"].solid = "#e7e7e7";
DefaultColorThemePalette.lightMode["light-violet"].fill = "#e7e7e7";
DefaultColorThemePalette.lightMode["light-violet"].semi = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].solid = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].fill = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].semi = "#e7e7e7";

function MainMenuWithLogout({ username }: { username: string }) {
  return (
    <DefaultMainMenu>
      <div>
        <TldrawUiMenuGroup id="example">
          <TldrawUiMenuItem
            id="current-user"
            label={`Welcome, ${username}!`}
            readonlyOk
            noClose
            onSelect={() => {}}
          />
        </TldrawUiMenuGroup>
      </div>
      <DefaultMainMenuContent />
      <div>
        <TldrawUiMenuGroup id="example">
          <TldrawUiMenuItem
            id="logout"
            label="Log out"
            readonlyOk
            onSelect={() => {
              fetch(`${BACKEND_URL}/logout`, { method: "POST" }).then(() => {
                window.location.reload();
              });
            }}
          />
        </TldrawUiMenuGroup>
      </div>
    </DefaultMainMenu>
  );
}

class CommentTool extends StateNode {
  static override id = "comment-tool";

  override onPointerDown(info: TLPointerEventInfo) {
    console.log(info);
    console.log("world");
  }
}

export function TLDrawCanvas({ username }: { username: string }) {
  // Create a store connected to multiplayer.
  const store = useSync({
    // We need to know the websocket's URI...
    uri: `${BACKEND_URL}/connect/${roomId}`,
    // ...and how to handle static assets like images & videos
    assets: multiplayerAssets,
  });

  const components: TLComponents = {
    InFrontOfTheCanvas: ContextToolbarComponent,
    MainMenu: () => <MainMenuWithLogout username={username} />,
    Toolbar: (props) => {
      const tools = useTools();
      const isCommentSelected = useIsToolSelected(tools["comment"]);
      // take apart the DefaultToolbarContent component. illegal in 13 countries
      // and disallowed under the geneva conventions, but it works
      const defaultTools = DefaultToolbarContent().props.children;
      return (
        <DefaultToolbar {...props}>
          {defaultTools.slice(0, 3)}
          <TldrawUiMenuItem {...tools["comment"]} isSelected={isCommentSelected} />
          {defaultTools.slice(4)}
        </DefaultToolbar>
      );
    },
  };

  const overrides: TLUiOverrides = {
    tools(editor, tools, helpers) {
      tools.comment = {
        id: "comment",
        icon: "question-mark",
        label: "tools.comment",
        kbd: "c",
        onSelect: () => {
          // Whatever you want to happen when the tool is selected.
          editor.setCurrentTool("comment-tool");
          editor.setCursor({ type: "cross" });
        },
      };
      return tools;
    },
    translations: {
      en: {
        "tools.comment": "Comment",
      },
    },
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        // we can pass the connected store into the Tldraw component which will handle
        // loading states & enable multiplayer UX like cursors & a presence menu
        store={store}
        onMount={(editor) => {
          // @ts-expect-error cheap debugging tactic
          window.editor = editor;

          // we need to register our bookmark unfurling service (TODO: what is that)
          editor.registerExternalAssetHandler("url", unfurlBookmarkUrl);

          // basic way to add the current user's username to the tldraw user
          // presence; note that this can be overwritten by further user
          // actions, and thus should not be trusted
          editor.user.updateUserPreferences({ name: username });

          mountMountainsOnEditor(editor);
        }}
        tools={[CommentTool]}
        overrides={overrides}
        components={components}
      />
    </div>
  );
}
