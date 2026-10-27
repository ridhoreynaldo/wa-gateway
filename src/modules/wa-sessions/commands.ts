import { keys, redis } from "@/shared/redis";

export type SessionCommand = { type: "start" | "stop" | "logout" | "resync" | "reset"; sessionId: string };

/** Web → worker lewat Redis pub/sub. Worker adalah satu-satunya yang memegang socket Baileys. */
export const sendCommand = (cmd: SessionCommand) => redis().publish(keys.commands, JSON.stringify(cmd));
