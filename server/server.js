import express from "express"
import cors from "cors"
import OpenAI from "openai"
import multer from "multer"
import fs from "fs"
import os from "os"

const app = express()
app.use(cors())
app.use(express.json())

// Настройка загрузки временных аудиофайлов
const upload = multer({ dest: os.tmpdir() })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// 1. АНАЛИЗ СЛОВА / ФРАЗЫ (GPT-4o-mini)
app.post("/analyze", async (req, res) => {
  const { word } = req.body

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a vocabulary teacher for kids. User input is a word, a short phrase, or a full sentence.

CRITICAL SAFETY RULE: If the input contains profanity, adult content, violence, insults, or any inappropriate words, you MUST reject it.
If rejected, respond EXACTLY with this JSON:
{
  "word": "Oops! 🙈",
  "gif_query": "no",
  "transcription": "no-no",
  "translation": "Это слово не подходит для нашего словарика",
  "examples": ["Let's learn something else!", "Давай выучим другое слово!"]
}

CRITICAL TRANSLATION RULE:
- The "word" field MUST ALWAYS BE IN ENGLISH.
- The "translation" field MUST ALWAYS BE IN RUSSIAN.
- Provide transcription (without brackets) for the English text, and 2 simple English example sentences.
- ADD a "gif_query" field: extract 1-2 main English keywords optimized for GIF search engines (e.g., for "I want to buy a computer", return "computer").
Respond ONLY in JSON.
`
        },
        { role: "user", content: word }
      ],
      temperature: 0.3
    })

    const resultText = completion.choices[0].message.content
    res.json(JSON.parse(resultText))
  } catch (err) {
    console.error("GPT Error:", err)
    res.status(500).json({ error: "AI error" })
  }
})

// 2. ПОИСК ГИФОК (KLiPy API с защитой от ошибок)
app.post("/generate-image", async (req, res) => {
  const { word } = req.body
  console.log("--- GIF search for:", word)

  try {
    const klipyApiKey = process.env.KLIPY_API_KEY
    if (!klipyApiKey) {
      console.error("KLIPY_API_KEY is missing!")
      return res.status(500).json({ error: "Server config error" })
    }

    // Запрос к KLiPy (совместимость с Tenor v2)
    const response = await fetch(`https://api.klipy.co/v2/search?q=${encodeURIComponent(word)}&key=${klipyApiKey}&limit=1&contentfilter=high`)
    const data = await response.json()

    if (data && data.results && data.results.length > 0) {
      const res0 = data.results[0]
      let imageUrl = null

      // Ищем URL в разных форматах (защищенный поиск)
      if (res0.media_formats) {
        if (res0.media_formats.tinygif && res0.media_formats.tinygif.url) {
          imageUrl = res0.media_formats.tinygif.url
        } else if (res0.media_formats.gif && res0.media_formats.gif.url) {
          imageUrl = res0.media_formats.gif.url
        }
      }

      // Запасной вариант - корневой URL
      if (!imageUrl && res0.url) {
        imageUrl = res0.url
      }

      if (imageUrl) {
        console.log("Success! Found URL:", imageUrl)
        return res.json({ imageUrl })
      }
    }

    console.warn("GIF not found in KLiPy for:", word)
    res.status(404).json({ error: "Not found" })

  } catch (error) {
    console.error("KLiPy Route Error:", error)
    res.status(500).json({ error: "Network error" })
  }
})

// 3. ОЗВУЧКА (OpenAI TTS)
app.post("/speak", async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: "No text" })

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // Мягкий женский голос
      input: text,
    })
    
    const buffer = Buffer.from(await mp3.arrayBuffer())
    res.set({'Content-Type': 'audio/mpeg'})
    res.send(buffer)
  } catch (error) {
    console.error("TTS Error:", error)
    res.status(500).json({ error: "TTS failed" })
  }
})

// 4. РАСПОЗНАВАНИЕ ГОЛОСА (Whisper-1)
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  let filePathWithExt = null
  try {
    if (!req.file) return res.status(400).json({ error: "No audio" })
    
    const tempFilePath = req.file.path
    filePathWithExt = tempFilePath + ".webm"
    fs.renameSync(tempFilePath, filePathWithExt)
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePathWithExt),
      model: "whisper-1"
    })

    let recognizedText = transcription.text
    
    // Если включен режим Spell, исправляем опечатки через GPT
    if (req.body.mode === "spell" && recognizedText) {
        const spellCheck = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{role: "system", content: "Return ONLY the corrected English word."}, {role: "user", content: recognizedText}],
          temperature: 0.1
        })
        recognizedText = spellCheck.choices[0].message.content.trim()
    }
    
    if (fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt)
    res.json({ text: recognizedText || "" })
  } catch (error) {
    if (filePathWithExt && fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt)
    console.error("Whisper Error:", error)
    res.status(500).json({ error: "Failed" })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))