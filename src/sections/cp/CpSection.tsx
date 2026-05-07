import { ImageGallery } from "../../viewers/ImageGallery";

const CP_IMAGES = Array.from({ length: 10 }, (_, i) => ({
  name: `CP${i}`,
  thumb: `/CPs/small/CP${i}_recto.jpg`,
  full: `/CPs/CP${i}_recto.jpg`,
}));

export default function CpSection() {
  return <ImageGallery title="Cartes Postales" images={CP_IMAGES} />;
}
