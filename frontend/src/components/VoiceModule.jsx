import React, { useState, useEffect, useRef } from "react";

/**
 * Hook to handle Text-to-Speech (TTS) and Speech-to-Text (STT)
 */
export function useVoiceAssistant() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setVoiceSupported(false);
    }
  }, []);

  const speakText = (text, onComplete) => {
    if (!("speechSynthesis" in window)) {
      setSpeechError("Speech synthesis not supported in this browser.");
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      // Select a clean English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => (v.lang.includes("en-IN") || v.lang.includes("en-US") || v.lang.includes("en-GB")) && !v.name.includes("whisper")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeechError(null);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (onComplete) onComplete();
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis error:", e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const startListening = (onTranscriptResult) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("Speech recognition not supported in this browser. Please use Chrome/Edge.");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (onTranscriptResult) {
          onTranscriptResult(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error !== "no-speech") {
          setSpeechError(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("STT error:", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return {
    isSpeaking,
    isListening,
    speechError,
    voiceSupported,
    speakText,
    stopSpeaking,
    startListening,
    stopListening
  };
}

/**
 * Animated Audio Equalizer Bars
 */
export function AudioWaves({ isDark = false }) {
  return (
    <div className="flex items-center gap-0.5 h-3.5 px-1">
      <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.6s_infinite_100ms] h-3"></span>
      <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.6s_infinite_200ms] h-4"></span>
      <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.6s_infinite_300ms] h-2"></span>
      <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.6s_infinite_150ms] h-3.5"></span>
    </div>
  );
}
