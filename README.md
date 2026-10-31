# Peppers Robotics

The team website uses plain HTML, CSS, and JavaScript. Page sections have their own folders so a new team member can edit one part without searching through the whole site. There is no framework or bundler, and the HTML assembler uses only Node's built-in libraries.

## Start here

Install **Node 22** and run these commands from this folder:

```sh
npm start
```

Open **http://127.0.0.1:4173**. Edit a module, save, then refresh the browser. HTML sections are assembled on each page request; HTML, CSS, and JavaScript edits do not need a server restart. `npm run dev` does the same thing. Stop the server with Ctrl+C.

```sh
npm test        # Check content, files, module behavior, and chat security
npm run build  # Assemble the complete public/index.html for static hosting
```

Start with [MAINTAINING.md](MAINTAINING.md) for common editing tasks and the handover checklist.

## Where things live

| Location | What to edit there |
| --- | --- |
| `public/modules/header/` | Navigation, mobile menu, theme button, scroll progress line, and hanging peppers |
| `public/modules/hero/` | Opening workshop photo, headline, and featured robot |
| `public/modules/mission/` | 01 Who we are: team, mission, what FTC is, quick facts, spinning badge |
| `public/modules/events/` | 02 News: event listings and category filters |
| `public/modules/showcase/` | 03 Projects (outreach programs) and awards, in two tabs |
| `public/modules/partners/` | Auto-scrolling sponsor bar with hover/tap info cards |
| `public/modules/seasons/` | 04 Robot cards and inline model loading |
| `public/modules/gallery/` | 05 Memories: drifting photo wall, album buttons, team film |
| `public/modules/sponsors/` | 06 Support us: monthly support button, sponsor benefits table, other ways to help |
| `public/modules/about/` | 07 Expandable FAQ answers |
| `public/modules/contact/` | Contact address, social links, and contact area |
| `public/modules/footer/` | Footer copy, links, and copyright year |
| `public/modules/details/` | Shared popup for robot galleries, albums, and film |
| `src/index.html` | Page title, metadata, script links, and section order |
| `public/css/theme.css` | Colors, font, and site-wide spacing |
| `public/css/base.css`, `public/css/components.css` | Resets and shared controls/layouts |
| `public/css/viewer.css`, `public/css/photo-deck.css` | Shared 3D viewer and photo stack styles |
| `public/css/effects.css` | Photo burn, liquid glass, and reveal effects |
| `public/data/seasons.json`, `public/data/albums.json` | Gallery photos, video, and model paths |
| `public/js/main.js` | Startup list; section behavior belongs in its module |
| `public/js/theme.js`, `public/js/reveal-boot.js` | Tiny scripts that run before the page paints |
| `public/js/viewer.js`, `public/js/photo-deck.js` | Shared 3D viewer and photo stack behavior |
| `public/js/dither-reveal.js`, `public/js/photo-burn.js`, `public/js/liquid-glass.js` | Shared visual effects |
| `public/js/scroll-fx.js` | Shared scroll reader, progress line, and spinning badge |
| `public/js/heat-flames.js` | Pixel flames at the bottom of the screen that grow with scroll |
| `public/js/hanging-peppers.js` | Swinging peppers under the header |
| `public/chat-widget.js`, `public/chat-widget.css` | Q&A widget |
| `lib/team-info.mjs` | Team facts supplied to the Q&A bot |
| `api/chat.js`, `lib/chat-security.mjs` | Chat endpoint and request validation |
| `scripts/build.mjs`, `scripts/serve.mjs` | HTML assembly and local preview |

Inside a section folder, **`section.html` is the content**, **`styles.css` is its appearance**, and **`index.js` is its behavior**. Static sections need no JavaScript file. Keep a section's responsive rules in its own stylesheet.

`public/index.html` is generated. Edit the module HTML or `src/index.html` instead. `public/styles.css` is only the stylesheet import list. `public/js/details.js` is a compatibility export; edit `public/modules/details/index.js` for dialog behavior.

All browser asset paths start at `public/`: use `photos/name.jpg`, not `public/photos/name.jpg`. CSS image/font URLs are relative to the stylesheet that contains them.

## How the page loads

1. `src/index.html` lists the sections with `<!-- include: modules/header/section.html -->` comments.
2. `scripts/build.mjs` replaces those comments with the actual HTML and writes `public/index.html`. The preview also assembles the latest source on refresh.
3. `public/styles.css` imports shared and section styles. `public/js/main.js` starts the interactive modules, then the visual effects.
4. The browser receives a complete HTML page. Sections do not depend on browser-side HTML fetching, and content remains available without JavaScript. Galleries, filters, theme switching, and models require JavaScript.

## Hosting

On Vercel, use the repository root containing `package.json`, `vercel.json`, `api/`, and `public/`. The checked-in configuration selects framework **Other**, runs **npm run build**, and serves **public**. Security headers and the chat endpoint remain configured in `vercel.json`.

For another static host, run `npm run build` and upload the contents of `public/`. Static-only hosting does not provide the `/api/chat` endpoint. Do not open the site using `file://`; JavaScript modules and galleries need an HTTP server.

The Q&A needs server-side `GEMINI_API_KEY`. For local use, copy `.env.example` to `.env.local`, fill it privately, and restart the preview. Existing environment settings take precedence. Never put credentials under `public/` or commit `.env.local`. See [SECURITY.md](SECURITY.md) for endpoint protections and optional rate limiting. Do not change these files just to update page copy.

## Content to keep and confirm

The **Coming Soon pug is permanent**. Keep its `coming-soon` ID, image `https://picsum.photos/id/1025/700/440`, and gallery entry.

Event dates, venues, and attendance arrangements are provisional. Keep the draft notice until the team confirms them. Confirm model-to-season assignments before replacing the demo models, and use approved sponsor information. Recruitment is school-only; update the FAQ only with approved school information.

The confirmed email is `contact@peppers-robotics.ro`; social accounts use `cyliispepp`. Large photos, film, GIFs, and GLB files remain under their original paths. The remote pug, Google Fonts, and pinned 3D libraries require a connection; fallback fonts and gallery error states handle unavailable resources.
