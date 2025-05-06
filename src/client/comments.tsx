import { useEffect, useRef, useState } from "react";
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
    editor.updatePage({
      id: currentPage.id,
      meta: {
        comments: [
          ...((currentPage.meta.comments as any[]) || []),
          {
            id: uniqueId(),
            // matches the horizontally centered display coordinate(s)
            pageX: pageCoordinates.pageX,
            pageY: pageCoordinates.pageY,
            text: commentText,
            author: editor.user.getName(),
          },
        ],
      },
    });
    console.log("page", editor.getCurrentPage());
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
        width: 200,
        height: 150,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        flexDirection: "column",
        gap: 2,
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
        <textarea
          ref={(value) => {
            // stupid hack, but it won't focus right away for some reason,
            // including with the autoFocus prop
            setTimeout(() => value?.focus(), 100);
          }}
          style={{ width: "100%", height: "100%", resize: "none" }}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        <button onClick={save}>Save</button>
        <button onClick={reset}>Cancel</button>
      </div>
    </div>
  );
});

export const CommentDisplay = track(() => {
  const editor = useEditor();

  const comments = (editor.getCurrentPage().meta.comments || []) as {
    id: string;
    pageX: number;
    pageY: number;
    text: string;
    author: string;
  }[];

  return comments.map((comment) => {
    const screenCoords = editor.pageToViewport({ x: comment.pageX, y: comment.pageY });

    return (
      <div
        key={comment.id}
        style={{
          position: "absolute",
          pointerEvents: "none",
          top: screenCoords.y,
          left: screenCoords.x,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          flexDirection: "column",
          gap: 2,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {comment.text} - {comment.author}
      </div>
    );
  });
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
