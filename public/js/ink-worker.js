import { generateInkArrival } from './ink-field.js';

self.onmessage = ({ data }) => {
  const { id, columns, rows, originX, originY, seed } = data;
  try {
    const thresholds = generateInkArrival(columns, rows, originX, originY, seed);
    self.postMessage({ id, thresholds }, [thresholds.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error.message || error) });
  }
};
