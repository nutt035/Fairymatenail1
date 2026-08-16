import 'server-only';

interface BookingNotification {
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  startTime: string;
  serviceName: string;
  price: number;
}

export async function notifyNewBooking(booking: BookingNotification) {
  const text = [
    '✨ มีคิวใหม่จากเว็บไซต์',
    `ลูกค้า: ${booking.customerName}`,
    `โทร: ${booking.customerPhone}`,
    `บริการ: ${booking.serviceName}`,
    `วันเวลา: ${booking.bookingDate} ${booking.startTime.slice(0, 5)} น.`,
    `ราคา: ฿${booking.price.toLocaleString('th-TH')}`,
  ].join('\n');

  const [line, messenger] = await Promise.allSettled([
    sendLine(text),
    sendMessenger(text),
  ]);

  return {
    line: resultStatus(line),
    messenger: resultStatus(messenger),
  };
}

function resultStatus(result: PromiseSettledResult<boolean>) {
  return result.status === 'fulfilled' && result.value ? 'sent' : 'skipped_or_failed';
}

async function sendLine(text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const recipients = recipientIds(process.env.LINE_RECIPIENT_IDS ?? process.env.LINE_GROUP_ID);
  if (!token || recipients.length === 0) return false;

  const results = await Promise.all(recipients.map(async (recipient) => {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Line-Retry-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ to: recipient, messages: [{ type: 'text', text }] }),
    });
    if (!response.ok) console.error('LINE notification failed', response.status, await response.text());
    return response.ok;
  }));
  return results.every(Boolean);
}

async function sendMessenger(text: string) {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const version = process.env.META_GRAPH_API_VERSION || 'v26.0';
  const recipients = recipientIds(
    process.env.FACEBOOK_MESSENGER_RECIPIENT_IDS ?? process.env.FACEBOOK_MESSENGER_RECIPIENT_ID,
  );
  if (!token || recipients.length === 0) return false;

  const results = await Promise.all(recipients.map(async (recipient) => {
    const url = new URL(`https://graph.facebook.com/${version}/me/messages`);
    url.searchParams.set('access_token', token);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipient },
        messaging_type: 'UPDATE',
        message: { text },
      }),
    });
    if (!response.ok) console.error('Messenger notification failed', response.status, await response.text());
    return response.ok;
  }));
  return results.every(Boolean);
}

function recipientIds(value: string | undefined) {
  return [...new Set((value ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
}
