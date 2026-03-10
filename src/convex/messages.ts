import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { computeReadPatch } from "../lib/message-conflict-utils";
import { requireRoomParticipantSession, verifyRoomParticipantSession } from "./sessionAuth";
import { api } from "./_generated/api";
import { getRoomByRoomId, hardDeleteRoomData, isRoomExpiredOrInactive } from "./roomLifecycle";

const HEART_VARIANTS = new Set(["\u2764", "\u2764\uFE0F"]);
const ALLOWED_REACTIONS = new Set([
  "\u{1F44D}", // 👍
  "\u2764\uFE0F", // ❤️
  "\u{1F602}", // 😂
  "\u{1F62E}", // 😮
  "\u{1F622}", // 😢
  "\u{1F64F}", // 🙏
]);
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const LINK_PREVIEW_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const UNFURL_TIMEOUT_MS = 5_000;
const MAX_UNFURL_BYTES = 250_000;

type LinkPreview = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  canonicalUrl: string;
};

function normalizeReactionEmoji(value: string) {
  const emoji = value.trim();
  if (HEART_VARIANTS.has(emoji)) return "\u2764\uFE0F";
  return emoji;
}

function handleConvexError(scope: string, e: unknown): never {
  console.error(`[${scope}]`, e);
  if (e instanceof Error && e.message) {
    throw new Error(e.message);
  }
  throw new Error("Unexpected server error.");
}

function sanitizeText(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) return true;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }

  if (host.includes(":")) {
    if (host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd")) return true;
    if (host.startsWith("fe80")) return true;
  }

  return false;
}

function normalizePreviewUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProtocol = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (isPrivateHost(parsed.hostname)) return null;
  parsed.hash = "";
  return parsed.toString();
}

function extractMetaTagContent(html: string, keys: string[]) {
  const keySet = new Set(keys);
  const metaMatches = html.matchAll(/<meta\s+[^>]*>/gi);
  for (const match of metaMatches) {
    const tag = match[0];
    const attributes = new Map<string, string>();
    for (const attribute of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*["']([^"']*)["']/g)) {
      attributes.set(attribute[1].toLowerCase(), attribute[2]);
    }
    const prop = attributes.get("property")?.toLowerCase();
    const name = attributes.get("name")?.toLowerCase();
    if (!prop && !name) continue;
    if (!keySet.has(prop || "") && !keySet.has(name || "")) continue;
    const content = attributes.get("content");
    if (content) return content;
  }
  return undefined;
}

function resolveUrl(maybeUrl: string | undefined, baseUrl: string) {
  if (!maybeUrl) return undefined;
  try {
    const resolved = new URL(maybeUrl, baseUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) return undefined;
    if (isPrivateHost(resolved.hostname)) return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

function parseLinkPreview(html: string, baseUrl: string): LinkPreview {
  const headChunk = html.slice(0, 80_000);
  const titleTag = headChunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const ogTitle = extractMetaTagContent(headChunk, ["og:title", "twitter:title"]);
  const ogDescription = extractMetaTagContent(headChunk, ["og:description", "twitter:description", "description"]);
  const ogImage = extractMetaTagContent(headChunk, ["og:image", "twitter:image"]);
  const ogSiteName = extractMetaTagContent(headChunk, ["og:site_name"]);
  const canonical = extractMetaTagContent(headChunk, ["og:url"]) ?? baseUrl;

  return {
    title: sanitizeText(ogTitle ?? titleTag, 120),
    description: sanitizeText(ogDescription, 280),
    image: resolveUrl(ogImage, baseUrl),
    siteName: sanitizeText(ogSiteName, 80),
    canonicalUrl: resolveUrl(canonical, baseUrl) ?? baseUrl,
  };
}

async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UNFURL_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ZeroTrace-LinkPreview/1.0",
      },
    });
    if (!response.ok) return null;

    const finalUrl = normalizePreviewUrl(response.url || url);
    if (!finalUrl) return null;

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > MAX_UNFURL_BYTES) return null;

    if (!contentType.includes("text/html")) {
      const finalParsed = new URL(finalUrl);
      return {
        title: finalParsed.hostname,
        canonicalUrl: finalUrl,
      };
    }

    let html = "";
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_UNFURL_BYTES) break;
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } else {
      html = (await response.text()).slice(0, MAX_UNFURL_BYTES);
    }

    const preview = parseLinkPreview(html, finalUrl);
    if (!preview.title && !preview.description && !preview.image) {
      const parsed = new URL(finalUrl);
      return {
        title: parsed.hostname,
        canonicalUrl: finalUrl,
      };
    }
    return preview;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function requireActiveRoom(
  ctx: any,
  roomId: string,
  options: {
    purgeIfExpired?: boolean;
  } = {}
) {
  const room = await getRoomByRoomId(ctx, roomId);
  if (!room) {
    throw new Error("Room not found or expired");
  }

  if (isRoomExpiredOrInactive(room)) {
    if (options.purgeIfExpired) {
      await hardDeleteRoomData(ctx, roomId);
    }
    throw new Error("Room not found or expired");
  }

  return room;
}

