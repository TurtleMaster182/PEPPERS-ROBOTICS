import { inkArrivalSteps } from './ink-field.js';

let worker, active, workerFailed = false;
const queue = [];
let nextId = 0;

export function randomInkStart(columns, rows, random = Math.random) {
  return { originX: Math.floor(random() * columns), originY: Math.floor(random() * rows),
    seed: Math.floor(random() * 4294967296) >>> 0 };
}

function settle(job, error, thresholds) {
  job.signal?.removeEventListener('abort', job.abort);
  if (active === job) active = undefined;
  if (error) job.reject(error); else job.resolve(thresholds);
  drain();
}

function drain() {
  if (active) return;
  const job = queue.shift();
  if (!job) { worker?.terminate(); worker = undefined; return; }
  active = job;
  if (typeof Worker !== 'undefined' && !workerFailed) {
    try {
      if (!worker) {
        const created = new Worker(new URL('./ink-worker.js', import.meta.url), { type: 'module' });
        worker = created;
        created.onmessage = ({ data }) => {
          if (worker !== created) return;
          if (active?.id !== data.id) return;
          settle(active, data.error ? new Error(data.error) : null, data.thresholds);
        };
        created.onerror = event => {
          if (worker !== created) return;
          event.preventDefault();
          created.terminate(); worker = undefined; workerFailed = true;
          if (active) runCooperatively(active);
        };
      }
      worker.postMessage({ id: job.id, ...job.parameters });
      return;
    } catch {
      worker?.terminate(); worker = undefined; workerFailed = true;
    }
  }
  runCooperatively(job);
}

function runCooperatively(job) {
  const { columns, rows, originX, originY, seed } = job.parameters;
  const steps = inkArrivalSteps(columns, rows, originX, originY, seed);
  function batch() {
    if (active !== job) return;
    try {
      const until = performance.now() + 6;
      do {
        const result = steps.next();
        if (result.done) { settle(job, null, result.value); return; }
      } while (performance.now() < until);
      setTimeout(batch, 0);
    } catch (error) { settle(job, error); }
  }
  setTimeout(batch, 0);
}

export function requestInkField(parameters, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Ink preparation cancelled')); return; }
    const job = { id: ++nextId, parameters, signal, resolve, reject };
    job.abort = () => {
      if (active === job) { worker?.terminate(); worker = undefined; }
      else {
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
      }
      settle(job, new Error('Ink preparation cancelled'));
    };
    signal?.addEventListener('abort', job.abort, { once: true });
    queue.push(job);
    drain();
  });
}
