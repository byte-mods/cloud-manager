'use client';

import { useState, useCallback, useRef } from 'react';

type MessageRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
};

type UseClaudeChatReturn = {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  error: string | null;
  clearHistory: () => void;
};

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useClaudeChat(): UseClaudeChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: new Date(),
      };

      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

        const response = await fetch(`${baseUrl}/v1/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content,
            history: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const token = parsed.token ?? parsed.content ?? parsed.delta ?? '';

                if (token) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: m.content + token }
                        : m
                    )
                  );
                }
              } catch {
                // Non-JSON SSE data, treat as raw token
                if (data.trim()) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: m.content + data }
                        : m
                    )
                  );
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        const errorMessage =
          err?.message ?? 'Failed to send message. Please try again.';
        setError(errorMessage);
        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMessageId)
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, messages]
  );

  const clearHistory = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return { messages, sendMessage, isStreaming, error, clearHistory };
}

export type { ChatMessage, MessageRole, UseClaudeChatReturn };
