export interface FlightDynamicsSnapshot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lift: number;
  diveReserve: number;
}

const SAFE_FLOOR = 0.2;
const SAFE_CEILING = 5.55;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export class FlightDynamics {
  private x = 0;
  private y = 2.35;
  private velocityX = 0;
  private velocityY = 0;
  private lift = 0.48;
  private diveReserve = 0;

  reset(): void {
    this.x = 0;
    this.y = 2.35;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lift = 0.48;
    this.diveReserve = 0;
  }

  update(
    deltaSeconds: number,
    targetX: number,
    targetY: number,
    wingFold: number,
    speedMultiplier: number,
  ): FlightDynamicsSnapshot {
    const openWing = 1 - wingFold;
    const airflow = 0.94 + (speedMultiplier - 1) * 0.42;
    const turnAuthority = 0.68 + openWing * 0.32;

    const horizontalError = targetX - this.x;
    const horizontalAcceleration =
      horizontalError * 5.8 * turnAuthority * airflow - this.velocityX * (2.15 + openWing * 0.35);
    this.velocityX = clamp(this.velocityX + horizontalAcceleration * deltaSeconds, -5.2, 5.2);
    this.x += this.velocityX * deltaSeconds;

    const verticalError = targetY - this.y;
    const pitchCommand = clamp(verticalError / 1.65, -1, 1);

    if (this.velocityY < -0.08) {
      const generatedLift = clamp(-this.velocityY / 2.65, 0, 1);
      this.diveReserve = Math.max(this.diveReserve * Math.exp(-deltaSeconds * 0.38), generatedLift);
    } else {
      this.diveReserve *= Math.exp(-deltaSeconds * 0.72);
    }

    const liftAuthority = 0.56 + openWing * 0.44;
    const pullUpLift = Math.max(0, pitchCommand) * this.diveReserve * 5.4 * liftAuthority;
    const verticalAcceleration =
      verticalError * 3.9 * liftAuthority * airflow -
      this.velocityY * (1.62 + openWing * 0.46) +
      pullUpLift;
    this.velocityY = clamp(this.velocityY + verticalAcceleration * deltaSeconds, -3.15, 3.85);
    this.y += this.velocityY * deltaSeconds;

    // Neutral trim cancels gravity, and these soft limits prevent lift play from causing a crash.
    if (this.y < SAFE_FLOOR) {
      this.y = SAFE_FLOOR;
      this.velocityY = Math.max(0, this.velocityY * 0.16);
      this.diveReserve = Math.max(this.diveReserve, 0.34);
    } else if (this.y > SAFE_CEILING) {
      this.y = SAFE_CEILING;
      this.velocityY = Math.min(0, this.velocityY * 0.16);
    }

    this.lift = clamp(
      0.42 + Math.max(0, pitchCommand) * 0.22 + this.diveReserve * 0.42 - wingFold * 0.18,
      0.16,
      1,
    );

    return this.getSnapshot();
  }

  getSnapshot(): FlightDynamicsSnapshot {
    return {
      x: this.x,
      y: this.y,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
      lift: this.lift,
      diveReserve: this.diveReserve,
    };
  }
}
