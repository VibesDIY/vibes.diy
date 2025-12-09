import React, { useMemo } from "react";
import VibeGalleryCard from "./VibeGalleryCard.js";

// Featured vibes data (imported from FeaturedVibes)
const publishedVibes = [
  {
    name: "Museum API",
    slug: "global-kingfisher-4005",
  },
  {
    name: "Reality Distortion Field",
    slug: "immense-shrimp-9469",
  },
  {
    name: "Dr. Deas Drum Machine",
    slug: "excited-wombat-4753",
  },
  {
    name: "Party Game",
    slug: "cute-frog-9259",
  },
  {
    name: "Trivia Showdown",
    slug: "atmospheric-tiger-9377",
  },
  {
    name: "Chess Drills",
    slug: "advanced-tahr-2423",
  },
  {
    name: "Bonsai Generator",
    slug: "historical-wildfowl-2884",
  },
  {
    name: "303 Synth",
    slug: "nice-peacock-7883",
  },
];

interface VibeGalleryProps {
  count?: number;
}

export default function VibeGallery({ count = 4 }: VibeGalleryProps) {
  const selectedVibes = useMemo(() => {
    // Get random vibes from the publishedVibes array
    const shuffled = [...publishedVibes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }, [count]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: 'center',
        alignItems: "center",
        padding: "20px 0px",
        width: "100%",
      }}
    >
      {selectedVibes.map((vibe) => (
        <VibeGalleryCard key={vibe.slug} slug={vibe.slug} name={vibe.name} />
      ))}
    </div>
  );
}
