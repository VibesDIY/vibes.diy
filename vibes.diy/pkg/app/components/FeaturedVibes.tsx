import React, { useMemo } from "react";
import PublishedVibeCard from "./PublishedVibeCard.js";

// Featured vibes data
export const publishedVibes = [
  // Newly featured vibes (2025-10-13)
  {
    name: "Bricksalot",
    // From https://vivaldi-quasar-3156_pingpong.vibesdiy.app/
    slug: "vivaldi-quasar-3156_pingpong",
  },
  {
    name: "Create Emotional Playlists",
    slug: "occupational-basilisk-4371",
  },
  {
    name: "Dr. Deas Drum Machine",
    slug: "excited-wombat-4753",
  },
  // {
  //   name: 'Dr. Deas Chord Synthesizer',
  //   slug: 'environmental-newt-5799',
  // },
  {
    name: "Trivia Showdown",
    slug: "atmospheric-tiger-9377",
  },
  {
    name: "Ultra-Haptic",
    slug: "ellington-ceres-4413",
  },
  {
    name: "Bedtime Stories",
    slug: "okay-bedbug-2773",
  },
  {
    name: "Chess Drills",
    slug: "advanced-tahr-2423",
  },
  {
    name: "Napkin Sketch",
    slug: "varying-peacock-7591",
  },
  {
    name: "Bonsai Generator",
    slug: "historical-wildfowl-2884",
  },
  {
    name: "Reality Distortion Field",
    slug: "immense-shrimp-9469",
  },
  {
    name: "Party Game",
    slug: "cute-frog-9259",
  },
  {
    name: "303 Synth",
    slug: "nice-peacock-7883",
  },
  {
    name: "Color Bender",
    slug: "loose-gerbil-5537",
  },
  {
    name: "Startup Landing",
    slug: "dominant-lion-3190",
  },
  {
    name: "Archive Radio",
    slug: "minimum-sawfish-6762",
  },
  {
    name: "BMX Legends",
    slug: "interested-barnacle-9449",
  },
  {
    name: "Vibecode News",
    slug: "smiling-barnacle-8368",
  },
  {
    name: "Museum API",
    slug: "global-kingfisher-4005",
  },
  {
    name: "Ascii Camera",
    slug: "physical-krill-5417",
  },
  {
    name: "Moto Tempest",
    slug: "proper-lemur-3368",
  },
  {
    name: "Cosmic Canvas",
    slug: "grand-platypus-4140",
  },
];

interface FeaturedVibesProps {
  count?: number;
  className?: string;
}

export default function FeaturedVibes({
  count = 3,
  className = "",
}: FeaturedVibesProps) {
  const filteredVibes = useMemo(() => {
    // Get random vibes from the publishedVibes array
    const shuffled = [...publishedVibes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }, [count]);

  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-3 gap-4">
        {filteredVibes.map((vibe) => (
          <PublishedVibeCard
            key={vibe.name}
            slug={vibe.slug}
            name={vibe.name}
          />
        ))}
      </div>
    </div>
  );
}
