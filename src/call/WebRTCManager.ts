import { CONFIG } from "@/lib/config";
import { CallStatsSnapshot, ConnectionQuality } from "./types";

type ManagerEvents = {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onStats?: (stats: CallStatsSnapshot, quality: ConnectionQuality) => void;
  onReconnectAttempt?: (attempt: number) => void;
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private statsTimer: number | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 6;
  private readonly events: ManagerEvents;

  constructor(events: ManagerEvents = {}) {
    this.events = events;
  }

  async ensureLocalStream(deviceId?: string) {
    if (this.localStream?.active) return this.localStream;
    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          },
      video: false,
    };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  async createConnection() {
    if (this.pc) return this.pc;
    this.pc = new RTCPeerConnection({
      iceServers: CONFIG.webrtc.iceServers as RTCIceServer[],
      iceCandidatePoolSize: CONFIG.webrtc.iceCandidatePoolSize,
      bundlePolicy: CONFIG.webrtc.bundlePolicy,
      rtcpMuxPolicy: CONFIG.webrtc.rtcpMuxPolicy,
    });
    this.remoteStream = new MediaStream();
    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((t) => this.remoteStream?.addTrack(t));
      if (event.streams[0]) this.events.onRemoteStream?.(event.streams[0]);
      else if (this.remoteStream) this.events.onRemoteStream?.(this.remoteStream);
    };
    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.events.onIceCandidate?.(event.candidate);
    };
    this.pc.onconnectionstatechange = async () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      this.events.onConnectionState?.(state);
      if (state === "connected") {
        this.reconnectAttempts = 0;
      }
      if (state === "failed" || state === "disconnected") {
        await this.restartIce();
      }
    };
    return this.pc;
  }

  async attachLocalTracks() {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    if (!this.localStream) throw new Error("Local stream not initialized");
    const senders = this.pc.getSenders();
    this.localStream.getTracks().forEach((track) => {
      const existing = senders.find((s) => s.track?.kind === track.kind);
      if (existing) existing.replaceTrack(track);
      else this.pc?.addTrack(track, this.localStream as MediaStream);
    });
  }

  async createOffer() {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async applyAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) throw new Error("PeerConnection not initialized");
    if (this.pc.signalingState !== "have-local-offer") return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    if (!this.pc.remoteDescription) return;
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async restartIce() {
    if (!this.pc) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts += 1;
    this.events.onReconnectAttempt?.(this.reconnectAttempts);
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
    } catch (error) {
      console.warn("ICE restart failed", error);
    }
  }

  startStatsMonitor(intervalMs = 2000) {
    this.stopStatsMonitor();
    this.statsTimer = window.setInterval(async () => {
      if (!this.pc) return;
      const report = await this.collectStats();
      const quality = this.deriveQuality(report);
      this.events.onStats?.(report, quality);
      this.applyAdaptiveBitrate(report);
    }, intervalMs);
  }

  stopStatsMonitor() {
    if (this.statsTimer) window.clearInterval(this.statsTimer);
    this.statsTimer = null;
  }

  private async collectStats(): Promise<CallStatsSnapshot> {
    if (!this.pc) return { rttMs: 0, jitterMs: 0, packetLoss: 0, bitrateKbps: 0 };
    const stats = await this.pc.getStats();
    const output: CallStatsSnapshot = { rttMs: 0, jitterMs: 0, packetLoss: 0, bitrateKbps: 0 };
    stats.forEach((r) => {
      if (r.type === "candidate-pair" && r.state === "succeeded") {
        output.rttMs = (r.currentRoundTripTime || 0) * 1000;
      }
      if (r.type === "inbound-rtp" && r.kind === "audio") {
        output.packetLoss = r.packetsLost || 0;
        output.jitterMs = (r.jitter || 0) * 1000;
      }
      if (r.type === "outbound-rtp" && r.kind === "audio" && r.bytesSent) {
        output.bitrateKbps = Math.max(output.bitrateKbps, Math.round((r.bytesSent * 8) / 1000));
      }
    });
    return output;
  }

  private deriveQuality(stats: CallStatsSnapshot): ConnectionQuality {
    if (stats.rttMs > 300 || stats.packetLoss > 10) return "weak";
    if (stats.rttMs > 120 || stats.packetLoss > 4) return "good";
    return "excellent";
  }

  private async applyAdaptiveBitrate(stats: CallStatsSnapshot) {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "audio");
    if (!sender) return;
    const params = sender.getParameters();
    if (!params.encodings) params.encodings = [{}];
    if (stats.packetLoss > 8 || stats.rttMs > 250) params.encodings[0].maxBitrate = 18000;
    else if (stats.packetLoss > 4 || stats.rttMs > 140) params.encodings[0].maxBitrate = 26000;
    else params.encodings[0].maxBitrate = 48000;
    await sender.setParameters(params);
  }

  async setOutputDevice(audioEl: HTMLAudioElement, sinkId: string): Promise<boolean> {
    const anyEl = audioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof anyEl.setSinkId !== "function") return false;
    await anyEl.setSinkId(sinkId);
    return true;
  }

  toggleMute(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  getLocalStream() {
    return this.localStream;
  }

  cleanup() {
    this.stopStatsMonitor();
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
    }
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
  }
}
