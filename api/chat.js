import { ClientError, jsonError, readMessages } from '../lib/chat-security.mjs';
import { TEAM_INFO } from '../lib/team-info.mjs';

// Assembles TEAM_INFO into the single system-instruction string Gemini
// actually receives. Edit lib/team-info.mjs, not this function.
function buildTeamContext(info) {
  const lines = [];

  lines.push(
    "Only answer using the information below. If a fact is marked " +
    '"[FILL IN]" or a section is empty, you do NOT have that information — ' +
    'say so plainly and suggest the visitor email the team or check the ' +
    'contact page. Do not guess, infer, or invent any fact, including ' +
    'contact details, that is not explicitly present below. Season-specific ' +
    'details (robots, mechanisms, strategies, member roles) can change a ' +
    'lot between seasons, so do not treat them as permanent team traits.'
  );
  lines.push('');
  lines.push(`You are the support chatbot for ${info.basics.name}, an FTC robotics team.`);
  lines.push('');

  lines.push('TEAM INFO:');
  lines.push(`- Team name: ${info.basics.name}`);
  lines.push(`- Location: ${info.basics.location || '[FILL IN]'}`);
  lines.push(`- School: ${info.basics.school || '[FILL IN]'}`);
  lines.push(`- FTC rookie year: ${info.basics.rookieYear || '[FILL IN]'}`);
  lines.push(`- Website: ${info.basics.website || '[FILL IN]'}`);
  lines.push(`- Slogan: ${info.basics.slogan || '[FILL IN]'}`);
  lines.push(`- Meeting days/times: ${info.basics.meetingDaysTimes}`);
  lines.push(`- Meeting location: ${info.basics.meetingLocation}`);
  lines.push(`- Contact email: ${info.basics.contactEmail}`);
  lines.push(`- How to join the team: ${info.basics.howToJoin}`);
  lines.push(`- Current season's game: ${info.basics.currentSeasonGame}`);
  lines.push(`- Social media / socials: ${info.basics.socials}`);
  lines.push(`- Fundraising / donations info: ${info.basics.fundraisingInfo}`);
  lines.push('');

  if (info.achievements.length) {
    lines.push('NOTABLE ACHIEVEMENTS/AWARDS:');
    for (const a of info.achievements) {
      lines.push(`- ${a.season}: ${a.title}`);
    }
    lines.push('');
  }

  if (info.sponsors.length) {
    lines.push('SPONSORS:');
    for (const s of info.sponsors) {
      lines.push(`- ${s.name}${s.note ? ` — ${s.note}` : ''}`);
    }
    lines.push('');
  }

  if (info.roster.length) {
    lines.push('TEAM MEMBERS:');
    for (const m of info.roster) {
      lines.push(`- ${m.name}${m.role ? ` — ${m.role}` : ''}`);
    }
    lines.push('');
  }

  if (info.seasons.length) {
    lines.push('SEASON ARCHIVE:');
    for (const s of info.seasons) {
      lines.push(`- ${s.years}${s.tag ? ` (${s.tag})` : ''}: ${s.summary}`);
    }
    lines.push('');
  }

  if (info.faq.length) {
    lines.push('FAQ:');
    for (const item of info.faq) {
      lines.push(`Q: ${item.q}`);
      lines.push(`A: ${item.a}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

const TEAM_CONTEXT = buildTeamContext(TEAM_INFO);

// Primary model and fallback models in order of priority
const MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
];
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Browser boundary only; direct HTTP clients can supply their own Origin.
  const origin = req.headers.get('origin');
  if ((origin && origin !== new URL(req.url).origin) ||
      req.headers.get('sec-fetch-site') === 'cross-site') {
    return jsonError(403, 'Cross-origin requests are not allowed.');
  }
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed.', { Allow: 'POST' });

  let messages;
  try { messages = await readMessages(req); }
  catch (err) {
    return jsonError(err instanceof ClientError ? err.status : 400, err instanceof ClientError ? err.message : 'Invalid request.');
  }
  if (!process.env.GEMINI_API_KEY) return jsonError(503, 'Chat is temporarily unavailable.');

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }],
  }));
  let lastStatus = 503;
  for (const model of MODELS) {
    const controller = new AbortController();
    // Includes headers AND response streaming; never cleared just on HTTP 200.
    const timer = setTimeout(() => controller.abort(), 8000);
    const abort = () => controller.abort();
    req.signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      req.signal.removeEventListener('abort', abort);
    };
    try {
      if (req.signal.aborted) throw new Error('Disconnected');
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: TEAM_CONTEXT }] }, contents,
          generationConfig: { maxOutputTokens: 500 } }),
      });
      if (!upstream.ok || !upstream.body) {
        lastStatus = upstream.status === 429 ? 429 : 502;
        await upstream.body?.cancel();
        controller.abort();
        cleanup();
        if ([400, 401, 403].includes(upstream.status)) break;
        continue;
      }
      return streamReply(upstream, controller, cleanup);
    } catch {
      lastStatus = controller.signal.aborted ? 504 : 502;
      controller.abort();
      cleanup();
      if (req.signal.aborted) break;
    }
  }
  // Never return provider error bodies, configuration details, or credentials.
  return jsonError(lastStatus, 'Chat is temporarily unavailable. Please try again later.');
}

function streamReply(upstream, abortController, cleanup) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '', bytes = 0, outputChars = 0;
      const emit = data => { if (!cancelled) controller.enqueue(encoder.encode(`data: ${data}\n\n`)); };
      function flushEvent(event) {
        const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
        if (!data || data === '[DONE]') return;
        const parsed = JSON.parse(data);
        const parts = parsed?.candidates?.[0]?.content?.parts || [];
        const text = parts.filter(part => typeof part.text === 'string').map(part => part.text).join('');
        outputChars += text.length;
        if (outputChars > 16000) throw new Error('Output limit');
        if (text) emit(JSON.stringify({ text }));
      }
      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 262144) throw new Error('Stream limit');
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, '\n');
          let separator;
          while ((separator = buffer.indexOf('\n\n')) !== -1) {
            flushEvent(buffer.slice(0, separator));
            buffer = buffer.slice(separator + 2);
          }
        }
        buffer += decoder.decode();
        if (buffer.trim() && !cancelled) flushEvent(buffer);
      } catch {
        emit(JSON.stringify({ error: 'The response was interrupted. Please try again.' }));
      } finally {
        abortController.abort();
        void reader.cancel().catch(() => {});
        cleanup();
        if (!cancelled) { emit('[DONE]'); controller.close(); }
      }
    },
    cancel() {
      cancelled = true;
      abortController.abort();
      void reader.cancel().catch(() => {});
      cleanup();
    },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no',
  } });
}
