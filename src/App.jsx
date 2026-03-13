import { useState, useRef } from "react";

export default function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedWord, setRecognizedWord] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  
  // Новый стейт для режима произношения по буквам
  const [isSpellingMode, setIsSpellingMode] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null); // Реф для таймера 30 секунд

  const analyzeWord = async (wordToAnalyze = word) => {
    if (!wordToAnalyze) return;
    const res = await fetch("https://vocab-app-m8ti.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: wordToAnalyze }),
    });
    const data = await res.json();
    setResult(data);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Ограничение записи до 30 секунд
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
    // Очищаем таймер, если отпустили кнопку раньше 30 секунд
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    
    // Передаем на бэкенд информацию о текущем режиме
    formData.append("mode", isSpellingMode ? "spell" : "normal");

    try {
      const res = await fetch("https://vocab-app-m8ti.onrender.com/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      setRecognizedWord(data.text);
      setNeedsConfirmation(true);
      setIsSpellingMode(false); // Сбрасываем режим после успешного ответа
    } catch (error) {
      console.error("Ошибка распознавания:", error);
      alert("Не удалось распознать голос. Сервер еще не настроен!");
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
    setIsSpellingMode(true); // Включаем режим диктовки по буквам
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center" }}>
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
          
          {/* Подсказка для режима диктовки по буквам */}
          {isSpellingMode && (
            <div style={{ color: "#ff9800", fontWeight: "bold", fontSize: "18px" }}>
              Spelling mode: Hold the mic and spell the letters! (e.g., C - A - T)
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button 
              onMouseDown={startRecording} 
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording} // Остановка, если курсор ушел с кнопки
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              style={{ 
                padding: "15px", 
                fontSize: 24, 
                cursor: "pointer", 
                background: isRecording ? "red" : (isSpellingMode ? "#ffb74d" : "#ddd"),
                borderRadius: "50%",
                border: "none",
                width: "60px",
                height: "60px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }}
              title="Удерживайте, чтобы говорить (макс. 30 секунд)"
            >
              {isProcessing ? "⏳" : "🎤"}
            </button>

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
    </div>
  );
}