import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_CONTACT_EMAIL_MAX,
  DEMO_CONTACT_MAP_WARNING,
  DEMO_CONTACT_MESSAGE_MAX,
  DEMO_CONTACT_NAME_MAX,
  DEMO_CONTACT_SAFETY_LABEL,
  DEMO_CONTACT_SUCCESS,
} from './contact';
import { DEMO_BOOK_HREF, DEMO_CONTACT_HREF } from './nav';
import {
  DEMO_HOURS,
  DEMO_LOCATION,
  DEMO_LOCATION_NOTE,
  DEMO_PHONE,
  DEMO_PHONE_ACCESSIBLE_NAME,
  DEMO_PHONE_FICTION_NOTE,
  DEMO_PHONE_TEL,
  DEMO_WALK_INS,
} from './site';

const pageSource = readFileSync(new URL('../../pages/demo/contact.astro', import.meta.url), 'utf8');
const heroSource = readFileSync(new URL('../../components/demo/DemoContactHero.astro', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../../components/demo/DemoContactIndex.astro', import.meta.url), 'utf8');
const hoursSource = readFileSync(new URL('../../components/demo/DemoContactHours.astro', import.meta.url), 'utf8');
const enquirySource = readFileSync(new URL('../../components/demo/DemoContactEnquiry.astro', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('../../components/demo/DemoLocationMap.astro', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../styles/demo/blackline.css', import.meta.url), 'utf8');
const sources = [pageSource, heroSource, indexSource, hoursSource, enquirySource, mapSource].join('\n');

describe('BLACKLINE Contact page', () => {
  it('keeps the shared demo shell and contact landmarks', () => {
    expect(pageSource).toContain('DemoLayout');
    expect(pageSource).toContain('DemoContactHero');
    expect(pageSource).toContain('DemoContactIndex');
    expect(pageSource).toContain('DemoContactHours');
    expect(pageSource).toContain('DemoContactEnquiry');
    expect(pageSource).toContain('canonicalPath="/demo/contact"');
    expect(DEMO_CONTACT_HREF).toBe('/demo/contact');
    expect(heroSource).toContain("from '@/components/demo/DemoPageHero.astro'");
    expect(heroSource).toContain('headingId="blackline-contact-heading"');
    expect(indexSource).toContain('id="blackline-contact-index-heading"');
    expect(hoursSource).toContain('id="blackline-contact-hours-heading"');
    expect(enquirySource).toContain('id="blackline-contact-enquiry-heading"');
    expect(indexSource).toContain('<address');
    expect(hoursSource).toContain('<dl');
    expect(enquirySource).toContain('<form');
  });

  it('uses the exact hero, index, hours, and enquiry copy from shared profile data', () => {
    expect(heroSource).toContain('Contact');
    expect(heroSource).toContain('Come');
    expect(heroSource).toContain('through.');
    expect(heroSource).toContain('Everything you need before you take the chair.');
    expect(heroSource).toContain('DEMO_LOCATION');
    expect(heroSource).toContain('DEMO_LOCATION_NOTE');
    expect(indexSource).toContain('Contact Index');
    expect(indexSource).toContain('Find Blackline.');
    expect(indexSource).toContain('The details below belong to the fictional BLACKLINE demonstration shop.');
    expect(indexSource).toContain('Choose your barber, service and time.');
    expect(indexSource).toContain('Book an appointment');
    expect(hoursSource).toContain('Opening Hours');
    expect(hoursSource).toContain('Plan your visit.');
    expect(hoursSource).toContain('DEMO_HOURS');
    expect(enquirySource).toContain('Demo Enquiry');
    expect(enquirySource).toContain('Send a note.');
    expect(enquirySource).toContain('Try the contact experience. Nothing entered here is sent or stored.');
    expect(enquirySource).toContain('DEMO_CONTACT_SAFETY_LABEL');
    expect(DEMO_CONTACT_SAFETY_LABEL).toBe('Demo form · No message will be sent');
    expect(sources).not.toContain('A map and form will sit here.');
    expect(DEMO_LOCATION).toBe('Northern Quarter, Manchester');
    expect(DEMO_LOCATION_NOTE).toBe('Demonstration location');
    expect(DEMO_PHONE).toBe('0161 496 0127');
    expect(DEMO_PHONE_TEL).toBe('tel:+441614960127');
    expect(DEMO_PHONE_ACCESSIBLE_NAME).toBe('Call BLACKLINE demo number 0161 496 0127');
    expect(DEMO_PHONE_FICTION_NOTE).toBe('Fictional Manchester demo number');
    expect(DEMO_WALK_INS).toBe('Walk-ins welcome when availability allows.');
    expect(DEMO_HOURS).toEqual([
      { days: 'Monday–Friday', hours: '09:00–19:00' },
      { days: 'Saturday', hours: '09:00–17:00' },
      { days: 'Sunday', hours: 'Closed' },
    ]);
  });

  it('books through the canonical route and never invents a street, map service, or extra close CTA', () => {
    expect(indexSource).toContain('DEMO_BOOK_HREF');
    expect(indexSource).toContain('href={DEMO_BOOK_HREF}');
    expect(DEMO_BOOK_HREF).toBe('/demo/book');
    expect(indexSource).not.toMatch(/\?barber=|\?service=/);
    expect(indexSource).toContain('DEMO_PHONE_TEL');
    expect(indexSource).toContain('DEMO_PHONE_ACCESSIBLE_NAME');
    expect(indexSource).toContain('variant="expanded"');
    expect(mapSource).toContain('viewBox="0 0 800 640"');
    expect(mapSource).toContain('DEMO_CONTACT_MAP_WARNING');
    expect(DEMO_CONTACT_MAP_WARNING).toBe('Illustrative map · Not for navigation');
    expect(sources).not.toMatch(/<iframe/i);
    expect(sources).not.toMatch(/google\.com\/maps|maps\.apple|mapbox|openstreetmap|bing\.com\/maps/i);
    expect(sources).not.toMatch(/GET DIRECTIONS|OPEN IN MAPS|CALL NOW|EMAIL US|WHATSAPP/i);
    expect(sources).not.toMatch(/\bM1\b|\bpostcode\b|53\.\d+|-2\.\d+/i);
    expect(pageSource).not.toContain('DemoContactClose');
    expect(pageSource).not.toContain('Your turn in the chair');
  });

  it('keeps the enquiry form local-only with labelled fields and the exact success copy', () => {
    expect(enquirySource).toContain('type="text"');
    expect(enquirySource).toContain('type="email"');
    expect(enquirySource).toContain('<textarea');
    expect(enquirySource).toContain('Your name');
    expect(enquirySource).toContain('Your email');
    expect(enquirySource).toContain('What can we help with?');
    expect(enquirySource).toContain('Send enquiry');
    expect(enquirySource).toContain('DEMO_CONTACT_NAME_MAX');
    expect(enquirySource).toContain('DEMO_CONTACT_EMAIL_MAX');
    expect(enquirySource).toContain('DEMO_CONTACT_MESSAGE_MAX');
    expect(DEMO_CONTACT_NAME_MAX).toBe(80);
    expect(DEMO_CONTACT_EMAIL_MAX).toBe(254);
    expect(DEMO_CONTACT_MESSAGE_MAX).toBe(1000);
    expect(enquirySource).toContain('role="status"');
    expect(enquirySource).toContain('aria-live="polite"');
    expect(enquirySource).toContain('DEMO_CONTACT_SUCCESS');
    expect(DEMO_CONTACT_SUCCESS).toBe('Demo complete. No message was sent or stored.');
    expect(pageSource).toContain('preventDefault');
    expect(pageSource).toContain('validateDemoContact');
    expect(pageSource).toContain('form.reset');
    expect(pageSource).not.toContain('fetch(');
    expect(pageSource).not.toContain('localStorage');
    expect(pageSource).not.toContain('sessionStorage');
    expect(pageSource).not.toContain('console.log');
    expect(enquirySource).not.toContain('server:action');
    expect(DEMO_CONTACT_SUCCESS.toLowerCase()).not.toMatch(/we’ll get back|message sent|we’ll be in touch|has been received/);
  });

  it('progressively enhances motion without hiding booking or submit controls', () => {
    expect(cssSource).not.toMatch(/transition:\s*all/);
    expect(cssSource).toContain("[data-theme='blackline'][data-bl-contact-motion]");
    expect(cssSource).toContain("[data-theme='blackline'] .bl-contact-page *");
    expect(cssSource).not.toContain("[data-theme='blackline'][data-bl-contact-motion] .bl-contact-book {");
    expect(cssSource).not.toContain("[data-theme='blackline'][data-bl-contact-motion] .bl-contact-submit {");
    expect(cssSource).toContain('@media (min-width: 960px)');
    expect(cssSource).toContain('@media (min-width: 1100px)');
    expect(cssSource).toContain('--bl-size-page-hero: clamp(3.75rem, 8vw, 8.75rem)');
    expect(cssSource).toContain('position: sticky');
    expect(cssSource).toContain('aspect-ratio: 5 / 4');
    expect(pageSource).toContain("setAttribute('data-bl-contact-motion'");
    expect(pageSource).toContain("removeAttribute('data-bl-contact-motion'");
    expect(pageSource).toContain('IntersectionObserver');
    expect(pageSource).toContain('unobserve');
    expect(pageSource).toContain('disconnect');
    expect(pageSource).toContain('pageshow');
    expect(pageSource).not.toMatch(/addEventListener\(['"]scroll['"]/);
    expect(cssSource).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*\.bl-contact-book-arrow[\s\S]*transform: rotate\(45deg\)/,
    );
  });
});
