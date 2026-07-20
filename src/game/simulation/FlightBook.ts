import { formatRunSeed, normalizeRunSeed } from './RunSeed';
import type { ProceduralRoomFamilyId } from './ProceduralRoomSet';

export const FLIGHT_BOOK_STORAGE_KEY = 'paperGlider.flightBook.v1';
export const FLIGHT_BOOK_SCHEMA_VERSION = 1;
export const FLIGHT_BOOK_EVENT_VERSION = 'flight-book-event-v1';
export const FLIGHT_BOOK_UNLOCK_NOTICE_SECONDS = 3.2;
export const FLIGHT_BOOK_CANARY_SEED = 0x1badb000;
export const FLIGHT_BOOK_CANARY_SEED_LABEL = '1BADB000';

export type FlightBookGoalId = 'ring-route' | 'clean-archive' | 'room-tour';
export type FlightBookStyleId = 'default' | 'amber-kraft' | 'blueprint-fold' | 'sage-ledger';
export type FlightBookFamilyId = Exclude<ProceduralRoomFamilyId, 'classic-room'>;

export interface FlightBookGoalDefinition {
  readonly id: FlightBookGoalId;
  readonly title: string;
  readonly condition: string;
  readonly rewardStyleId: Exclude<FlightBookStyleId, 'default'>;
}

export interface FlightBookStyleDefinition {
  readonly id: FlightBookStyleId;
  readonly label: string;
  readonly description: string;
  readonly paperColor: number;
  readonly foldColor: number;
}

export const FLIGHT_BOOK_GOALS: readonly FlightBookGoalDefinition[] = Object.freeze([
  Object.freeze({
    id: 'ring-route',
    title: 'Ring Route',
    condition: 'Collect 8 rings and earn 1 Line bonus in one flight.',
    rewardStyleId: 'amber-kraft',
  }),
  Object.freeze({
    id: 'clean-archive',
    title: 'Clean Archive',
    condition: 'Complete the Archive Gate CLEAN LINE once.',
    rewardStyleId: 'blueprint-fold',
  }),
  Object.freeze({
    id: 'room-tour',
    title: 'Room Tour',
    condition: 'Enter, guide, and exit Offset Gallery and Split Loft in one flight.',
    rewardStyleId: 'sage-ledger',
  }),
]);

export const FLIGHT_BOOK_STYLES: readonly FlightBookStyleDefinition[] = Object.freeze([
  Object.freeze({
    id: 'default',
    label: 'Ivory',
    description: 'Original cream paper and parchment fold.',
    paperColor: 0xf7f1df,
    foldColor: 0xdacbad,
  }),
  Object.freeze({
    id: 'amber-kraft',
    label: 'Amber Kraft',
    description: 'Warm kraft paper with a terracotta fold.',
    paperColor: 0xe4c78f,
    foldColor: 0xb85f43,
  }),
  Object.freeze({
    id: 'blueprint-fold',
    label: 'Blueprint Fold',
    description: 'Blue-gray paper with a light drafting fold.',
    paperColor: 0xaebfc6,
    foldColor: 0xd1e2e6,
  }),
  Object.freeze({
    id: 'sage-ledger',
    label: 'Sage Ledger',
    description: 'Pale sage paper with a dark green fold.',
    paperColor: 0xc7d3b5,
    foldColor: 0x55745c,
  }),
]);

const goalIds = new Set<FlightBookGoalId>(FLIGHT_BOOK_GOALS.map(({ id }) => id));
const styleIds = new Set<FlightBookStyleId>(FLIGHT_BOOK_STYLES.map(({ id }) => id));
const goalOrder = new Map(FLIGHT_BOOK_GOALS.map(({ id }, index) => [id, index]));
const styleOrder = new Map(FLIGHT_BOOK_STYLES.map(({ id }, index) => [id, index]));

export interface FlightBookPersistentState {
  readonly version: typeof FLIGHT_BOOK_SCHEMA_VERSION;
  readonly completedGoalIds: readonly FlightBookGoalId[];
  readonly unlockedStyleIds: readonly FlightBookStyleId[];
  readonly selectedStyleId: FlightBookStyleId;
}

export type FlightBookFamilyStage = 'not-entered' | 'entered' | 'guided' | 'exited';

export interface FlightBookFamilyProgress {
  readonly stage: FlightBookFamilyStage;
  readonly roomSequence: number | null;
}

export interface FlightBookRunProgress {
  readonly runId: string | null;
  readonly seed: number | null;
  readonly runSequence: number;
  readonly status: 'idle' | 'active' | 'crashed' | 'ended' | 'restarted';
  readonly ringCount: number;
  readonly lineBonusCount: number;
  readonly cleanLineCount: number;
  readonly families: Readonly<Record<FlightBookFamilyId, FlightBookFamilyProgress>>;
  readonly processedEventIds: readonly string[];
  readonly newlyUnlockedStyleIds: readonly FlightBookStyleId[];
}

