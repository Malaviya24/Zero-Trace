import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Chat rooms - ephemeral, auto-expire
    rooms: defineTable({
      roomId: v.string(), // unique room identifier
      name: v.optional(v.string()), // optional room name
      passwordHash: v.optional(v.string()), // bcrypt hashed password
      // Add: passwordSalt to allow deterministic verification
      passwordSalt: v.optional(v.string()),
      creatorId: v.optional(v.id("users")), // creator (can be anonymous)
      isActive: v.boolean(), // room status
      maxParticipants: v.optional(v.number()), // room capacity
      expiresAt: v.number(), // TTL timestamp
      encryptionKey: v.optional(v.string()), // encrypted room key
      settings: v.optional(v.object({
        selfDestruct: v.boolean(), // enable self-destructing messages
        screenshotProtection: v.boolean(), // blur until hover
        keyRotationInterval: v.number(), // messages before key rotation
      })),
    })
    .index("by_room_id", ["roomId"])
    .index("by_expires_at", ["expiresAt"])
    .index("by_active", ["isActive"]),

    // Messages - ephemeral, encrypted
    messages: defineTable({
      roomId: v.string(), // room identifier
      senderId: v.optional(v.id("users")), // sender (can be anonymous)
      senderName: v.string(), // anonymous display name
      senderAvatar: v.string(), // emoji avatar
      content: v.string(), // encrypted message content
      messageType: v.union(
        v.literal("text"),
        v.literal("system"),
        v.literal("join"),
        v.literal("leave")
      ),
      isRead: v.boolean(), // read status
      readAt: v.optional(v.number()), // when message was read
      selfDestructAt: v.optional(v.number()), // self-destruct timestamp
      expiresAt: v.number(), // TTL timestamp
      encryptionKeyId: v.string(), // which key was used for encryption
      editedAt: v.optional(v.number()), // when message was last edited
    })
    .index("by_room_id", ["roomId"])
    .index("by_expires_at", ["expiresAt"])
    .index("by_self_destruct", ["selfDestructAt"]),

    // Active participants in rooms
    participants: defineTable({
      roomId: v.string(),
      userId: v.optional(v.id("users")), // can be anonymous
      displayName: v.string(), // anonymous display name
      avatar: v.string(), // emoji avatar
      isActive: v.boolean(), // currently connected
      lastSeen: v.number(), // last activity timestamp
      joinedAt: v.number(), // when they joined
      expiresAt: v.number(), // TTL timestamp
      // Add: role within the room (admin/member)
      role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
      // Add: typing status
      isTyping: v.optional(v.boolean()),
      typingUpdatedAt: v.optional(v.number()),
    })
    .index("by_room_id", ["roomId"])
    .index("by_user_id", ["userId"])
    .index("by_expires_at", ["expiresAt"])
    .index("by_room_and_user", ["roomId", "userId"]),

    // Encryption keys for key rotation
    encryptionKeys: defineTable({
      roomId: v.string(),
      keyId: v.string(), // unique key identifier
      encryptedKey: v.string(), // encrypted with master key
      createdAt: v.number(),
      isActive: v.boolean(),
      expiresAt: v.number(), // TTL timestamp
    })
    .index("by_room_id", ["roomId"])
    .index("by_key_id", ["keyId"])
    .index("by_expires_at", ["expiresAt"]),

    // Add: joinAttempts table for rate limiting incorrect password attempts
    joinAttempts: defineTable({
      roomId: v.string(),
      failed: v.boolean(), // true for incorrect attempts
      createdAt: v.number(), // attempt timestamp
      expiresAt: v.number(), // for cleanup
    })
    .index("by_room_and_failed_and_created_at", ["roomId", "failed", "createdAt"])
    .index("by_expires_at", ["expiresAt"]),

    // Calls - video/audio calling system
    calls: defineTable({
      roomId: v.optional(v.string()), // associated chat room (optional)
      createdBy: v.optional(v.id("users")), // call initiator (can be anonymous)
      status: v.union(
        v.literal("idle"),
        v.literal("ringing"),
        v.literal("active"),
        v.literal("ended"),
        v.literal("missed")
      ),
      startedAt: v.optional(v.number()), // when call actually started
      endedAt: v.optional(v.number()), // when call ended
      e2ee: v.boolean(), // end-to-end encryption enabled
      expiresAt: v.number(), // TTL timestamp
      // Phase 1: Scalability
      maxParticipants: v.optional(v.number()), // max participants for group calls
      sfuEnabled: v.optional(v.boolean()), // use SFU for group calls
      // Phase 2: Reliability
      recordingEnabled: v.optional(v.boolean()), // call recording
      recordingUrl: v.optional(v.string()), // recording storage URL
    })
    .index("by_room_id", ["roomId"])
    .index("by_created_by", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_expires_at", ["expiresAt"]),

    // Call participants
    callParticipants: defineTable({
      callId: v.id("calls"),
      userId: v.optional(v.id("users")), // can be anonymous
      displayName: v.string(),
      role: v.union(v.literal("admin"), v.literal("member")),
      joinedAt: v.optional(v.number()), // when they joined the call
      leftAt: v.optional(v.number()), // when they left the call
      expiresAt: v.number(), // TTL timestamp
      // Phase 1: Connection quality monitoring
      connectionQuality: v.optional(v.union(
        v.literal("excellent"),
        v.literal("good"),
        v.literal("fair"),
        v.literal("poor")
      )),
      lastQualityUpdate: v.optional(v.number()),
      // Phase 2: Reconnection tracking
      reconnectAttempts: v.optional(v.number()),
      lastReconnectAt: v.optional(v.number()),
    })
    .index("by_call_id", ["callId"])
    .index("by_user_id", ["userId"])
    .index("by_expires_at", ["expiresAt"]),

    // WebRTC signaling for automatic peer connection (MESH ARCHITECTURE)
    signaling: defineTable({
      callId: v.id("calls"),
      fromParticipantId: v.id("callParticipants"), // sender participant
      toParticipantId: v.id("callParticipants"), // target participant
      type: v.union(
        v.literal("offer"),
        v.literal("answer"),
        v.literal("ice-candidate")
      ),
      data: v.string(), // JSON stringified SDP or ICE candidate
      processed: v.boolean(), // whether the recipient has processed this signal
      expiresAt: v.number(),
    })
    .index("by_call_id", ["callId"])
    .index("by_call_and_to_participant", ["callId", "toParticipantId"])
    .index("by_call_and_to_and_processed", ["callId", "toParticipantId", "processed"])
    .index("by_expires_at", ["expiresAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;