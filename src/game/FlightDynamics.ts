import { flightTuning } from './FlightTuning';

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
    const tuning = flightTuning.dynamics;
    const airflow = tuning.airflowBase + (speedMultiplier - 1) * tuning.airflowFromBoost;
    const turnAuthority = tuning.foldedTurnAuthority + openWing * (1 - tuning.foldedTurnAuthority);

    const horizontalError = targetX - this.x;
    const horizontalAcceleration =
      horizontalError * tuning.horizontalSpring * turnAuthority * airflow -
      this.velocityX * (tuning.horizontalDamping + openWing * tuning.horizontalOpenDamping);
    this.velocityX = clamp(
      this.velocityX + horizontalAcceleration * deltaSeconds,
      -tuning.maximumHorizontalSpeed,
      tuning.maximumHorizontalSpeed,
    );
    this.x += this.velocityX * deltaSeconds;

    const verticalError = targetY - this.y;
    const pitchCommand = clamp(verticalError / tuning.pitchRange, -1, 1);

    if (this.velocityY < -0.08) {
      const generatedLift = clamp(-this.velocityY / tuning.diveReserveVelocity, 0, 1);
      this.diveReserve = Math.max(
        this.diveReserve * Math.exp(-deltaSeconds * tuning.diveReserveDecayWhileDiving),
        generatedLift,
      );
    } else {
      this.diveReserve *= Math.exp(-deltaSeconds * tuning.diveReserveDecayWhileGliding);
    }

    const liftAuthority = tuning.foldedLiftAuthority + openWing * (1 - tuning.foldedLiftAuthority);
    const pullUpLift =
      Math.max(0, pitchCommand) * this.diveReserve * tuning.pullUpImpulse * liftAuthority;
    const verticalAcceleration =
      verticalError * tuning.verticalSpring * liftAuthority * airflow -
      this.velocityY * (tuning.verticalDamping + openWing * tuning.verticalOpenDamping) +
      pullUpLift;
    this.velocityY = clamp(
      this.velocityY + verticalAcceleration * deltaSeconds,
      -tuning.maximumDiveSpeed,
      tuning.maximumClimbSpeed,
    );
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
      0.43 + Math.max(0, pitchCommand) * 0.2 + this.diveReserve * 0.36 - wingFold * 0.14,
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
