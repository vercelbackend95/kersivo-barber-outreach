import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMarketingSitemapEntries } from './marketingSitemap';
import { resolveCanonicalUrl, resolveRobotsContent } from './meta';
import { MARKETING_NAV_ITEMS } from '@/lib/nav/marketingNavigation';
import { GET as getRobots } from '../../pages/robots.txt';
import { getRouteFamily } from '@/lib/navigation/routeFamilies';
import {
  TIMELY_ALTERNATIVE_PAGE_PATH,
  TIMELY_ALTERNATIVE_TITLE,
  TIMELY_ALTERNATIVE_DESCRIPTION,
  TIMELY_ALTERNATIVE_LAST_UPDATED_ISO,
  TIMELY_ALTERNATIVE_FAQ_ITEMS,
  buildTimelyAlternativeFaqJsonLd,
} from './timelyAlternativeFaq';
import {
  buildTimelyAlternativeWebPageJsonLd,
  buildTimelyAlternativeBreadcrumbJsonLd,
} from './timelyAlternativeJsonLd';
import { TIMELY_SOURCES } from './timelyFacts';
import { BUILDER_FEATURES, TIMELY_TABLE_ROWS, TIMELY_TIERS } from './timelyAlternativeContent';

const here=dirname(fileURLToPath(import.meta.url));
const read=(path:string)=>readFileSync(join(here,path),'utf8');
const page=read('../../pages/timely-alternative/index.astro');
const component=(name:string)=>read(`../../components/timelyAlternative/${name}.astro`);
const hero=component('TimelyHero');
const builder=component('TimelyBuilder');
const sources=component('TimelySources');
const content=read('./timelyAlternativeContent.ts');
const siteUrl='https://kersivo.co.uk';
const pageUrl=siteUrl+'/timely-alternative';

