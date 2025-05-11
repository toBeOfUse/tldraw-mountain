import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  atom,
  StateNode,
  TLPointerEventInfo,
  track,
  TLUiComponents,
  DefaultToolbarContent,
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
  ToolbarItem,
  Editor,
} from "tldraw";

const commentInProgress = atom<null | {
  pageX: number;
  pageY: number;
  text: string;
  editing: boolean;
  textBeforeEditing?: string;
}>("commentInProgress", null);

export class CommentTool extends StateNode {
  static override id = "comment";

  override onPointerDown(info: TLPointerEventInfo) {
    if (!commentInProgress.get()) {
      const point = this.editor.inputs.currentPagePoint;
      commentInProgress.set({ pageX: point.x, pageY: point.y, text: "", editing: false });
    }
  }
}

// i think there's a way to add this to tldraw's page type somehow
type Comment = {
  id: string;
  pageX: number;
  pageY: number;
  text: string;
  author: string;
};

const CommentStorage = {
  addComment(editor: Editor, comment: Omit<Comment, "id">) {
    const currentPage = editor.getCurrentPage();
    const newCommentId = uniqueId();
    editor.updatePage({
      id: currentPage.id,
      meta: {
        comments: [
          ...((currentPage.meta.comments as Comment[]) || []),
          { ...comment, id: newCommentId },
        ],
      },
    });
    return newCommentId;
  },
  updateComment(editor: Editor, commentId: string, newData: Omit<Comment, "id">) {
    const currentPage = editor.getCurrentPage();
    const existingComments = (currentPage.meta.comments || []) as Comment[];
    const commentToEdit = existingComments.find((c) => c.id === commentId);
    if (!commentToEdit) {
      console.error(`Could not find comment with id ${commentId} to edit it`);
      return;
    }
    const updatedComment: Comment = {
      ...commentToEdit,
      ...newData,
    };
    const newComments = [...existingComments.filter((c) => c.id != commentId), updatedComment];
    editor.updatePage({
      id: currentPage.id,
      meta: {
        comments: newComments,
      },
    });
  },
  deleteComment(editor: Editor, commentId: string) {
    const currentPage = editor.getCurrentPage();
    editor.updatePage({
      id: currentPage.id,
      meta: {
        comments: ((currentPage.meta.comments as any[]) || []).filter(
          (comment) => comment.id != commentId
        ),
      },
    });
  },
};

const openComments = atom("openComments", [] as string[]);

export const CommentEntry = track(() => {
  const editor = useEditor();

  const editingText = commentInProgress.get()?.text || "";

  const reset = () => {
    if (commentInProgress.get()?.editing) {
      save(commentInProgress.get()?.textBeforeEditing || "");
    }
    commentInProgress.set(null);
  };

  const pageCoordinates = commentInProgress.get();
  const viewportCoordinates = pageCoordinates
    ? editor.pageToViewport({ x: pageCoordinates.pageX, y: pageCoordinates.pageY })
    : null;

  const save = (text: string) => {
    if (!pageCoordinates) {
      return;
    }
    const newCommentId = CommentStorage.addComment(editor, {
      // matches the horizontally centered display coordinate(s)
      pageX: pageCoordinates.pageX,
      pageY: pageCoordinates.pageY,
      text,
      author: editor.user.getName(),
    });
    openComments.set([...openComments.get(), newCommentId]);
    commentInProgress.set(null);
  };

  const textareaWasNullLastTime = useRef(true);

  // these should either both or neither be null
  if (!pageCoordinates || !viewportCoordinates) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "all",
        // feeble attempt to vertically center the text area on the mouse click
        top: viewportCoordinates.y - 10,
        left: viewportCoordinates.x - 5,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        flexDirection: "column",
        gap: 2,
        fontFamily: '"tldraw_draw", sans-serif',
        zIndex: 1000000,
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
          value={editingText}
          ref={(el) => {
            if (el) {
              // this doesn't really stop it from calling el.focus() as often as
              // it wants
              if (textareaWasNullLastTime.current) {
                textareaWasNullLastTime.current = false;
                // stupid hack, but it won't focus right away for some reason,
                // including with the autoFocus prop
                setTimeout(() => {
                  if (el) {
                    el.focus();
                  }
                }, 100);
              }
            } else {
              textareaWasNullLastTime.current = true;
            }
          }}
          style={{ resize: "none", width: 175, scrollbarWidth: "thin" }}
          onChange={(e) => {
            const commentData = commentInProgress.get();
            if (commentData) {
              commentInProgress.set({ ...commentData, text: e.target.value });
            }
          }}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === "Enter") {
              save(editingText);
            } else if (event.key === "Escape") {
              reset();
            }
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        <button onClick={reset}>Cancel</button>
        <button onClick={() => save(editingText)}>Save</button>
      </div>
    </div>
  );
});

const commentTargetedByRightClick = atom("commentTargetedByRightClick", "");

