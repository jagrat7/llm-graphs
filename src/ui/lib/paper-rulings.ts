/** Minor squares per major interval, as on graph paper ruled in fifths. */
export const RULING_SUBDIVISIONS = 4
/** More rulings than this across one span means the ticks are too close to subdivide. */
const RULING_LIMIT = 400
const EDGE = 1e-6

/**
 * Where the minor rulings fall between major ticks, as on graph paper: each interval
 * between consecutive ticks splits into equal squares, and the end intervals' spacing
 * carries on to the edges so the sheet is ruled from border to border. Works in any
 * one-dimensional space, pixels for the SVG plot or unit fractions for the 3D walls.
 */
export function minorRulings(
  ticks: ReadonlyArray<number>,
  low: number,
  high: number,
  subdivisions = RULING_SUBDIVISIONS,
): Array<number> {
  const majors = [...new Set(ticks.filter(Number.isFinite))].toSorted((a, b) => a - b)

  if (majors.length < 2 || subdivisions < 2) return []

  const inside = (position: number) => position > low + EDGE && position < high - EDGE
  const rulings: Array<number> = []
  const firstStep = (majors[1] - majors[0]) / subdivisions
  const lastStep = (majors[majors.length - 1] - majors[majors.length - 2]) / subdivisions

  if ((high - low) / Math.min(firstStep, lastStep) > RULING_LIMIT) return []

  for (let index = 0; index < majors.length - 1; index += 1) {
    const step = (majors[index + 1] - majors[index]) / subdivisions

    for (let square = 1; square < subdivisions; square += 1) {
      const position = majors[index] + square * step

      if (inside(position)) rulings.push(position)
    }
  }

  for (let position = majors[0] - firstStep; inside(position); position -= firstStep) {
    rulings.push(position)
  }

  for (
    let position = majors[majors.length - 1] + lastStep;
    inside(position);
    position += lastStep
  ) {
    rulings.push(position)
  }

  return rulings.toSorted((a, b) => a - b)
}
