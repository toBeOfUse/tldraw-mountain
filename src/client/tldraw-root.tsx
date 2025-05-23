/**
 * This file is responsible for integrating custom features into the actual
 * TLDraw component and configuration.
 */

import { useSync } from "@tldraw/sync";

import {
  DefaultColorThemePalette,
  DefaultMainMenu,
  DefaultMainMenuContent,
  TLComponents,
  Tldraw,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
} from "tldraw";

import { MountainToolbar, mountMountainsOnEditor } from "./mountains";
import { multiplayerAssets, unfurlBookmarkUrl, BACKEND_URL, roomId } from "./boilerplate";
import {
  CommentLayer,
  CommentEntry,
  CommentTool,
  commentToolbarOverrides,
  ContextMenuWithCommentEdit,
  ToolbarWithCommentTool,
} from "./comments";

// repurposing the "light-violet" palette option to match the continents in our bg
DefaultColorThemePalette.lightMode["light-violet"].solid = "#e7e7e7";
DefaultColorThemePalette.lightMode["light-violet"].fill = "#e7e7e7";
DefaultColorThemePalette.lightMode["light-violet"].semi = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].solid = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].fill = "#e7e7e7";
DefaultColorThemePalette.darkMode["light-violet"].semi = "#e7e7e7";

// lightly customized version of the top left dropdown menu that adds user
// session functionality
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

// primary component of the whole app
export function TLDrawCanvas({ username }: { username: string }) {
  // Create a store connected to multiplayer.
  const store = useSync({
    // We need to know the websocket's URI...
    uri: `${BACKEND_URL}/connect/${roomId}`,
    // ...and how to handle static assets like images & videos
    assets: multiplayerAssets,
  });

  const components: TLComponents = {
    OnTheCanvas: CommentLayer,
    InFrontOfTheCanvas: () => (
      <>
        <CommentEntry />
        <MountainToolbar />
      </>
    ),
    MainMenu: () => <MainMenuWithLogout username={username} />,
    Toolbar: ToolbarWithCommentTool,
    ContextMenu: ContextMenuWithCommentEdit,
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
        overrides={commentToolbarOverrides}
        components={components}
      />
    </div>
  );
}
