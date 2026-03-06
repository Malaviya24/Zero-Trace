export class RingtoneController {
  private incoming = new Audio("/ringtone-incoming.mp3");
  private outgoing = new Audio("/ringtone-outgoing.mp3");

  constructor() {
    this.incoming.loop = true;
    this.outgoing.loop = true;
    this.incoming.preload = "auto";
    this.outgoing.preload = "auto";
  }

  async unlock() {
    try {
      await this.incoming.play();
      this.incoming.pause();
      this.incoming.currentTime = 0;
      await this.outgoing.play();
      this.outgoing.pause();
      this.outgoing.currentTime = 0;
    } catch (error) {
      console.warn("Audio unlock blocked", error);
    }
  }

  async playIncoming() {
    this.stopAll();
    try {
      await this.incoming.play();
    } catch (error) {
      console.warn("Incoming ringtone playback blocked", error);
    }
  }

  async playOutgoing() {
    this.stopAll();
    try {
      await this.outgoing.play();
    } catch (error) {
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
