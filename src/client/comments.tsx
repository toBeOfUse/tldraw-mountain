import { useEffect, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  atom,
  StateNode,
  TLPointerEventInfo,
  track,
  TLUiComponents,
  useTools,
  DefaultToolbarContent,
  useIsToolSelected,
  DefaultToolbar,
  TldrawUiMenuItem,
  TLUiOverrides,
  useEditor,
  uniqueId,
  TLEventInfo,
  TLUiContextMenuProps,
  DefaultContextMenu,
  TldrawUiMenuGroup,
  DefaultContextMenuContent,
} from "tldraw";

const commentInProgress = atom<null | { pageX: number; pageY: number }>("commentInProgress", null);

export class CommentTool extends StateNode {
  static override id = "comment-tool";

  override onPointerDown(info: TLPointerEventInfo) {
    if (!commentInProgress.get()) {
      const point = this.editor.inputs.currentPagePoint;
      commentInProgress.set({ pageX: point.x, pageY: point.y });
    }
  }
}

const openComments = atom("openComments", [] as string[]);

export const CommentEntry = track(() => {
  const editor = useEditor();

  const [commentText, setCommentText] = useState("");

  const reset = () => {
    setCommentText("");
    commentInProgress.set(null);
  };

  const pageCoordinates = commentInProgress.get();
  const viewportCoordinates = pageCoordinates
    ? editor.pageToViewport({ x: pageCoordinates.pageX, y: pageCoordinates.pageY })
    : null;

  const save = () => {
    if (!pageCoordinates) {
      return;
    }
    const currentPage = editor.getCurrentPage();
    const newCommentId = uniqueId();
    editor.updatePage({
      id: currentPage.id,
      meta: {
        comments: [
          ...((currentPage.meta.comments as any[]) || []),
          {
            id: newCommentId,
            // matches the horizontally centered display coordinate(s)
            pageX: pageCoordinates.pageX,
            pageY: pageCoordinates.pageY,
            text: commentText,
            author: editor.user.getName(),
          },
        ],
      },
    });
    openComments.set([...openComments.get(), newCommentId]);
    reset();
  };

  // these should either both or neither be null
  if (!pageCoordinates || !viewportCoordinates) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "all",
        top: viewportCoordinates.y,
        left: viewportCoordinates.x,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        flexDirection: "column",
        gap: 2,
        fontFamily: '"tldraw_draw", sans-serif',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          borderRadius: 8,
          display: "flex",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)",
          background: "var(--color-panel)",
          alignItems: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <TextareaAutosize
          minRows={1}
          maxRows={5}
          value={commentText}
          ref={(value) => {
            // stupid hack, but it won't focus right away for some reason,
            // including with the autoFocus prop
            setTimeout(() => value?.focus(), 100);
          }}
          style={{ resize: "none", width: 175 }}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === "Enter") {
              save();
            } else if (event.key === "Escape") {
              reset();
            }
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        <button onClick={reset}>Cancel</button>
        <button onClick={save}>Save</button>
      </div>
    </div>
  );
});

const commentTargetedByRightClick = atom("commentTargetedByRightClick", "");

export const CommentDisplay = track(() => {
  const editor = useEditor();

  const comments = (editor.getCurrentPage().meta.comments || []) as {
    id: string;
    pageX: number;
    pageY: number;
    text: string;
    author: string;
  }[];

  useEffect(() => {
    const closeAll = (event: TLEventInfo) => {
      if (event.type === "pointer" && event.name === "pointer_down") {
        openComments.set([]);
      }
    };
    // this is meant to trigger when the bg is clicked
    editor.on("event", closeAll);
    return () => {
      editor.off("event", closeAll);
    };
  }, []);

  return comments.map((comment) => {
    const screenCoords = editor.pageToViewport({ x: comment.pageX, y: comment.pageY });
    const isThisOpen = openComments.get().includes(comment.id);
    return (
      <div
        key={comment.id}
        className="custom-comment"
        style={{
          position: "absolute",
          background: "#f1f1f1",
          cursor: "pointer",
          top: screenCoords.y,
          left: screenCoords.x,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 2,
          borderRadius: 10,
          width: isThisOpen ? undefined : 20,
          height: isThisOpen ? undefined : 20,
          fontSize: isThisOpen ? undefined : 16,
          border: "1px solid darkgray",
          fontFamily: '"tldraw_draw", sans-serif',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          // allegedly, this ignores right clicks
          if (e.pointerType !== "mouse" || e.button === 0) {
            if (openComments.get().includes(comment.id)) {
              openComments.set([...openComments.get().filter((id) => id !== comment.id)]);
            } else {
              openComments.set([...openComments.get(), comment.id]);
            }
          } else if (e.pointerType === "mouse") {
            commentTargetedByRightClick.set(comment.id);
            editor.once("event", (event) => {
              console.log(event);
              if (event.name === "pointer_up") {
                commentTargetedByRightClick.set("");
              }
            });
          }
        }}
      >
        {isThisOpen ? (
          <div style={{ padding: "2px 4px" }}>
            <p style={{ margin: "2px 0", fontWeight: "bold" }}>{comment.author}</p>
            <p style={{ margin: 0, whiteSpace: "pre" }}>{comment.text}</p>
          </div>
        ) : (
          comment.author.slice(0, 1).toUpperCase()
        )}
      </div>
    );
  });
});

export const ContextMenuWithCommentDelete = track((props: TLUiContextMenuProps) => {
  const commentIdToDelete = commentTargetedByRightClick.get();
  const editor = useEditor();

  return (
    <DefaultContextMenu {...props}>
      {!!commentIdToDelete && (
        <TldrawUiMenuGroup id="delete-comment">
          <div>
            <TldrawUiMenuItem
              id="delete-comment-item"
              label="Delete comment"
              icon="trash"
              onSelect={() => {
                const currentPage = editor.getCurrentPage();
                editor.updatePage({
                  id: currentPage.id,
                  meta: {
                    comments: ((currentPage.meta.comments as any[]) || []).filter(
                      (comment) => comment.id != commentIdToDelete
                    ),
                  },
                });
                commentTargetedByRightClick.set("");
              }}
            />
          </div>
        </TldrawUiMenuGroup>
      )}
      <DefaultContextMenuContent />
    </DefaultContextMenu>
  );
});

export const ToolbarWithCommentTool: TLUiComponents["Toolbar"] = (props) => {
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
};

export const commentToolbarOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    tools.comment = {
      id: "comment",
      icon: "plus",
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
