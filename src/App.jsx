import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");

  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔐 Проверка авторизации
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
  }, []);

  // ✉ Вход по magic link
  const login = async () => {
    await supabase.auth.signInWithOtp({ email });
    alert("Проверь почту для входа ✉️");
  };

  // 🚪 Выход
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // 📚 Отправка слова на сервер
  const analyzeWord = async () => {
    if (!word) return;

    setLoading(true);
    setResult(null);

    const res = await fetch("http://localhost:3001/analyze-word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word,
        userId: user.id,
      }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  // 🔒 Если не вошёл
  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Вход</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={login}>Войти</button>
      </div>
    );
  }

  // ✅ Основной экран
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <b>Ты вошёл как:</b> {user.email}
        <button onClick={logout} style={{ marginLeft: 10 }}>
          Выйти
        </button>
      </div>

      <h2>Добавить слово</h2>

      <input
        placeholder="Скажи или введи слово"
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <button onClick={analyzeWord} disabled={loading}>
        {loading ? "Обработка..." : "Перевести"}
      </button>

      {result && (
        <div style={{ marginTop: 30 }}>
          <h3>
            {result.word} {result.transcription && `(${result.transcription})`}
          </h3>
          <p>
            <b>Перевод:</b> {result.translation}
          </p>
          <p>
            <b>Часть речи:</b> {result.part_of_speech}
          </p>

          <h4>Примеры:</h4>
          <ul>
            {result.examples?.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
