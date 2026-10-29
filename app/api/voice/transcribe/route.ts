import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const rawLang = (formData.get("language") as string) || "en-IN";

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Strictly restrict transcription language to Hindi ('hi') or English ('en')
    const isoLang = rawLang.startsWith("hi") ? "hi" : "en";

    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "voice.webm");
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("language", isoLang);
    groqFormData.append(
      "prompt",
      isoLang === "hi"
        ? "होटल बुकिंग, चेक-इन, चेक-आउट, हाउसकीपिंग, रूम स्टेटस, स्टाफ, रिफंड, रिपोर्ट्स (Hindi and English hotel operations)"
        : "Hotel booking, check-in, check-out, housekeeping, room status, staff, refunds, reports."
    );

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Transcription failed: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({
      text: (data.text || "").trim(),
      language: rawLang,
    });
  } catch (error: any) {
    console.error("Voice transcription error:", error);
    return NextResponse.json({ error: error.message || "Voice transcription failed" }, { status: 500 });
  }
}
