import { initQR } from './qr/qr-section.js';
import { initMap } from './map/map-section.js';
import { initImageViewer } from './viewers/image-viewer.js';

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
  const tabs = document.querySelectorAll('.nav-tab');
  const sections = document.querySelectorAll('.app-section');
  const initialized = {};

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.section;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      sections.forEach(s => s.classList.toggle('active', s.id === `section-${target}`));

      if (!initialized[target]) {
        initialized[target] = true;
        const el = document.getElementById(`section-${target}`);
        switch (target) {
          case 'map':
            initMap(el);
            break;
          case 'cp':
            initImageViewer(el, { title: 'Cartes Postales', images: CP_IMAGES });
            break;
          case 'tuiles':
            initImageViewer(el, { title: 'Tuiles', images: TUILE_IMAGES });
            break;
        }
      }
    });
  });

  // Init QR immediately (default section)
  initQR(document.getElementById('section-qr'));
});
