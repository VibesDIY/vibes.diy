import SimpleAppLayout from '../components/SimpleAppLayout';
import { HomeIcon } from '../components/SessionSidebar/HomeIcon';
import VibesDIYLogo from '~/components/VibesDIYLogo';

export function meta() {
  return [
    { title: 'About - Vibes DIY' },
    { name: 'description', content: 'About Vibes DIY - AI App Builder' },
  ];
}

export default function About() {
  return (
    <SimpleAppLayout
      headerLeft={
        <div className="flex items-center">
          <a
            href="/"
            className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark flex items-center px-3 py-2"
            aria-label="Go to home"
          >
            <HomeIcon className="h-6 w-6" />
          </a>
        </div>
      }
    >
      <div className="h-full">
        <div className="mw-10 flex items-center justify-center">
          <VibesDIYLogo width={300} />
        </div>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="pb-4 text-2xl font-bold">About</h1>

          <div className="space-y-6">
            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-5">
              <h2 className="text-light-primary mb-3 text-xl font-medium dark:text-white">
                What is Vibes DIY?
              </h2>
              <p className="text-light-secondary dark:text-dark-secondary">
                An AI-powered app builder that lets you create custom applications with your
                preferred style and functionality. No extensive coding knowledge required.
              </p>
            </div>

            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-5">
              <h2 className="text-light-primary mb-3 text-xl font-medium dark:text-white">
                Open source
              </h2>
              <p className="text-light-secondary dark:text-dark-secondary">
                Share your apps with the{' '}
                <a
                  href="https://discord.gg/vnpWycj4Ta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  community
                </a>{' '}
                and fork the{' '}
                <a
                  href="https://github.com/fireproof-storage/vibes.diy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  builder repo
                </a>
                .
              </p>
            </div>

            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-5">
              <h2 className="text-light-primary mb-3 text-xl font-medium dark:text-white">
                Key Features
              </h2>
              <ul className="text-light-secondary dark:text-dark-secondary ml-5 list-disc space-y-2">
                <li>
                  <span className="font-medium">AI-Powered Generation</span> - Create applications
                  using natural language prompts
                </li>
                <li>
                  <span className="font-medium">Custom Styling</span> - Choose from various design
                  styles or create your own
                </li>
                <li>
                  <span className="font-medium">Local-First Architecture</span> - Your data is
                  managed on your device
                </li>
                <li>
                  <span className="font-medium">
                    <a
                      href="https://use-fireproof.com"
                      target="_blank"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Fireproof
                    </a>
                  </span>{' '}
                  - Reliable, secure database that syncs across devices
                </li>
                <li>
                  <span className="font-medium">Choose Your Model</span> - Access to a variety of AI
                  models through{' '}
                  <a
                    href="https://openrouter.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    OpenRouter
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p className="text-light-secondary dark:text-dark-secondary text-center text-xs">
          Copyright © 2025{' '}
          <a
            href="https://fireproof.storage"
            target="_blank"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Fireproof
          </a>
          {' · '}
          <a
            href="/support"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Support
          </a>
          {' · '}
          <a href="/legal/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
            Privacy Policy
          </a>
          {' · '}
          <a href="/legal/tos" className="text-blue-600 hover:underline dark:text-blue-400">
            Terms of Service
          </a>
        </p>
      </div>
    </SimpleAppLayout>
  );
}
