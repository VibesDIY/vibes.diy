import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import About from '../app/routes/about';

// Mock the SimpleAppLayout component
vi.mock('../app/components/SimpleAppLayout', () => ({
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
vi.mock('../app/components/SessionSidebar/HomeIcon', () => ({
  HomeIcon: () => <div data-testid="home-icon" />,
}));

// Mock VibesDIYLogo component
vi.mock('~/components/VibesDIYLogo', () => ({
  default: () => <div data-testid="vibes-diy-logo" />,
}));

describe('About Route', () => {
  const renderAbout = () => render(<About />);

  it('renders the about page with correct title and layout', () => {
    renderAbout();

    // Check for header content
    const headerSection = screen.getByTestId('header-left');
    expect(headerSection).toBeInTheDocument();

    // Check the home icon exists in the header
    const homeIcon = screen.getByTestId('home-icon');
    expect(homeIcon).toBeInTheDocument();

    // Check for the logo
    const logo = screen.getByTestId('vibes-diy-logo');
    expect(logo).toBeInTheDocument();
  });

  it('displays the main about page heading', () => {
    renderAbout();
    const heading = screen.getByText('About');
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H1');
  });

  it('displays the "What is Vibes DIY?" section', () => {
    renderAbout();
    const sectionHeading = screen.getByText('What is Vibes DIY?');
    expect(sectionHeading).toBeInTheDocument();

    const description = screen.getByText(
      /An AI-powered app builder that lets you create custom applications/
    );
    expect(description).toBeInTheDocument();
  });

  it('displays the "Open source" section with links', () => {
    renderAbout();
    const sectionHeading = screen.getByText('Open source');
    expect(sectionHeading).toBeInTheDocument();

    // Check for the community link
    const communityLink = screen.getByText('community');
    expect(communityLink).toBeInTheDocument();
    expect(communityLink.getAttribute('href')).toBe('https://discord.gg/vnpWycj4Ta');
    expect(communityLink.getAttribute('target')).toBe('_blank');

    // Check for the repo link
    const repoLink = screen.getByText('builder repo');
    expect(repoLink).toBeInTheDocument();
    expect(repoLink.getAttribute('href')).toBe('https://github.com/vibesDIY/vibes.diy');
  });

  it('displays the "Key Features" section with bullet points', () => {
    renderAbout();
    const sectionHeading = screen.getByText('Key Features');
    expect(sectionHeading).toBeInTheDocument();

    // Check for feature bullet points
    const aiFeature = screen.getByText(/AI-Powered Generation/);
    expect(aiFeature).toBeInTheDocument();

    const stylingFeature = screen.getByText(/Custom Styling/);
    expect(stylingFeature).toBeInTheDocument();

    const localFirstFeature = screen.getByText(/Local-First Architecture/);
    expect(localFirstFeature).toBeInTheDocument();

    const fireproofFeature = screen.getByText(/database/);
    expect(fireproofFeature).toBeInTheDocument();

    const modelFeature = screen.getByText(/Choose Your Model/);
    expect(modelFeature).toBeInTheDocument();
  });

  it('has the correct external links', () => {
    renderAbout();

    // Check Fireproof link - use the within scope of the feature list to be more specific
    const fireproofLink = screen.getByText(/Reliable, secure database that syncs across devices/);
    const featureFireproofLink = fireproofLink.querySelector('a');
    expect(featureFireproofLink).toBeInTheDocument();
    expect(featureFireproofLink?.getAttribute('href')).toBe('https://use-fireproof.com');

    // Check OpenRouter link
    const openRouterLink = screen.getByText('OpenRouter');
    expect(openRouterLink).toBeInTheDocument();
    expect(openRouterLink.getAttribute('href')).toBe('https://openrouter.ai');
  });

  it('has a home navigation link', () => {
    renderAbout();

    // Find link to home
    const homeLink = screen.getByRole('link', { name: /go to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});
