import React from "react"
import { callAI } from "call-ai"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "",
  header: "",
  uploader: "",
  costumePicker: "",
  tryOn: "",
  gallery: "",
};

function PhotoUploader() {
  return (
    <section id="photo-uploader" className={classNames.uploader}>
      <h2>Upload Pet Photo</h2>
      {/* drag and drop upload */}
    </section>
  );
}

function CostumePicker() {
  return (
    <section id="costume-picker" className={classNames.costumePicker}>
      <h2>Pick a Costume</h2>
      {/* costume grid */}
    </section>
  );
}

function TryOnResult() {
  return (
    <section id="try-on" className={classNames.tryOn}>
      <h2>Try-On Result</h2>
      {/* imgvibes result */}
    </section>
  );
}

function FavoritesGallery() {
  return (
    <section id="gallery" className={classNames.gallery}>
      <h2>Favorites</h2>
      {/* saved gallery */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Pet Costume Try-On</h1>
      </header>
      <PhotoUploader />
      <CostumePicker />
      <TryOnResult />
      <FavoritesGallery />
    </main>
  );
}