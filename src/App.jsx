import { useState, useRef, useEffect } from "react";

export default function App() {
  const [word, setWord] = useState("");
  
  // Состояние для хранения истории чата
  const [chatHistory, setChatHistory] = useState([
    { 
      id: 1, 
      sender: "bot", 
      type: "welcome", 
      text: "Привет! Я LizAlis 🎀 Скажи или напиши мне любое слово, и я его переведу!" 
    }
  ]);

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
  
  // Реф для автоматического скролла вниз
  const messagesEndRef = useRef(null);

  // Авто-скролл при добавлении новых сообщений
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isProcessing, isTranslating, needsConfirmation]);

  const analyzeWord = async (textToTranslate) => {
    const target = typeof textToTranslate === "string" ? textToTranslate : word;
    if (!target.trim()) return;
    
    // Добавляем сообщение пользователя в чат
    setChatHistory(prev => [...prev, { id: Date.now(), sender: "user", text: target }]);
    setWord(""); // Очищаем поле ввода
    setNeedsConfirmation(false);
    
    setIsTranslating(true); 
    try {
      const res = await fetch("https://vocab-app-m8ti.onrender.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: target }),
      });
      const data = await res.json();
      
      // Добавляем ответ бота в чат
      setChatHistory(prev => [...prev, { id: Date.now() + 1, sender: "bot", type: "result", result: data }]);
    } catch (error) {
      console.error("Ошибка при переводе:", error);
      setChatHistory(prev => [...prev, { id: Date.now() + 1, sender: "bot", type: "error", text: "Ой, что-то пошло не так. Попробуй еще раз! 🥺" }]);
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

  const handleMainButtonClick = async (e) => {
    if (e) e.preventDefault();
    
    // Если в поле ввода есть текст, кнопка работает как "Отправить"
    if (word.trim()) {
      analyzeWord(word);
      return;
    }

    // Иначе работает как микрофон
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && word.trim() && !isProcessing && !isTranslating) {
      analyzeWord(word);
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

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100dvh", // 100dvh для правильного отображения на мобильных (учитывая панели браузера)
      backgroundColor: "#fff5f8", // Очень светлый розовый фон приложения
      fontFamily: "'Fredoka', sans-serif",
      position: "relative",
      overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap');
        
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
        
        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0.7; transform: scale(0.98); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        input:focus { outline: none; }
        
        /* Скрываем скроллбар для красоты, но оставляем скроллинг */
        .chat-container::-webkit-scrollbar { display: none; }
        .chat-container { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ФОН С ИГРУШКАМИ */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'hidden', opacity: 0.12, fontSize: '4rem', userSelect: 'none' }}>
        <span style={{ position: 'absolute', top: '5%', left: '8%', transform: 'rotate(-15deg)' }}>🧸</span>
        <span style={{ position: 'absolute', top: '15%', right: '12%', transform: 'rotate(20deg)' }}>🎈</span>
        <span style={{ position: 'absolute', top: '45%', left: '4%', transform: 'rotate(10deg)' }}>🦄</span>
        <span style={{ position: 'absolute', top: '65%', right: '8%', transform: 'rotate(-20deg)' }}>🚗</span>
        <span style={{ position: 'absolute', bottom: '8%', left: '15%', transform: 'rotate(15deg)' }}>🎀</span>
        <span style={{ position: 'absolute', top: '35%', right: '25%', transform: 'rotate(-10deg)' }}>🌟</span>
        <span style={{ position: 'absolute', bottom: '25%', right: '5%', transform: 'rotate(5deg)' }}>🍭</span>
      </div>

      {/* ШАПКА ЧАТА (Header) */}
      <div style={{ 
        flex: "0 0 auto", 
        padding: "15px 20px", 
        background: "rgba(255, 255, 255, 0.9)", 
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 117, 140, 0.2)",
        zIndex: 10,
        textAlign: "center",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: "2.2rem", 
          fontWeight: "600",
          background: "linear-gradient(45deg, #ff758c 0%, #ff7eb3 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "2px 2px 10px rgba(255, 117, 140, 0.1)"
        }}>LizAlis</h1>
      </div>

      {/* ОБЛАСТЬ СООБЩЕНИЙ (Чат) */}
      <div className="chat-container" style={{ 
        flex: "1 1 auto", 
        overflowY: "auto", 
        padding: "20px", 
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "15px"
      }}>
        
        {chatHistory.map((msg) => (
          <div key={msg.id} style={{
            alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            animation: "slideIn 0.3s ease-out"
          }}>
            {msg.sender === "user" ? (
              // Пузырь пользователя (запрос)
              <div style={{
                background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
                color: "#d81b60",
                padding: "12px 20px",
                borderRadius: "20px 20px 0 20px",
                fontSize: "18px",
                fontWeight: "500",
                boxShadow: "0 2px 8px rgba(255, 154, 158, 0.3)"
              }}>
                {msg.text}
              </div>
            ) : (
              // Сообщения бота
              msg.type === "welcome" || msg.type === "error" ? (
                // Текстовое сообщение от бота
                <div style={{
                  background: "#ffffff",
                  color: "#333",
                  padding: "12px 20px",
                  borderRadius: "20px 20px 20px 0",
                  fontSize: "18px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                }}>
                  {msg.text}
                </div>
              ) : (
                // Карточка с результатом перевода
                <div style={{
                  background: "#ffffff",
                  padding: "20px",
                  borderRadius: "20px 20px 20px 0",
                  color: "#333",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
                  minWidth: "250px"
                }}>
                  <h2 style={{ margin: "0 0 5px 0", fontSize: "26px", color: "#333", fontWeight: "600" }}>
                    {msg.result.word}
                  </h2>
                  <p style={{ margin: "0 0 15px 0", fontSize: "16px", color: "#888", fontStyle: "italic" }}>
                    [{msg.result.transcription.replace(/[\[\]]/g, "")}] {/* Очищаем от случайных двойных скобок */}
                  </p>
                  
                  <div style={{ background: "#fff0f5", padding: "12px 15px", borderRadius: "12px", marginBottom: "15px" }}>
                    <p style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#d81b60" }}>
                      {msg.result.translation}
                    </p>
                  </div>
                  
                  <div style={{ fontSize: "16px", color: "#555", lineHeight: "1.4" }}>
                    <p style={{ margin: "0 0 8px 0" }}>• {msg.result.examples[0]}</p>
                    <p style={{ margin: 0 }}>• {msg.result.examples[1]}</p>
                  </div>
                </div>
              )
            )}
          </div>
        ))}

        {/* Индикатор записи / распознавания */}
        {isProcessing && (
          <div style={{ alignSelf: "flex-start", animation: "slideIn 0.3s ease-out" }}>
            <div style={{ background: "#fff3e0", color: "#e65100", padding: "12px 20px", borderRadius: "20px 20px 20px 0", fontSize: "16px", fontWeight: "500", animation: "pulse 1.5s infinite", boxShadow: "0 2px 8px rgba(230, 81, 0, 0.1)" }}>
              Распознаю голос... 🎧
            </div>
          </div>
        )}

        {/* Индикатор перевода */}
        {isTranslating && (
          <div style={{ alignSelf: "flex-start", animation: "slideIn 0.3s ease-out" }}>
            <div style={{ background: "#f3e5f5", color: "#6a1b9a", padding: "12px 20px", borderRadius: "20px 20px 20px 0", fontSize: "16px", fontWeight: "500", animation: "pulse 1.5s infinite", boxShadow: "0 2px 8px rgba(106, 27, 154, 0.1)" }}>
              Перевожу... 🧠
            </div>
          </div>
        )}

        {/* Блок подтверждения слова (отображается как сообщение бота) */}
        {needsConfirmation && (
          <div style={{ alignSelf: "flex-start", maxWidth: "85%", animation: "slideIn 0.3s ease-out" }}>
            <div style={{ background: "#ffffff", padding: "15px", borderRadius: "20px 20px 20px 0", boxShadow: "0 4px 15px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: "0 0 15px 0", fontSize: "18px", color: "#333" }}>
                Я услышала: <b>"{recognizedWord}"</b><br/>Все верно?
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={() => analyzeWord(recognizedWord)} style={{ flex: 1, background: "#4CAF50", color: "white", padding: "10px", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "500" }}>✅ Да</button>
                <button onClick={() => setNeedsConfirmation(false)} style={{ flex: 1, background: "#f44336", color: "white", padding: "10px", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "500" }}>🎤 Нет</button>
                <button onClick={() => { setNeedsConfirmation(false); setIsSpellingMode(true); }} style={{ width: "100%", background: "#ff9800", color: "white", padding: "10px", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "500", marginTop: "4px" }}>🔤 По буквам</button>
              </div>
            </div>
          </div>
        )}

        {/* Невидимый элемент для авто-скролла */}
        <div ref={messagesEndRef} style={{ height: "1px" }} />
      </div>

      {/* ПАНЕЛЬ ВВОДА (Bottom Bar) */}
      <div style={{ 
        flex: "0 0 auto", 
        padding: "15px 20px 25px 20px", // Увеличен нижний отступ для айфонов
        background: "rgba(255, 255, 255, 0.95)", 
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        zIndex: 10,
        display: "flex",
        gap: "10px",
        alignItems: "center"
      }}>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isSpellingMode ? "Spelling mode (C-A-T)..." : "Напиши слово..."}
          disabled={isProcessing || isTranslating}
          style={{ 
            fontFamily: "'Fredoka', sans-serif",
            height: "55px", // Строгая высота
            padding: "0 20px", 
            fontSize: "18px", 
            flex: "1", 
            color: "#333",       
            backgroundColor: "#f5f5f5", 
            border: "1px solid transparent", 
            borderRadius: "28px", 
            transition: "all 0.3s ease",
            boxSizing: "border-box"
          }}
        />

        <button 
          onClick={handleMainButtonClick} 
          disabled={isProcessing || isTranslating}
          style={{ 
            height: "55px", // Идентичная высота
            width: "55px",  // Идеальный круг
            flexShrink: 0,
            cursor: (isProcessing || isTranslating) ? "not-allowed" : "pointer", 
            
            // Если введен текст - кнопка синяя (отправить). Если нет - розовая (микрофон) или красная (запись).
            background: word.trim() ? "#2196F3" : (isRecording ? "#f44336" : (isSpellingMode ? "#ffb74d" : "#ff4081")),
            
            color: "white",
            borderRadius: isRecording && !word.trim() ? "15px" : "50%", // Квадрат при записи
            border: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "24px",
            boxShadow: word.trim() ? "0 4px 15px rgba(33, 150, 243, 0.3)" : "0 4px 15px rgba(255, 64, 129, 0.3)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
            opacity: (isProcessing || isTranslating) ? 0.5 : 1,

            WebkitUserSelect: "none",
            userSelect: "none",
            touchAction: "manipulation", 
            WebkitTapHighlightColor: "transparent"
          }}
          title={word.trim() ? "Отправить" : "Нажмите, чтобы начать/остановить запись"}
        >
          {word.trim() ? "🚀" : (isRecording ? "🛑" : "🎤")}
        </button>
      </div>

    </div>
  );
}