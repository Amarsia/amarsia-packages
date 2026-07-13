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

export function useAgent<
  TAgentState extends object,
  TAgentController extends SubscribableState<TAgentState>
>(client: {
  agent: TAgentController;
}): Readonly<TAgentState> & { agent: TAgentController } {
  const state = useControllerState(client.agent);
  return {
    ...state,
    agent: client.agent
  } as Readonly<TAgentState> & { agent: TAgentController };
}

export function useAmarsia<
  TRunState extends object,
  TRunController extends SubscribableState<TRunState>,
  TStreamState extends object,
  TStreamController extends SubscribableState<TStreamState>,
  TConversationState extends object,
  TConversationController extends SubscribableState<TConversationState>,
  TAgentState extends object,
  TAgentController extends SubscribableState<TAgentState>
>(client: {
  run: TRunController;
  stream: TStreamController;
  conversation: TConversationController;
  agent: TAgentController;
}): {
  run: Readonly<TRunState> & { run: TRunController };
  stream: Readonly<TStreamState> & { stream: TStreamController };
  conversation: Readonly<TConversationState> & { conversation: TConversationController };
  agent: Readonly<TAgentState> & { agent: TAgentController };
} {
  const run = useRun(client);
  const stream = useStream(client);
  const conversation = useConversation(client);
  const agent = useAgent(client);

  return {
    run,
    stream,
    conversation,
    agent
  } as {
    run: Readonly<TRunState> & { run: TRunController };
    stream: Readonly<TStreamState> & { stream: TStreamController };
    conversation: Readonly<TConversationState> & { conversation: TConversationController };
    agent: Readonly<TAgentState> & { agent: TAgentController };
  };
}

function useControllerState<TState>(controller: SubscribableState<TState>): Readonly<TState> {
  return useSyncExternalStore(
    (onStoreChange: () => void) => controller.subscribe(() => onStoreChange()),
    controller.getState,
    controller.getState
  );
}
