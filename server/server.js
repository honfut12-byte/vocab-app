import express from "express"
import cors from "cors"
import OpenAI from "openai"
import multer from "multer"
import fs from "fs"
import os from "os"

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ dest: os.tmpdir() })

if (!process.env.OPENAI_API_KEY) {
  console.error("Critical Error: OPENAI_API_KEY is not defined in environment variables.")
  process.exit(1)
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// --- 1. АНАЛИЗАТОР-ЛЕКСИКОГРАФ (EN <-> RU) ---
app.post("/analyze", async (req, res) => {
  const { word } = req.body
  console.log("--- Analyzing phrase:", word);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional lexicographer for a children's English-Russian dictionary.

CORE RULES:
1. SYMMETRY: English "word" and Russian "translation" MUST match in part of speech. (Noun <-> Noun, Verb <-> Verb, etc).
2. VERBS: Always translate verbs in infinitive form (e.g., "to go" <-> "идти/ходить").
3. IDIOMS: Translate idioms by their figurative meaning (e.g., "break the ice" -> "растопить лед (начать общение)").
4. TRANSCRIPTION: Provide phonetic transcription for the English "word" field ONLY. NEVER transcribe Russian input.
5. GIF_QUERY: Extract 1-2 English keywords from the phrase for a GIF search (e.g., for "I want to eat", return "eat" or "hungry").
6. SAFETY: Daily activities (cinema, shopping, home) are 100% safe. Reject ONLY explicit profanity.

Response ONLY in JSON:
{
  "word": "English text",
  "translation": "Russian text",
  "transcription": "English phonetics",
  "examples": ["2 simple English sentences"],
  "gif_query": "Keywords for GIF search"
}
`
        },
        { role: "user", content: word }
      ],
      temperature: 0.2
    })

    const result = JSON.parse(completion.choices[0].message.content)
    res.json(result)
  } catch (err) {
    console.error("GPT Error:", err)
    res.status(500).json({ error: "Analysis failed" })
  }
})

// --- 2. ПОИСК ГИФОК (KLiPy v2) ---
app.post("/generate-image", async (req, res) => {
  const { word } = req.body
  console.log("--- GIF search for:", word)

  try {
    const klipyApiKey = process.env.KLIPY_API_KEY
    if (!klipyApiKey) return res.status(500).json({ error: "Missing KLIPY_API_KEY" })

    // Используем v2 для совместимости и contentfilter для безопасности
    const response = await fetch(`https://api.klipy.co/v2/search?q=${encodeURIComponent(word)}&key=${klipyApiKey}&limit=1&contentfilter=high`)
    const data = await response.json()

    if (data?.results?.length > 0) {
      const res0 = data.results[0]
      // Проверяем наличие URL в разных форматах
      const imageUrl = res0.media_formats?.tinygif?.url || 
                       res0.media_formats?.gif?.url || 
                       res0.url;
      
      if (imageUrl) return res.json({ imageUrl });
    }
    res.status(404).json({ error: "No GIF found" })
  } catch (error) {
    console.error("GIF Error:", error)
    res.status(500).json({ error: "GIF service error" })
  }
})

// --- 3. ОЗВУЧКА (OpenAI TTS) ---
app.post("/speak", async (req, res) => {
  const { text } = req.body
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text
    })
    const buffer = Buffer.from(await mp3.arrayBuffer())
    res.set({ 'Content-Type': 'audio/mpeg' }).send(buffer)
  } catch (error) {
    res.status(500).json({ error: "TTS failed" })
  }
})

// --- 4. ГОЛОСОВОЙ ВВОД (Whisper) ---
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  let filePathWithExt = null
  try {
    if (!req.file) return res.status(400).send("No audio")
    filePathWithExt = req.file.path + ".webm"
    fs.renameSync(req.file.path, filePathWithExt)

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePathWithExt),
      model: "whisper-1"
    })

    let text = transcription.text
    if (req.body.mode === "spell" && text) {
      const sc = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a spelling assistant. Return ONLY the English word or phrase recognized, stripped of any punctuation or meta-talk." },
          { role: "user", content: text }
        ],
        temperature: 0.1
      })
      text = sc.choices[0].message.content.trim()
    }

    res.json({ text })
  } catch (error) {
    console.error("Transcription Error:", error)
    res.status(500).send("Transcription failed")
  } finally {
    if (filePathWithExt && fs.existsSync(filePathWithExt)) {
      try { fs.unlinkSync(filePathWithExt) } catch (e) { console.error("FS Error:", e) }
    }
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`LizAlis Server is active on port ${PORT}`))