import React, { useState, useRef, useEffect } from "react";

// Replace with your actual API keys
const ASSEMBLY_AI_API_KEY = "763ddc1189bc46efb771469822930c7f";
const OPENROUTER_API_KEY =
  "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";
const OPENROUTER_MODEL = "mistralai/mistral-7b-instruct";

const VoiceAgent = () => {
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const defaultVoice = useRef(null);

  useEffect(() => {
    const loadDefaultVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        defaultVoice.current = voices[0];
      }
    };
    window.speechSynthesis.onvoiceschanged = loadDefaultVoice;
    loadDefaultVoice();
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const startRecording = async () => {
    try {
      setTranscript("");
      setResponse("");
      setIsLoading(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = handleAudioStop;
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("🎙️ Microphone access error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsLoading(true);
    }
  };

  const handleAudioStop = async () => {
    const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
    try {
      const text = await transcribeAudio(audioBlob);
      setTranscript(text);
      const aiReply = await sendToOpenRouter(text);
      setResponse(aiReply);
      speakText(aiReply);
    } catch (err) {
      console.error("❌ Error handling audio:", err);
      setResponse("❌ Error occurred. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const transcribeAudio = async (blob) => {
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: ASSEMBLY_AI_API_KEY,
      },
      body: blob,
    });
    const { upload_url } = await uploadRes.json();

    const transcriptRes = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          authorization: ASSEMBLY_AI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio_url: upload_url }),
      }
    );
    const transcriptJson = await transcriptRes.json();

    let result;
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));
      const polling = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptJson.id}`,
        {
          headers: { authorization: ASSEMBLY_AI_API_KEY },
        }
      );
      result = await polling.json();
      if (result.status === "completed") break;
      if (result.status === "error")
        throw new Error(`Transcription error: ${result.error}`);
    }

    return result.text;
  };

  const sendToOpenRouter = async (text) => {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: text },
          ],
        }),
      }
    );

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "No response from model.";
  };

  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (defaultVoice.current) utterance.voice = defaultVoice.current;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const Spinner = () => (
    <div style={{ marginTop: 10, textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          width: 28,
          height: 28,
          border: "4px solid #ccc",
          borderTop: `4px solid ${darkMode ? "#f1c40f" : "#4b47e0"}`,
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg);}
          100% { transform: rotate(360deg);}
        }
      `}</style>
    </div>
  );

  const colors = {
    background: darkMode ? "#1e1e2f" : "#f5f7fa",
    card: darkMode ? "#29293d" : "#ffffff",
    text: darkMode ? "#f0f0f0" : "#2c3e50",
    userBubble: darkMode ? "#6c63ff" : "#d2e7ff",
    aiBubble: darkMode ? "#4b47e0" : "#7d75ff",
    micBg: darkMode ? "#8e7fff" : "#a18aff",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        position: "relative",
      }}
    >
      {/* Dark Mode Toggle in Top-Left */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        aria-label="Toggle Dark Mode"
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          background: "transparent",
          border: "none",
          fontSize: 24,
          cursor: "pointer",
          color: darkMode ? "#f1c40f" : "#2c3e50",
          zIndex: 1000,
          transition: "color 0.3s ease",
        }}
      >
        🌙
      </button>

      {/* Main Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          backgroundColor: colors.card,
          borderRadius: 20,
          boxShadow: darkMode
            ? "0 12px 25px rgba(0,0,0,0.4)"
            : "0 12px 25px rgba(74, 144, 226, 0.15)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: colors.text,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: "bold", marginBottom: 16 }}>
          🎙️ ASIFORNIA
        </h1>

        {/* Mic Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            backgroundColor: colors.micBg,
            border: "none",
            boxShadow: isRecording
              ? "0 0 25px 6px rgba(111, 79, 242, 0.8), inset 0 0 18px 5px rgba(111, 79, 242, 0.9)"
              : "0 0 18px 5px rgba(161, 138, 255, 0.8), inset 0 0 12px 4px rgba(161, 138, 255, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            cursor: "pointer",
          }}
          aria-label={isRecording ? "Stop Recording" : "Start Recording"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="white"
            viewBox="0 0 24 24"
            width="40px"
            height="40px"
          >
            <path
              d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zM12 18v4m-4 0h8"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Chat Area */}
        <div
          style={{
            width: "100%",
            maxHeight: 300,
            overflowY: "auto",
            padding: "10px 16px",
            backgroundColor: darkMode ? "#1b1b2b" : "#ffffff",
            borderRadius: 14,
            fontSize: 16,
            lineHeight: 1.5,
            boxShadow: darkMode
              ? "inset 0 0 10px rgba(255,255,255,0.05)"
              : "inset 0 0 10px rgba(0,0,0,0.05)",
          }}
        >
          {transcript && (
            <div
              style={{
                backgroundColor: colors.userBubble,
                color: darkMode ? "#fff" : "#054a91",
                padding: "10px 14px",
                borderRadius: "18px 18px 0 18px",
                marginBottom: 12,
                maxWidth: "80%",
                fontWeight: "500",
              }}
            >
              <strong>You:</strong> {transcript}
            </div>
          )}

          {isLoading ? (
            <Spinner />
          ) : (
            response && (
              <div
                style={{
                  backgroundColor: colors.aiBubble,
                  color: "#fff",
                  padding: "12px 16px",
                  borderRadius: "18px 18px 18px 0",
                  maxWidth: "80%",
                  fontWeight: "500",
                  whiteSpace: "pre-wrap",
                }}
              >
                <strong>AI:</strong> {response}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAgent;
