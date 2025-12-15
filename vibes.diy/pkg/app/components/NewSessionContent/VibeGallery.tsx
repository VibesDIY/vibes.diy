import React, { useMemo } from "react";
import VibeGalleryCard from "./VibeGalleryCard.js";
import {
  FaceIcon1,
  FaceIcon2,
  FaceIcon3,
  FaceIcon4,
} from "../vibes/icons/index.js";
import { getVibeGalleryWrapperStyle } from "./NewSessionContent.styles.js";

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
  isMobile?: boolean;
}

export default function VibeGallery({
  count = 4,
  isMobile = false,
}: VibeGalleryProps) {
  const selectedVibes = useMemo(() => {
    // Get random vibes from the publishedVibes array
    const shuffled = [...publishedVibes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }, [count]);

  // Array of face icons to cycle through
  const faceIcons = [FaceIcon1, FaceIcon2, FaceIcon3, FaceIcon4];

  return (
    <div style={getVibeGalleryWrapperStyle(isMobile)}>
      {selectedVibes.map((vibe, index) => (
        <VibeGalleryCard
          key={vibe.slug}
          slug={vibe.slug}
          name={vibe.name}
          IconComponent={faceIcons[index % faceIcons.length]}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}
