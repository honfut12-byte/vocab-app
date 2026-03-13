import { useState, useRef } from "react";

export default function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false); 
  
  const [recognizedWord, setRecognizedWord] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isSpellingMode, setIsSpellingMode] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null); 

  const analyzeWord = async (textToTranslate) => {
    const target = typeof textToTranslate === "string" ? textToTranslate : word;
    if (!target) return;
    
    setIsTranslating(true); 
    try {
      const res = await fetch("https://vocab-app-m8ti.onrender.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: target }),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Ошибка при переводе:", error);
    } finally {
      setIsTranslating(false); 
    }
  };

  const startRecording = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const mimeType = mediaRecorderRef.current.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          stopRecording();
        }
      }, 30000);

    } catch (error) {
      console.error("Ошибка доступа к микрофону:", error);
      alert("Пожалуйста, разрешите доступ к микрофону в браузере.");
    }
  };

  const stopRecording = () => {
    setIsRecording(false); 

    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const toggleRecording = async (e) => {
    if (e) e.preventDefault();
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    setIsProcessing(true); 
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice_record");
    formData.append("mode", isSpellingMode ? "spell" : "normal");

    try {
      const res = await fetch("https://vocab-app-m8ti.onrender.com/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.text) {
        setRecognizedWord(data.text);
        setNeedsConfirmation(true);
      } else {
        alert("Не удалось распознать звук. Попробуйте сказать громче.");
      }
      setIsSpellingMode(false);
    } catch (error) {
      console.error("Ошибка распознавания:", error);
      alert("Не удалось распознать голос. Проверьте соединение с сервером.");
      setIsSpellingMode(false);
    } finally {
      setIsProcessing(false); 
    }
  };

  const confirmWord = () => {
    setWord(recognizedWord);
    setNeedsConfirmation(false);
    analyzeWord(recognizedWord);
  };

  const rejectAndRepeat = () => {
    setNeedsConfirmation(false);
    setRecognizedWord("");
  };

  const rejectAndSpell = () => {
    setNeedsConfirmation(false);
    setRecognizedWord("");
    setIsSpellingMode(true);
  };

  return (
    <>
      <style>{`
        body, html {
          margin: 0;
          padding: 0;
          background-color: #ffffff !important;
          width: 100%;
          height: 100%;
        }
        
        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0.7; transform: scale(0.98); }
        }

        /* Убираем стандартную синюю обводку браузера при клике на поле ввода */
        input:focus {
          outline: none;
          box-shadow: 0 6px 15px rgba(0,0,0,0.15) !important;
        }
      `}</style>

      <div style={{ 
        padding: 40, 
        fontFamily: "sans-serif", 
        textAlign: "center", 
        paddingBottom: "100px",
        color: "#000000",         
        backgroundColor: "#ffffff", 
        minHeight: "100vh",
        boxSizing: "border-box" 
      }}>
        <h1>📚 LizAlis</h1>

        {needsConfirmation ? (
          <div style={{ background: "#f0f8ff", padding: "20px", borderRadius: "20px", display: "inline-block", color: "#000", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
            <h3>I heard: "{recognizedWord}"</h3>
            <p>Is this correct?</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={confirmWord} style={{ background: "#4CAF50", color: "white", padding: "10px", border: "none", borderRadius: "15px", cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>✅ Yes, Translate!</button>
              <button onClick={rejectAndRepeat} style={{ background: "#f44336", color: "white", padding: "10px", border: "none", borderRadius: "15px", cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>🎤 No, repeat</button>
              <button onClick={rejectAndSpell} style={{ background: "#ff9800", color: "white", padding: "10px", border: "none", borderRadius: "15px", cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>🔤 Spell out loud</button>
            </div>
          </div>
        ) : (
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            gap: "20px", 
            justifyContent: "center",
            alignItems: "center"
          }}>
            
            {isSpellingMode && (
              <div style={{ color: "#ff9800", fontWeight: "bold", fontSize: "18px" }}>
                Spelling mode: Tap the mic and spell the letters! (e.g., C - A - T)
              </div>
            )}

            <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: "500px" }}>
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Say or type a word"
                disabled={isProcessing || isTranslating}
                style={{ 
                  padding: "15px 25px", 
                  fontSize: "18px", 
                  flex: "1", 
                  minWidth: "200px", 
                  color: "#000000",       
                  backgroundColor: (isProcessing || isTranslating) ? "#f5f5f5" : "#ffffff", 
                  border: "none", 
                  borderRadius: "25px", // Более круглые края
                  boxShadow: "0 4px 10px rgba(0,0,0,0.08)", // Мягкая тень
                  transition: "all 0.3s ease"
                }}
              />

              <button 
                onClick={() => analyzeWord(word)} 
                disabled={isProcessing || isTranslating || !word}
                style={{ 
                  padding: "15px 30px", 
                  fontSize: "18px", 
                  fontWeight: "bold",
                  cursor: (isProcessing || isTranslating || !word) ? "not-allowed" : "pointer", 
                  color: "#0056b3", // Темно-синий текст
                  backgroundColor: "#e3f2fd", // Нежно-голубой фон
                  border: "none", 
                  borderRadius: "25px", // Круглая кнопка
                  boxShadow: "0 4px 10px rgba(0,0,0,0.08)", // Тень как у инпута
                  opacity: (isProcessing || isTranslating || !word) ? 0.6 : 1,
                  transition: "all 0.3s ease"
                }}>
                Translate!
              </button>
            </div>
          </div>
        )}

        {(isProcessing || isTranslating) && (
          <div style={{ marginTop: 40, textAlign: "center" }}>
            <div style={{
              display: "inline-block",
              padding: "15px 30px",
              background: isProcessing ? "#fff3e0" : "#e0f7fa", 
              borderRadius: "25px",
              color: isProcessing ? "#e65100" : "#006064",
              fontWeight: "bold",
              fontSize: "18px",
              animation: "pulse 1.5s infinite",
              boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
            }}>
              {isProcessing ? "Распознаю голос... 🎧" : "Перевожу... 🧠"}
            </div>
          </div>
        )}

        {result && !needsConfirmation && !isProcessing && !isTranslating && (
          <div style={{ marginTop: 30, textAlign: "left", display: "inline-block", background: "#ffffff", padding: "25px", borderRadius: "20px", color: "#000", boxShadow: "0 4px 15px rgba(0,0,0,0.08)", width: "100%", maxWidth: "500px", boxSizing: "border-box" }}>
            <h2 style={{ marginTop: 0, fontSize: "28px", color: "#333" }}>{result.word}</h2>
            <p style={{ fontSize: "18px", color: "#666", marginBottom: "20px" }}><b>Transcription:</b> {result.transcription}</p>
            <div style={{ background: "#f0f8ff", padding: "15px", borderRadius: "15px", marginBottom: "20px" }}>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "bold", color: "#0056b3" }}>{result.translation}</p>
            </div>
            <p style={{ fontSize: "18px", marginBottom: "10px" }}>• {result.examples[0]}</p>
            <p style={{ fontSize: "18px" }}>• {result.examples[1]}</p>
          </div>
        )}

        {!needsConfirmation && (
          <button 
            onClick={toggleRecording} 
            onContextMenu={(e) => e.preventDefault()}
            disabled={isProcessing || isTranslating}
            style={{ 
              position: "fixed", 
              bottom: "30px", 
              right: "30px", 
              zIndex: 1000, 
              padding: "15px", 
              fontSize: 28, 
              cursor: (isProcessing || isTranslating) ? "not-allowed" : "pointer", 
              background: isRecording ? "#f44336" : (isSpellingMode ? "#ffb74d" : "#2196F3"),
              color: "white",
              borderRadius: isRecording ? "20px" : "50%", 
              border: "none",
              width: "70px",
              height: "70px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: "0px 6px 15px rgba(0,0,0,0.3)",
              transition: "all 0.3s ease", 
              opacity: (isProcessing || isTranslating) ? 0.5 : 1,

              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
              touchAction: "manipulation", 
              WebkitTapHighlightColor: "transparent"
            }}
            title="Нажмите, чтобы начать/остановить запись"
          >
            {isRecording ? "🛑" : "🎤"}
          </button>
        )}
      </div>
    </>
  );
}