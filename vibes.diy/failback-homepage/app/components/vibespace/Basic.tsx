import React, { ReactElement } from "react";

// Define the structure of vibe documents
interface VibeDocument {
  _id: string;
  title?: string;
  slug?: string;
  createdAt?: number;
  publishedUrl?: string;
}

interface BasicVibespaceProps {
  userId: string;
  vibes: VibeDocument[];
  isLoading: boolean;
}

export default function Basic({
  userId,
  vibes,
  isLoading,
}: BasicVibespaceProps): ReactElement {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-4 text-2xl font-bold">Space: {userId}</h2>
            <p className="text-accent-01 dark:text-accent-01 mb-6">
              View vibes in this space
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : vibes.length === 0 ? (
          <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-md border py-8 text-center">
            <p className="mb-4 text-lg">No vibes found in this space</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vibes.map((doc) => (
              <div
                key={doc._id}
                className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-md border p-4 transition-colors hover:border-blue-500"
              >
                <div className="flex items-center justify-between">
                  <h3 className="mb-1 text-lg font-medium">
                    {doc.title || doc._id}
                  </h3>
                </div>

                {doc.publishedUrl && (
                  <div className="border-light-decorative-01 dark:border-dark-decorative-01 relative mt-3 mb-4 w-full overflow-hidden rounded-md border">
                    {/* Blurred background version */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      <img
                        src={`${doc.publishedUrl}/screenshot.png`}
                        className="h-full w-full scale-110 object-cover"
                        alt=""
                        style={{ filter: "blur(10px)", opacity: 0.9 }}
                        loading="lazy"
                      />
                    </div>

                    {/* Foreground image with variable height */}
                    <div className="relative z-10 flex w-full justify-center py-2">
                      <img
                        src={`${doc.publishedUrl}/screenshot.png`}
                        alt={`Screenshot from ${doc.title || doc._id}`}
                        className="max-w-full object-contain"
                        style={{ maxHeight: "16rem" }}
                        loading="lazy"
                      />
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <div className="flex-grow"></div>

                  {doc.slug && (
                    <a
                      href={`/remix/${doc.slug}`}
                      className="text-light-secondary dark:text-dark-secondary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 rounded-md px-3 py-1 text-sm"
                    >
                      Remix
                    </a>
                  )}

                  {doc.publishedUrl && (
                    <a
                      href={doc.publishedUrl}
                      className="text-light-primary bg-light-decorative-01 dark:text-dark-primary dark:bg-dark-decorative-01 rounded-md px-3 py-1 text-sm hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Live
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
