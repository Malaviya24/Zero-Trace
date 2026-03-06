import { SignalingMessage } from "@/call/types";

type MessageHandler = (message: SignalingMessage) => void;

export class SignalingClient {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly authToken?: string;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1000;

  constructor(url: string, authToken?: string) {
    this.url = url;
    this.authToken = authToken;
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.reconnectDelay = 1000;
      if (this.authToken) {
        this.send({
          type: "call:start",
          callId: "auth",
          from: "client",
          payload: { token: this.authToken },
          ts: Date.now(),
        });
      }
    };
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SignalingMessage;
        this.handlers.forEach((h) => h(parsed));
      } catch (error) {
        console.warn("Invalid signaling message", error);
      }
    };
    this.socket.onclose = () => {
      this.scheduleReconnect();
    };
    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(message: SignalingMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  close() {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelay = Math.min(30000, this.reconnectDelay * 2);
    }, this.reconnectDelay);
  }
}