export const getUnfurlContext = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await verifyRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });
    if (!participant) return { authorized: false, linkPreviewsEnabled: false };

    const room = await getRoomByRoomId(ctx, args.roomId);
    if (!room || isRoomExpiredOrInactive(room)) return { authorized: false, linkPreviewsEnabled: false };
    return {
      authorized: true,
      linkPreviewsEnabled: room.settings?.linkPreviewsEnabled ?? true,
    };
  },
});

export const getLinkPreviewCache = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await verifyRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });
    if (!participant) return null;

    const normalizedUrl = normalizePreviewUrl(args.url);
    if (!normalizedUrl) return null;

    const existing = await ctx.db
      .query("linkPreviewCache")
      .withIndex("by_room_and_url", (q) => q.eq("roomId", args.roomId).eq("url", normalizedUrl))
      .first();

    if (!existing || existing.expiresAt <= Date.now()) return null;
    return {
      title: existing.title,
      description: existing.description,
      image: existing.image,
      siteName: existing.siteName,
      canonicalUrl: existing.canonicalUrl,
    } as LinkPreview;
  },
});

export const storeLinkPreviewCache = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    url: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    siteName: v.optional(v.string()),
    canonicalUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRoomParticipantSession(ctx, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });

    const normalizedUrl = normalizePreviewUrl(args.url);
    const canonicalUrl = normalizePreviewUrl(args.canonicalUrl);
    if (!normalizedUrl || !canonicalUrl) return;

    const now = Date.now();
    const payload = {
      roomId: args.roomId,
      url: normalizedUrl,
      title: sanitizeText(args.title, 120),
      description: sanitizeText(args.description, 280),
      image: resolveUrl(args.image, canonicalUrl),
      siteName: sanitizeText(args.siteName, 80),
      canonicalUrl,
      fetchedAt: now,
      expiresAt: now + LINK_PREVIEW_CACHE_TTL_MS,
    };

    const existing = await ctx.db
      .query("linkPreviewCache")
      .withIndex("by_room_and_url", (q) => q.eq("roomId", args.roomId).eq("url", normalizedUrl))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return;
    }

    await ctx.db.insert("linkPreviewCache", payload);
  },
});

export const unfurlUrl: any = action({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    url: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ignored: true } | { ignored: false; preview: LinkPreview }> => {
    const normalizedUrl = normalizePreviewUrl(args.url);
    if (!normalizedUrl) return { ignored: true as const };

    const context = await ctx.runQuery((api as any).messages.getUnfurlContext, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
    });
    if (!context?.authorized || !context.linkPreviewsEnabled) {
      return { ignored: true as const };
    }

    const cached: LinkPreview | null = await ctx.runQuery((api as any).messages.getLinkPreviewCache, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      url: normalizedUrl,
    });
    if (cached) {
      return { ignored: false as const, preview: cached as LinkPreview };
    }

    const preview = await fetchLinkPreview(normalizedUrl);
    if (!preview) return { ignored: true as const };

    await ctx.runMutation((api as any).messages.storeLinkPreviewCache, {
      roomId: args.roomId,
      participantId: args.participantId,
      participantToken: args.participantToken,
      url: normalizedUrl,
      title: preview.title,
      description: preview.description,
      image: preview.image,
      siteName: preview.siteName,
      canonicalUrl: preview.canonicalUrl,
    });

    return { ignored: false as const, preview };
  },
});

