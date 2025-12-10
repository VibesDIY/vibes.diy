import React from "react";

interface MetaProps {
  title?: string;
  description?: string;
}

export function Meta({
  title = "Vibes DIY",
  description = "Vibe coding made easy",
}: MetaProps = {}) {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
    </>
  );
}
