import { useState } from "react";

export default function App() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);

  const analyzeWord = async () => {
    const res = await fetch("https://vocab-app-m8ti.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });

    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>📚 Word Trainer</h1>

      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Say or type a word"
        style={{ padding: 10, fontSize: 18 }}
      />

      <button onClick={analyzeWord} style={{ marginLeft: 10, padding: 10 }}>
        Analyze
      </button>

      {result && (
        <div style={{ marginTop: 30 }}>
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