export const sendMessage = mutation({
  args: {
    roomId: v.string(),
    content: v.string(),
    encryptionKeyId: v.string(),
    selfDestruct: v.optional(v.boolean()),
    participantId: v.id("participants"),
    participantToken: v.string(),
    messageType: v.optional(
      v.union(v.literal("text"), v.literal("image"), v.literal("video"), v.literal("file"), v.literal("audio"))
    ),
    storageId: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    linkPreviewEncrypted: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const participant = await requireRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      const rawMessageType = args.messageType || "text";
      const normalizedMimeType = (args.mimeType || "").toLowerCase();
      const messageType =
        rawMessageType === "file" && normalizedMimeType.startsWith("audio/")
          ? "audio"
          : rawMessageType;
      const body = args.content?.trim() ?? "";

      if (messageType === "text" && !body) {
        throw new Error("Message content cannot be empty.");
      }
      if (messageType !== "text" && !args.storageId) {
        throw new Error("Attachment upload reference is missing.");
      }
      if (body.length > 10_000) {
        throw new Error("Message is too long.");
      }
      if (typeof args.fileSize === "number" && args.fileSize > MAX_ATTACHMENT_BYTES) {
        throw new Error("File is too large. Maximum size is 100 MB.");
      }
      if (!args.encryptionKeyId.trim()) {
        throw new Error("Missing encryption key reference.");
      }

      const room = await requireActiveRoom(ctx, args.roomId, { purgeIfExpired: true });

      const now = Date.now();
      const expiresAt = Math.min(room.expiresAt, now + 2 * 60 * 60 * 1000);
      const selfDestructAt = args.selfDestruct ? now + 10 * 60 * 1000 : undefined;

      let resolvedReplyTo: Id<"messages"> | undefined;
      let resolvedReplyToPreview:
        | {
            senderName: string;
            content: string;
            type: "text" | "image" | "video" | "file" | "audio" | "system";
          }
        | undefined;

      const rawReplyTo = args.replyTo?.trim();
      if (rawReplyTo) {
        const normalizedReplyTo = ctx.db.normalizeId("messages", rawReplyTo);
        if (normalizedReplyTo) {
          const parent = await ctx.db.get(normalizedReplyTo);
          if (
            parent &&
            parent.roomId === args.roomId &&
            parent.expiresAt > now &&
            (!parent.selfDestructAt || parent.selfDestructAt > now)
          ) {
            resolvedReplyTo = parent._id;
            resolvedReplyToPreview = {
              senderName: parent.senderName,
              content: parent.content,
              type:
                parent.messageType === "join" || parent.messageType === "leave"
                  ? "system"
                  : parent.messageType,
            };
          }
        }
      }

      const messageId = await ctx.db.insert("messages", {
        roomId: args.roomId,
        senderId: undefined,
        senderParticipantId: participant._id,
        senderName: participant.displayName,
        senderAvatar: participant.avatar,
        content: body,
        messageType,
        storageId: args.storageId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        isRead: false,
        selfDestructAt,
        expiresAt,
        encryptionKeyId: args.encryptionKeyId,
        linkPreviewEncrypted: messageType === "text" ? args.linkPreviewEncrypted?.trim() : undefined,
        replyTo: resolvedReplyTo,
        replyToPreview: resolvedReplyToPreview,
      });

      await ctx.db.patch(participant._id, { lastSeen: now });

      return messageId;
    } catch (e) {
      handleConvexError("messages.sendMessage", e);
    }
  },
});

export const generateUploadUrl = mutation({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await requireActiveRoom(ctx, args.roomId, { purgeIfExpired: true });
      await requireRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      return await ctx.storage.generateUploadUrl();
    } catch (e) {
      handleConvexError("messages.generateUploadUrl", e);
    }
  },
});

export const getRoomMessages = query({
  args: {
    roomId: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const participant = await verifyRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      if (!participant) return [];

      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!room || room.expiresAt < Date.now()) return [];

      const limit = Math.max(1, Math.min(args.limit ?? 50, 500));
      const allMessages = await ctx.db
        .query("messages")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .order("asc")
        .collect();

      const now = Date.now();
      const visible = allMessages.filter(
        (message) => message.expiresAt > now && (!message.selfDestructAt || message.selfDestructAt > now)
      );
      const windowMessages = visible.slice(Math.max(0, visible.length - limit));

      const visibleById = new Map<string, (typeof windowMessages)[number]>(
        windowMessages.map((message) => [String(message._id), message])
      );
      const replyParentMap = new Map<string, (typeof windowMessages)[number]>();
      const replyParentIds = Array.from(
        new Set(windowMessages.map((message) => message.replyTo).filter(Boolean))
      ) as Id<"messages">[];

      for (const parentId of replyParentIds) {
        const fromWindow = visibleById.get(String(parentId));
        const parent = fromWindow ?? (await ctx.db.get(parentId));
        if (
          parent &&
          parent.roomId === args.roomId &&
          parent.expiresAt > now &&
          (!parent.selfDestructAt || parent.selfDestructAt > now)
        ) {
          replyParentMap.set(String(parentId), parent);
        }
      }

      const enhancedMessages = await Promise.all(
        windowMessages.map(async (message) => {
          const parent = message.replyTo ? replyParentMap.get(String(message.replyTo)) : undefined;
          const storedReplyPreview = message.replyToPreview;
          const replyToPreview = parent
            ? {
                senderName: parent.senderName,
                content: parent.content,
                type:
                  parent.messageType === "join" || parent.messageType === "leave"
                    ? "system"
                    : parent.messageType,
              }
            : storedReplyPreview;

          if (message.storageId) {
            return {
              ...message,
              fileUrl: await ctx.storage.getUrl(message.storageId),
              replyToPreview,
            };
          }
          return {
            ...message,
            replyToPreview,
          };
        })
      );

      return enhancedMessages;
    } catch (e) {
      handleConvexError("messages.getRoomMessages", e);
    }
  },
});

