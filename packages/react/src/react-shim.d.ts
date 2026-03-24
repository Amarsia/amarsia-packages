declare module "react" {
  export function useSyncExternalStore<TState>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => TState,
    getServerSnapshot?: () => TState
  ): TState;
}
