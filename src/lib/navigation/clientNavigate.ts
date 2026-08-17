export async function navigateAppPath(href: string): Promise<void> {
  const { navigate } = await import('astro:transitions/client');
  await navigate(href);
}
