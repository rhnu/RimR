export async function api(path, method = 'GET', body, allowMissing = false) {
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY)
    throw new Error('GitHub release credentials are required');
  const response = await fetch(
    `${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${process.env.GH_TOKEN}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (allowMissing && response.status === 404) return null;
  if (!response.ok)
    throw new Error(`GitHub ${method} ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

export function requireDraft(release, tag) {
  if (release && !release.draft)
    throw new Error(`Release ${tag} is already public; refusing to overwrite installers`);
}

export async function verifyTag(tag, sha) {
  const reference = await api(`git/ref/tags/${encodeURIComponent(tag)}`);
  if (reference.object.type !== 'tag') throw new Error('Release tag is no longer annotated');
  const annotation = await api(`git/tags/${reference.object.sha}`);
  if (annotation.object.type !== 'commit' || annotation.object.sha !== sha)
    throw new Error('Release tag moved after planning or building');
}
