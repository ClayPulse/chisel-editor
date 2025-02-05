import { useContext } from "react";
import { EditorContext } from "@/components/providers/editor-context-provider";
import { FileViewModel } from "@pulse-editor/types";

export function useViewManager() {
  const editorContext = useContext(EditorContext);

  async function openFileView(file: File) {
    const text = await file.text();
    const model: FileViewModel = {
      fileContent: text,
      filePath: file.name,
      isActive: true,
    };

    if (!editorContext) {
      throw new Error("Editor context is not available");
    }

    const isAlreadyOpened = editorContext.editorStates.openedViewModels.find(
      (view) => view.filePath === model.filePath,
    );
    if (isAlreadyOpened) {
      setActiveFileView(model);
      return;
    }

    editorContext.setEditorStates((prev) => {
      return {
        ...prev,
        openedViewModels: [...prev.openedViewModels, model],
      };
    });
  }

  function getFileViewByFilePath(uri: string): FileViewModel | undefined {
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }
    return editorContext.editorStates.openedViewModels.find(
      (view) => view.filePath === uri,
    );
  }

  function closeFileView(view: FileViewModel) {
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }
    editorContext.setEditorStates((prev) => {
      return {
        ...prev,
        openedViewModels: prev.openedViewModels.filter(
          (v) => v.filePath !== view.filePath,
        ),
      };
    });
  }

  function updateFileView(view: Partial<FileViewModel>) {
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }

    editorContext.setEditorStates((prev) => {
      const updatedViewModels = prev.openedViewModels.map((v) => {
        if (v.filePath === view.filePath) {
          return {
            ...v,
            ...view,
          };
        } else {
          return v;
        }
      });
      return {
        ...prev,
        openedViewModels: updatedViewModels,
      };
    });
  }

  /**
   * Clear all views
   */
  function closeAllFileViews() {
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }
    editorContext.setEditorStates((prev) => {
      return {
        ...prev,
        openedViewModels: [],
      };
    });
  }

  function fileViewCount(): number {
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }
    return editorContext.editorStates.openedViewModels.length;
  }

  // TODO: Set view active based on layout
  function setActiveFileView(view: FileViewModel) {
    // Set all other views to inactive except the view
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }

    editorContext.setEditorStates((prev) => {
      const updatedViewModels = prev.openedViewModels.map((v) => {
        if (v.filePath === view.filePath) {
          return {
            ...v,
            isActive: true,
          };
        } else {
          return {
            ...v,
            isActive: false,
          };
        }
      });
      return {
        ...prev,
        openedViewModels: updatedViewModels,
      };
    });
  }

  function getActiveFileView(): FileViewModel | undefined {
    if (!editorContext) {
      throw new Error("Editor context is not available");
    }

    return editorContext.editorStates.openedViewModels.find(
      (view) => view.isActive,
    );
  }

  return {
    openFileView,
    getFileViewByFilePath,
    closeFileView,
    updateFileView,
    closeAllFileViews,
    fileViewCount,
    setActiveFileView,
    getActiveFileView,
  };
}
