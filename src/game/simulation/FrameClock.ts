export class FrameClock {
  private previousTimestampMs: number | null = null;
  private paused = false;
  private lastDeltaSeconds = 0;

  constructor(private readonly maximumDeltaSeconds = 0.05) {}

  tick(timestampMs: number): number {
    if (this.paused) return 0;
    if (this.previousTimestampMs === null) {
      this.previousTimestampMs = timestampMs;
      this.lastDeltaSeconds = 0;
      return 0;
    }

    const rawDelta = Math.max(0, (timestampMs - this.previousTimestampMs) / 1000);
    this.previousTimestampMs = timestampMs;
    this.lastDeltaSeconds = Math.min(this.maximumDeltaSeconds, rawDelta);
    return this.lastDeltaSeconds;
  }

  pause(): void {
    this.paused = true;
    this.previousTimestampMs = null;
    this.lastDeltaSeconds = 0;
  }

  resume(): void {
    this.paused = false;
    this.previousTimestampMs = null;
    this.lastDeltaSeconds = 0;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getLastDeltaSeconds(): number {
    return this.lastDeltaSeconds;
  }
}
