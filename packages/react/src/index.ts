import { useSyncExternalStore } from "react";

type SubscribableState<TState> = {
  getState: () => Readonly<TState>;
  subscribe: (listener: (state: Readonly<TState>) => void) => () => void;
};

export function useRun<TRunState extends object, TRunController extends SubscribableState<TRunState>>(client: {
  run: TRunController;
}): Readonly<TRunState> & { run: TRunController } {
  const state = useControllerState(client.run);
  return {
    ...state,
    run: client.run
  } as Readonly<TRunState> & { run: TRunController };
}

export function useStream<TStreamState extends object, TStreamController extends SubscribableState<TStreamState>>(client: {
  stream: TStreamController;
}): Readonly<TStreamState> & { stream: TStreamController } {
  const state = useControllerState(client.stream);
  return {
    ...state,
    stream: client.stream
  } as Readonly<TStreamState> & { stream: TStreamController };
}

export function useConversation<
  TConversationState extends object,
  TConversationController extends SubscribableState<TConversationState>
>(client: {
  conversation: TConversationController;
}): Readonly<TConversationState> & { conversation: TConversationController } {
  const state = useControllerState(client.conversation);
  return {
    ...state,
    conversation: client.conversation
  } as Readonly<TConversationState> & { conversation: TConversationController };
}

export function useAmarsia<
  TRunState extends object,
  TRunController extends SubscribableState<TRunState>,
  TStreamState extends object,
  TStreamController extends SubscribableState<TStreamState>,
  TConversationState extends object,
  TConversationController extends SubscribableState<TConversationState>
>(client: {
  run: TRunController;
  stream: TStreamController;
  conversation: TConversationController;
}): {
  run: Readonly<TRunState> & { run: TRunController };
  stream: Readonly<TStreamState> & { stream: TStreamController };
  conversation: Readonly<TConversationState> & { conversation: TConversationController };
} {
  const run = useRun(client);
  const stream = useStream(client);
  const conversation = useConversation(client);

  return {
    run,
    stream,
    conversation
  } as {
    run: Readonly<TRunState> & { run: TRunController };
    stream: Readonly<TStreamState> & { stream: TStreamController };
    conversation: Readonly<TConversationState> & { conversation: TConversationController };
  };
}

function useControllerState<TState>(controller: SubscribableState<TState>): Readonly<TState> {
  return useSyncExternalStore(
    (onStoreChange: () => void) => controller.subscribe(() => onStoreChange()),
    controller.getState,
    controller.getState
  );
}
