import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { checkRateLimit, getClientIdentifier, rateLimitExceededResponse } from "@/lib/rate-limit";

function splitIntoChunks(text: string, maxLen = 160): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[।.!?,\n])\s+/);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        // Hard-split long sentence by words
        const words = sentence.split(" ");
        let temp = "";
        for (const w of words) {
          if ((temp + " " + w).trim().length <= maxLen) {
            temp = (temp + " " + w).trim();
          } else {
            if (temp) chunks.push(temp);
            temp = w;
          }
        }
        current = temp;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { text, language } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const targetLang = language === "hi-IN" ? "hi-IN" : "en-IN";
    const rateLimit = checkRateLimit(getClientIdentifier(req), {
      namespace: "voice-tts",
      limit: 60,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit, targetLang);
    }
    const cleaned = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[*#_`~>|]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    let spokenText = cleaned;
    const hasHindiDevanagari = /[\u0900-\u097F]/.test(cleaned);

    // If user selected Hindi ('hi-IN') and the message is in English (or mostly English), translate it to natural Hindi first!
    if (targetLang === "hi-IN" && !hasHindiDevanagari) {
      try {
        const { text: translated } = await generateText({
          model: groq("qwen/qwen3.8-27b"),
          system:
            "You are a professional hotel concierge translator. Translate the given English hotel assistant message into natural, polite, conversational Hindi in Devanagari script (हिंदी) suitable for speaking aloud. Output ONLY the Hindi translation, with no extra commentary or quotes.",
          prompt: cleaned,
        });
        if (translated && translated.trim()) {
          spokenText = translated.replace(/[*#_`~>|]/g, " ").replace(/\s+/g, " ").trim();
        }
      } catch (e) {
        console.error("Hindi translation fallback error:", e);
      }
    } else if (targetLang === "en-IN" && hasHindiDevanagari) {
      // If user selected English ('en-IN') on a Hindi message, translate to English for readout
      try {
        const { text: translated } = await generateText({
          model: groq("qwen/qwen3.8-27b"),
          system:
            "You are a professional hotel concierge translator. Translate the given Hindi hotel assistant message into natural, polite, conversational English suitable for speaking aloud. Output ONLY the English translation, with no extra commentary or quotes.",
          prompt: cleaned,
        });
        if (translated && translated.trim()) {
          spokenText = translated.replace(/[*#_`~>|]/g, " ").replace(/\s+/g, " ").trim();
        }
      } catch (e) {
        console.error("English translation fallback error:", e);
      }
    }

    // Generate MP3 audio chunks using Google TTS endpoint (tl=hi or tl=en-IN) so it works even if Windows lacks a local Hindi voice pack
    const tl = targetLang === "hi-IN" ? "hi" : "en-IN";
    const chunks = splitIntoChunks(spokenText, 160);
    const buffers: Buffer[] = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
        tl
      )}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

      const ttsRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (ttsRes.ok) {
        const arrBuf = await ttsRes.arrayBuffer();
        buffers.push(Buffer.from(arrBuf));
      }
    }

    const combinedBuffer = buffers.length > 0 ? Buffer.concat(buffers) : null;
    const audioBase64 = combinedBuffer ? combinedBuffer.toString("base64") : null;

    return NextResponse.json({
      spokenText,
      language: targetLang,
      audioBase64,
    });
  } catch (error: any) {
    console.error("TTS Speak API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
