import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { SQUIRE_ALTERNATIVE_DESCRIPTION, SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO, SQUIRE_ALTERNATIVE_PAGE_PATH, SQUIRE_ALTERNATIVE_TITLE } from './squireAlternativeFaq';
export function buildSquireAlternativeWebPageJsonLd(): Record<string,unknown> {
  const siteUrl = getPublicSiteUrl(); const url = siteUrl + SQUIRE_ALTERNATIVE_PAGE_PATH;
  return {'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage',url,name:SQUIRE_ALTERNATIVE_TITLE,description:SQUIRE_ALTERNATIVE_DESCRIPTION,inLanguage:'en-GB',dateModified:SQUIRE_ALTERNATIVE_LAST_UPDATED_ISO,isPartOf:{'@id':getKersivoWebsiteId(siteUrl)},publisher:{'@id':getKersivoOrganizationId(siteUrl)},breadcrumb:{'@id':url+'#breadcrumb'}};
}

/** Breadcrumb on SQUIRE page matches the visible Home / SQUIRE alternative path. */
export function buildSquireAlternativeBreadcrumbJsonLd(): Record<string, unknown> {
 const base=getPublicSiteUrl();const url=base+SQUIRE_ALTERNATIVE_PAGE_PATH;
 return {'@context':'https://schema.org','@type':'BreadcrumbList','@id':url+'#breadcrumb',
 itemListElement:[
 {'@type':'ListItem',position:1,name:'Home',item:base+'/'},
 {'@type':'ListItem',position:2,name:'SQUIRE alternative',item:url},
 ]};
}
