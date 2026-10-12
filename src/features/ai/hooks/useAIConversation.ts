import { useState, useCallback, useRef, useEffect } from "react";
import type { AISettings, AIMessage, AIConversation } from "../types/ai.ts";
import type { AISource } from "../providers/types.ts";
import type { AIAction } from "../actions/types.ts";
import { createProvider, getProviderConfigError } from "../providers/provider-factory.ts";
import { buildMessages } from "../prompt-builder.ts";
import { generateId } from "../../../utils/id.ts";
import { saveConversation, getConversationsByEntry } from "../storage/ai-conversations.ts";

function message(role: AIMessage["role"], content: string, actionId: string, sources?: AISource[]): AIMessage {
  const msg: AIMessage = { id: generateId(), role, content, timestamp: Date.now(), actionId };
  return sources && sources.length > 0 ? { ...msg, sources } : msg;
}

export function useAIConversation(settings: AISettings) {
  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Identifies the one stream allowed to touch state. Any stream whose
  // controller is no longer here was superseded and must stay silent.
  const abortRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamContent("");
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadConversation = useCallback(async (key: string, actionId: string) => {
    const existing = await getConversationsByEntry(key);
    const match = existing.find((c) => c.frameworkId === actionId) ?? null;
    if (match) {
      setConversation(match);
      setError(null);
    }
    return match;
  }, []);

  /** Pass `replaceId` to overwrite a saved conversation (regenerate). */
  const startConversation = useCallback((key: string, actionId: string, replaceId?: string) => {
    const now = Date.now();
    const conv: AIConversation = {
      id: replaceId ?? generateId(),
      entryId: key,
      frameworkId: actionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setConversation(conv);
    setError(null);
    return conv;
  }, []);

  const sendMessage = useCallback(
    async (conv: AIConversation, action: AIAction, userMessage: string) => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const isCurrent = () => abortRef.current === abort;

      // Keep the user's message even if the request fails, so it isn't lost.
      let result: AIConversation = {
        ...conv,
        messages: [...conv.messages, message("user", userMessage, action.id)],
        updatedAt: Date.now(),
      };
      setConversation(result);
      setError(null);

      const provider = createProvider(settings);
      if (!provider) {
        setError(getProviderConfigError(settings) ?? "No LLM provider configured");
        abortRef.current = null;
        await saveConversation(result);
        return;
      }

      setStreaming(true);
      setStreamContent("");
      let fullResponse = "";
      // Keyed by URL: the same page is often both searched and cited several times.
      const sources = new Map<string, AISource>();
      try {
        const stream = provider.chat(buildMessages(action.systemPrompt, result.messages), {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          signal: abort.signal,
          webSearch: settings.webSearch && !!action.webSearch,
        });
        for await (const chunk of stream) {
          if (abort.signal.aborted || !isCurrent()) break;
          for (const source of chunk.sources ?? []) {
            if (!sources.has(source.url) || source.title) sources.set(source.url, source);
          }
          if (!chunk.content) continue;
          fullResponse += chunk.content;
          setStreamContent(fullResponse);
        }
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        if (isCurrent() && !aborted) setError(err instanceof Error ? err.message : String(err));
      }

      if (!isCurrent()) return;
      if (fullResponse) {
        result = {
          ...result,
          messages: [...result.messages, message("assistant", fullResponse, action.id, [...sources.values()])],
          updatedAt: Date.now(),
        };
      }
      abortRef.current = null;
      setConversation(result);
      setStreaming(false);
      setStreamContent("");
      await saveConversation(result);
    },
    [settings],
  );

  /** Stops generation and keeps what has streamed so far. */
  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearConversation = useCallback(() => {
    cancelStream();
    setConversation(null);
    setError(null);
  }, [cancelStream]);

  return {
    conversation,
    streaming,
    streamContent,
    error,
    loadConversation,
    startConversation,
    sendMessage,
    abort,
    clearConversation,
  };
}
