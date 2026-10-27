// The user's four 5×5 reference masks, followed by a completely filled cell:
// center dot → plus → 3×3 square → 5×5 without corners → full square.
// Each entry says which stage first reveals that subpixel.
export const DITHER_PATTERN = Object.freeze([
  4, 3, 3, 3, 4,
  3, 2, 1, 2, 3,
  3, 1, 0, 1, 3,
  3, 2, 1, 2, 3,
  4, 3, 3, 3, 4
]);
export const DITHER_STAGE_STEP = 17;

// Encode both the fluid arrival and the cell's five stages into one threshold
// image. Playback still only updates the shared SVG threshold once per frame.
export function writeDitherPattern(data, arrivals, columns, rows) {
  if (arrivals.length !== columns * rows || data.length !== columns * rows * 25 * 4) {
    throw new RangeError('Dither image and arrival matrix dimensions differ');
  }
  data.fill(255);
  const width = columns * 5;
  for (let cy = 0; cy < rows; cy++) {
    for (let py = 0; py < 5; py++) {
      let offset = ((cy * 5 + py) * width) * 4 + 3;
      for (let cx = 0; cx < columns; cx++) {
        // Reserve the last 68/255 of the timeline for local dot growth.
        // Every cell gets the complete sequence, even the last cell reached.
        const onset = 1 + Math.round((arrivals[cy * columns + cx] - 1) * 184 / 251);
        for (let px = 0; px < 5; px++) {
          data[offset] = onset + DITHER_PATTERN[py * 5 + px] * DITHER_STAGE_STEP;
          offset += 4;
        }
      }
    }
  }
}
