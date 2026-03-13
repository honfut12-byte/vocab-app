import express from "express"
import cors from "cors"
import OpenAI from "openai"
import multer from "multer"
import fs from "fs"
import os from "os"

const app = express()
app.use(cors())
app.use(express.json())

// Настраиваем временное хранилище для аудиофайлов
const upload = multer({ dest: os.tmpdir() })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// --- СТАРЫЙ МАРШРУТ АНАЛИЗА (без изменений) ---
app.post("/analyze", async (req, res) => {
  const { word } = req.body

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a vocabulary teacher for kids.

User may input a word in Russian or English.

ALWAYS:
1. Detect the meaning
2. Convert it to the MAIN ENGLISH WORD
3. Provide transcription for the ENGLISH word
4. Give translation into Russian
5. Provide 2 simple example sentences in ENGLISH

Respond ONLY in JSON format:

{
  "word": "english word",
  "transcription": "[phonetic]",
  "translation": "russian translation",
  "examples": ["sentence 1", "sentence 2"]
}
`
        },
        { role: "user", content: word }
      ],
      temperature: 0.3
    })

    const text = completion.choices[0].message.content
    const data = JSON.parse(text)

    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "AI error" })
  }
})

// --- НОВЫЙ МАРШРУТ РАСПОЗНАВАНИЯ ГОЛОСА ---
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    // 1. Берем сохраненный аудиофайл
    const audioFile = fs.createReadStream(req.file.path)
    const { mode } = req.body // получаем режим: "normal" или "spell"

    // 2. Отправляем аудио в Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en" // Ограничиваем английским для лучшего распознавания слов
    })

    let recognizedText = transcription.text

    // 3. Магия для режима диктовки: просим GPT собрать буквы в слово
    if (mode === "spell") {
      const spellCheck = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "The user spelled an English word out loud. Combine the phonetics or letters into a single valid English word. Return ONLY the word, nothing else. No punctuation. Example: 'C A T' -> 'cat', 'be oh why' -> 'boy'." 
          },
          { role: "user", content: recognizedText }
        ],
        temperature: 0.1
      })
      recognizedText = spellCheck.choices[0].message.content.trim()
    }

    // 4. Удаляем временный файл, чтобы не засорять сервер
    fs.unlinkSync(req.file.path)

    // 5. Отправляем слово обратно на фронтенд
    res.json({ text: recognizedText })

  } catch (error) {
    console.error("Ошибка при работе с аудио:", error)
    if (req.file) fs.unlinkSync(req.file.path) // чистим файл в случае ошибки
    res.status(500).json({ error: "Transcription failed" })
  }
})

app.listen(3001, () => console.log("Server running on port 3001"))