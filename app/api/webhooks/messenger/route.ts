import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expectedToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    challenge &&
    expectedToken &&
    safeEqual(token ?? '', expectedToken)
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const signature = request.headers.get('x-hub-signature-256');
  const rawBody = await request.text();

  if (!appSecret || !signature || !validSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as MessengerWebhook;
    if (payload.object !== 'page') {
      return NextResponse.json({ error: 'Unsupported webhook object' }, { status: 404 });
    }

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (event.sender?.id) {
          console.info('[MESSENGER_PSID_DISCOVERED]', event.sender.id);
        }
      }
    }

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    console.error('Invalid Messenger webhook payload', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

function validSignature(body: string, signature: string, secret: string) {
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  return safeEqual(signature, expected);
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

interface MessengerWebhook {
  object?: string;
  entry?: Array<{
    messaging?: Array<{ sender?: { id?: string } }>;
  }>;
}
