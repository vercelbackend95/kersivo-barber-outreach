import { SETORA_ALTERNATIVE_DESCRIPTION, SETORA_ALTERNATIVE_LAST_UPDATED_ISO, SETORA_ALTERNATIVE_PAGE_PATH, SETORA_ALTERNATIVE_TITLE } from './setoraAlternativeFaq';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';

export function buildSetoraAlternativeWebPageJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${SETORA_ALTERNATIVE_PAGE_PATH}`;
  return {
    '@context':'https://schema.org', '@type':'WebPage', '@id':`${pageUrl}#webpage`,
    url:pageUrl, name:SETORA_ALTERNATIVE_TITLE,
    description:SETORA_ALTERNATIVE_DESCRIPTION, inLanguage:'en-GB',
    dateModified:SETORA_ALTERNATIVE_LAST_UPDATED_ISO,
    isPartOf:{'@id':getKersivoWebsiteId(siteUrl)},
    publisher:{'@id':getKersivoOrganizationId(siteUrl)},
    breadcrumb:{'@id':`${pageUrl}#breadcrumb`},
  };
}
export function buildSetoraAlternativeBreadcrumbJsonLd(): Record<string, unknown> {
  const siteUrl = getPublicSiteUrl();
  const pageUrl = `${siteUrl}${SETORA_ALTERNATIVE_PAGE_PATH}`;
  return {
    '@context':'https://schema.org', '@type':'BreadcrumbList', '@id':`${pageUrl}#breadcrumb`,
    itemListElement:[
      {'@type':'ListItem',position:1,name:'Home',item:`${siteUrl}/`},
      {'@type':'ListItem',position:2,name:'Setora alternative',item:pageUrl},
    ],
  };
}
