import { create } from 'zustand';

type TerminalSession = {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
};

type TerminalState = {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  createSession: (name?: string) => string;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
};

let sessionCounter = 0;

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeSessionId: null,

  createSession: (name?) => {
    sessionCounter += 1;
    const id = crypto.randomUUID();
    const sessionName = name ?? `Session ${sessionCounter}`;
    const session: TerminalSession = {
      id,
      name: sessionName,
      active: true,
      createdAt: new Date(),
    };

    set((state) => ({
      sessions: [
        ...state.sessions.map((s) => ({ ...s, active: false })),
        session,
      ],
      activeSessionId: id,
    }));

    return id;
  },

  closeSession: (id) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id);
      const wasActive = state.activeSessionId === id;
      const newActiveId = wasActive
        ? (remaining[remaining.length - 1]?.id ?? null)
        : state.activeSessionId;

      return {
        sessions: remaining.map((s) => ({
          ...s,
          active: s.id === newActiveId,
        })),
        activeSessionId: newActiveId,
      };
    }),

  setActiveSession: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        active: s.id === id,
      })),
      activeSessionId: id,
    })),
}));

export type { TerminalSession, TerminalState };
