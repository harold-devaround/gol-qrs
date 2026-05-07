import { ImageGallery } from "../../viewers/ImageGallery";

const TUILE_IMAGES = Array.from({ length: 24 }, (_, i) => ({
  name: `Tuile ${i + 1}`,
  thumb: `/tuiles/small/tuile${i + 1}_small.png`,
  full: `/tuiles/tuile${i + 1}.png`,
}));

export default function TuilesSection() {
  return <ImageGallery title="Tuiles" images={TUILE_IMAGES} />;
}
