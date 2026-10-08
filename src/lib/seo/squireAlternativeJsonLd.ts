import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { SQUIRE_ALTERNATIVE_DESCRIPTION, SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO, SQUIRE_ALTERNATIVE_PAGE_PATH, SQUIRE_ALTERNATIVE_TITLE } from './squireAlternativeFaq';
export function buildSquireAlternativeWebPageJsonLd(): Record<string,unknown> {
  const siteUrl = getPublicSiteUrl(); const url = siteUrl + SQUIRE_ALTERNATIVE_PAGE_PATH;
  return {'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage',url,name:SQUIRE_ALTERNATIVE_TITLE,description:SQUIRE_ALTERNATIVE_DESCRIPTION,inLanguage:'en-GB',dateModified:SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO,isPartOf:{'@id':getKersivoWebsiteId(siteUrl)},publisher:{'@id':getKersivoOrganizationId(siteUrl)}};
}
