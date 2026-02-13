import { useState, useCallback, useRef } from "react";
import type { AISettings, AIMessage, AIConversation } from "../types/ai.ts";
import type { FrameworkStep } from "../ai/frameworks/types.ts";
import { createProvider } from "../ai/providers/provider-factory.ts";
import { buildMessages } from "../ai/prompt-builder.ts";
import { generateId } from "../utils/id.ts";
import {
  saveConversation,
  getConversationsByEntry,
} from "../storage/ai-conversations.ts";

export function useAIConversation(settings: AISettings) {
  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (entryId: string, frameworkId: string) => {
    const existing = await getConversationsByEntry(entryId);
    const match = existing.find((c) => c.frameworkId === frameworkId);
    if (match) {
      setConversation(match);
      return match;
    }
    return null;
  }, []);

  const startConversation = useCallback(
    (entryId: string, frameworkId: string, stepId: string) => {
      const conv: AIConversation = {
        id: generateId(),
        entryId,
        frameworkId,
        currentStepId: stepId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversation(conv);
      setError(null);
      return conv;
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      conv: AIConversation,
      step: FrameworkStep,
      noteContent: string,
      userMessage?: string,
    ) => {
      const provider = createProvider(settings);
      if (!provider) {
        setError("No LLM provider configured");
        return;
      }

      setError(null);
      setStreaming(true);
      setStreamContent("");

      const updatedMessages = [...conv.messages];

      // Add user message if this is a follow-up
      if (userMessage) {
        const msg: AIMessage = {
          id: generateId(),
          role: "user",
          content: userMessage,
          timestamp: Date.now(),
          frameworkStepId: step.id,
        };
        updatedMessages.push(msg);
      } else if (updatedMessages.length === 0) {
        // First message: add the template-based user prompt
        const content = step.userPromptTemplate.replace(
          "{{noteContent}}",
          noteContent,
        );
        const msg: AIMessage = {
          id: generateId(),
          role: "user",
          content,
          timestamp: Date.now(),
          frameworkStepId: step.id,
        };
        updatedMessages.push(msg);
      }

      const llmMessages = buildMessages(step, noteContent, updatedMessages);

      const abort = new AbortController();
      abortRef.current = abort;

      let fullResponse = "";
      try {
        const stream = provider.chat(llmMessages, {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          signal: abort.signal,
        });

        for await (const chunk of stream) {
          if (abort.signal.aborted) break;
          fullResponse += chunk.content;
          setStreamContent(fullResponse);
        }

        const assistantMsg: AIMessage = {
          id: generateId(),
          role: "assistant",
          content: fullResponse,
          timestamp: Date.now(),
          frameworkStepId: step.id,
        };
        updatedMessages.push(assistantMsg);

        const updated: AIConversation = {
          ...conv,
          messages: updatedMessages,
          currentStepId: step.id,
          updatedAt: Date.now(),
        };
        setConversation(updated);
        await saveConversation(updated);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        } else if (!(err instanceof Error)) {
          setError(String(err));
        }
      } finally {
        setStreaming(false);
        setStreamContent("");
        abortRef.current = null;
      }
    },
    [settings],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearConversation = useCallback(() => {
    setConversation(null);
    setError(null);
    setStreamContent("");
  }, []);

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
