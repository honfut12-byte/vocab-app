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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// --- 1. УМНЫЙ СЛОВАРЬ (АНАЛИЗ И ПЕРЕВОД) ---
app.post("/analyze", async (req, res) => {
  const { word } = req.body
  console.log("--- Analyzing:", word);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional lexicographer for a children's English-Russian dictionary. 

DICTIONARY RULES:
1. INFINTIVE FORM: Always translate verbs in their infinitive form (e.g., "to go" -> "идти/ходить", not "иди").
2. IDIOMS: Translate idioms by their figurative meaning, not literally (e.g., "break the ice" -> "растопить лед (начать общение)").
3. TRANSCRIPTION BUG FIX: The "transcription" field MUST be the phonetic transcription of the ENGLISH "word" field ONLY. NEVER transcribe Russian input.
4. SIMPLE MEANINGS: Choose the most common and child-friendly meaning.
5. SAFETY: Only reject explicit profanity/harmful content. Daily life (cinema, love, shopping) is 100% safe.

EXAMPLES:
- Input: "пошли в кино" -> {"word": "to go to the cinema", "translation": "идти в кино", "transcription": "tuː ɡoʊ tuː ðə ˈsɪnəmə", ...}
- Input: "break the ice" -> {"word": "to break the ice", "translation": "растопить лед (начать общение)", "transcription": "tuː breɪk ðiː aɪs", ...}

Response MUST be ONLY JSON:
{
  "word": "English translation/word",
  "translation": "Russian dictionary-style translation",
  "transcription": "English phonetics ONLY",
  "examples": ["2 simple EN sentences"],
  "gif_query": "1-2 keywords for GIF"
}
`
        },
        { role: "user", content: word }
      ],
      temperature: 0.2 // Снизили температуру для большей точности
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
  try {
    const klipyApiKey = process.env.KLIPY_API_KEY
    if (!klipyApiKey) return res.status(500).json({ error: "No Key" })

    const response = await fetch(`https://api.klipy.co/v2/search?q=${encodeURIComponent(word)}&key=${klipyApiKey}&limit=1&contentfilter=high`)
    const data = await response.json()

    if (data?.results?.length > 0) {
      const res0 = data.results[0]
      const imageUrl = res0.media_formats?.tinygif?.url || res0.media_formats?.gif?.url || res0.url
      if (imageUrl) return res.json({ imageUrl })
    }
    res.status(404).json({ error: "Not found" })
  } catch (error) {
    res.status(500).json({ error: "GIF service error" })
  }
})

// --- 3. ОЗВУЧКА ---
app.post("/speak", async (req, res) => {
  const { text } = req.body
  try {
    const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: "nova", input: text })
    const buffer = Buffer.from(await mp3.arrayBuffer())
    res.set({ 'Content-Type': 'audio/mpeg' }).send(buffer)
  } catch (error) {
    res.status(500).json({ error: "Speech failed" })
  }
})

// --- 4. ГОЛОСОВОЙ ВВОД ---
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  let filePathWithExt = null
  try {
    if (!req.file) return res.status(400).send("No audio")
    filePathWithExt = req.file.path + ".webm"
    fs.renameSync(req.file.path, filePathWithExt)
    const transcription = await openai.audio.transcriptions.create({ file: fs.createReadStream(filePathWithExt), model: "whisper-1" })
    let text = transcription.text
    if (req.body.mode === "spell" && text) {
      const sc = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Return ONLY the English word." }, { role: "user", content: text }], temperature: 0.1 })
      text = sc.choices[0].message.content.trim()
    }
    if (fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt)
    res.json({ text })
  } catch (error) {
    res.status(500).send("Whisper error")
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`LizAlis Lexicographer Server running on port ${PORT}`))