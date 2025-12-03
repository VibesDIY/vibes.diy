import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import About from "~/vibes.diy/app/routes/about.js";

// Mock the SimpleAppLayout component
vi.mock("~/vibes.diy/app/components/SimpleAppLayout.js", () => ({
  default: ({
    headerLeft,
    children,
  }: {
    headerLeft: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="simple-app-layout">
      <div data-testid="header-left">{headerLeft}</div>
      <div data-testid="content-area">{children}</div>
    </div>
  ),
}));

// Mock HomeIcon component
vi.mock("~/vibes.diy/app/components/SessionSidebar/HomeIcon.js", () => ({
  HomeIcon: () => <div data-testid="home-icon" />,
}));

// Mock VibesDIYLogo component
vi.mock("~/vibes.diy/app/components/VibesDIYLogo", () => ({
  default: () => <div data-testid="vibes-diy-logo" />,
}));

describe("About Route", () => {
  const renderAbout = () => render(<About />);
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders the about page with correct title and layout", () => {
    const res = renderAbout();

    // Check for header content
    const headerSection = res.getByTestId("header-left");
    expect(headerSection).toBeInTheDocument();

    // Check the home icon exists in the header
    const homeIcon = res.getByTestId("home-icon");
    expect(homeIcon).toBeInTheDocument();

    // Check for the logo
    const logo = res.getByTestId("vibes-diy-logo");
    expect(logo).toBeInTheDocument();
  });

  it("displays the main about page heading", () => {
    const res = renderAbout();
    const heading = res.getByText("About");
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it('displays the "What is Vibes DIY?" section', () => {
    const res = renderAbout();
    const sectionHeading = res.getByText("What is Vibes DIY?");
    expect(sectionHeading).toBeInTheDocument();

    const description = res.getByText(
      /An AI-powered app builder that lets you create custom applications/,
    );
    expect(description).toBeInTheDocument();
  });

  it('displays the "Open source" section with links', () => {
    const res = renderAbout();
    const sectionHeading = res.getByText("Open source");
    expect(sectionHeading).toBeInTheDocument();

    // Check for the community link
    const communityLink = res.getByText("community");
    expect(communityLink).toBeInTheDocument();
    expect(communityLink.getAttribute("href")).toBe(
      "https://discord.gg/vnpWycj4Ta",
    );
    expect(communityLink.getAttribute("target")).toBe("_blank");

    // Check for the repo link
    const repoLink = res.getByText("builder repo");
    expect(repoLink).toBeInTheDocument();
    expect(repoLink.getAttribute("href")).toBe(
      "https://github.com/fireproof-storage/vibes.diy",
    );
  });

  it('displays the "Key Features" section with bullet points', () => {
    const res = renderAbout();
    const sectionHeading = res.getByText("Key Features");
    expect(sectionHeading).toBeInTheDocument();

    // Check for feature bullet points
    const aiFeature = res.getByText(/AI-Powered Generation/);
    expect(aiFeature).toBeInTheDocument();

    const stylingFeature = res.getByText(/Custom Styling/);
    expect(stylingFeature).toBeInTheDocument();

    const localFirstFeature = res.getByText(/Local-First Architecture/);
    expect(localFirstFeature).toBeInTheDocument();

    const fireproofFeature = res.getByText(/database/);
    expect(fireproofFeature).toBeInTheDocument();

    const modelFeature = res.getByText(/Choose Your Model/);
    expect(modelFeature).toBeInTheDocument();
  });

  it("has the correct external links", () => {
    const res = renderAbout();

    // Check Fireproof link - use the within scope of the feature list to be more specific
    const fireproofLink = res.getByText(
      /Reliable, secure database that syncs across devices/,
    );
    const featureFireproofLink = fireproofLink.querySelector("a");
    expect(featureFireproofLink).toBeInTheDocument();
    expect(featureFireproofLink?.getAttribute("href")).toBe(
      "https://use-fireproof.com",
    );

    // Check OpenRouter link
    const openRouterLink = res.getByText("OpenRouter");
    expect(openRouterLink).toBeInTheDocument();
    expect(openRouterLink.getAttribute("href")).toBe("https://openrouter.ai");
  });

  it("has a home navigation link", () => {
    const res = renderAbout();

    // Find link to home
    const homeLink = res.getByRole("link", { name: /go to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.getAttribute("href")).toBe("/");
  });
});
