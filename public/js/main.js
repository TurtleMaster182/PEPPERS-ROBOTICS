// Page startup only. Section markup, styles, and interactions live in public/modules/.
import { initHeader } from '../modules/header/index.js';
import { initDetails } from '../modules/details/index.js';
import { initSeasons } from '../modules/seasons/index.js';
import { initEvents } from '../modules/events/index.js';
import { initShowcase } from '../modules/showcase/index.js';
import { initPartners } from '../modules/partners/index.js';
import { initGallery } from '../modules/gallery/index.js';
import { initAbout } from '../modules/about/index.js';
import { initContact } from '../modules/contact/index.js';
import { initDitherReveals } from './dither-reveal.js';
import { initViewportPhotos } from './viewport-photos.js';
import { initScrollIndicators } from './scroll-fx.js';
import { initHeatFlames } from './heat-flames.js';
import { initHangingPeppers } from './hanging-peppers.js';

initViewportPhotos();

initHeader();
initDetails();
initSeasons();
initEvents();
initShowcase();
initPartners();
initGallery();
initAbout();
initContact();

// Effects run last so every section is ready before it is revealed.
initDitherReveals();
initScrollIndicators();
initHeatFlames();
initHangingPeppers();
