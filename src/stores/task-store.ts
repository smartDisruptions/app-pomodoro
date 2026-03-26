import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Task } from "@/types";

interface TaskStore {
  tasks: Task[];
  selectedTaskId: string | null;
  addTask: (title: string) => void;
  deleteTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  incrementSessions: (id: string) => void;
  clearAll: () => void;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      selectedTaskId: null,

      addTask: (title) => {
        const task: Task = {
          id: crypto.randomUUID(),
          title,
          createdAt: new Date().toISOString(),
          completedSessions: 0,
        };
        set({ tasks: [task, ...get().tasks] });
      },

      deleteTask: (id) => {
        const { tasks, selectedTaskId } = get();
        set({
          tasks: tasks.filter((t) => t.id !== id),
          selectedTaskId: selectedTaskId === id ? null : selectedTaskId,
        });
      },

      selectTask: (id) => set({ selectedTaskId: id }),

      incrementSessions: (id) => {
        set({
          tasks: get().tasks.map((t) =>
            t.id === id
              ? { ...t, completedSessions: t.completedSessions + 1 }
              : t
          ),
        });
      },

      clearAll: () => set({ tasks: [], selectedTaskId: null }),
    }),
    { name: "pomo-tasks-v1" }
  )
);
