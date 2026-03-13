import { useState, useRef } from "react";

export default function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedWord, setRecognizedWord] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isSpellingMode, setIsSpellingMode] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null); // Запоминаем поток для отключения железа

  const analyzeWord = async (textToTranslate) => {
    const target = typeof textToTranslate === "string" ? textToTranslate : word;
    if (!target) return;
    
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
    }
  };

  const startRecording = async (e) => {
    if (e) e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Сохраняем доступ к микрофону
      
      mediaRecorderRef.current = new MediaRecorder(stream);
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

  const stopRecording = (e) => {
    if (e) e.preventDefault();
    
    setIsRecording(false); // Мгновенный возврат кнопки в синий цвет

    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Жестко отключаем аппаратный микрофон, чтобы погасла оранжевая точка
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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
    <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center", paddingBottom: "100px" }}>
      <h1>📚 LizAli</h1>

      {needsConfirmation ? (
        <div style={{ background: "#f0f8ff", padding: "20px", borderRadius: "10px", display: "inline-block" }}>
          <h3>I heard: "{recognizedWord}"</h3>
          <p>Is this correct?</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={confirmWord} style={{ background: "#4CAF50", color: "white", padding: "10px", border: "none", borderRadius: "5px", cursor: "pointer" }}>✅ Yes, Translate!</button>
            <button onClick={rejectAndRepeat} style={{ background: "#f44336", color: "white", padding: "10px", border: "none", borderRadius: "5px", cursor: "pointer" }}>🎤 No, repeat</button>
            <button onClick={rejectAndSpell} style={{ background: "#ff9800", color: "white", padding: "10px", border: "none", borderRadius: "5px", cursor: "pointer" }}>🔤 Spell out loud</button>
          </div>
        </div>
      ) : (
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          gap: "15px", 
          justifyContent: "center",
          alignItems: "center"
        }}>
          
          {isSpellingMode && (
            <div style={{ color: "#ff9800", fontWeight: "bold", fontSize: "18px" }}>
              Spelling mode: Hold the mic and spell the letters! (e.g., C - A - T)
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Say or type a word"
              style={{ padding: 10, fontSize: 18, flex: "1", minWidth: "200px", maxWidth: "300px" }}
            />

            <button onClick={() => analyzeWord(word)} style={{ padding: 10, fontSize: 18, cursor: "pointer" }}>
              Translate!
            </button>
          </div>
        </div>
      )}

      {result && !needsConfirmation && (
        <div style={{ marginTop: 30, textAlign: "left", display: "inline-block", background: "#f9f9f9", padding: "20px", borderRadius: "10px" }}>
          <h2 style={{ marginTop: 0 }}>{result.word}</h2>
          <p><b>Transcription:</b> {result.transcription}</p>
          <p><b>Translation:</b> {result.translation}</p>
          <p>• {result.examples[0]}</p>
          <p>• {result.examples[1]}</p>
        </div>
      )}

      {!needsConfirmation && (
        <button 
          onMouseDown={startRecording} 
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording} 
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          style={{ 
            position: "fixed", 
            bottom: "30px", 
            right: "30px", 
            zIndex: 1000, 
            padding: "15px", 
            fontSize: 28, 
            cursor: "pointer", 
            background: isRecording ? "#f44336" : (isSpellingMode ? "#ffb74d" : "#2196F3"),
            color: "white",
            borderRadius: "50%",
            border: "none",
            width: "70px",
            height: "70px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0px 6px 15px rgba(0,0,0,0.3)",
            transition: "transform 0.1s",

            // Магия против Safari: отключаем выделение, меню и зум
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
            touchAction: "none", 
            WebkitTapHighlightColor: "transparent"
          }}
          title="Удерживайте, чтобы говорить (макс. 30 секунд)"
        >
          {isProcessing ? "⏳" : "🎤"}
        </button>
      )}
    </div>
  );
}