import { createContext, useContext, type ReactNode } from 'react';

export interface ChatActions {
  stop: () => void;
  retry: () => void;
  resend: (messageId: string, text: string) => void;
  resync: () => Promise<unknown>;
}

const noop = () => {};
const noopResend = () => {};
const noopResync = async () => {};

const ChatActionsContext = createContext<ChatActions>({
  stop: noop,
  retry: noop,
  resend: noopResend,
  resync: noopResync,
});

export function ChatActionsProvider({
  value,
  children,
}: {
  value: ChatActions;
  children: ReactNode;
}) {
  return <ChatActionsContext.Provider value={value}>{children}</ChatActionsContext.Provider>;
}

export function useChatActions(): ChatActions {
  return useContext(ChatActionsContext);
}
