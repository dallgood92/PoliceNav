const DIRECTIONS = [
  'NORTH',
  'EAST',
  'SOUTH',
  'WEST',
];

const ARROWS = ['↑', '→', '↓', '←'];

export function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

export function directionIndex(degrees) {
  return Math.round(normalizeDegrees(degrees) / 90) % 4;
}

export function formatDirection({ course, speed, compassHeading }) {
  const isMoving = Number.isFinite(speed) && speed >= 1.5;
  const hasCourse = Number.isFinite(course) && course >= 0;
  const hasCompass = Number.isFinite(compassHeading) && compassHeading >= 0;
  const degrees = isMoving && hasCourse ? course : hasCompass ? compassHeading : null;

  if (degrees === null) {
    return { label: 'DIRECTION UNAVAILABLE', arrow: '—', degrees: null, source: 'none' };
  }

  const index = directionIndex(degrees);
  return {
    label: isMoving && hasCourse ? `${DIRECTIONS[index]}BOUND` : `FACING ${DIRECTIONS[index]}`,
    arrow: ARROWS[index],
    degrees: Math.round(normalizeDegrees(degrees)),
    source: isMoving && hasCourse ? 'course' : 'compass',
  };
}
