import type { Subscription } from "../types";

type StoreApi<TState> = {
  getState: () => Readonly<TState>;
  setState: (updater: (previous: Readonly<TState>) => TState) => Readonly<TState>;
  subscribe: (listener: Subscription<TState>) => () => void;
};

export function createStore<TState>(initialState: TState): StoreApi<TState> {
  let state = Object.freeze({ ...initialState }) as Readonly<TState>;
  const listeners = new Set<Subscription<TState>>();

  const getState = (): Readonly<TState> => state;

  const setState = (updater: (previous: Readonly<TState>) => TState): Readonly<TState> => {
    const nextState = updater(state);
    state = Object.freeze({ ...nextState }) as Readonly<TState>;
    listeners.forEach((listener) => listener(state));
    return state;
  };

  const subscribe = (listener: Subscription<TState>): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState,
    setState,
    subscribe
  };
}

