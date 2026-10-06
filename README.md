# Peppers Robotics · final build

A simpler rebuild of `testsite`, using its team photos, video, GIFs, models, and protected Q&A endpoint. Plain HTML, CSS, and browser JavaScript modules. No framework, bundler, package installation, or build step.

## Open locally

With Node 22 or newer, run this from the `final build` folder:

```sh
npm start
```

Open **http://127.0.0.1:4173**. The preview serves the page, security headers, and `/api/chat`. Without the server-side chat settings, the bot reports that it is temporarily unavailable. Do not open the HTML directly with `file://`; the gallery and modules need an HTTP server.

```sh
npm test
```

## Where to edit

| File | Responsibility |
| --- | --- |
| `public/index.html` | All visible page content, navigation, season cards, and contact area |
| `public/styles.css` | Theme tokens, layouts, component styles, responsive rules |
| `public/data/seasons.json` | Season gallery images/videos and model paths |
| `public/data/albums.json` | Workshop and team photo albums |
| `public/js/main.js` | Mobile menu, theme, team tabs, event filters, and links to FAQ answers |
| `public/js/theme.js` | Saved theme before the page paints |
| `public/js/details.js` | Shared season, album, and film dialog |
| `public/js/viewer.js` | The single, on-demand 3D viewer |
| `public/chat-widget.js`, `public/chat-widget.css` | Q&A interface |
| `lib/team-info.mjs` | Public facts supplied to the Q&A bot |
| `api/chat.js`, `lib/chat-security.mjs` | Protected chat endpoint and quota checks |
| `scripts/serve.mjs` | Local preview server |

`public/` is the website root. Use `photos/name.jpg` in browser paths, not `public/photos/name.jpg`.

## Updating a season

1. Edit or copy one `article.season-card` in `public/index.html`. Give it a unique `data-season-id`, year, title, description, and cover.
2. Add the same ID to `public/data/seasons.json`. Its `media` array accepts `{ "src": "folder/photo.jpg", "alt": "Description" }`. Videos also need `"type": "video"` and can have a `poster`.
3. An optional `"model": "models/robot.glb"` adds a Load 3D preview button. Only GLB models are supported, matching the supplied files. Nothing downloads until the visitor requests it.
4. Update the bot's corresponding facts in `lib/team-info.mjs` when those facts change.

The **Coming Soon pug is permanent**. Keep the `coming-soon` ID, the original image `https://picsum.photos/id/1025/700/440`, and its gallery entry. Add new seasons alongside it.

## What changed

- A fuller homepage with a bold entrance, large navigation buttons, a 3D lab shortcut, and a prominent Upcoming Events section.
- The original three event listings are restored, clearly marked as a draft schedule. Competition/community filters and expandable event information work without dead RSVP or livestream links.
- The team section has four keyboard-accessible discipline tabs. Process, support, and joining sections give visitors more ways to explore Peppers.
- The homepage uses compact robot previews. Team and workshop photos live in albums that open on request; every original media file is still preserved. The competition album uses a lighter WebP copy of the 9.6 MB original photo.
- Red/dark and light themes, ordinary scrolling, and responsive layouts.
- The original film opens from “Watch the team film”; it no longer blocks the page with autoplay or a loading screen.
- One native dialog handles the galleries and film, including Escape, focus trapping, returning focus, and background scroll locking.
- One 3D viewer is created on demand and disposed when closed. It supports pointer movement, keyboard arrows, and visible rotate/reset controls. It renders only when needed.
- A working mobile menu replaces the prototype alert. Theme changes also update the chat appearance.
- Page content, season/album data, interaction code, model code, and bot facts have separate edit points.
- All original media files remain available under their original paths. The old repository and its history are not copied into this build.

## Content still to confirm

The source had sample event dates, sponsor names, award badges, robot specifications, and fake contact/social links. The event dates and venues are restored as provisional listings; other unconfirmed claims use neutral copy or clear pending states. The original drafts remain in the untouched `testsite` folder.

The confirmed email is `contact@peppers-robotics.ro`; Instagram, Facebook, and YouTube use the team's `cyliispepp` accounts. Contact, sponsorship, mentoring, recruitment-enquiry, and event-enquiry buttons open addressed email drafts. Social buttons link directly to the supplied accounts.

Before publishing, add approved sponsors in `#sponsors` and confirm the dates, venues, and attendance information in `#events`. Confirm model-to-season assignments: the supplied `.glb` files are preserved exactly, including their prototype content. The bot's existing historical facts are preserved separately; review them along with the page content. No new claims about achievements, roster size, or robot performance were invented.

## Editing events and albums

- Each `article.event-card` in `#events` has a `data-event-kind` of `competition` or `community`, a machine-readable `time datetime`, visible date/location/time, and a native expandable `details` block. Keep the machine-readable date and visible date in sync. Add confirmed registration or livestream URLs inside the details when available. Keep the draft notice until the schedule is confirmed.
- Album buttons in `#gallery` use `data-open-album`. The corresponding key in `public/data/albums.json` provides the images. The shared dialog handles loading and closing automatically.
- The team tabs use standard `role="tab"`, `aria-controls`, and matching `role="tabpanel"` IDs. Up/Down/Home/End keys navigate them.
- Internal FAQ links automatically open the linked answer. The contact, support, mentoring, and joining-enquiry buttons use the confirmed email. Replace the joining enquiry with the recruitment form when its link is supplied; event enquiries are not registration links.

The film, GIFs, and GLB files are still large. They load on demand; original assets have not been destructively compressed or replaced. The intentional remote pug image, Google Fonts, and the pinned 3D libraries require a connection. Text uses fallback fonts if Google Fonts is unavailable, and a failed 3D request leaves the gallery usable.

## Hosting

The page can be served from `public/`. On Vercel, select framework **Other**, leave the build command empty, and use **public** as the output directory. Keep the top-level `api/` and `lib/` folders for the Q&A endpoint. The existing `vercel.json` security headers are preserved.

The Q&A requires server-side `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. See `SECURITY.md`. Keep keys out of `public/`. For local chat, copy `.env.example` to `.env.local` in the project root and fill in all three values privately. Restart `npm start` after changing them. The preview loads `.env.local`, then `.env` defaults; existing process environment variables take precedence. Startup lists missing setting names without printing secrets. On Vercel, configure these variables in the project environment settings and redeploy. This rebuild does not deploy the site or configure external accounts.

Tests cover the protected endpoint, safe widget rendering, gallery/asset references, section links, pinned script policies, and the permanent pug. Before release, also open the page on desktop and phone, try both themes, all galleries and models, the film, and a configured live chat request.
# PEPPERS-ROBOTICS
