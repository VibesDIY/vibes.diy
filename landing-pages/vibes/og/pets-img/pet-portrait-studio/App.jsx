import React from "react"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"

const classNames = {
  page: "",
  header: "",
  uploader: "",
  stylePicker: "",
  gallery: "",
};

function Uploader() {
  return (
    <section id="uploader" className={classNames.uploader}>
      <h2>Upload</h2>
      {/* drag and drop zone */}
    </section>
  );
}

function StylePicker() {
  return (
    <section id="style-picker" className={classNames.stylePicker}>
      <h2>Pick a Style</h2>
      {/* style buttons grid */}
    </section>
  );
}

function Gallery() {
  return (
    <section id="gallery" className={classNames.gallery}>
      <h2>Gallery</h2>
      {/* past portraits */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Pet Portrait Studio</h1>
      </header>
      <Uploader />
      <StylePicker />
      <Gallery />
    </main>
  );
}