export const markMessageRead = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const message = await ctx.db.get(args.messageId);
      if (!message) return;

      const participant = await verifyRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });
      if (!participant) return;

      const now = Date.now();
      const patch = computeReadPatch(message, now);
      if (!patch) return;
      await ctx.db.patch(args.messageId, patch);
    } catch (e) {
      handleConvexError("messages.markMessageRead", e);
    }
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const body = args.content?.trim() ?? "";
      if (!body) {
        throw new Error("Message content cannot be empty.");
      }
      if (body.length > 10_000) {
        throw new Error("Message is too long.");
      }

      const message = await ctx.db.get(args.messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      if (message.messageType !== "text") {
        throw new Error("Only text messages can be edited");
      }

      const participant = await requireRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      if (message.senderParticipantId && message.senderParticipantId !== participant._id) {
        throw new Error("You can only edit your own messages");
      }

      if (!message.senderParticipantId && message.senderName !== participant.displayName) {
        throw new Error("You can only edit your own messages");
      }

      await ctx.db.patch(args.messageId, {
        content: body,
        editedAt: Date.now(),
      });

      return args.messageId;
    } catch (e) {
      handleConvexError("messages.editMessage", e);
    }
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    participantToken: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const now = Date.now();
      const emoji = normalizeReactionEmoji(args.emoji);
      if (!emoji || emoji.length > 8 || !ALLOWED_REACTIONS.has(emoji)) {
        return { messageId: args.messageId, reactions: [], ignored: true as const };
      }

      const message = await ctx.db.get(args.messageId);
      if (!message) {
        return { messageId: args.messageId, reactions: [], ignored: true as const };
      }
      if (message.expiresAt <= now || (message.selfDestructAt && message.selfDestructAt <= now)) {
        return { messageId: args.messageId, reactions: [], ignored: true as const };
      }

      const participant = await requireRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      const existing = message.reactions ?? [];
      const reactionIndex = existing.findIndex(
        (reaction) => reaction.participantId === args.participantId && reaction.emoji === emoji
      );

      const withoutMine = existing.filter((reaction) => reaction.participantId !== args.participantId);
      const reactions =
        reactionIndex >= 0
          ? existing.filter((_, index) => index !== reactionIndex)
          : [
              ...withoutMine,
              {
                emoji,
                participantId: args.participantId,
                displayName: participant.displayName,
                createdAt: Date.now(),
              },
            ];

      try {
        await ctx.db.patch(args.messageId, { reactions });
      } catch (patchError) {
        const errorMessage = patchError instanceof Error ? patchError.message.toLowerCase() : "";
        if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
          return { messageId: args.messageId, reactions: [], ignored: true as const };
        }
        throw patchError;
      }

      return { messageId: args.messageId, reactions, ignored: false as const };
    } catch (e) {
      handleConvexError("messages.toggleReaction", e);
    }
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    participantId: v.id("participants"),
    participantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const message = await ctx.db.get(args.messageId);
      if (!message) return;

      const participant = await requireRoomParticipantSession(ctx, {
        roomId: message.roomId,
        participantId: args.participantId,
        participantToken: args.participantToken,
      });

      const deleteMessageWithAttachment = async () => {
        if (message.storageId) {
          try {
            await ctx.storage.delete(message.storageId as Id<"_storage">);
          } catch {
            // Ignore missing attachment blobs.
          }
        }
        await ctx.db.delete(args.messageId);
      };

      if (message.senderParticipantId && message.senderParticipantId === participant._id) {
        await deleteMessageWithAttachment();
        return;
      }

      if (!message.senderParticipantId && message.senderName === participant.displayName) {
        await deleteMessageWithAttachment();
      }
    } catch (e) {
      handleConvexError("messages.deleteMessage", e);
    }
  },
});

export const clearRoomMessages = mutation({
  args: {
    roomId: v.string(),
    callerParticipantId: v.id("participants"),
    callerParticipantToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const caller = await requireRoomParticipantSession(ctx, {
        roomId: args.roomId,
        participantId: args.callerParticipantId,
        participantToken: args.callerParticipantToken,
      });

      if (caller.role !== "admin") {
        throw new Error("Only the admin can perform this action");
      }

      const room = await ctx.db
        .query("rooms")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .first();

      if (!room || room.expiresAt < Date.now() || room.isActive !== true) {
        return;
      }

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_room_id", (q) => q.eq("roomId", args.roomId))
        .collect();

      for (const message of messages) {
        if (message.storageId) {
          try {
            await ctx.storage.delete(message.storageId as Id<"_storage">);
          } catch {
            // Ignore missing attachment blobs.
          }
        }
        await ctx.db.delete(message._id);
      }
    } catch (e) {
      handleConvexError("messages.clearRoomMessages", e);
    }
  },
});

