import React from "react";
import { HomeSectionProps } from "./HomeSection.types.ts";
import { getHomeSectionStyle, getHomeSectionWrapperStyle } from "./HomeSection.styles.ts";

export const HomeSection = ({ color, children }: HomeSectionProps) => {
  return <section style={getHomeSectionWrapperStyle(color)}>
    <div style={getHomeSectionStyle(color)}>
      {children}
    </div>
  </section>
};
