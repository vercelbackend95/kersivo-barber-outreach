import { VAGARO_ALTERNATIVE_DESCRIPTION, VAGARO_ALTERNATIVE_LAST_UPDATED_ISO, VAGARO_ALTERNATIVE_PAGE_PATH, VAGARO_ALTERNATIVE_TITLE } from './vagaroAlternativeFaq';
import { getKersivoOrganizationId, getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export function buildVagaroAlternativeWebPageJsonLd(): Record<string,unknown> {
 const siteUrl=getPublicSiteUrl(), pageUrl=`${siteUrl}${VAGARO_ALTERNATIVE_PAGE_PATH}`;
 return {'@context':'https://schema.org','@type':'WebPage','@id':`${pageUrl}#webpage`,url:pageUrl,name:VAGARO_ALTERNATIVE_TITLE,description:VAGARO_ALTERNATIVE_DESCRIPTION,inLanguage:'en-GB',dateModified:VAGARO_ALTERNATIVE_LAST_UPDATED_ISO,isPartOf:{'@id':getKersivoWebsiteId(siteUrl)},publisher:{'@id':getKersivoOrganizationId(siteUrl)},breadcrumb:{'@id':`${pageUrl}#breadcrumb`}};
}
export function buildVagaroAlternativeBreadcrumbJsonLd(): Record<string,unknown> {
 const siteUrl=getPublicSiteUrl(),pageUrl=`${siteUrl}${VAGARO_ALTERNATIVE_PAGE_PATH}`;
 return {'@context':'https://schema.org','@type':'BreadcrumbList','@id':`${pageUrl}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:`${siteUrl}/`},{'@type':'ListItem',position:2,name:'Vagaro alternative',item:pageUrl}]};
}
