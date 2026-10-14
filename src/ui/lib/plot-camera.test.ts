import { describe, expect, it } from "vitest"
import { PerspectiveCamera, Vector3 } from "three"
import { PLOT_CAMERA_FOV, plotCameraFov } from "./plot-camera"

describe("perspective chart framing", () => {
  it.each([343 / 590, 300 / 630, 1, 1217 / 560])(
    "keeps every cube corner visible at viewport aspect %s",
    (aspect) => {
      const camera = new PerspectiveCamera(plotCameraFov(aspect), aspect, 0.1, 60)
      camera.position.set(3.2512149975, 2.2019064465, 3.7069136813)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const projected = new Vector3(x, y, z).project(camera)
            expect(Math.abs(projected.x)).toBeLessThan(1)
            expect(Math.abs(projected.y)).toBeLessThan(1)
            expect(projected.z).toBeLessThan(1)
          }
    },
  )
  it("retains desktop framing and a finite projection for unmeasured viewports", () => {
    expect(plotCameraFov(2)).toBeCloseTo(PLOT_CAMERA_FOV)
    for (const aspect of [0, -1, NaN, Infinity]) expect(plotCameraFov(aspect)).toBe(PLOT_CAMERA_FOV)
  })
})
