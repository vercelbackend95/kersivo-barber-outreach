import { TREATWELL_ALTERNATIVE_DESCRIPTION,TREATWELL_ALTERNATIVE_LAST_UPDATED_ISO,TREATWELL_ALTERNATIVE_PAGE_PATH,TREATWELL_ALTERNATIVE_TITLE } from './treatwellAlternativeFaq';
import { getKersivoOrganizationId,getKersivoWebsiteId } from '@/lib/seo/barberDemoJsonLd';
import { getPublicSiteUrl } from '@/lib/setup/siteUrl';
export function buildTreatwellAlternativeWebPageJsonLd(): Record<string,unknown> {
const siteUrl=getPublicSiteUrl(),pageUrl=`${siteUrl}${TREATWELL_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'WebPage','@id':`${pageUrl}#webpage`,url:pageUrl,name:TREATWELL_ALTERNATIVE_TITLE,description:TREATWELL_ALTERNATIVE_DESCRIPTION,inLanguage:'en-GB',dateModified:TREATWELL_ALTERNATIVE_LAST_UPDATED_ISO,isPartOf:{'@id':getKersivoWebsiteId(siteUrl)},publisher:{'@id':getKersivoOrganizationId(siteUrl)},breadcrumb:{'@id':`${pageUrl}#breadcrumb`}};
}
export function buildTreatwellAlternativeBreadcrumbJsonLd(): Record<string,unknown>{
const siteUrl=getPublicSiteUrl(),pageUrl=`${siteUrl}${TREATWELL_ALTERNATIVE_PAGE_PATH}`;
return {'@context':'https://schema.org','@type':'BreadcrumbList','@id':`${pageUrl}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:`${siteUrl}/`},{'@type':'ListItem',position:2,name:'Treatwell alternative',item:pageUrl}]};
}