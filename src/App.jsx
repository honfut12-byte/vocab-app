import { useState } from "react";

export default function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);

  const analyzeWord = async () => {
    // Временно оставляем старый бэкенд, пока не перейдем к БД
    const res = await fetch("https://vocab-app-m8ti.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });

    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center" }}>
      {/* Пункт 3: Новое название */}
      <h1>📚 LizAli</h1>

      {/* Пункт 2: Flexbox контейнер для правильных отступов на мобильных */}
      <div style={{ 
        display: "flex", 
        gap: "10px", 
        flexWrap: "wrap", 
        justifyContent: "center",
        alignItems: "center"
      }}>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Say or type a word"
          style={{ padding: 10, fontSize: 18, flex: "1", minWidth: "200px", maxWidth: "300px" }}
        />

        {/* Пункт 1: Переименованная кнопка */}
        <button onClick={analyzeWord} style={{ padding: 10, fontSize: 18, cursor: "pointer" }}>
          Translate!
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 30, textAlign: "left", display: "inline-block" }}>
          <h2>{result.word}</h2>
          <p><b>Transcription:</b> {result.transcription}</p>
          <p><b>Translation:</b> {result.translation}</p>
          <p>• {result.examples[0]}</p>
          <p>• {result.examples[1]}</p>
        </div>
      )}
    </div>
  );
}