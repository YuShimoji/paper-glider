// Recommended v1 balance: readable high-speed rooms, deliberate tuck timing, and a controlled lift kick.
export const flightTuning = {
  wing: {
    foldPerSecond: 0.38,
    unfoldStep: 0.34,
    speedBoostMaximum: 0.36,
    speedBoostCurve: 1.22,
    visualFoldRadians: 1.1,
  },
  gesture: {
    doublePressWindowMs: 420,
    doublePressDistancePixels: 42,
  },
  dynamics: {
    airflowBase: 0.96,
    airflowFromBoost: 0.32,
    foldedTurnAuthority: 0.72,
    horizontalSpring: 5.4,
    horizontalDamping: 2.3,
    horizontalOpenDamping: 0.38,
    maximumHorizontalSpeed: 4.85,
    pitchRange: 1.7,
    diveReserveVelocity: 2.8,
    diveReserveDecayWhileDiving: 0.52,
    diveReserveDecayWhileGliding: 0.82,
    foldedLiftAuthority: 0.62,
    pullUpImpulse: 4.65,
    verticalSpring: 3.65,
    verticalDamping: 1.78,
    verticalOpenDamping: 0.48,
    maximumDiveSpeed: 2.9,
    maximumClimbSpeed: 3.25,
  },
} as const;
