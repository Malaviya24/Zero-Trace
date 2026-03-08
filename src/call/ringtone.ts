export class RingtoneController {
  private incoming = new Audio("/ringtone-incoming.mp3");
  private outgoing = new Audio("/ringtone-outgoing.mp3");
  private disabled = false;
  private verified = false;
  private verifyPromise: Promise<void> | null = null;

  constructor() {
    this.incoming.loop = true;
    this.outgoing.loop = true;
    this.incoming.preload = "auto";
    this.outgoing.preload = "auto";
  }

  private markUnavailable() {
    this.disabled = true;
  }

  private shouldDisableForError(error: unknown) {
    if (!(error instanceof DOMException)) return false;
    return error.name === "NotSupportedError";
  }

  private async verifySources() {
    if (this.disabled || this.verified) return;
    if (this.verifyPromise) {
      await this.verifyPromise;
      return;
    }

    this.verifyPromise = (async () => {
      try {
        const [incomingHead, outgoingHead] = await Promise.all([
          fetch("/ringtone-incoming.mp3", { method: "HEAD", cache: "no-store" }),
          fetch("/ringtone-outgoing.mp3", { method: "HEAD", cache: "no-store" }),
        ]);
        if (!incomingHead.ok || !outgoingHead.ok) {
          this.disabled = true;
          return;
        }
        this.verified = true;
      } catch {
        this.disabled = true;
      } finally {
        this.verifyPromise = null;
      }
    })();

    await this.verifyPromise;
  }

  async unlock() {
    await this.verifySources();
    if (this.disabled) return;
    try {
      await this.incoming.play();
      this.incoming.pause();
      this.incoming.currentTime = 0;
      await this.outgoing.play();
      this.outgoing.pause();
      this.outgoing.currentTime = 0;
    } catch (error) {
      if (this.shouldDisableForError(error)) {
        this.markUnavailable();
        return;
      }
      console.warn("Audio unlock blocked", error);
    }
  }

  async playIncoming() {
    await this.verifySources();
    if (this.disabled) return;
    this.stopAll();
    try {
      await this.incoming.play();
    } catch (error) {
      if (this.shouldDisableForError(error)) {
        this.markUnavailable();
        return;
      }
      console.warn("Incoming ringtone playback blocked", error);
    }
  }

  async playOutgoing() {
    await this.verifySources();
    if (this.disabled) return;
    this.stopAll();
    try {
      await this.outgoing.play();
    } catch (error) {
      if (this.shouldDisableForError(error)) {
        this.markUnavailable();
        return;
      }
      console.warn("Outgoing ringtone playback blocked", error);
    }
  }

  stopAll() {
    this.incoming.pause();
    this.outgoing.pause();
    this.incoming.currentTime = 0;
    this.outgoing.currentTime = 0;
  }
}
