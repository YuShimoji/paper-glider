import { formatRunSeed, normalizeRunSeed, randomUnit } from './RunSeed';

export const FLIGHT_FEEDBACK_EVENT_VERSION = 'flight-feedback-event-v1';
export const FLIGHT_FEEDBACK_WAKE_CAPACITY = 24;
export const FLIGHT_FEEDBACK_EVENT_CAPACITY = 24;
export const FLIGHT_FEEDBACK_EVENT_ID_CAPACITY = 512;

export type FlightFeedbackEventType =
  | 'ring-captured'
  | 'line-bonus'
  | 'family-passed'
  | 'clean-line';

export type FlightFeedbackEventKind =
  | 'capture-shard'
  | 'line-pulse'
  | 'passage-mark'
  | 'clean-convergence';

export interface FlightFeedbackEventInput {
  readonly type: FlightFeedbackEventType;
  readonly seed: number;
  readonly runSequence: number;
  readonly entityId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FlightFeedbackEvent extends FlightFeedbackEventInput {
  readonly eventId: string;
}

export interface FlightFeedbackFrame {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly speed: number;
  readonly speedMultiplier: number;
  readonly wingFold: number;
}

export interface FlightFeedbackWakeSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  rotation: number;
  age: number;
  life: number;
  scaleX: number;
  scaleY: number;
}

export interface FlightFeedbackEventSlot {
  active: boolean;
  kind: FlightFeedbackEventKind;
  x: number;
  y: number;
  z: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  rotation: number;
  spin: number;
  age: number;
  life: number;
  scale: number;
}

export interface FlightFeedbackSnapshot {
  readonly version: typeof FLIGHT_FEEDBACK_EVENT_VERSION;
  readonly seed: string;
  readonly runSequence: number;
  readonly active: boolean;
  readonly reducedMotion: boolean;
  readonly wakeSerial: number;
  readonly eventSerial: number;
  readonly wakeDistanceAccumulator: number;
  readonly processedEventIds: readonly string[];
  readonly wake: readonly Readonly<FlightFeedbackWakeSlot>[];
  readonly events: readonly Readonly<FlightFeedbackEventSlot>[];
}

function createWakeSlot(): FlightFeedbackWakeSlot {
  return {
    active: false,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
    age: 0,
    life: 0,
    scaleX: 0,
    scaleY: 0,
  };
}

function createEventSlot(): FlightFeedbackEventSlot {
  return {
    active: false,
    kind: 'capture-shard',
    x: 0,
    y: 0,
    z: 0,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    rotation: 0,
    spin: 0,
    age: 0,
    life: 0,
    scale: 0,
  };
}

function copyWakeSlot(slot: FlightFeedbackWakeSlot): Readonly<FlightFeedbackWakeSlot> {
  return { ...slot };
}

function copyEventSlot(slot: FlightFeedbackEventSlot): Readonly<FlightFeedbackEventSlot> {
  return { ...slot };
}

export function createFlightFeedbackEvent(input: FlightFeedbackEventInput): FlightFeedbackEvent {
  const seed = normalizeRunSeed(input.seed);
  const entityId = input.entityId.trim() || 'unknown';
  return {
    ...input,
    seed,
    entityId,
    eventId: [
      FLIGHT_FEEDBACK_EVENT_VERSION,
      formatRunSeed(seed),
      input.runSequence,
      input.type,
      entityId,
    ].join(':'),
  };
}

/**
 * Deterministic, render-independent flight feedback simulation.
 *
 * The simulation consumes only the run seed, canonical gameplay events, sampled
 * flight state, and explicit delta seconds. It never reads a wall clock, DOM,
 * renderer state, or implicit randomness. Fixed arrays bound both the visual
 * pool and event identity history for long runs.
 */
export class FlightFeedbackSimulation {
  private readonly wakeSlots = Array.from(
    { length: FLIGHT_FEEDBACK_WAKE_CAPACITY },
    createWakeSlot,
  );
  private readonly eventSlots = Array.from(
    { length: FLIGHT_FEEDBACK_EVENT_CAPACITY },
    createEventSlot,
  );
  private readonly processedEventIds = Array<string>(FLIGHT_FEEDBACK_EVENT_ID_CAPACITY).fill('');
  private seed = 0;
  private runSequence = -1;
  private active = false;
  private reducedMotion = false;
  private wakeSerial = 0;
  private eventSerial = 0;
  private wakeCursor = 0;
  private eventCursor = 0;
  private processedEventCount = 0;
  private processedEventCursor = 0;
  private wakeDistanceAccumulator = 0;

