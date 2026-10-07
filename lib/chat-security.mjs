export const MAX_BODY_BYTES = 32768;
export const MAX_MESSAGES = 10;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_TOTAL_CHARS = 8000;

export class ClientError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function jsonError(status, message, extra = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

export async function readMessages(req) {
  const encoding = req.headers.get('content-encoding');
  if (encoding && encoding !== 'identity') throw new ClientError(415, 'Compressed requests are not supported.');
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ClientError(415, 'Content-Type must be application/json.');
  }
  const declared = Number(req.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) throw new ClientError(413, 'Message payload is too large.');
  if (!req.body) throw new ClientError(400, 'A JSON body is required.');
  const reader = req.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, raw = '';
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ClientError(408, 'Request body timed out.'));
      void reader.cancel().catch(() => {});
    }, 5000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new ClientError(413, 'Message payload is too large.');
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
      throw new ClientError(400, 'Provide between 1 and 10 messages.');
    }
    let total = 0;
    const clean = messages.map(msg => {
      if (!msg || typeof msg !== 'object' || !['user', 'assistant'].includes(msg.role) ||
          typeof msg.content !== 'string' || !msg.content.trim() || msg.content.length > MAX_MESSAGE_CHARS) {
        throw new ClientError(400, 'Invalid message role, text, or length.');
      }
      total += msg.content.length;
      return { role: msg.role, content: msg.content };
    });
    if (total > MAX_TOTAL_CHARS) throw new ClientError(413, 'Conversation is too long.');
    if (clean.at(-1).role !== 'user') throw new ClientError(400, 'The final message must be a user message.');
    return clean;
  } catch (err) {
    void reader.cancel().catch(() => {});
    if (err instanceof ClientError) throw err;
    throw new ClientError(400, 'Invalid JSON request.');
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
