import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;

type State = {
  toasts: ToasterToast[];
};

type Action =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

const listeners = new Set<(state: State) => void>();
let memoryState: State = { toasts: [] };

function addToRemoveQueue(toastId: string) {
  setTimeout(() => {
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY);
}

function dispatch(action: Action) {
  switch (action.type) {
    case "ADD_TOAST": {
      const id = Math.random().toString(36).slice(2);
      const toast: ToasterToast = {
        ...action.toast,
        id,
        open: true,
      };
      memoryState = {
        ...memoryState,
        toasts: [toast, ...memoryState.toasts].slice(0, TOAST_LIMIT),
      };
      break;
    }
    case "UPDATE_TOAST": {
      memoryState = {
        ...memoryState,
        toasts: memoryState.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
      break;
    }
    case "DISMISS_TOAST": {
      const { toastId } = action;
      memoryState = {
        ...memoryState,
        toasts: memoryState.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      };
      (toastId
        ? [toastId]
        : memoryState.toasts.map((t) => t.id)
      ).forEach(addToRemoveQueue);
      break;
    }
    case "REMOVE_TOAST": {
      const { toastId } = action;
      if (toastId) {
        memoryState = {
          ...memoryState,
          toasts: memoryState.toasts.filter((t) => t.id !== toastId),
        };
      } else {
        memoryState = { ...memoryState, toasts: [] };
      }
      break;
    }
  }
  listeners.forEach((listener) => listener(memoryState));
}

export function toast(props: Toast) {
  dispatch({ type: "ADD_TOAST", toast: props });
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}
