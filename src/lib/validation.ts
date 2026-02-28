import { z } from "zod";

// Input validation schemas
export const schemas = {
  roomId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(50),
  messageContent: z.string().min(1).max(5000),
  password: z.string().min(4).max(100).optional(),
  
  createRoom: z.object({
    name: z.string().min(1).max(100).optional(),
    password: z.string().min(4).max(100).optional(),
    maxParticipants: z.number().int().min(2).max(50).optional(),
  }),
  
  joinRoom: z.object({
    roomId: z.string().min(1).max(100),
    displayName: z.string().min(1).max(50),
    password: z.string().optional(),
  }),
  
  sendMessage: z.object({
    roomId: z.string().min(1).max(100),
    content: z.string().min(1).max(5000),
  }),
};

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
