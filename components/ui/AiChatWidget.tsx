// @ts-nocheck
"use client";
import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ArrowUp,
  Loader2,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Trash2,
  ShieldAlert,
  Check,
} from 'lucide-react';

type SupportedLanguage = 'en-IN' | 'hi-IN';

const LOCAL_STORAGE_KEY = 'hotel_ai_chat_history_v1';

// Clean markdown characters before speaking aloud
function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*#_`~>|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Split text into sentences for low-latency Sentence-Streaming TTS
function splitIntoSentences(raw: string): string[] {
  const cleaned = cleanTextForSpeech(raw);
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[।.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>('en-IN');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [resolvedConfirmations, setResolvedConfirmations] = useState<Record<string, 'confirmed' | 'cancelled'>>({});
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveTranscriptRef = useRef<string>('');
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const speakAbortRef = useRef<AbortController | null>(null);
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechSessionIdRef = useRef<number>(0);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const streamedSentenceCountRef = useRef<Record<string, number>>({});
  const sentenceQueueRef = useRef<Array<{ text: string; lang: SupportedLanguage; sessionId: number }>>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, sendMessage, status, error, regenerate } = useChat({
    maxToolRoundtrips: 3,
  });

  const isLoading = status === 'in_progress' || status === 'streaming' || status === 'submitted';

  // Helper to extract plain text from a UIMessage
  const getMessageText = useCallback((m: any): string => {
    if (typeof m?.content === 'string' && m.content.trim()) {
      return m.content;
    }
    if (Array.isArray(m?.parts)) {
      return m.parts
        .filter((p: any) => p.type === 'text' && p.text)
        .map((p: any) => p.text)
        .join('\n');
    }
    if (typeof m?.text === 'string') {
      return m.text;
    }
    return '';
  }, []);

  const stopSpeaking = useCallback(() => {
    speechSessionIdRef.current += 1;
    sentenceQueueRef.current = [];
    isProcessingQueueRef.current = false;

    if (speakAbortRef.current) {
      speakAbortRef.current.abort();
      speakAbortRef.current = null;
    }
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch {}
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const playSingleSentenceWithBrowser = useCallback(
    (spokenText: string, targetLang: SupportedLanguage, sessionId: number): Promise<void> => {
      return new Promise((resolve) => {
        if (
          typeof window === 'undefined' ||
          !('speechSynthesis' in window) ||
          speechSessionIdRef.current !== sessionId
        ) {
          resolve();
          return;
        }

        window.speechSynthesis.cancel();
        speakTimeoutRef.current = setTimeout(() => {
          if (speechSessionIdRef.current !== sessionId) {
            resolve();
            return;
          }
          const utterance = new SpeechSynthesisUtterance(spokenText);
          utteranceRef.current = utterance;
          utterance.lang = targetLang;
          utterance.rate = 1.0;

          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            const exactMatch =
              voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
              voices.find((v) =>
                targetLang === 'hi-IN'
                  ? v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi')
                  : v.lang.toLowerCase().startsWith('en-in') || v.lang.toLowerCase().startsWith('en')
              );
            if (exactMatch) {
              utterance.voice = exactMatch;
            }
          }

          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => {
            utteranceRef.current = null;
            resolve();
          };
          utterance.onerror = () => {
            utteranceRef.current = null;
            resolve();
          };

          window.speechSynthesis.speak(utterance);
        }, 50);
      });
    },
    []
  );

  // Process the Sentence-Streaming TTS queue sequentially while pre-fetching the next sentence in parallel
  const processSentenceQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    setIsSpeaking(true);

    const fetchSentenceAudio = async (item: { text: string; lang: SupportedLanguage; sessionId: number }) => {
      const controller = new AbortController();
      speakAbortRef.current = controller;
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.text, language: item.lang }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return res.json();
    };

    try {
      let prefetchedPromise: Promise<any> | null = null;
      let prefetchedKey: string | null = null;

      while (sentenceQueueRef.current.length > 0) {
        const current = sentenceQueueRef.current.shift()!;
        if (speechSessionIdRef.current !== current.sessionId) break;

        const currentKey = `${current.sessionId}:${current.lang}:${current.text}`;
        const dataPromise =
          prefetchedPromise && prefetchedKey === currentKey
            ? prefetchedPromise
            : fetchSentenceAudio(current).catch(() => null);

        // Pre-fetch the next sentence in the queue while the current one is resolving/playing
        const nextItem = sentenceQueueRef.current[0];
        if (nextItem && nextItem.sessionId === current.sessionId) {
          prefetchedKey = `${nextItem.sessionId}:${nextItem.lang}:${nextItem.text}`;
          prefetchedPromise = fetchSentenceAudio(nextItem).catch(() => null);
        } else {
          prefetchedKey = null;
          prefetchedPromise = null;
        }

        const data = await dataPromise;
        if (speechSessionIdRef.current !== current.sessionId) break;

        const spokenText = data?.spokenText || current.text;
        const targetLang: SupportedLanguage = data?.language === 'hi-IN' ? 'hi-IN' : current.lang;

        if (data?.audioBase64) {
          await new Promise<void>((resolve) => {
            if (speechSessionIdRef.current !== current.sessionId) {
              resolve();
              return;
            }
            const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
            audioPlayerRef.current = audio;
            setIsSpeaking(true);

            audio.onended = () => {
              audioPlayerRef.current = null;
              resolve();
            };
            audio.onerror = async () => {
              audioPlayerRef.current = null;
              await playSingleSentenceWithBrowser(spokenText, targetLang, current.sessionId);
              resolve();
            };

            audio.play().catch(async () => {
              audioPlayerRef.current = null;
              await playSingleSentenceWithBrowser(spokenText, targetLang, current.sessionId);
              resolve();
            });
          });
        } else {
          await playSingleSentenceWithBrowser(spokenText, targetLang, current.sessionId);
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      if (sentenceQueueRef.current.length === 0) {
        setIsSpeaking(false);
      }
    }
  }, [playSingleSentenceWithBrowser]);

  const enqueueSentencesForSpeech = useCallback(
    (sentences: string[], preferredLang: SupportedLanguage, resetExisting = false) => {
      if (typeof window === 'undefined' || sentences.length === 0) return;

      if (resetExisting) {
        stopSpeaking();
      }

      const activeSessionId = speechSessionIdRef.current;
      for (const s of sentences) {
        const cleaned = cleanTextForSpeech(s);
        if (cleaned) {
          sentenceQueueRef.current.push({
            text: cleaned,
            lang: preferredLang,
            sessionId: activeSessionId,
          });
        }
      }

      if (sentenceQueueRef.current.length > 0) {
        processSentenceQueue();
      }
    },
    [stopSpeaking, processSentenceQueue]
  );

  const speakText = useCallback(
    (rawText: string, preferredLang: SupportedLanguage) => {
      const sentences = splitIntoSentences(rawText);
      if (sentences.length === 0) return;
      enqueueSentencesForSpeech(sentences, preferredLang, true);
    },
    [enqueueSentencesForSpeech]
  );

  // 1. Load Persistent Chat History from Prisma (/api/chat/history) or localStorage on mount
  useEffect(() => {
    let mounted = true;
    async function loadPersistedHistory() {
      try {
        const res = await fetch('/api/chat/history');
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            const last = data.messages[data.messages.length - 1];
            if (last?.id) lastSpokenMessageIdRef.current = last.id;
            setHistoryLoaded(true);
            return;
          }
        }
      } catch {}

      // Fallback to localStorage for guest sessions
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached && mounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            const last = parsed[parsed.length - 1];
            if (last?.id) lastSpokenMessageIdRef.current = last.id;
          }
        }
      } catch {}
      if (mounted) setHistoryLoaded(true);
    }

    loadPersistedHistory();
    return () => {
      mounted = false;
    };
  }, [setMessages]);

  // 2. Save Persistent Chat History to Prisma + localStorage whenever turn finishes
  useEffect(() => {
    if (!historyLoaded || isLoading || messages.length === 0) return;

    const visibleMessages = messages.filter(
      (m: any) =>
        !['Please summarize the results.', 'कृपया परिणामों का हिंदी में संक्षिप्त विवरण दें।'].includes(
          getMessageText(m)
        )
    );

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(visibleMessages.slice(-40)));
    } catch {}

    fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: visibleMessages.slice(-40) }),
    }).catch(() => {});
  }, [messages, isLoading, historyLoaded, getMessageText]);

  const handleClearChatHistory = async () => {
    stopSpeaking();
    setMessages([]);
    setResolvedConfirmations({});
    lastSpokenMessageIdRef.current = null;
    streamedSentenceCountRef.current = {};
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
    try {
      await fetch('/api/chat/history', { method: 'DELETE' });
    } catch {}
  };

  // Ensure browser voices are loaded on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if (speakAbortRef.current) speakAbortRef.current.abort();
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Live Sentence-Streaming TTS while the assistant is streaming text + final completion check
  useEffect(() => {
    if (!historyLoaded || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const msgText = getMessageText(lastMsg);

    // While streaming, speak completed sentences immediately (all sentences except the last still-growing fragment)
    if (isLoading && voiceEnabled && msgText.trim()) {
      const sentences = splitIntoSentences(msgText);
      const completedSentenceCount = Math.max(0, sentences.length - 1);
      const alreadySpokenCount = streamedSentenceCountRef.current[lastMsg.id] || 0;

      if (completedSentenceCount > alreadySpokenCount) {
        const newSentences = sentences.slice(alreadySpokenCount, completedSentenceCount);
        streamedSentenceCountRef.current[lastMsg.id] = completedSentenceCount;
        enqueueSentencesForSpeech(newSentences, language, false);
      }
      return;
    }

    // When streaming finishes
    if (!isLoading) {
      if (
        !msgText.trim() &&
        ((lastMsg.toolInvocations && lastMsg.toolInvocations.length > 0) ||
          lastMsg.parts?.some((p: any) => p.type?.startsWith('tool')))
      ) {
        const promptText =
          language === 'hi-IN'
            ? 'कृपया परिणामों का हिंदी में संक्षिप्त विवरण दें।'
            : 'Please summarize the results.';
        setTimeout(
          () =>
            sendMessage(
              { text: promptText },
              { body: { language }, headers: { 'x-voice-language': language } }
            ),
          100
        );
        return;
      }

      if (voiceEnabled && msgText.trim() && lastSpokenMessageIdRef.current !== lastMsg.id) {
        lastSpokenMessageIdRef.current = lastMsg.id;
        const sentences = splitIntoSentences(msgText);
        const alreadySpokenCount = streamedSentenceCountRef.current[lastMsg.id] || 0;
        const remainingSentences = sentences.slice(alreadySpokenCount);
        streamedSentenceCountRef.current[lastMsg.id] = sentences.length;

        if (remainingSentences.length > 0) {
          enqueueSentencesForSpeech(remainingSentences, language, alreadySpokenCount === 0);
        }
      }
    }
  }, [
    messages,
    isLoading,
    historyLoaded,
    regenerate,
    sendMessage,
    language,
    voiceEnabled,
    getMessageText,
    enqueueSentencesForSpeech,
  ]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitUserMessage = useCallback(
    (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed) return;
      stopSpeaking();
      sendMessage(
        { text: trimmed },
        { body: { language }, headers: { 'x-voice-language': language } }
      );
      setInput('');
    },
    [language, sendMessage, stopSpeaking]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      stopVoiceRecording(true);
      return;
    }
    submitUserMessage(input);
  };

  const cleanupRecordingResources = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingSeconds(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const stopVoiceRecording = async (shouldSend = true) => {
    setIsListening(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        if (!shouldSend) {
          audioChunksRef.current = [];
          return;
        }

        const capturedText = (liveTranscriptRef.current || input).trim();
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        if (audioBlob.size > 0) {
          setIsTranscribing(true);
          try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice.webm');
            formData.append('language', language);

            const res = await fetch('/api/voice/transcribe', {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            if (res.ok && data.text && data.text.trim()) {
              submitUserMessage(data.text.trim());
              return;
            }
          } catch {
            // Fall back to liveTranscriptRef if Whisper request fails
          } finally {
            setIsTranscribing(false);
          }
        }

        if (capturedText) {
          submitUserMessage(capturedText);
        } else {
          setVoiceError(
            language === 'hi-IN'
              ? 'कोई आवाज़ नहीं मिली। कृपया दोबारा बोलें।'
              : 'No speech detected. Please try speaking again.'
          );
        }
      };

      recorder.stop();
      mediaRecorderRef.current = null;
    } else {
      cleanupRecordingResources();
      const capturedText = (liveTranscriptRef.current || input).trim();
      if (shouldSend && capturedText) {
        submitUserMessage(capturedText);
      }
    }
  };

  const toggleVoiceInput = async () => {
    setVoiceError(null);
    stopSpeaking();

    if (isListening) {
      await stopVoiceRecording(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      liveTranscriptRef.current = '';

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      const SpeechRecognitionAPI =
        typeof window !== 'undefined'
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null;

      if (SpeechRecognitionAPI) {
        try {
          const recognition = new SpeechRecognitionAPI();
          recognition.lang = language;
          recognition.interimResults = true;
          recognition.continuous = true;

          recognition.onresult = (event: any) => {
            let combined = '';
            for (let i = 0; i < event.results.length; ++i) {
              combined += event.results[i][0].transcript + ' ';
            }
            const cleaned = combined.trim();
            if (cleaned) {
              liveTranscriptRef.current = cleaned;
              setInput(cleaned);
            }
          };

          recognition.onerror = () => {};
          recognition.onend = () => {};

          recognitionRef.current = recognition;
          recognition.start();
        } catch {}
      }
    } catch {
      cleanupRecordingResources();
      setIsListening(false);
      setVoiceError(
        language === 'hi-IN'
          ? 'माइक्रोफ़ोन अनुमति आवश्यक है (Please allow microphone access).'
          : 'Microphone access denied or unavailable.'
      );
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  // Extract any Human-in-the-Loop (HITL) confirmation payloads from a message's tool outputs
  const extractHitlPayloads = (m: any) => {
    const items: Array<{ key: string; payload: any }> = [];

    if (Array.isArray(m?.toolInvocations)) {
      m.toolInvocations.forEach((ti: any, idx: number) => {
        const res = ti?.result;
        if (res && res.requiresConfirmation) {
          items.push({ key: `${m.id}-ti-${idx}`, payload: res });
        }
      });
    }

    if (Array.isArray(m?.parts)) {
      m.parts.forEach((part: any, idx: number) => {
        const out = part?.output ?? part?.result;
        if (out && out.requiresConfirmation) {
          items.push({ key: `${m.id}-part-${idx}`, payload: out });
        }
      });
    }

    return items;
  };

  const hiddenAutoPrompts = [
    'Please summarize the results.',
    'कृपया परिणामों का हिंदी में संक्षिप्त विवरण दें।',
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans tracking-tight">
      {isOpen ? (
        <div className="flex flex-col w-[360px] sm:w-[410px] h-[620px] bg-white border border-gray-200 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-gray-900" />
              <div>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                  {language === 'hi-IN' ? 'AI वॉइस असिस्टेंट' : 'AI Voice Assistant'}
                </h3>
                <p className="text-[10px] text-gray-400 font-medium">
                  {language === 'hi-IN'
                    ? 'हिंदी और अंग्रेज़ी (Streaming Voice)'
                    : 'English & Hindi Streaming Voice'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Language Switcher: Strictly EN (en-IN) & HI (hi-IN) */}
              <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setLanguage('en-IN');
                  }}
                  className={`px-2 py-1 rounded-full transition-all ${
                    language === 'en-IN'
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="English (India)"
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setLanguage('hi-IN');
                  }}
                  className={`px-2 py-1 rounded-full transition-all ${
                    language === 'hi-IN'
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="हिंदी (Hindi)"
                >
                  हिंदी
                </button>
              </div>

              {/* Stop Speaking button when actively speaking */}
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  title={language === 'hi-IN' ? 'बोलना बंद करें' : 'Stop speaking'}
                >
                  <Square size={14} fill="currentColor" />
                </button>
              )}

              {/* Voice Output Mute/Unmute Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (voiceEnabled) stopSpeaking();
                  setVoiceEnabled(!voiceEnabled);
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  voiceEnabled
                    ? 'text-gray-900 bg-gray-100 hover:bg-gray-200'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={
                  voiceEnabled
                    ? language === 'hi-IN'
                      ? 'आवाज़ चालू है (Voice Output ON)'
                      : 'Voice Output ON'
                    : language === 'hi-IN'
                    ? 'आवाज़ बंद है (Voice Output OFF)'
                    : 'Voice Output OFF'
                }
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Clear Persistent Chat History */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChatHistory}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title={language === 'hi-IN' ? 'चैट इतिहास साफ़ करें' : 'Clear chat history'}
                >
                  <Trash2 size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  if (isListening) stopVoiceRecording(false);
                  setIsOpen(false);
                }}
                className="text-gray-400 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#FAFAFA]">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-10 flex flex-col items-center">
                <div className="w-11 h-11 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-3 shadow-sm">
                  <Sparkles size={18} className="text-gray-900" />
                </div>
                <h4 className="text-gray-900 font-medium mb-1 text-sm">
                  {language === 'hi-IN' ? 'आज मैं आपकी क्या मदद कर सकता हूँ?' : 'How can I help you today?'}
                </h4>
                <p className="text-xs text-gray-500 max-w-[250px] mx-auto leading-relaxed">
                  {language === 'hi-IN'
                    ? 'माइक दबाकर हिंदी या अंग्रेज़ी में बोलें — बुकिंग, चेक-इन/आउट, हाउसकीपिंग, स्टाफ, रिफंड या रिपोर्ट्स के लिए पूछें।'
                    : 'Tap the mic to speak in English or Hindi — ask about bookings, check-in/out, housekeeping, staff, refunds, or analytics.'}
                </p>
              </div>
            )}

            {messages
              .filter((m: any) => !hiddenAutoPrompts.includes(getMessageText(m)))
              .map((m: any) => {
                const msgText = getMessageText(m);
                const hitlItems = m.role === 'assistant' ? extractHitlPayloads(m) : [];

                return (
                  <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                        m.role === 'user'
                          ? 'bg-gray-900 text-white rounded-2xl rounded-tr-sm'
                          : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-200'
                      }`}
                    >
                      {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}

                      {m.toolInvocations?.map((toolInvocation: any, i: number) => (
                        <div
                          key={i}
                          className="text-xs text-gray-500 font-medium my-2 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md w-fit border border-gray-100"
                        >
                          {toolInvocation.state === 'result' ? (
                            <>✅ {language === 'hi-IN' ? 'कार्य पूर्ण' : 'Tool completed'}</>
                          ) : (
                            <>
                              <Loader2 size={12} className="animate-spin text-gray-400" />{' '}
                              {language === 'hi-IN' ? 'प्रोसेस हो रहा है...' : 'Running tool...'}
                            </>
                          )}
                        </div>
                      ))}

                      {!m.content &&
                        m.parts?.map((part: any, i: number) => (
                          <div key={i}>
                            {part.type?.startsWith('tool') && (
                              <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md w-fit border border-gray-100">
                                {part.state === 'output-available' || part.state === 'result' ? (
                                  <>✅ {language === 'hi-IN' ? 'कार्य पूर्ण' : 'Tool completed'}</>
                                ) : (
                                  <>
                                    <Loader2 size={12} className="animate-spin text-gray-400" />
                                    {language === 'hi-IN' ? 'प्रोसेस हो रहा है...' : 'Running tool...'}
                                  </>
                                )}
                              </div>
                            )}
                            {part.type === 'text' && <span className="whitespace-pre-wrap">{part.text}</span>}
                          </div>
                        ))}

                      {/* Human-in-the-Loop (HITL) Confirmation Cards */}
                      {hitlItems.map(({ key, payload }) => {
                        const statusDecision = resolvedConfirmations[key];
                        const title = language === 'hi-IN' ? payload.titleHi || payload.titleEn : payload.titleEn;
                        const summary =
                          language === 'hi-IN' ? payload.summaryHi || payload.summaryEn : payload.summaryEn;
                        const confirmPrompt =
                          language === 'hi-IN'
                            ? payload.confirmPromptHi || payload.confirmPromptEn
                            : payload.confirmPromptEn;

                        return (
                          <div
                            key={key}
                            className="mt-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-gray-900 space-y-2.5"
                          >
                            <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
                              <ShieldAlert size={15} className="shrink-0" />
                              <span>{title}</span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed">{summary}</p>

                            {statusDecision ? (
                              <div className="text-[11px] font-semibold flex items-center gap-1 pt-1 text-gray-600">
                                <Check size={13} />
                                <span>
                                  {statusDecision === 'confirmed'
                                    ? language === 'hi-IN'
                                      ? 'पुष्टि की गई (Confirmed)'
                                    : 'Confirmed'
                                    : language === 'hi-IN'
                                    ? 'रद्द किया गया (Cancelled)'
                                    : 'Cancelled'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => {
                                    setResolvedConfirmations((prev) => ({ ...prev, [key]: 'confirmed' }));
                                    submitUserMessage(confirmPrompt);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40"
                                >
                                  {language === 'hi-IN' ? 'पुष्टि करें (Confirm)' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => {
                                    setResolvedConfirmations((prev) => ({ ...prev, [key]: 'cancelled' }));
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
                                >
                                  {language === 'hi-IN' ? 'रद्द करें (Cancel)' : 'Cancel'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Per-message Listen button for assistant responses */}
                      {m.role === 'assistant' && msgText && (
                        <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => (isSpeaking ? stopSpeaking() : speakText(msgText, language))}
                            className="text-[11px] text-gray-400 hover:text-gray-800 flex items-center gap-1 transition-colors"
                            title={language === 'hi-IN' ? 'सुनें' : 'Listen'}
                          >
                            <Volume2 size={12} />
                            <span>{language === 'hi-IN' ? 'सुनें' : 'Speak'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 rounded-2xl px-4 py-3 text-[14px] rounded-tl-sm border border-gray-200 shadow-sm flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}

            {(error || voiceError) && (
              <div className="flex justify-center my-2">
                <div className="bg-red-50 text-red-500 text-xs px-3 py-2 rounded-lg border border-red-100 max-w-[90%] text-center">
                  {voiceError || error?.message || 'Failed to connect to AI server.'}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Active Voice Recording / Transcribing Banner */}
          {(isListening || isTranscribing) && (
            <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 flex items-center justify-between text-xs text-red-600 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>
                  {isTranscribing
                    ? language === 'hi-IN'
                      ? 'आवाज़ को टेक्स्ट में बदला जा रहा है...'
                      : 'Transcribing voice with AI...'
                    : language === 'hi-IN'
                    ? `हिंदी में रिकॉर्ड हो रहा है (${formatDuration(recordingSeconds)})... बोलने के बाद भेजें दबाएं`
                    : `Recording in English (${formatDuration(recordingSeconds)})... Click Mic or Send when done`}
                </span>
              </div>
              {isListening && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(false)}
                    className="text-[11px] text-gray-500 hover:text-gray-800 px-1.5 py-0.5 rounded"
                  >
                    {language === 'hi-IN' ? 'रद्द करें' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => stopVoiceRecording(true)}
                    className="text-[11px] bg-red-600 text-white px-2.5 py-1 rounded-full font-semibold hover:bg-red-700"
                  >
                    {language === 'hi-IN' ? 'भेजें' : 'Send'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3.5 bg-white border-t border-gray-100">
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isLoading || isTranscribing}
                className={`p-3 rounded-full transition-all shrink-0 flex items-center justify-center shadow-xs ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse hover:bg-red-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                } disabled:opacity-40`}
                title={
                  language === 'hi-IN'
                    ? isListening
                      ? 'रिकॉर्डिंग रोकें और भेजें'
                      : 'हिंदी में बोलने के लिए माइक दबाएं'
                    : isListening
                    ? 'Stop recording and send'
                    : 'Tap to speak in English'
                }
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    language === 'hi-IN'
                      ? 'हिंदी में लिखें या माइक दबाएं...'
                      : 'Ask or tap mic to speak...'
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-full pl-4 pr-11 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent transition-all shadow-xs"
                  disabled={isLoading || isTranscribing}
                />
                <button
                  type="submit"
                  className="absolute right-1.5 p-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 transition-colors flex items-center justify-center"
                  disabled={isLoading || isTranscribing || (!input?.trim() && !isListening)}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-900 hover:bg-gray-800 text-white w-14 h-14 rounded-full shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 flex items-center justify-center"
        >
          <Sparkles size={24} />
        </button>
      )}
    </div>
  );
}
