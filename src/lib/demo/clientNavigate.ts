export async function navigateDemoPath(href: string): Promise<void> {
  const { navigate } = await import('astro:transitions/client');
  await navigate(href);
}
