import { PHOREST_ALTERNATIVE_DESCRIPTION, PHOREST_ALTERNATIVE_LAST_UPDATED_ISO, PHOREST_ALTERNATIVE_PAGE_PATH, PHOREST_ALTERNATIVE_TITLE } from './phorestAlternativeFaq';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export function buildPhorestAlternativeWebPageJsonLd():Record<string,unknown>{
const siteUrl=getPublicSiteUrl(),pageUrl=`${siteUrl}${PHOREST_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'WebPage','@id':`${pageUrl}#webpage`,url:pageUrl,name:PHOREST_ALTERNATIVE_TITLE,description:PHOREST_ALTERNATIVE_DESCRIPTION,inLanguage:'en-GB',dateModified:PHOREST_ALTERNATIVE_LAST_UPDATED_ISO,isPartOf:{'@id':getKersivoWebsiteId(siteUrl)},publisher:{'@id':getKersivoOrganizationId(siteUrl)},breadcrumb:{'@id':`${pageUrl}#breadcrumb`}};
}
export function buildPhorestAlternativeBreadcrumbJsonLd():Record<string,unknown>{
const siteUrl=getPublicSiteUrl(),pageUrl=`${siteUrl}${PHOREST_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'BreadcrumbList','@id':`${pageUrl}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:`${siteUrl}/`},{'@type':'ListItem',position:2,name:'Phorest alternative',item:pageUrl}]};
}