export interface FlightBookNotification {
  readonly styleId: Exclude<FlightBookStyleId, 'default'> | null;
  readonly remainingSeconds: number;
}

export interface FlightBookState {
  readonly persistent: FlightBookPersistentState;
  readonly run: FlightBookRunProgress;
  readonly notification: FlightBookNotification;
}

interface FlightBookEventBase {
  readonly eventVersion: typeof FLIGHT_BOOK_EVENT_VERSION;
  readonly eventId: string;
  readonly seed: number;
  readonly runSequence: number;
}

export type FlightBookEvent =
  | (FlightBookEventBase & { readonly type: 'run-started' })
  | (FlightBookEventBase & {
      readonly type: 'ring-collected';
      readonly roomSequence: number;
      readonly ringId: string;
    })
  | (FlightBookEventBase & {
      readonly type: 'line-bonus-awarded';
      readonly roomSequence: number;
      readonly ringId: string;
    })
  | (FlightBookEventBase & {
      readonly type: 'family-entered';
      readonly familyId: FlightBookFamilyId;
      readonly roomSequence: number;
    })
  | (FlightBookEventBase & {
      readonly type: 'family-guide-ring-collected';
      readonly familyId: FlightBookFamilyId;
      readonly roomSequence: number;
      readonly ringId: string;
    })
  | (FlightBookEventBase & {
      readonly type: 'family-exited';
      readonly familyId: FlightBookFamilyId;
      readonly roomSequence: number;
    })
  | (FlightBookEventBase & {
      readonly type: 'clean-line-awarded';
      readonly commitSequence: number;
    })
  | (FlightBookEventBase & { readonly type: 'crashed' })
  | (FlightBookEventBase & { readonly type: 'run-ended' })
  | (FlightBookEventBase & { readonly type: 'restarted' });

export type FlightBookEventInput = FlightBookEvent extends infer Event
  ? Event extends FlightBookEvent
    ? Omit<Event, 'eventId' | 'eventVersion'>
    : never
  : never;

export interface FlightBookStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function sortGoalIds(ids: Iterable<FlightBookGoalId>): FlightBookGoalId[] {
  return [...new Set(ids)].sort((left, right) => goalOrder.get(left)! - goalOrder.get(right)!);
}

function sortStyleIds(ids: Iterable<FlightBookStyleId>): FlightBookStyleId[] {
  return [...new Set(ids)].sort((left, right) => styleOrder.get(left)! - styleOrder.get(right)!);
}

export function createDefaultFlightBookPersistentState(): FlightBookPersistentState {
  return {
    version: FLIGHT_BOOK_SCHEMA_VERSION,
    completedGoalIds: [],
    unlockedStyleIds: ['default'],
    selectedStyleId: 'default',
  };
}

function createIdleRunProgress(): FlightBookRunProgress {
  return {
    runId: null,
    seed: null,
    runSequence: -1,
    status: 'idle',
    ringCount: 0,
    lineBonusCount: 0,
    cleanLineCount: 0,
    families: {
      'offset-gallery': { stage: 'not-entered', roomSequence: null },
      'split-loft': { stage: 'not-entered', roomSequence: null },
    },
    processedEventIds: [],
    newlyUnlockedStyleIds: [],
  };
}

export function createFlightBookState(
  persistent: FlightBookPersistentState = createDefaultFlightBookPersistentState(),
): FlightBookState {
  return {
    persistent: normalizePersistentState(persistent),
    run: createIdleRunProgress(),
    notification: { styleId: null, remainingSeconds: 0 },
  };
}

function isGoalId(value: unknown): value is FlightBookGoalId {
  return typeof value === 'string' && goalIds.has(value as FlightBookGoalId);
}

function isStyleId(value: unknown): value is FlightBookStyleId {
  return typeof value === 'string' && styleIds.has(value as FlightBookStyleId);
}

function normalizePersistentState(value: FlightBookPersistentState): FlightBookPersistentState {
  const completedGoalIds = sortGoalIds(value.completedGoalIds.filter(isGoalId));
  const earnedStyles = completedGoalIds.map((goalId) => (
    FLIGHT_BOOK_GOALS.find(({ id }) => id === goalId)!.rewardStyleId
  ));
  const unlockedStyleIds = sortStyleIds(['default', ...earnedStyles]);
  const selectedStyleId = isStyleId(value.selectedStyleId)
    && unlockedStyleIds.includes(value.selectedStyleId)
    ? value.selectedStyleId
    : 'default';
  return {
    version: FLIGHT_BOOK_SCHEMA_VERSION,
    completedGoalIds,
    unlockedStyleIds,
    selectedStyleId,
  };
}

