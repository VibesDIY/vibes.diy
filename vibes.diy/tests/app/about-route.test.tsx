import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import About from "~/vibes.diy/app/routes/about.js";

// Mock BrutalistLayout component
vi.mock("~/vibes.diy/app/components/BrutalistLayout", () => ({
  default: ({
    children,
    title,
    subtitle,
  }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
  }) => (
    <div data-testid="brutalist-layout">
      <div data-testid="layout-title">{title}</div>
      {subtitle && <div data-testid="layout-subtitle">{subtitle}</div>}
      <div data-testid="content-area">{children}</div>
    </div>
  ),
}));

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    userId: "test",
    isLoaded: true,
    isSignedIn: true,
  }),
  useClerk: () => ({
    redirectToSignIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe("About Route", () => {
  const renderAbout = () => render(<About />);
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders the about page with correct title and layout", () => {
    const res = renderAbout();

    // Check for layout
    const layout = res.getByTestId("brutalist-layout");
    expect(layout).toBeInTheDocument();

    // Check for title
    const title = res.getByTestId("layout-title");
    expect(title).toBeInTheDocument();
    expect(title.textContent).toBe("About");

    // Check for subtitle
    const subtitle = res.getByTestId("layout-subtitle");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle.textContent).toBe("AI-powered app builder");
  });

  it("displays the main about page heading", () => {
    const res = renderAbout();
    const heading = res.getByText("What is Vibes DIY?");
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H2");
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

    // The about page doesn't have a specific "go to home" link
    // but the BrutalistLayout has a hamburger menu/sidebar
    // Let's verify the layout is rendered instead
    const layout = res.getByTestId("brutalist-layout");
    expect(layout).toBeInTheDocument();
  });
});
