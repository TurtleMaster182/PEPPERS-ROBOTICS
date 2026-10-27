# Maintaining the Peppers website

## The usual edit

1. Start the preview with `npm start` and open http://127.0.0.1:4173.
2. Find the section in `public/modules/`. Open its `section.html` to change text, links, or images.
3. Save and refresh. For appearance changes, edit that section's `styles.css`; its phone/tablet rules are in the same file.
4. Run `npm test`, then `npm run build`. Check desktop and phone layouts before publishing.

Never edit `public/index.html` directly: the next build replaces it. The file is kept in the repository as a ready-to-serve snapshot, but the section files are the source of truth.

## Add or update a robot

1. In `public/modules/seasons/section.html`, copy an `article.season-card` and give it a unique `id` and `data-season-id`. Update the year, title, description, cover image, and alt text.
2. In `public/data/seasons.json`, add a key matching that `data-season-id`. Copy another entry as a starting point. Keep JSON commas and quotes valid.
3. Add media entries such as `{ "src": "2026-2027/photo.jpeg", "alt": "Description of the robot" }`. Videos also need `"type": "video"`; a `poster` is optional. An optional `"model": "models/robot.glb"` enables the popup's 3D preview.
4. To show a model directly on a card, use the existing `data-inline-model` markup. Those models load as they approach the screen; popup models load on request.
5. To change the featured robot, edit `public/modules/hero/section.html`. Its `data-season-target` must match a season's `data-season-id`.
6. Update `lib/team-info.mjs` if the bot's approved team facts have changed.

Keep the permanent Coming Soon pug alongside new seasons. Keep real robot files separate from the supplied demo models until their replacements are ready.

## Change events

Edit `public/modules/events/section.html`. Each `article.event-card` contains its visible date, title, location, time, and expandable details. Keep `time datetime="YYYY-MM-DD"` consistent with the displayed date.

`data-event-kind` must match a `data-event-filter` button (`competition` or `community`). If you add a category, add a matching filter too. Update the initial `eventFilterStatus` count when adding or removing cards. Keep the draft notice until the schedule is confirmed. Put confirmed registration or livestream links inside the event details.

## Change gallery photos or the film

Album buttons live in `public/modules/gallery/section.html`. Each `data-open-album` matches a key in `public/data/albums.json`; add, remove, or reorder that entry's `media` array to update its photo stack.

The film's source and poster are set in the `[data-open-film]` handler in `public/modules/details/index.js`. The popup's behavior is shared by albums and seasons. Its layout is in that folder's `styles.css`; photo-stack behavior/styles are in `public/js/photo-deck.js` and `public/css/photo-deck.css`.

## Change colors, navigation, or contact details

- Edit `public/css/theme.css` for colors. `--accent` and `--accent-solid` are both pure red `#ff0000`. Light-theme differences belong in `:root.light-mode` in that same file.
- Edit `public/modules/header/section.html` and `public/modules/footer/section.html` for navigation links. An `href="#events"` must match an element with `id="events"`.
- The email is intentionally visible in several places. Search the project for `contact@peppers-robotics.ro` when changing it, including links' `mailto:` addresses and bot facts. Social links appear in contact and footer modules.
- Site title, description, fonts, and script links live in `src/index.html`. Theme preference is applied by `public/js/theme.js` before the page paints.

## Add or reorder a section

1. Make `public/modules/your-section/section.html` and `styles.css`. Use a unique section `id`; follow an existing section's heading and spacing markup.
2. Add `<!-- include: modules/your-section/section.html -->` on its own line inside `<main>` in `src/index.html`. Move include lines to reorder sections. Include paths are relative to `public/`; nested includes are deliberately unsupported.
3. Add `@import url("modules/your-section/styles.css");` to `public/styles.css` before shared effects.
4. If the section needs behavior, export an initializer from its `index.js`, import it in `public/js/main.js`, and call it before the visual effects. Static sections need no JavaScript file.
5. Add navigation links where appropriate. Run the tests and build.

## Visual effects and shared code

Reveal and liquid-glass effects start at the end of `public/js/main.js` (the gallery photo burn starts from `public/js/photo-deck.js`). Remove the relevant initializer call and import there to disable an effect. All respect the visitor's reduced-motion preference. Their CSS is in `public/css/effects.css`.

Adjust dither cell size with `--dither-pixel-size` in `public/css/effects.css` (default `5`, without a unit). Each square cell is 5 × 5 CSS pixels on screen for both photos and other content, independent of photo resolution and cropping. Override the property on a section or individual reveal target for a different size. The reveal duration is set by `REVEAL_DURATION` in `public/js/dither-reveal.js`.

Every reveal generates a fresh matrix from a random starting cell and a procedural ink-flow formula. There are no reusable animation maps. The solver runs on demand in `public/js/ink-worker.js`, with a cooperative fallback. See [the formula and measured inputs](docs/dither-flow.md). Below-fold photos use `data-viewport-src` and a matching `<noscript>` image so the browser does not request them before their section arrives on screen; keep both URLs and alt text in sync when replacing a photo.

Within each 5 × 5 cell, the reveal grows from a center dot through a plus, a 3 × 3 square, and a rounded square before filling the corners. The exact patterns and stage spacing are in `public/js/dither-pattern.js`; the ink formula determines when each cell starts this sequence.

The ink grows along a newly generated branching tree, then thickens sideways to fill the gaps. Branch density and the contrast between fast channels and slow lateral spreading are set in `public/js/ink-field.js`.

The shared 3D viewer is in `public/js/viewer.js` and `public/css/viewer.css`. Keep its pinned library URLs and integrity values together; security headers must permit those exact URLs. Routine content edits do not need changes to the viewer or API.

## Before handing the site to the next team

- Confirm that `npm test` and `npm run build` pass.
- Open the preview on a desktop and a narrow phone window. Check the mobile menu, dark/light theme, event filters, FAQ links, each gallery, 3D controls, film playback, and contact links.
- Check the chat with configured server settings; never commit a real API key. This refactor's automated tests mock upstream chat requests.
- Confirm event information and sponsor copy. Update copyright and season years where needed.
- Give the next maintainer access to the repository and hosting account through the services' normal invitation process. Explain where server environment settings are managed without putting secrets in this document.
- Point them to this guide and the section table in `README.md`.

## Troubleshooting

**My edit disappears:** you edited generated `public/index.html`. Make the edit in the matching module or `src/index.html`.

**An edit does not appear:** save the file and refresh. A plain static server needs `npm run build` after HTML edits; this project's `npm start` assembles them on refresh. Restart after changing server scripts or environment settings.

**The build fails:** check the include path named in the error. Every include must be on its own line and point to an existing `.html` file under `public/`.

**A link/image/gallery stops working:** check the path and case, then run `npm test`. Browser paths omit the `public/` prefix. JSON gallery IDs must match the HTML's data attributes.

**Port 4173 is busy:** stop the existing preview, or run with a different `PORT` setting. The server prints the address to open.
