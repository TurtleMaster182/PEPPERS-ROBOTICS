// Page startup only. Section markup, styles, and interactions live in public/modules/.
import { initHeader } from '../modules/header/index.js';
import { initDetails } from '../modules/details/index.js';
import { initSeasons } from '../modules/seasons/index.js';
import { initEvents } from '../modules/events/index.js';
import { initAbout } from '../modules/about/index.js';
import { initContact } from '../modules/contact/index.js';
import { initDitherReveals } from './dither-reveal.js';
import { initLiquidGlass } from './liquid-glass.js';

initHeader();
initDetails();
initSeasons();
initEvents();
initAbout();
initContact();

// Effects run last so every section is ready before it is revealed.
initDitherReveals();
initLiquidGlass();
