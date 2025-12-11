import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl, message } = await request.json();

    // 1. ใส่คีย์ที่ได้จาก LINE Developers
    const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_TOKEN || 'OmmPZhy3AQnn4jSAkajuCvRMju4/ic7clQF+CEQd9uAFYmj1Hbkl46PDIGwYnMmIva3yDPLCMrOeM4Y+RLHcR1fibIZaZyH46fQqPFguMq5uOszTv8rHNc82EVqJPE71LkY6dU1io71ARtxMNTgb3QdB04t89/1O/w1cDnyilFU=';
    const GROUP_ID = process.env.LINE_GROUP_ID || 'Cee3c681cf4a4652718fb2fc00608be7c'; 

    // 2. สร้างข้อความที่จะส่ง (ส่งเป็นรูปภาพ)
    const body = {
      to: GROUP_ID,
      messages: [
        {
          type: "text",
          text: message || "บิลใหม่มาแล้วครับ 💅"
        },
        {
          type: "image",
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl // ใช้รูปเดียวกันเลย
        }
      ]
    };

    // 3. ยิงไปหา LINE
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Line API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}