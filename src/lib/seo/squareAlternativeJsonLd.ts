import {SQUARE_ALTERNATIVE_DESCRIPTION,SQUARE_ALTERNATIVE_LAST_UPDATED_ISO,SQUARE_ALTERNATIVE_PAGE_PATH,SQUARE_ALTERNATIVE_TITLE} from './squareAlternativeFaq';
import {getKersivoOrganizationId,getKersivoWebsiteId} from '@/lib/seo/barberDemoJsonLd';
import {getPublicSiteUrl} from '@/lib/setup/siteUrl';
export function buildSquareAlternativeWebPageJsonLd():Record<string,unknown>{
 const base=getPublicSiteUrl(),url=base+SQUARE_ALTERNATIVE_PAGE_PATH;
 return {'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage',url,name:SQUARE_ALTERNATIVE_TITLE,description:SQUARE_ALTERNATIVE_DESCRIPTION,inLanguage:'en-GB',dateModified:SQUARE_ALTERNATIVE_LAST_UPDATED_ISO,isPartOf:{'@id':getKersivoWebsiteId(base)},publisher:{'@id':getKersivoOrganizationId(base)},breadcrumb:{'@id':url+'#breadcrumb'}};
}
export function buildSquareAlternativeBreadcrumbJsonLd():Record<string,unknown>{
 const base=getPublicSiteUrl(),url=base+SQUARE_ALTERNATIVE_PAGE_PATH;
 return {'@context':'https://schema.org','@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base+'/'},{'@type':'ListItem',position:2,name:'Square Appointments alternative',item:url}]};
}
