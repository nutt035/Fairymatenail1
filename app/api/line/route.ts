import { NextResponse } from 'next/server';

type LineRequest = {
  imageUrl?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const { imageUrl, message } = (await request.json()) as LineRequest;
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const recipientId = (
      process.env.LINE_RECIPIENT_IDS || process.env.LINE_GROUP_ID || ''
    )
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);

    if (!accessToken || !recipientId) {
      return NextResponse.json(
        { error: 'LINE integration is not configured' },
        { status: 503 },
      );
    }

    const messages: Array<Record<string, string>> = [
      { type: 'text', text: message?.trim() || 'มีรายการใหม่จาก Fairymate.Nail' },
    ];

    if (imageUrl) {
      messages.push({
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      });
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ to: recipientId, messages }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('LINE push failed:', response.status, detail);
      return NextResponse.json({ error: 'LINE push failed' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LINE API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
