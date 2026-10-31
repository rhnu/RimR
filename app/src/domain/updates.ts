/** Only bundles supported by RimR's updater may replace the running application. */
export function supportsUpdateInstall(bundleType: string): boolean {
  return ['nsis', 'app', 'appimage'].includes(bundleType);
}

export function downloadPercent(downloaded: number, total: number | undefined): number | undefined {
  return total && total > 0 ? Math.min(100, Math.max(0, (downloaded / total) * 100)) : undefined;
}
