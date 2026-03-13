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
    formData.append("mode", isSpellingMode ? "spell" : "normal");

    try {
      const res = await fetch("https://vocab-app-m8ti.onrender.com/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      setRecognizedWord(data.text);
      setNeedsConfirmation(true);
      setIsSpellingMode(false);
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
    setIsSpellingMode(true);
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center", paddingBottom: "100px" }}>
      <h1>📚 LizAli</h1>

      {/* Экран подтверждения слова */}
      {needsConfirmation ? (
        <div style={{ background: "#f0f8ff", padding: "20px", borderRadius: "10px", display: "