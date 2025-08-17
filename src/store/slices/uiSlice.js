// UI slice: panels and view gizmo/ui settings flags
export const createUISlice = (set) => ({
  showLibrary: false,
  showAssets: false,
  isPostProcessingPanelOpen: false,
  showHDRI: false,
  isViewGizmoSettingsOpen: false,
  dragUseSelectionForDnD: false,

  setShowLibrary: (v) => set({ showLibrary: !!v }),
  setShowAssets: (v) => set({ showAssets: !!v }),
  setIsPostProcessingPanelOpen: (v) => set({ isPostProcessingPanelOpen: !!v }),
  setShowHDRI: (v) => set({ showHDRI: !!v }),
  setIsViewGizmoSettingsOpen: (v) => set({ isViewGizmoSettingsOpen: !!v }),
  setDragUseSelectionForDnD: (on) => set({ dragUseSelectionForDnD: !!on }),
})
