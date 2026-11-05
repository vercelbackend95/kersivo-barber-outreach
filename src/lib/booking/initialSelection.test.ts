import { describe, expect, it } from 'vitest';
import { bookingDeepLink, resolveBookingPreselection } from './initialSelection';

const catalogue = {
  services: [{ id: 'svc_cut' }, { id: 'svc_beard' }],
  barbers: [
    { id: 'brb_callum', showOnWebsite: true, serviceIds: ['svc_cut', 'svc_beard'] },
    { id: 'brb_cuts_only', showOnWebsite: true, serviceIds: ['svc_cut'] },
    { id: 'brb_hidden', showOnWebsite: false, serviceIds: ['svc_cut'] },
    { id: 'brb_any', showOnWebsite: true, serviceIds: [] },
  ],
};

describe('resolveBookingPreselection', () => {
  it('preselects a valid service and barber', () => {
    expect(resolveBookingPreselection('?service=svc_cut&barber=brb_callum', catalogue)).toEqual({
      initialServiceId: 'svc_cut',
      initialBarberId: 'brb_callum',
    });
  });

  it('accepts either parameter on its own', () => {
    expect(resolveBookingPreselection('?service=svc_beard', catalogue)).toEqual({ initialServiceId: 'svc_beard' });
    expect(resolveBookingPreselection('?barber=brb_callum', catalogue)).toEqual({ initialBarberId: 'brb_callum' });
  });

  it('silently ignores ids that are not this shop’s', () => {
    expect(resolveBookingPreselection('?service=svc_other_shop&barber=brb_other_shop', catalogue)).toEqual({});
    expect(resolveBookingPreselection('', catalogue)).toEqual({});
  });

  it('ignores a service that is not in the bookable (active) list', () => {
    expect(resolveBookingPreselection('?service=svc_inactive', catalogue)).toEqual({});
  });

  it('ignores a barber not shown on the website', () => {
    expect(resolveBookingPreselection('?service=svc_cut&barber=brb_hidden', catalogue)).toEqual({
      initialServiceId: 'svc_cut',
    });
  });

  it('drops a barber who does not perform the chosen service, keeping the service', () => {
    expect(resolveBookingPreselection('?service=svc_beard&barber=brb_cuts_only', catalogue)).toEqual({
      initialServiceId: 'svc_beard',
    });
    // a barber with no service links performs everything (same rule as the booking flow)
    expect(resolveBookingPreselection('?service=svc_beard&barber=brb_any', catalogue)).toEqual({
      initialServiceId: 'svc_beard',
      initialBarberId: 'brb_any',
    });
  });

  it('rejects malformed values without looking them up', () => {
    expect(resolveBookingPreselection(`?service=${'a'.repeat(65)}`, catalogue)).toEqual({});
    expect(resolveBookingPreselection('?service=svc_cut%20OR%201', catalogue)).toEqual({});
    expect(resolveBookingPreselection('?service=&barber=', catalogue)).toEqual({});
  });

  it('reads only `service` and `barber`', () => {
    expect(resolveBookingPreselection('?serviceId=svc_cut&staff=brb_callum', catalogue)).toEqual({});
  });
});

describe('bookingDeepLink', () => {
  it('adds the parameter with URLSearchParams and keeps null as null', () => {
    expect(bookingDeepLink('https://kersivo.co.uk/book/sharp-cuts', { barber: 'b1' })).toBe(
      'https://kersivo.co.uk/book/sharp-cuts?barber=b1',
    );
    expect(bookingDeepLink('https://sharpcuts.co.uk/book', { service: 's1', barber: 'b1' })).toBe(
      'https://sharpcuts.co.uk/book?service=s1&barber=b1',
    );
    expect(bookingDeepLink(null, { service: 's1' })).toBeNull();
  });
});
