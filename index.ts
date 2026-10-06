import { generateText } from 'ai';

if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
  console.error('Set AI_GATEWAY_API_KEY in the Vercel environment before running this example.');
  process.exit(1);
}

try {
  const { text } = await generateText({
    model: 'moonshotai/kimi-k3',
    prompt: 'Invent a new holiday and describe its traditions.',
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(120_000),
  });

  if (!text.trim()) {
    console.error('AI Gateway returned no text.');
    process.exitCode = 1;
  } else {
    console.log(text);
  }
} catch {
  // Avoid logging error objects that could contain credentials or request headers.
  console.error('AI Gateway generation failed. Check your local key, account access, and model availability.');
  process.exitCode = 1;
}