export const CommentComponent = track(
  ({ comment, isThisOpen }: { comment: Comment; isThisOpen: boolean }) => {
    const editor = useEditor();
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragStartPoint = useRef({ x: 0, y: 0 });
    const isBeingDragged = useRef(false);
    return (
      <div
        key={comment.id}
        className="custom-comment"
        style={{
          position: "absolute",
          background: "white",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 2,
          borderRadius: isThisOpen ? 10 : 20,
          width: isThisOpen ? undefined : 30,
          height: isThisOpen ? undefined : 30,
          // feeble attempt to center on where the user clicked
          top: comment.pageY + dragOffset.y - (isThisOpen ? 10 : 7),
          left: comment.pageX + dragOffset.x - 7,
          fontSize: isThisOpen ? undefined : 25,
          zIndex: isThisOpen ? 1000000 : 900000,
          border: "1px solid darkgray",
          fontFamily: '"tldraw_draw", sans-serif',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          isBeingDragged.current = true;
          dragStartPoint.current = {
            x: e.clientX,
            y: e.clientY,
          };
          const handleDrag = (event: TLEventInfo) => {
            // if this is not a left-click (which is indicated by button === 0)
            // or a touch event (non-mouse), do not respond to drag
            if (e.pointerType !== "mouse" || e.button === 0) {
              if (event.name === "pointer_move") {
                const zoomLevel = editor.getZoomLevel();
                // you can only learn it by reading their code, but event.point is
                // based on .clientX and .clientY, just like how i made
                // dragStartPoint. we just need to scale the offset to match the
                // zoom level of the page
                setDragOffset({
                  x: (event.point.x - dragStartPoint.current.x) / zoomLevel,
                  y: (event.point.y - dragStartPoint.current.y) / zoomLevel,
                });
              }
            }
          };
          const handleDragEnd = (event: TLEventInfo) => {
            if (event.name === "pointer_up") {
              editor.off("event", handleDrag);
              editor.off("event", handleDragEnd);
              setDragOffset((current) => {
                // this if condition is mostly to deal with react strict mode
                // calling this callback twice. react strict mode, i defy you
                if (isBeingDragged.current) {
                  if (Math.abs(current.x) < 5 && Math.abs(current.y) < 5) {
                    handleClick();
                  } else {
                    CommentStorage.updateComment(editor, comment.id, {
                      ...comment,
                      pageX: comment.pageX + current.x,
                      pageY: comment.pageY + current.y,
                    });
                  }
                  isBeingDragged.current = false;
                }
                return { x: 0, y: 0 };
              });
            }
          };
          const handleClick = () => {
            if (e.pointerType !== "mouse" || e.button === 0) {
              // handle touch event or left click
              if (openComments.get().includes(comment.id)) {
                openComments.set([...openComments.get().filter((id) => id !== comment.id)]);
              } else {
                openComments.set([...openComments.get(), comment.id]);
              }
            } else if (e.pointerType === "mouse" && e.button == 2) {
              // handle right click
              commentTargetedByRightClick.set(comment.id);
              editor.once("event", (event) => {
                if (event.name === "pointer_up") {
                  commentTargetedByRightClick.set("");
                }
              });
            }
          };
          editor.on("event", handleDrag);
          editor.on("event", handleDragEnd);
        }}
      >
        {isThisOpen ? (
          <div style={{ padding: "2px 4px", width: "max-content", maxWidth: 300 }}>
            <p style={{ margin: "2px 0", fontWeight: "bold" }}>{comment.author}</p>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{comment.text}</p>
          </div>
        ) : (
          comment.author.slice(0, 1).toUpperCase()
        )}
      </div>
    );
  }
);

export const CommentDisplay = track(() => {
  const editor = useEditor();

  const comments = (editor.getCurrentPage().meta.comments || []) as Comment[];

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
    const isThisOpen = openComments.get().includes(comment.id);
    return <CommentComponent comment={comment} isThisOpen={isThisOpen} key={comment.id} />;
  });
});

export const ContextMenuWithCommentEdit = track((props: TLUiContextMenuProps) => {
  const commentId = commentTargetedByRightClick.get();
  const editor = useEditor();
  const deleteTargetedComment = () => {
    CommentStorage.deleteComment(editor, commentId);
    commentTargetedByRightClick.set("");
  };

  return (
    <DefaultContextMenu {...props}>
      {!!commentId && (
        <TldrawUiMenuGroup id="delete-comment">
          <div>
            <TldrawUiMenuItem
              id="edit-comment-item"
              label="Edit comment"
              icon="edit"
              onSelect={() => {
                // editing is achieved by deleting the comment, then opening the
                // editor window for another one in the same spot that starts
                // with the same text
                const targetedCommentData = (
                  (editor.getCurrentPage().meta.comments as Comment[]) || []
                ).find((comment) => comment.id === commentId);
                deleteTargetedComment();
                if (targetedCommentData) {
                  commentInProgress.set({
                    pageX: targetedCommentData.pageX,
                    pageY: targetedCommentData.pageY,
                    text: targetedCommentData.text,
                    editing: true,
                    textBeforeEditing: targetedCommentData.text,
                  });
                }
              }}
            />
            <TldrawUiMenuItem
              id="delete-comment-item"
              label="Delete comment"
              icon="trash"
              onSelect={deleteTargetedComment}
            />
          </div>
        </TldrawUiMenuGroup>
      )}
      <DefaultContextMenuContent />
    </DefaultContextMenu>
  );
});

export const ToolbarWithCommentTool: TLUiComponents["Toolbar"] = track((props) => {
  // take apart the DefaultToolbarContent component. illegal in 13 countries
  // and disallowed under the geneva conventions, but it works
  const defaultTools = DefaultToolbarContent().props.children;
  return (
    <DefaultToolbar {...props}>
      {defaultTools.slice(0, 3)}
      <ToolbarItem tool="comment" />
      {defaultTools.slice(4)}
    </DefaultToolbar>
  );
});

export const commentToolbarOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    tools.comment = {
      id: "comment",
      icon: "plus",
      label: "tools.comment",
      kbd: "c",
      onSelect: () => {
        // Whatever you want to happen when the tool is selected.
        editor.setCurrentTool("comment");
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
