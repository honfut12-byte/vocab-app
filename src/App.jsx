import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const API_BASE_URL = "https://vocab-app-m8ti.onrender.com";

// Используем только ANON KEY на фронтенде
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [word, setWord] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { id: 1, sender: "bot", type: "welcome", text: "Привет! Я LizAlis 🎀 Напиши или скажи мне слово или целую фразу!" }
  ]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false); 
  
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // ТЕПЕРЬ МЫ ХРАНИМ ID КОНКРЕТНОГО СООБЩЕНИЯ, А НЕ ОБЩИЙ СТАТУС
  const [drawingMessageId, setDrawingMessageId] = useState(null); 
  const [playingAudioId, setPlayingAudioId] = useState(null); 

  const [modalImage, setModalImage] = useState(null); 

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null); 
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (err) {
        console.error("Auth init failed:", err);
      } finally {
        // В любом случае убираем экран загрузки через 1.5 сек максимум
        setIsInitialLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isProcessing, isTranslating, drawingMessageId]);

  // ДОБАВИЛИ ПАРАМЕТР ID В ФУНКЦИЮ ОЗВУЧКИ
  const playAudio = async (text, id) => {
    if (!text) return;
    setPlayingAudioId(id); // Крутим часы ТОЛЬКО на этой кнопке
    
    try {
      const res = await fetch(`${API_BASE_URL}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("Audio fetch failed");

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setPlayingAudioId(null); // Останавливаем часы
        URL.revokeObjectURL(audioUrl); 
      };
      
      await audio.play();
    } catch (error) {
      console.error("Play audio error:", error);
      alert("Не удалось загрузить озвучку 😔");
      setPlayingAudioId(null);
    }
  };

  const handleGenerateImage = async (wordToDraw, messageId) => {
    if (!wordToDraw) return;
    setDrawingMessageId(messageId); // Крутим часы ТОЛЬКО на этой кнопке

    try {
      const res = await fetch(`${API_BASE_URL}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: wordToDraw }),
      });
      const data = await res.json();
      
      if (data.imageUrl) {
        setChatHistory(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, result: { ...msg.result, generatedImageUrl: data.imageUrl } }
            : msg
        ));
        setModalImage(data.imageUrl);
      } else {
        alert("Не удалось найти картинку 😔 Попробуй другое слово.");
      }
    } catch (error) {
      console.error("Image error:", error);
      alert("Ошибка сервера. Не удалось загрузить картинку.");
    } finally {
      setDrawingMessageId(null); // Останавливаем часы
    }
  };

  const analyzeWord = async (textToTranslate) => {
    const target = typeof textToTranslate === "string" ? textToTranslate : word;
    if (!target.trim()) return;
    setChatHistory(prev => [...prev, { id: Date.now(), sender: "user", text: target }]);
    setWord(""); 
    
    setIsTranslating(true); 
    try {
      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          word: target, 
          userId: session?.user?.id // Передаем ID пользователя
        }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { id: Date.now() + 1, sender: "bot", type: "result", result: data }]);
    } catch (error) {
      console.error(error);
      setChatHistory(prev => [...prev, { id: Date.now() + 1, sender: "bot", type: "error", text: "Ой, ошибка сети 🥺" }]);
    } finally {
      setIsTranslating(false); 
    }
  };

  const handleAuth = async (type) => {
    if (!email || !password) return alert("Введи почту и пароль 🎀");
    setIsAuthLoading(true);
    try {
      const { data, error } = type === 'login' 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    
      if (error) {
        alert(error.message);
        if (error.message.includes("email rate limit exceeded")) {
          alert("Ой! Мы отправили слишком много писем. Пожалуйста, подожди часик или попробуй другую почту. ⏳");
        } else {
          alert(error.message);
        }
      } else if (type === 'signup' && data.user && !data.session) {
        // Если регистрация прошла успешно, но нужно подтверждение почты
        alert("Регистрация почти завершена! Проверь свою почту и нажми на ссылку в письме 💌");
      }
    } catch (err) {
      console.error("Auth error:", err);
      alert("Произошла ошибка при входе или регистрации 🥺");
    } finally {
      setIsAuthLoading(false);
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioToBackend(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      recordingTimerRef.current = setTimeout(() => stopRecording(), 30000);
    } catch (error) { console.error(error); alert("Доступ к микрофону запрещен."); }
  };

  const stopRecording = () => {
    setIsRecording(false); 
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    setIsProcessing(true); 
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice_record");
    try {
      const res = await fetch(`${API_BASE_URL}/transcribe`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.text) analyzeWord(data.text);
    } catch (error) { console.error(error); alert("Ошибка распознавания.");
    } finally { setIsProcessing(false); }
  };

  const handleMainButtonClick = (e) => {
    if (e) e.preventDefault();
    if (word.trim()) { analyzeWord(word); return; }
    if (isRecording) stopRecording(); else startRecording();
  };

  if (isInitialLoading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff5f8" }}>
        <div style={{ animation: "spin 1s linear infinite", fontSize: "2rem" }}>⏳</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff5f8", fontFamily: "'Fredoka', sans-serif" }}>
        <div style={{ background: "white", padding: "40px", borderRadius: "30px", boxShadow: "0 10px 25px rgba(255, 117, 140, 0.1)", width: "90%", maxWidth: "400px", textAlign: "center" }}>
          <h1 style={{ color: "#ff758c", marginBottom: "30px" }}>LizAlis 🎀</h1>
          <input type="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", height: "50px", borderRadius: "25px", border: "2px solid #fff0f5", padding: "0 20px", marginBottom: "15px", boxSizing: "border-box" }} />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", height: "50px", borderRadius: "25px", border: "2px solid #fff0f5", padding: "0 20px", marginBottom: "25px", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={() => handleAuth('login')} 
              disabled={isAuthLoading}
              style={{ 
                flex: 1, height: "50px", borderRadius: "25px", border: "none", 
                background: "#ff758c", color: "white", fontWeight: "600", 
                cursor: isAuthLoading ? "wait" : "pointer", opacity: isAuthLoading ? 0.7 : 1 
              }}
            >
              {isAuthLoading ? "..." : "Войти"}
            </button>
            <button 
              onClick={() => handleAuth('signup')} 
              disabled={isAuthLoading}
              style={{ 
                flex: 1, height: "50px", borderRadius: "25px", border: "2px solid #fff0f5", 
                background: "none", color: "#ff758c", fontWeight: "600", 
                cursor: isAuthLoading ? "wait" : "pointer", opacity: isAuthLoading ? 0.7 : 1 
              }}
            >
              {isAuthLoading ? "..." : "Создать"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", width: "100vw", position: "fixed", top: 0, left: 0, backgroundColor: "#fff5f8", fontFamily: "'Fredoka', sans-serif", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&display=swap');
        
        body, html { 
          margin: 0; 
          padding: 0; 
          width: 100%; 
          height: 100%; 
          overflow: hidden; 
          overscroll-behavior: none; 
          touch-action: none; 
          -webkit-user-select: none;
          user-select: none;
        }

        @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        input:focus { outline: none; }
        
        .chat-container::-webkit-scrollbar { display: none; }
        .chat-container { 
          -ms-overflow-style: none; 
          scrollbar-width: none; 
          overflow-y: auto; 
          -webkit-overflow-scrolling: touch; 
          overscroll-behavior-y: contain; 
          touch-action: pan-y; 
        }
        
        .action-button {
          border: none;
          border-radius: 50%;
          width: 34px; 
          height: 34px; 
          display: flex;
          align-items: center; 
          justify-content: center; 
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          font-size: 16px; 
          padding: 0;
          margin: 0;
          line-height: 1;
          box-sizing: border-box;
        }
        .action-button:hover:not(:disabled) { transform: scale(1.05); }
        .action-button:active:not(:disabled) { transform: scale(0.95); }
        .action-button:disabled { opacity: 0.6; cursor: wait; }
      `}</style>

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'hidden', opacity: 0.1, fontSize: '4rem', userSelect: 'none' }}>
        <span style={{ position: 'absolute', top: '5%', left: '8%', transform: 'rotate(-15deg)' }}>🧸</span>
        <span style={{ position: 'absolute', top: '15%', right: '12%', transform: 'rotate(20deg)' }}>🎈</span>
        <span style={{ position: 'absolute', bottom: '25%', right: '5%', transform: 'rotate(5deg)' }}>🍭</span>
      </div>

      <div style={{ maxWidth: "700px", margin: "0 auto", height: "100%", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, backgroundColor: "rgba(255, 255, 255, 0.4)" }}>
        
        <div style={{ flex: "0 0 auto", padding: "15px 20px", background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255, 117, 140, 0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "40px" }}></div>
          <h1 style={{ margin: 0, fontSize: "2.2rem", fontWeight: "600", background: "linear-gradient(45deg, #ff758c 0%, #ff7eb3 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LizAlis</h1>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "1px solid #ff758c", color: "#ff758c", borderRadius: "15px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" }}>Выйти</button>
        </div>

        <div className="chat-container" style={{ flex: "1 1 auto", padding: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
          
          {chatHistory.map((msg) => (
            <div key={msg.id} style={{ alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", maxWidth: "85%", animation: "slideIn 0.3s ease-out", position: 'relative' }}>
              {msg.sender === "user" ? (
                <div style={{ background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", color: "#d81b60", padding: "12px 20px", borderRadius: "20px 20px 0 20px", fontSize: "18px", fontWeight: "500", boxShadow: "0 2px 8px rgba(255, 154, 158, 0.3)", WebkitUserSelect: "text", userSelect: "text" }}>
                  {msg.text}
                </div>
              ) : msg.type === "result" ? (
                <div style={{ background: "#ffffff", padding: "20px", paddingRight: "85px", borderRadius: "20px 20px 20px 0", color: "#333", boxShadow: "0 4px 15px rgba(0,0,0,0.06)", minWidth: "250px", position: "relative", WebkitUserSelect: "text", userSelect: "text" }}>
                  
                  <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' }}>
                    <button 
                      className="action-button" 
                      onClick={() => playAudio(msg.result.word, msg.id)}
                      disabled={playingAudioId === msg.id}
                      style={{ background: '#e3f2fd', color: '#1976d2' }}
                      title="Послушать">
                      {playingAudioId === msg.id ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> : "🔊"}
                    </button>

                    <button 
                      className="action-button" 
                      onClick={() => msg.result.generatedImageUrl ? setModalImage(msg.result.generatedImageUrl) : handleGenerateImage(msg.result.gif_query || msg.result.word, msg.id)}
                      disabled={!!drawingMessageId || msg.result.transcription === "no-no"} 
                      style={{ background: msg.result.generatedImageUrl ? '#e8f5e9' : '#fce4ec', color: msg.result.generatedImageUrl ? '#388e3c' : '#d81b60' }}
                      title={msg.result.generatedImageUrl ? "Показать картинку" : "Найти картинку"}>
                      {drawingMessageId === msg.id ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> : (msg.result.generatedImageUrl ? '🖼️' : '🎨')}
                    </button>
                  </div>

                  <h2 style={{ margin: "0 0 5px 0", fontSize: "24px", color: "#333", fontWeight: "600", lineHeight: "1.2" }}>{msg.result.word}</h2>
                  <p style={{ margin: "0 0 15px 0", fontSize: "16px", color: "#888", fontStyle: "italic" }}>/{msg.result.transcription}/</p>
                  <div style={{ background: "#fff0f5", padding: "12px 15px", borderRadius: "12px", marginBottom: "15px" }}>
                    <p style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "#d81b60", lineHeight: "1.3" }}>{msg.result.translation}</p>
                  </div>
                  
                  {msg.result.transcription !== "no-no" && (
                    <div style={{ fontSize: "16px", color: "#555", lineHeight: "1.4" }}>
                      <p style={{ margin: "0 0 8px 0" }}>• {msg.result.examples[0]}</p>
                      <p style={{ margin: 0 }}>• {msg.result.examples[1]}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "#ffffff", color: "#333", padding: "12px 20px", borderRadius: "20px 20px 20px 0", fontSize: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", WebkitUserSelect: "text", userSelect: "text" }}>
                  {msg.text}
                </div>
              )}
            </div>
          ))}

          {isProcessing && <div style={{ alignSelf: "flex-start" }}><div style={{ background: "#fff3e0", color: "#e65100", padding: "10px 20px", borderRadius: "15px", animation: "pulse 1.5s infinite" }}>Распознаю... 🎧</div></div>}
          {isTranslating && <div style={{ alignSelf: "flex-start" }}><div style={{ background: "#f3e5f5", color: "#6a1b9a", padding: "10px 20px", borderRadius: "15px", animation: "pulse 1.5s infinite" }}>Перевожу... 🧠</div></div>}

          <div ref={messagesEndRef} style={{ height: "1px" }} />
        </div>

        <div style={{ flex: "0 0 auto", padding: "15px 20px 25px 20px", background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(10px)", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: "10px", alignItems: "center" }}>
          <input value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMainButtonClick()} placeholder="Напиши слово или фразу..." disabled={isProcessing || isTranslating || !!drawingMessageId} style={{ fontFamily: "'Fredoka', sans-serif", height: "55px", padding: "0 20px", fontSize: "18px", flex: "1", color: "#333", backgroundColor: "#f5f5f5", border: "1px solid transparent", borderRadius: "28px", boxSizing: "border-box" }} />
          
          <button onClick={handleMainButtonClick} disabled={isProcessing || isTranslating || !!drawingMessageId} style={{ height: "55px", width: "55px", flexShrink: 0, cursor: "pointer", background: word.trim() ? "#2196F3" : (isRecording ? "#f44336" : "#ff4081"), color: "white", borderRadius: isRecording && !word.trim() ? "15px" : "50%", border: "none", fontSize: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", transition: "all 0.3s ease", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, margin: 0, lineHeight: 1, boxSizing: "border-box" }}>
            {word.trim() ? "🚀" : (isRecording ? "🛑" : "🎤")}
          </button>
        </div>
      </div>

      {modalImage && (
        <div onClick={() => setModalImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.3s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', background: 'white', padding: '15px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxWidth: '280px', width: '90%', display: 'flex', flexDirection: 'column' }}>
            <img src={modalImage} alt="Generated cartoon" style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain', borderRadius: '15px', display: 'block' }} />
            
            <button onClick={() => setModalImage(null)} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '32px', height: '32px', borderRadius: '50%', background: '#f44336', color: 'white', border: '3px solid white', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', padding: 0, margin: 0, lineHeight: 1, flexShrink: 0, boxSizing: "border-box" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}