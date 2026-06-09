export function normalizePhoneForSms(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

export function normalizePhoneForWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function getFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/).find(Boolean);
  return first || 'there';
}

export type ClientMessageChannel = 'sms' | 'whatsapp';

export type OpenClientMessageChannelInput = {
  phone: string | null | undefined;
  fullName: string;
  channel: ClientMessageChannel;
};

export type OpenClientMessageChannelResult =
  | { ok: true }
  | { ok: false; error: string };

export function openClientMessageChannel({
  phone,
  fullName,
  channel,
}: OpenClientMessageChannelInput): OpenClientMessageChannelResult {
  const rawPhone = phone?.trim() ?? '';
  if (!rawPhone) {
    return { ok: false, error: 'No phone number is available for this client.' };
  }

  const firstName = getFirstName(fullName);
  const prefill = `Hi ${firstName}, this is Kersivo.`;

  if (channel === 'sms') {
    const smsPhone = normalizePhoneForSms(rawPhone);
    if (!smsPhone) {
      return { ok: false, error: 'Phone number is invalid for SMS.' };
    }
    window.location.href = `sms:${smsPhone}?body=${encodeURIComponent(prefill)}`;
    return { ok: true };
  }

  const whatsappPhone = normalizePhoneForWhatsApp(rawPhone);
  if (!whatsappPhone) {
    return { ok: false, error: 'Phone number is invalid for WhatsApp.' };
  }
  window.open(
    `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(prefill)}`,
    '_blank',
    'noopener,noreferrer',
  );
  return { ok: true };
}
