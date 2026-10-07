# Chat security and deployment

## Required before enabling chat

Configure this **server-side** Vercel environment variable for the intended
Preview/Production environment, then redeploy:

- `GEMINI_API_KEY`: the existing Google API key.

Never add these values to public JavaScript or commits. `.env*` and `.vercel/`
are ignored; `.env.example` contains names only. If a credential was previously
published, deleting the file does not revoke the credential: rotate it.

Chat returns a generic 503 without calling Gemini if the API key is missing.
The rest of the site still works. No database is required.

## Enforced boundaries

- Maximum body: 32 KiB, measured while reading, even without Content-Length.
- Body read deadline: 5 seconds. JSON only; compressed requests rejected.
- 1–10 messages; `user`/`assistant` roles only; non-empty strings up to 2,000
  UTF-16 code units each and 8,000 in total. Final message must be from a user.
- A request may attempt at most two configured models, each with a
  500-output-token limit.
- Each model attempt has an 8-second deadline, including response streaming.
  Client cancellation also cancels the provider request.
- Provider stream: maximum 256 KiB and 16,000 output characters. Raw provider
  bodies and generated chat text are not logged or returned as diagnostics.
- Same-origin browser requests only. This is not authentication: scripts can
  forge Origin.
- Plain text rendering of chat output; repeated submission is blocked while a
  response is pending. Client history is bounded and fetch has a deadline.
- CSP restricts executable scripts to local assets and the two exact CDN script
  paths; SHA-384 integrity attributes verify those CDN files. Framing, plugins,
  and base-tag injection are blocked. Inline styles remain allowed because the
  3D renderer applies canvas dimensions dynamically.

There is no application-level request rate limit or shared daily usage cap.
Request and output limits bound individual calls, but do not cap total usage.
Model output is untrusted; public team context is not
confidential and prompts are not an authorization boundary.

## Verification

Run with Node 22 or newer:

```sh
node --test tests/security.test.mjs
```

Tests use mocked Gemini responses. They cover malformed and large
requests, rejected origins, operation with only a Gemini key, response sanitization,
stream parsing/limits/deadlines, cancellation, and duplicate widget submissions.
They do not certify live model availability or Vercel
routing. Before merging, verify a configured preview can complete one chat,
returns the configured security headers, and still loads the shared robot viewer and
external fonts/images without CSP errors. Confirm a blocked-origin request gets
403.

Reference documentation:
- https://vercel.com/docs/project-configuration/vercel-json