export function loadFlightBookPersistentState(
  storage: FlightBookStorage | null,
): FlightBookPersistentState {
  try {
    const raw = storage?.getItem(FLIGHT_BOOK_STORAGE_KEY);
    if (!raw) return createDefaultFlightBookPersistentState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== FLIGHT_BOOK_SCHEMA_VERSION) return createDefaultFlightBookPersistentState();
    const completedGoalIds = Array.isArray(parsed.completedGoalIds)
      ? parsed.completedGoalIds.filter(isGoalId)
      : [];
    const selectedStyleId = isStyleId(parsed.selectedStyleId) ? parsed.selectedStyleId : 'default';
    return normalizePersistentState({
      version: FLIGHT_BOOK_SCHEMA_VERSION,
      completedGoalIds,
      unlockedStyleIds: ['default'],
      selectedStyleId,
    });
  } catch {
    return createDefaultFlightBookPersistentState();
  }
}

export function serializeFlightBookPersistentState(state: FlightBookPersistentState): string {
  return JSON.stringify(normalizePersistentState(state));
}

export function persistFlightBookPersistentState(
  storage: FlightBookStorage | null,
  state: FlightBookPersistentState,
): boolean {
  try {
    storage?.setItem(FLIGHT_BOOK_STORAGE_KEY, serializeFlightBookPersistentState(state));
    return storage !== null;
  } catch {
    return false;
  }
}

export function getFlightBookStyle(styleId: FlightBookStyleId): FlightBookStyleDefinition {
  return FLIGHT_BOOK_STYLES.find(({ id }) => id === styleId) ?? FLIGHT_BOOK_STYLES[0];
}

export function selectFlightBookStyle(
  state: FlightBookState,
  styleId: FlightBookStyleId,
): FlightBookState {
  if (
    !state.persistent.unlockedStyleIds.includes(styleId)
    || state.persistent.selectedStyleId === styleId
  ) return state;
  return {
    ...state,
    persistent: normalizePersistentState({ ...state.persistent, selectedStyleId: styleId }),
  };
}

export function getFlightBookRunId(seed: number, runSequence: number): string {
  return `${formatRunSeed(seed)}:${Math.max(0, Math.floor(runSequence))}`;
}

function eventIdentity(event: FlightBookEventInput): string {
  switch (event.type) {
    case 'run-started':
    case 'crashed':
    case 'run-ended':
    case 'restarted':
      return event.type;
    case 'ring-collected':
    case 'line-bonus-awarded':
      return `${event.roomSequence}:${event.ringId}`;
    case 'family-entered':
    case 'family-exited':
      return `${event.roomSequence}:${event.familyId}`;
    case 'family-guide-ring-collected':
      return `${event.roomSequence}:${event.familyId}:${event.ringId}`;
    case 'clean-line-awarded':
      return String(event.commitSequence);
  }
}

export function createFlightBookEvent(event: FlightBookEventInput): FlightBookEvent {
  const seed = normalizeRunSeed(event.seed);
  const runSequence = Math.max(0, Math.floor(event.runSequence));
  return {
    ...event,
    seed,
    runSequence,
    eventVersion: FLIGHT_BOOK_EVENT_VERSION,
    eventId: `${FLIGHT_BOOK_EVENT_VERSION}:${formatRunSeed(seed)}:${runSequence}:${event.type}:${eventIdentity(event)}`,
  } as FlightBookEvent;
}

function isCanonicalEvent(event: FlightBookEvent): boolean {
  if (event.eventVersion !== FLIGHT_BOOK_EVENT_VERSION) return false;
  const candidate = createFlightBookEvent(event);
  return candidate.eventId === event.eventId;
}

function goalSatisfied(goalId: FlightBookGoalId, run: FlightBookRunProgress): boolean {
  switch (goalId) {
    case 'ring-route':
      return run.ringCount >= 8 && run.lineBonusCount >= 1;
    case 'clean-archive':
      return run.cleanLineCount >= 1;
    case 'room-tour':
      return Object.values(run.families).every(({ stage }) => stage === 'exited');
  }
}

function withEarnedGoals(state: FlightBookState): FlightBookState {
  const newGoals = FLIGHT_BOOK_GOALS.filter(({ id }) => (
    !state.persistent.completedGoalIds.includes(id) && goalSatisfied(id, state.run)
  ));
  if (newGoals.length === 0) return state;

  const newStyleIds = newGoals.map(({ rewardStyleId }) => rewardStyleId);
  const completedGoalIds = sortGoalIds([
    ...state.persistent.completedGoalIds,
    ...newGoals.map(({ id }) => id),
  ]);
  const unlockedStyleIds = sortStyleIds([
    ...state.persistent.unlockedStyleIds,
    ...newStyleIds,
  ]);
  return {
    persistent: {
      version: FLIGHT_BOOK_SCHEMA_VERSION,
      completedGoalIds,
      unlockedStyleIds,
      selectedStyleId: state.persistent.selectedStyleId,
    },
    run: {
      ...state.run,
      newlyUnlockedStyleIds: sortStyleIds([
        ...state.run.newlyUnlockedStyleIds,
        ...newStyleIds,
      ]),
    },
    notification: {
      styleId: newStyleIds[0],
      remainingSeconds: FLIGHT_BOOK_UNLOCK_NOTICE_SECONDS,
    },
  };
}

