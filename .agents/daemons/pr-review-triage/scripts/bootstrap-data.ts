#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';

const USAGE =
  'Usage: bun .agents/daemons/pr-review-triage/scripts/bootstrap-data.ts --repo <owner/repo> --pr <number>';

const HELP_TEXT = `Bootstrap baseline data for the pr-review-triage daemon.

${USAGE}

Options:
  --repo <owner/repo>   Required repository identity.
  --pr <number>         Required pull request number (positive integer).
  -h, --help            Show this help text.
`;

const GRAPHQL_QUERY = `
query PrReviewTriageBootstrap($owner: String!, $repo: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    nameWithOwner
    pullRequest(number: $prNumber) {
      number
      title
      state
      url
      reviews(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          state
          submittedAt
          body
          url
          author {
            login
          }
        }
      }
      reviewThreads(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 100) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              body
              createdAt
              updatedAt
              url
              author {
                login
              }
            }
          }
        }
      }
      comments(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          body
          createdAt
          updatedAt
          url
          author {
            login
          }
        }
      }
    }
  }
}
`;

function parseArgs(argv: readonly string[]) {
  let repoRaw: string | null = null;
  let prRaw: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--repo' || token === '--pr') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for ${token}.\n${USAGE}`);
      }

      if (token === '--repo') {
        repoRaw = value;
      } else {
        prRaw = value;
      }

      index += 1;
      continue;
    }

    if (token === '-h' || token === '--help') {
      process.stdout.write(HELP_TEXT);
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}\n${USAGE}`);
  }

  if (!repoRaw || !prRaw) {
    throw new Error(`Both --repo and --pr are required.\n${USAGE}`);
  }

  const [repoOwner, repoName, extra] = repoRaw.split('/');
  if (!repoOwner || !repoName || extra) {
    throw new Error(`Invalid --repo value: ${repoRaw}. Expected owner/repo.`);
  }

  const prNumber = Number.parseInt(prRaw, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(
      `Invalid --pr value: ${prRaw}. Expected a positive integer.`
    );
  }

  return { repoOwner, repoName, prNumber };
}

function fetchBootstrapData(args: {
  repoOwner: string;
  repoName: string;
  prNumber: number;
}): string {
  const result = spawnSync(
    'gh',
    [
      'api',
      'graphql',
      '-f',
      `query=${GRAPHQL_QUERY}`,
      '-F',
      `owner=${args.repoOwner}`,
      '-F',
      `repo=${args.repoName}`,
      '-F',
      `prNumber=${args.prNumber}`,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (result.error) {
    throw new Error(`Failed to run gh api graphql: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      stderr && stderr.length > 0
        ? `gh api graphql failed: ${stderr}`
        : `gh api graphql failed with exit code ${String(result.status)}`
    );
  }

  return result.stdout;
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    const output = fetchBootstrapData(args);
    process.stdout.write(output);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown bootstrap-data error';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

main();
