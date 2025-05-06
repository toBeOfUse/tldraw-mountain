import { useState } from "react";
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
} from "tldraw";

const commentInProgress = atom<null | { x: number; y: number }>("commentInProgress", null);

export class CommentTool extends StateNode {
  static override id = "comment-tool";

  override onPointerDown(info: TLPointerEventInfo) {
    console.log(info);
    console.log("world");
    const point = this.editor.inputs.currentPagePoint;
    commentInProgress.set({ x: point.x, y: point.y });
  }
}

export const CommentEntry = track(() => {
  // const editor = useEditor();

  const [commentText, setCommentText] = useState("");

  const pageCoordinates = commentInProgress.get();

  if (!pageCoordinates) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "all",
        top: pageCoordinates.y - 42,
        left: pageCoordinates.x,
        width: 100,
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
        <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} />
      </div>
    </div>
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
