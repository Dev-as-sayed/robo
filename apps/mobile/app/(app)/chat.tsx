import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useConversationQuery,
  useConversationsQuery,
} from "@/api/chat-api";
import { startChatStream, type ChatStreamHandle } from "@/api/chat-stream";
import { useDocumentDownloadUrlMutation } from "@/api/documents-api";
import { apiErrorMessage } from "@/api/errors";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ReportAnswerButton } from "@/components/ReportAnswerButton";
import {
  setConversationId,
  startNewConversation,
} from "@/features/chat/chat-slice";
import {
  loadSavedConversationId,
  saveConversationId,
} from "@/features/chat/conversation-storage";
import { relativeTime } from "@/lib/time";
import { useAppDispatch, useAppSelector } from "@/store";
import type { ChatMessage, DisplayBlock } from "@/types";
import { colors, radii, spacing } from "@/theme";

const PENDING_PREFIX = "pending-";

type CardBlock = Extract<DisplayBlock, { type: "card" }>;

interface ChatCardBlockProps {
  block: CardBlock;
  messageId: string;
  onOpenCitation: (documentId: string, page?: number) => void;
}

function ChatCardBlock({
  block,
  messageId,
  onOpenCitation,
}: ChatCardBlockProps) {
  const router = useRouter();
  const citations = block.section === "citations";

  const rows = block.items.map((row, rowIndex) => {
    const body = (
      <>
        <Text style={styles.cardRowTitle}>{row.title}</Text>
        {row.subtitle ? (
          <Text style={styles.cardRowMeta}>{row.subtitle}</Text>
        ) : null}
        {row.meta ? <Text style={styles.cardRowMeta}>{row.meta}</Text> : null}
      </>
    );

    if (citations && row.id) {
      return (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${row.title}`}
          onPress={() => onOpenCitation(row.id!, row.page)}
          style={({ pressed }) => [
            styles.cardRow,
            styles.citationRow,
            pressed ? styles.cardPressed : null,
          ]}
        >
          {body}
          <Text style={styles.citationOpen}>Open source →</Text>
        </Pressable>
      );
    }

    return (
      <View
        key={row.id ?? `${messageId}-${rowIndex}`}
        style={styles.cardRow}
      >
        {body}
      </View>
    );
  });

  if (citations) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{block.title}</Text>
        {rows}
        {block.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={block.action.label}
            onPress={() =>
              router.push(
                block.action!.route as Parameters<typeof router.push>[0]
              )
            }
          >
            <Text style={styles.cardAction}>{block.action.label} →</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={block.action ? "button" : undefined}
      accessibilityLabel={block.action?.label}
      disabled={!block.action}
      onPress={() => {
        if (block.action) {
          router.push(block.action.route as Parameters<typeof router.push>[0]);
        }
      }}
      style={({ pressed }) => [
        styles.card,
        pressed && block.action ? styles.cardPressed : null,
      ]}
    >
      <Text style={styles.cardTitle}>{block.title}</Text>
      {rows}
      {block.action ? (
        <Text style={styles.cardAction}>{block.action.label} →</Text>
      ) : null}
    </Pressable>
  );
}

const suggestions = [
  "Explain Newton's second law with an example",
  "Quiz me on the Krebs cycle",
  "Plan two hours of revision for Friday",
];

function visibleMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    message => message.role === "USER" || message.role === "ASSISTANT"
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const conversationId = useAppSelector(state => state.chat.conversationId);
  const resumeLatest = useAppSelector(state => state.chat.resumeLatest);
  const { data: history } = useConversationQuery(conversationId ?? "", {
    skip: !conversationId,
  });
  const {
    data: conversations,
    isFetching: loadingConversations,
    refetch: refetchConversations,
  } = useConversationsQuery(20);

  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const cancelRef = useRef<ChatStreamHandle | null>(null);
  const streamTextRef = useRef("");
  const scrollRef = useRef<ScrollView>(null);
  const seededRef = useRef<string | null>(null);
  const preferredConversationRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  const isBusy = streamText !== null;

  useEffect(() => {
    if (!conversationId) {
      seededRef.current = null;
      setThread([]);
      return;
    }

    if (!history || seededRef.current === history.id) {
      return;
    }

    seededRef.current = history.id;
    setThread(visibleMessages(history.messages));
  }, [conversationId, history]);

  useEffect(() => {
    let active = true;

    void loadSavedConversationId().then(id => {
      if (!active) {
        return;
      }

      preferredConversationRef.current = id;
      setStorageReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !storageReady ||
      !resumeLatest ||
      conversationId ||
      !conversations?.length
    ) {
      return;
    }

    const preferred = conversations.find(
      conversation => conversation.id === preferredConversationRef.current
    );
    const nextId = preferred?.id ?? conversations[0].id;

    dispatch(setConversationId(nextId));
    void saveConversationId(nextId);
  }, [conversations, conversationId, dispatch, resumeLatest, storageReady]);

  useEffect(() => {
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [thread, streamText]);

  const [getDownloadUrl] = useDocumentDownloadUrlMutation();

  const openCitation = async (documentId: string, page?: number) => {
    setError(null);

    try {
      const { downloadUrl } = await getDownloadUrl(documentId).unwrap();
      const url = page ? `${downloadUrl}#page=${page}` : downloadUrl;
      await Linking.openURL(url);
    } catch (cause) {
      setError(apiErrorMessage(cause, "Robo could not open that source."));
    }
  };

  const takePartial = (): string => {
    const partial = streamTextRef.current.trim();
    streamTextRef.current = "";
    return partial;
  };

  const appendPartial = (content: string) => {
    if (content.length === 0) {
      return;
    }

    setThread(prev => [
      ...prev,
      {
        id: `partial-${Date.now()}`,
        role: "ASSISTANT",
        content,
        voiceText: null,
        displayContent: null,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const send = async (rawContent: string) => {
    const content = rawContent.trim();

    if (content.length === 0 || isBusy) {
      return;
    }

    setError(null);
    setDraft("");
    setHistoryOpen(false);

    const pending: ChatMessage = {
      id: `${PENDING_PREFIX}${Date.now()}`,
      role: "USER",
      content,
      voiceText: null,
      displayContent: null,
      createdAt: new Date().toISOString(),
    };

    setThread(prev => [
      ...prev.filter(message => !message.id.startsWith(PENDING_PREFIX)),
      pending,
    ]);
    streamTextRef.current = "";
    setStreamText("");

    cancelRef.current = null;

    const handle = await startChatStream(
      {
        content,
        ...(conversationId ? { conversationId } : {}),
      },
      {
        onToken: token => {
          streamTextRef.current += token;
          setStreamText(streamTextRef.current);
        },
        onDone: result => {
          cancelRef.current = null;
          streamTextRef.current = "";
          setStreamText(null);
          setThread(prev => [
            ...prev.filter(message => !message.id.startsWith(PENDING_PREFIX)),
            result.userMessage,
            result.assistantMessage,
          ]);
          seededRef.current = result.conversation.id;
          dispatch(setConversationId(result.conversation.id));
          void saveConversationId(result.conversation.id);
          void refetchConversations();
        },
        onError: message => {
          cancelRef.current = null;
          const partial = takePartial();
          setStreamText(null);
          appendPartial(partial);
          setError(message);
        },
      }
    );

    if (unmountedRef.current) {
      handle();
      return;
    }

    cancelRef.current = handle;
  };

  const stop = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    appendPartial(takePartial());
    setStreamText(null);
  };

  const newChat = () => {
    stop();
    setError(null);
    setDraft("");
    setHistoryOpen(false);
    dispatch(startNewConversation());
    void saveConversationId(null);
  };

  const openConversation = (id: string) => {
    stop();
    setError(null);
    setDraft("");
    setHistoryOpen(false);
    dispatch(setConversationId(id));
    void saveConversationId(id);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text style={styles.headerMuted}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>ASK ROBO</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chat history"
              onPress={() => setHistoryOpen(open => !open)}
              hitSlop={12}
            >
              <Text style={styles.headerMuted}>History</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new chat"
              onPress={newChat}
              hitSlop={12}
            >
              <Text style={styles.headerAccent}>New</Text>
            </Pressable>
          </View>
        </View>

        {historyOpen ? (
          <View style={styles.historyPanel}>
            <Text style={styles.historyTitle}>Recent chats</Text>
            <ScrollView
              style={styles.historyList}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {loadingConversations && !conversations ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : null}
              {conversations?.length ? (
                conversations.map(conversation => (
                  <Pressable
                    key={conversation.id}
                    accessibilityRole="button"
                    accessibilityLabel={conversation.title ?? "Untitled chat"}
                    onPress={() => openConversation(conversation.id)}
                    style={({ pressed }) => [
                      styles.historyRow,
                      conversation.id === conversationId
                        ? styles.historyRowActive
                        : null,
                      pressed ? styles.cardPressed : null,
                    ]}
                  >
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyRowTitle} numberOfLines={1}>
                        {conversation.title ?? "Untitled chat"}
                      </Text>
                      <Text style={styles.historyRowMeta} numberOfLines={1}>
                        {conversation.lastMessage?.content ?? "No messages yet"}
                      </Text>
                    </View>
                    <Text style={styles.historyRowTime}>
                      {relativeTime(conversation.updatedAt)}
                    </Text>
                  </Pressable>
                ))
              ) : loadingConversations ? null : (
                <Text style={styles.historyEmpty}>
                  Your saved chats will appear here.
                </Text>
              )}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? <ErrorBanner message={error} /> : null}

          {thread.length === 0 && !isBusy ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                Ask anything you are studying.
              </Text>
              <Text style={styles.emptyBody}>
                Robo answers in short sentences. Voice replies come from the
                speaker once it is paired.
              </Text>
              <View style={styles.suggestions}>
                {suggestions.map(suggestion => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    onPress={() => void send(suggestion)}
                    style={styles.suggestion}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {thread.map(message => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.role === "USER" ? styles.bubbleUser : styles.bubbleRobo,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  message.role === "USER" ? styles.bubbleTextUser : null,
                ]}
              >
                {message.content}
              </Text>

              {message.displayContent?.blocks
                .filter((block): block is CardBlock => block.type === "card")
                .map((block, blockIndex) => (
                  <ChatCardBlock
                    key={`${message.id}-${blockIndex}`}
                    block={block}
                    messageId={message.id}
                    onOpenCitation={(documentId, page) =>
                      void openCitation(documentId, page)
                    }
                  />
                ))}

              {message.role === "ASSISTANT" ? (
                <ReportAnswerButton surface="CHAT" messageId={message.id} />
              ) : null}
            </View>
          ))}

          {streamText !== null ? (
            <View style={[styles.bubble, styles.bubbleRobo]}>
              {streamText.length === 0 ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={styles.bubbleText}>{streamText}</Text>
              )}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask Robo..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            style={styles.input}
            onSubmitEditing={() => void send(draft)}
            returnKeyType="send"
            blurOnSubmit={false}
            accessibilityLabel="Message"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => (isBusy ? stop() : void send(draft))}
            disabled={!isBusy && draft.trim().length === 0}
            style={({ pressed }) => [
              styles.send,
              !isBusy && draft.trim().length === 0 ? styles.sendDisabled : null,
              pressed ? styles.sendPressed : null,
            ]}
          >
            <Text style={styles.sendLabel}>{isBusy ? "Stop" : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  historyPanel: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  historyTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  historyList: {
    maxHeight: 220,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  historyRowActive: {
    backgroundColor: colors.surfaceRaised,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyRowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  historyRowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  historyRowTime: {
    color: colors.textMuted,
    fontSize: 11,
  },
  historyEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  headerMuted: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  headerAccent: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  empty: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  suggestions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  suggestion: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
  },
  bubbleRobo: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  card: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  cardRow: {
    gap: 2,
  },
  citationRow: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  citationOpen: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  cardRowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cardRowMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.accentInk,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  send: {
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendPressed: {
    opacity: 0.82,
  },
  sendLabel: {
    color: colors.accentInk,
    fontSize: 15,
    fontWeight: "800",
  },
});
