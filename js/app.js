import { initQR } from './qr/qr-section.js';
import { initTabRouter } from './tab-router.js';

const CP_IMAGES = Array.from({ length: 10 }, (_, i) => ({
  name: `CP${i}`,
  thumb: `CPs/small/CP${i}_recto.jpg`,
  full: `CPs/CP${i}_recto.jpg`,
}));

const TUILE_IMAGES = Array.from({ length: 24 }, (_, i) => ({
  name: `Tuile ${i + 1}`,
  thumb: `tuiles/small/tuile${i + 1}_small.png`,
  full: `tuiles/tuile${i + 1}.png`,
}));

document.addEventListener('DOMContentLoaded', () => {
  const tabs = [...document.querySelectorAll('.nav-tab')];
  const sections = [...document.querySelectorAll('.app-section')];

  // Lazy-load heavy sections on first activation so that an error in one
  // module (e.g. Fabric.js not available) cannot break the whole app.
  initTabRouter(tabs, sections, {
    map: async el => {
      const { initMap } = await import('./map/map-section.js');
      initMap(el);
    },
    cp: async el => {
      const { initImageViewer } = await import('./viewers/image-viewer.js');
      initImageViewer(el, { title: 'Cartes Postales', images: CP_IMAGES });
    },
    tuiles: async el => {
      const { initImageViewer } = await import('./viewers/image-viewer.js');
      initImageViewer(el, { title: 'Tuiles', images: TUILE_IMAGES });
    },
  }, ['qr']); // 'qr' is initialized immediately below

  // Init QR immediately (default section)
  initQR(document.getElementById('section-qr'));
});
