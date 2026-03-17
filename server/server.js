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

// --- 1. АНАЛИЗАТОР И ПЕРЕВОДЧИК ---
app.post("/analyze", async (req, res) => {
  const { word } = req.body
  console.log("--- Analyze request:", word);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a friendly kid's teacher. 
          SAFETY: Only reject explicit profanity/sexual content. Cinema, shopping, playing, daily life are 100% SAFE.
          If harmful, return: {"word": "Oops! 🙈", "gif_query": "no", "transcription": "no-no", "translation": "Это не для детей", "examples": ["Try another word!"]}.
          
          If safe, return JSON:
          {
            "word": "Full English translation of input",
            "translation": "Full Russian translation of input",
            "transcription": "Phonetic transcription",
            "examples": ["2 simple English sentences"],
            "gif_query": "1-2 main English keywords for GIF search"
          }`
        },
        { role: "user", content: word }
      ],
      temperature: 0.3
    })

    res.json(JSON.parse(completion.choices[0].message.content))
  } catch (err) {
    console.error("Analysis Error:", err)
    res.status(500).json({ error: "Analysis failed" })
  }
})

// --- 2. ПОИСК ГИФОК (KLiPy) ---
app.post("/generate-image", async (req, res) => {
  const { word } = req.body
  console.log("--- GIF search for:", word)

  try {
    const klipyApiKey = process.env.KLIPY_API_KEY
    if (!klipyApiKey) return res.status(500).json({ error: "Missing API Key" })

    const response = await fetch(`https://api.klipy.co/v2/search?q=${encodeURIComponent(word)}&key=${klipyApiKey}&limit=1&contentfilter=high`)
    const data = await response.json()

    if (data?.results?.length > 0) {
      const res0 = data.results[0]
      const imageUrl = res0.media_formats?.tinygif?.url || res0.media_formats?.gif?.url || res0.url
      if (imageUrl) return res.json({ imageUrl })
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
    console.error("TTS Error:", error)
    res.status(500).json({ error: "Speech failed" })
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
    // Опциональный Spell-check для режима "по буквам"
    if (req.body.mode === "spell" && text) {
      const spellCheck = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Return ONLY the single English word." }, { role: "user", content: text }],
        temperature: 0.1
      })
      text = spellCheck.choices[0].message.content.trim()
    }

    if (fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt)
    res.json({ text })
  } catch (error) {
    if (filePathWithExt && fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt)
    console.error("Whisper Error:", error)
    res.status(500).send("Transcription failed")
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`LizAlis Server started on port ${PORT}`))