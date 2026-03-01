import { create } from 'zustand';
import type { ViewMode, ContextMenuState } from '../types';

interface UIState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  contextMenu: ContextMenuState | null;
  setContextMenu: (menu: ContextMenuState | null) => void;
  collapsedNodes: Set<string>;
  toggleCollapsed: (id: string) => void;
  // Modals
  showAddAgent: boolean;
  setShowAddAgent: (v: boolean) => void;
  showCreateTeam: boolean;
  setShowCreateTeam: (v: boolean) => void;
  addAgentParentId: string | null;
  setAddAgentParentId: (id: string | null) => void;
  // Disable dialogs
  disableAgentId: string | null;
  setDisableAgentId: (id: string | null) => void;
  disableTeamLeaderId: string | null;
  setDisableTeamLeaderId: (id: string | null) => void;
  // Toast
  toasts: { id: number; message: string; type: 'success' | 'error' }[];
  addToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'fleet',
  setViewMode: (mode) => set({ viewMode: mode }),
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id, drawerOpen: !!id }),
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open, selectedAgentId: open ? undefined : null } as Partial<UIState>),
  contextMenu: null,
  setContextMenu: (menu) => set({ contextMenu: menu }),
  collapsedNodes: new Set<string>(),
  toggleCollapsed: (id) =>
    set((s) => {
      const next = new Set(s.collapsedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedNodes: next };
    }),
  showAddAgent: false,
  setShowAddAgent: (v) => set({ showAddAgent: v }),
  showCreateTeam: false,
  setShowCreateTeam: (v) => set({ showCreateTeam: v }),
  addAgentParentId: null,
  setAddAgentParentId: (id) => set({ addAgentParentId: id }),
  disableAgentId: null,
  setDisableAgentId: (id) => set({ disableAgentId: id }),
  disableTeamLeaderId: null,
  setDisableTeamLeaderId: (id) => set({ disableTeamLeaderId: id }),
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
