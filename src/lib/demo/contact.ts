export const DEMO_CONTACT_MAP_LABEL =
  'Stylised illustrative map marking the fictional BLACKLINE demonstration location in Manchester’s Northern Quarter.';

export const DEMO_CONTACT_MAP_WARNING = 'Illustrative map · Not for navigation';

export const DEMO_CONTACT_SAFETY_LABEL = 'Demo form · No message will be sent';

export const DEMO_CONTACT_SUCCESS = 'Demo complete. No message was sent or stored.';

export const DEMO_CONTACT_NAME_MAX = 80;
export const DEMO_CONTACT_EMAIL_MAX = 254;
export const DEMO_CONTACT_MESSAGE_MAX = 1000;

export const DEMO_CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DemoContactField = 'name' | 'email' | 'message';

export type DemoContactErrors = Partial<Record<DemoContactField, string>>;

export type DemoContactValues = {
  name: string;
  email: string;
  message: string;
};

export function validateDemoContact(values: DemoContactValues): DemoContactErrors {
  const errors: DemoContactErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const message = values.message.trim();

  if (!name) errors.name = 'Enter your name.';
  else if (name.length > DEMO_CONTACT_NAME_MAX) errors.name = `Use ${DEMO_CONTACT_NAME_MAX} characters or fewer.`;

  if (!email) errors.email = 'Enter your email.';
  else if (email.length > DEMO_CONTACT_EMAIL_MAX) errors.email = `Use ${DEMO_CONTACT_EMAIL_MAX} characters or fewer.`;
  else if (!DEMO_CONTACT_EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  if (!message) errors.message = 'Enter a message.';
  else if (message.length > DEMO_CONTACT_MESSAGE_MAX) {
    errors.message = `Use ${DEMO_CONTACT_MESSAGE_MAX} characters or fewer.`;
  }

  return errors;
}