  beginRun(seed: number, runSequence: number, reducedMotion = false): void {
    this.seed = normalizeRunSeed(seed);
    this.runSequence = runSequence;
    this.reducedMotion = reducedMotion;
    this.active = true;
    this.wakeSerial = 0;
    this.eventSerial = 0;
    this.wakeCursor = 0;
    this.eventCursor = 0;
    this.processedEventCount = 0;
    this.processedEventCursor = 0;
    this.wakeDistanceAccumulator = 0;
    this.processedEventIds.fill('');
    this.clearSlots();
  }

  clearEffects(): void {
    this.wakeDistanceAccumulator = 0;
    this.clearSlots();
  }

  stop(): void {
    this.active = false;
    this.clearEffects();
  }

  advance(deltaSeconds: number, frame: FlightFeedbackFrame): void {
    if (!this.active || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const delta = Math.min(deltaSeconds, 0.1);
    const speed = Math.max(0, frame.speed);

    for (const slot of this.wakeSlots) {
      if (!slot.active) continue;
      slot.age += delta;
      if (slot.age >= slot.life) {
        slot.active = false;
        continue;
      }
      slot.z += speed * delta * 0.92;
    }

    for (const slot of this.eventSlots) {
      if (!slot.active) continue;
      slot.age += delta;
      if (slot.age >= slot.life) {
        slot.active = false;
        continue;
      }
      slot.x += slot.velocityX * delta;
      slot.y += slot.velocityY * delta;
      slot.z += (speed + slot.velocityZ) * delta;
      slot.rotation += slot.spin * delta;
    }

    const wakeSpacing = this.reducedMotion ? 3.4 : 1.32;
    this.wakeDistanceAccumulator += speed * delta;
    let spawned = 0;
    while (this.wakeDistanceAccumulator >= wakeSpacing && spawned < 4) {
      this.wakeDistanceAccumulator -= wakeSpacing;
      this.spawnWake(frame);
      spawned += 1;
    }
  }

  emit(input: FlightFeedbackEventInput): boolean {
    const event = createFlightFeedbackEvent(input);
    if (
      !this.active
      || event.seed !== this.seed
      || event.runSequence !== this.runSequence
      || this.hasProcessedEvent(event.eventId)
    ) return false;

    this.rememberEvent(event.eventId);
    const count = this.getEventShardCount(event.type);
    for (let index = 0; index < count; index += 1) {
      this.spawnEventSlot(event, index, count);
    }
    return true;
  }

  getWakeSlots(): readonly FlightFeedbackWakeSlot[] {
    return this.wakeSlots;
  }

  getEventSlots(): readonly FlightFeedbackEventSlot[] {
    return this.eventSlots;
  }

  getSnapshot(): FlightFeedbackSnapshot {
    const processedCount = Math.min(this.processedEventCount, FLIGHT_FEEDBACK_EVENT_ID_CAPACITY);
    const ids: string[] = [];
    const start = this.processedEventCount <= FLIGHT_FEEDBACK_EVENT_ID_CAPACITY
      ? 0
      : this.processedEventCursor;
    for (let index = 0; index < processedCount; index += 1) {
      const id = this.processedEventIds[(start + index) % FLIGHT_FEEDBACK_EVENT_ID_CAPACITY];
      if (id) ids.push(id);
    }
    return {
      version: FLIGHT_FEEDBACK_EVENT_VERSION,
      seed: formatRunSeed(this.seed),
      runSequence: this.runSequence,
      active: this.active,
      reducedMotion: this.reducedMotion,
      wakeSerial: this.wakeSerial,
      eventSerial: this.eventSerial,
      wakeDistanceAccumulator: this.wakeDistanceAccumulator,
      processedEventIds: ids,
      wake: this.wakeSlots.map(copyWakeSlot),
      events: this.eventSlots.map(copyEventSlot),
    };
  }

  private spawnWake(frame: FlightFeedbackFrame): void {
    const serial = this.wakeSerial;
    this.wakeSerial += 1;
    const slot = this.wakeSlots[this.wakeCursor];
    this.wakeCursor = (this.wakeCursor + 1) % FLIGHT_FEEDBACK_WAKE_CAPACITY;
    const side = serial % 2 === 0 ? -1 : 1;
    const jitter = randomUnit(this.seed, this.runSequence, serial, 17) - 0.5;
    const folded = Math.max(0, Math.min(1, frame.wingFold));
    const speedMultiplier = Math.max(1, frame.speedMultiplier);
    slot.active = true;
    slot.x = frame.x + side * (0.08 + (1 - folded) * 0.12) + jitter * 0.025;
    slot.y = frame.y - 0.035 - folded * 0.025;
    slot.z = frame.z + 0.16;
    slot.rotation = side * (0.22 + folded * 0.22) + jitter * 0.12;
    slot.age = 0;
    slot.life = this.reducedMotion ? 0.32 : 0.64;
    slot.scaleX = (0.11 + speedMultiplier * 0.035) * (0.76 + folded * 0.5);
    slot.scaleY = (0.025 + speedMultiplier * 0.009) * (1.35 - folded * 0.28);
  }

  private getEventShardCount(type: FlightFeedbackEventType): number {
    if (this.reducedMotion) {
      return type === 'clean-line' || type === 'line-bonus' ? 3 : 2;
    }
    switch (type) {
      case 'ring-captured':
        return 6;
      case 'line-bonus':
        return 8;
      case 'family-passed':
        return 4;
      case 'clean-line':
        return 10;
    }
  }

  private spawnEventSlot(event: FlightFeedbackEvent, index: number, count: number): void {
    const serial = this.eventSerial;
    this.eventSerial += 1;
    const slot = this.eventSlots[this.eventCursor];
    this.eventCursor = (this.eventCursor + 1) % FLIGHT_FEEDBACK_EVENT_CAPACITY;
    const angleJitter = randomUnit(this.seed, this.runSequence, serial, 31) - 0.5;
    const speedJitter = randomUnit(this.seed, this.runSequence, serial, 47);
    const angle = (Math.PI * 2 * index) / count + angleJitter * 0.42;
    const direction = event.type === 'clean-line' ? -1 : 1;
    const magnitude = 0.48 + speedJitter * 0.52;
    const radialOffset = event.type === 'clean-line'
      ? 0.58
      : event.type === 'line-bonus'
        ? 0.42
        : event.type === 'ring-captured'
          ? 0.28
          : 0;

    slot.active = true;
    slot.kind = this.getEventKind(event.type);
    slot.x = event.x + (
      event.type === 'family-passed'
        ? (index % 2 === 0 ? -1.8 : 1.8)
        : Math.cos(angle) * radialOffset
    );
    slot.y = event.y + (
      event.type === 'family-passed'
        ? (index < 2 ? 0.55 : -0.55)
        : Math.sin(angle) * radialOffset
    );
    slot.z = event.z - (event.type === 'family-passed' ? 0.8 : 0);
    slot.velocityX = Math.cos(angle) * magnitude * direction;
    slot.velocityY = Math.sin(angle) * magnitude * direction;
    slot.velocityZ = event.type === 'line-bonus' || event.type === 'clean-line' ? -0.65 : -0.2;
    slot.rotation = angle;
    slot.spin = (index % 2 === 0 ? -1 : 1) * (1.4 + speedJitter * 1.2);
    slot.age = 0;
    slot.life = this.reducedMotion ? 0.36 : event.type === 'family-passed' ? 0.9 : 0.68;
    slot.scale = event.type === 'family-passed'
      ? 0.4
      : event.type === 'clean-line'
        ? 0.3
        : event.type === 'line-bonus'
          ? 0.28
          : 0.22;
  }

  private getEventKind(type: FlightFeedbackEventType): FlightFeedbackEventKind {
    switch (type) {
      case 'ring-captured':
        return 'capture-shard';
      case 'line-bonus':
        return 'line-pulse';
      case 'family-passed':
        return 'passage-mark';
      case 'clean-line':
        return 'clean-convergence';
    }
  }

  private hasProcessedEvent(eventId: string): boolean {
    const count = Math.min(this.processedEventCount, FLIGHT_FEEDBACK_EVENT_ID_CAPACITY);
    for (let index = 0; index < count; index += 1) {
      if (this.processedEventIds[index] === eventId) return true;
    }
    return false;
  }

  private rememberEvent(eventId: string): void {
    this.processedEventIds[this.processedEventCursor] = eventId;
    this.processedEventCursor = (this.processedEventCursor + 1) % FLIGHT_FEEDBACK_EVENT_ID_CAPACITY;
    this.processedEventCount += 1;
  }

  private clearSlots(): void {
    for (const slot of this.wakeSlots) slot.active = false;
    for (const slot of this.eventSlots) slot.active = false;
  }
}
