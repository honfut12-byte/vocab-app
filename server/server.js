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

User may input a word or a short phrase in Russian or English.

ALWAYS:
1. Detect the language.
2. Determine the TARGET ENGLISH word or phrase (if input is Russian, translate to English; if input is English, keep it English).
3. Provide transcription for the ENGLISH text.
4. Give the Russian translation of the text.
5. Provide 2 simple example sentences in ENGLISH using this text.

Respond ONLY in JSON format:

{
  "word": "english text",
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

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  let filePathWithExt = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const tempFilePath = req.file.path;
    const mimeType = req.file.mimetype || "";
    
    // Динамическое расширение
    let ext = ".webm"; 
    if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) {
      ext = ".m4a"; 
    } else if (mimeType.includes("ogg")) {
      ext = ".ogg"; 
    } else if (mimeType.includes("wav")) {
      ext = ".wav"; 
    }

    filePathWithExt = tempFilePath + ext;
    fs.renameSync(tempFilePath, filePathWithExt);

    const audioFile = fs.createReadStream(filePathWithExt);
    const { mode } = req.body;

    // Отправляем в Whisper без жесткого указания языка (АВТООПРЕДЕЛЕНИЕ)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1"
    });

    let recognizedText = transcription.text;

    if (mode === "spell" && recognizedText) {
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
      });
      recognizedText = spellCheck.choices[0].message.content.trim();
    }

    if (fs.existsSync(filePathWithExt)) {
      fs.unlinkSync(filePathWithExt);
    }

    res.json({ text: recognizedText || "" });

  } catch (error) {
    console.error("Ошибка при работе с аудио:", error);
    
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (filePathWithExt && fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt);
    
    res.status(500).json({ error: "Transcription failed" });
  }
})

app.listen(3001, () => console.log("Server running on port 3001"))