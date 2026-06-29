import React from "react"
import { ImgVibes } from "img-vibes"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"

const classNames = {
  page: "",
  header: "",
  posterCreator: "",
  posterGallery: "",
  aiSuggester: "",
};

function PosterCreator() {
  return (
    <section id="poster-creator" className={classNames.posterCreator}>
      <h2>Poster Creator</h2>
      {/* upload + form fields */}
    </section>
  );
}

function PosterGallery() {
  return (
    <section id="poster-gallery" className={classNames.posterGallery}>
      <h2>Poster Gallery</h2>
      {/* thumbnail strip */}
    </section>
  );
}

export default function App() {
  return (
    <main id="app" className={classNames.page}>
      <header id="app-header" className={classNames.header}>
        <h1>Lost Pet Posters</h1>
      </header>
      <PosterCreator />
      <PosterGallery />
    </main>
  );
}