function appendProcessedEvent(run: FlightBookRunProgress, eventId: string): FlightBookRunProgress {
  return { ...run, processedEventIds: [...run.processedEventIds, eventId] };
}

export function reduceFlightBookState(
  state: FlightBookState,
  event: FlightBookEvent,
): FlightBookState {
  if (!isCanonicalEvent(event)) return state;
  if (event.type === 'run-started') {
    if (
      state.run.runId === getFlightBookRunId(event.seed, event.runSequence)
      && state.run.processedEventIds.includes(event.eventId)
    ) return state;
    return {
      ...state,
      run: {
        ...createIdleRunProgress(),
        runId: getFlightBookRunId(event.seed, event.runSequence),
        seed: event.seed,
        runSequence: event.runSequence,
        status: 'active',
        processedEventIds: [event.eventId],
      },
      notification: { styleId: null, remainingSeconds: 0 },
    };
  }

  if (
    state.run.runId !== getFlightBookRunId(event.seed, event.runSequence)
    || state.run.processedEventIds.includes(event.eventId)
  ) return state;

  if (event.type === 'restarted') {
    return {
      ...state,
      run: { ...appendProcessedEvent(state.run, event.eventId), status: 'restarted' },
    };
  }

  if (state.run.status !== 'active') return state;

  let run = appendProcessedEvent(state.run, event.eventId);
  switch (event.type) {
    case 'ring-collected':
      run = { ...run, ringCount: run.ringCount + 1 };
      break;
    case 'line-bonus-awarded':
      run = { ...run, lineBonusCount: run.lineBonusCount + 1 };
      break;
    case 'clean-line-awarded':
      run = { ...run, cleanLineCount: run.cleanLineCount + 1 };
      break;
    case 'family-entered': {
      const current = run.families[event.familyId];
      if (current.stage !== 'exited' && current.roomSequence !== event.roomSequence) {
        run = {
          ...run,
          families: {
            ...run.families,
            [event.familyId]: { stage: 'entered', roomSequence: event.roomSequence },
          },
        };
      }
      break;
    }
    case 'family-guide-ring-collected': {
      const current = run.families[event.familyId];
      if (current.stage === 'entered' && current.roomSequence === event.roomSequence) {
        run = {
          ...run,
          families: {
            ...run.families,
            [event.familyId]: { ...current, stage: 'guided' },
          },
        };
      }
      break;
    }
    case 'family-exited': {
      const current = run.families[event.familyId];
      if (current.stage === 'guided' && current.roomSequence === event.roomSequence) {
        run = {
          ...run,
          families: {
            ...run.families,
            [event.familyId]: { ...current, stage: 'exited' },
          },
        };
      }
      break;
    }
    case 'crashed':
      run = { ...run, status: 'crashed' };
      break;
    case 'run-ended':
      run = { ...run, status: 'ended' };
      break;
  }

  const next = { ...state, run };
  return event.type === 'crashed' || event.type === 'run-ended'
    ? next
    : withEarnedGoals(next);
}

export function advanceFlightBookSimulation(
  state: FlightBookState,
  deltaSeconds: number,
): FlightBookState {
  if (state.notification.styleId === null || deltaSeconds <= 0) return state;
  const remainingSeconds = Math.max(0, state.notification.remainingSeconds - deltaSeconds);
  return {
    ...state,
    notification: remainingSeconds > 0
      ? { ...state.notification, remainingSeconds }
      : { styleId: null, remainingSeconds: 0 },
  };
}

export function formatFlightBookGoalProgress(
  goalId: FlightBookGoalId,
  run: FlightBookRunProgress,
): string {
  switch (goalId) {
    case 'ring-route':
      return `${Math.min(8, run.ringCount)}/8 rings · ${Math.min(1, run.lineBonusCount)}/1 Line`;
    case 'clean-archive':
      return `${Math.min(1, run.cleanLineCount)}/1 CLEAN LINE`;
    case 'room-tour': {
      const exited = Object.values(run.families).filter(({ stage }) => stage === 'exited').length;
      return `${exited}/2 rooms safely toured`;
    }
  }
}

export function getTrackedFlightBookGoal(state: FlightBookState): FlightBookGoalDefinition | null {
  return FLIGHT_BOOK_GOALS.find(({ id }) => !state.persistent.completedGoalIds.includes(id))
    ?? null;
}