describe('Timely alternative: on-page and technical SEO',()=>{
  it('keeps the canonical, metadata, date and indexability in one place',()=>{
    expect(TIMELY_ALTERNATIVE_PAGE_PATH).toBe('/timely-alternative');
    expect(resolveCanonicalUrl(TIMELY_ALTERNATIVE_PAGE_PATH)).toBe(pageUrl);
    expect(TIMELY_ALTERNATIVE_TITLE).toContain('Timely Alternative UK');
    expect(TIMELY_ALTERNATIVE_TITLE.length).toBeLessThanOrEqual(65);
    expect(TIMELY_ALTERNATIVE_DESCRIPTION).toContain('UK barbershops');
    expect(TIMELY_ALTERNATIVE_DESCRIPTION.length).toBeLessThanOrEqual(165);
    expect(page).toContain('canonicalPath={path}');
    expect(page).toContain('title={title}');
    expect(page).toContain('description={description}');
    expect(page).not.toMatch(/\bnoindex\b/i);
    expect(resolveRobotsContent({noindex:false})).toBeUndefined();
  });

  it('includes one H1, the Timely-specific sections in order and an operable bill builder',()=>{
    const all=page+hero;
    expect(all.match(/<h1\b/g)).toHaveLength(1);
    expect(content).toContain('The Timely alternative');
    const order=['<TimelyHero />','<TimelyVerdict />','<TimelyModel />','<TimelyBuilder />','<TimelyWeek />','<TimelyTable />','<TimelySwitching />','<TimelyPricing />','<Faq4','<ComparisonFinalCta placement="timely" competitor="Timely" />','<Contact16','<TimelySources />'];
    const positions=order.map(x=>page.indexOf(x));
    positions.forEach(p=>expect(p).toBeGreaterThan(-1));
    expect([...positions].sort((x,y)=>x-y)).toEqual(positions);
    expect(hero).toContain('<ComparisonHeroActions placement="timely" />');
    expect(builder).toContain('data-ta-builder');
    expect(builder).toContain('href="/barber-software-cost-calculator"');
    expect(page).toContain('initTimelyAlternative');
    expect(TIMELY_TIERS.map(t=>t.name)).toEqual(['Run','Boost','Thrive']);
    expect(BUILDER_FEATURES.length).toBeGreaterThanOrEqual(8);
    expect(TIMELY_TABLE_ROWS.length).toBeGreaterThanOrEqual(10);
  });

  it('is discoverable via the sitemap, menu and crawlable robots policy', async()=>{
    const entries=buildMarketingSitemapEntries().filter(x=>x.loc===pageUrl);
    expect(entries).toHaveLength(1);
    expect(entries[0].lastmod).toBe(TIMELY_ALTERNATIVE_LAST_UPDATED_ISO);
    expect(TIMELY_ALTERNATIVE_LAST_UPDATED_ISO).toBe('2026-11-14');
    expect(sources).toContain('datetime={TIMELY_FACTS_CHECKED_ISO}');
    expect(MARKETING_NAV_ITEMS.filter(x=>x.href===TIMELY_ALTERNATIVE_PAGE_PATH)).toHaveLength(1);
    expect(getRouteFamily('/timely-alternative')).toBe('marketing');
    const robots=await (await getRobots({} as Parameters<typeof getRobots>[0])).text();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('User-agent: OAI-SearchBot');
    expect(robots).toContain('Sitemap: https://kersivo.co.uk/sitemap.xml');
    expect(robots).not.toContain('Disallow: /timely-alternative');
  });

  it('emits WebPage, BreadcrumbList and FAQPage without fabricated ratings or pricing',()=>{
    const web=buildTimelyAlternativeWebPageJsonLd();
    const breadcrumb=buildTimelyAlternativeBreadcrumbJsonLd();
    const faq=buildTimelyAlternativeFaqJsonLd();
    expect(web['@type']).toBe('WebPage');
    expect(web['@id']).toBe(pageUrl+'#webpage');
    expect(web.url).toBe(pageUrl);
    expect(web.breadcrumb).toEqual({'@id':pageUrl+'#breadcrumb'});
    expect(web.dateModified).toBe(TIMELY_ALTERNATIVE_LAST_UPDATED_ISO);
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect((breadcrumb.itemListElement as Array<{name:string;item:string;position:number}>)).toEqual([
      {'@type':'ListItem',position:1,name:'Home',item:siteUrl+'/'},
      {'@type':'ListItem',position:2,name:'Timely alternative',item:pageUrl},
    ]);
    expect(page).toContain('faqs={faqs}');
    expect(faq['@id']).toBe(pageUrl+'#faq');
    const entities=faq.mainEntity as Array<{name:string;acceptedAnswer:{text:string}}>;
    expect(entities).toHaveLength(TIMELY_ALTERNATIVE_FAQ_ITEMS.length);
    TIMELY_ALTERNATIVE_FAQ_ITEMS.forEach((item,i)=>{
      expect(entities[i].name).toBe(item.question);
      expect(entities[i].acceptedAnswer.text).toBe(item.answer);
    });
    for(const bad of ['"AggregateRating"','"reviewCount"','"offers":','"priceCurrency"','"priceSpecification"','"Product"','"SoftwareApplication"']){
      expect(JSON.stringify([web,breadcrumb,faq])).not.toContain(bad);
    }
  });

  it('uses official first-party sources, current UK weekly pricing and honest limits',()=>{
    expect(TIMELY_SOURCES.length).toBeGreaterThanOrEqual(3);
    expect(TIMELY_SOURCES.every(x=>x.url.startsWith('https://'))).toBe(true);
    expect(content).toContain('starting from');
    expect(content).toContain('adjusts with the number of bookings you take');
    expect(content).not.toMatch(/(Build|Elevate|Innovate|USD)/);
    expect(content).toContain('Stay on Timely if');
    expect(content).toContain('0% KERSIVO commission (Stripe fees apply)');
    expect(content).toContain('typically ready in a few days');
    expect(sources).toContain('TIMELY_TRADEMARK_DISCLAIMER');
    expect(page).not.toContain('Nearcut');
  });
});
