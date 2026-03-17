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

// 1. АНАЛИЗ СЛОВА И ПЕРЕВОД (С детским фильтром)
app.post("/analyze", async (req, res) => {
  const { word } = req.body

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a vocabulary teacher for kids. User input is a word or short phrase.

CRITICAL SAFETY RULE: If the input contains profanity, adult content (e.g., "секс", "порно"), violence, insults, or any inappropriate words for children in any language, you MUST reject it. 
If rejected, respond EXACTLY with this JSON and nothing else:
{
  "word": "Oops! 🙈",
  "transcription": "no-no",
  "translation": "Это слово не подходит для нашего словарика",
  "examples": ["Let's learn something else!", "Давай выучим другое слово!"]
}

If the word is safe:
Detect language (RU/EN). ALWAYS provide target ENGLISH text, its phonetic transcription (without brackets, e.g., 'kæt'), Russian translation, and 2 simple English example sentences.
Respond ONLY in JSON format.
`
        },
        { role: "user", content: word }
      ],
      temperature: 0.3
    })

    const text = completion.choices[0].message.content
    res.json(JSON.parse(text))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "AI error" })
  }
})

// 2. ГЕНЕРАЦИЯ КАРТИНКИ (Экономный DALL-E 2)
app.post("/generate-image", async (req, res) => {
  const { word } = req.body
  if (!word) return res.status(400).json({ error: "No word provided" });

  try {
    const response = await openai.images.generate({
      model: "dall-e-2", 
      prompt: `A cute colorful friendly cartoon illustration for children of: ${word}. Simple shapes, white background, kids style.`,
      n: 1,
      size: "256x256", 
      response_format: "url"
    });

    const imageUrl = response.data[0].url;
    res.json({ imageUrl }); 

  } catch (error) {
    console.error("DALL-E error:", error);
    res.status(500).json({ error: "Image generation failed" });
  }
});

// 3. НОВЫЙ МАРШРУТ: ОЗВУЧКА СЛОВА (OpenAI TTS)
app.post("/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // nova - красивый, мягкий женский голос
      input: text,
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({'Content-Type': 'audio/mpeg'});
    res.send(buffer);
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ error: "TTS failed" });
  }
});

// 4. РАСПОЗНАВАНИЕ ГОЛОСА (Whisper)
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  let filePathWithExt = null;
  try {
    if (!req.file) return res.status(400).json({ error: "No audio" });
    const tempFilePath = req.file.path;
    filePathWithExt = tempFilePath + ".webm";
    fs.renameSync(tempFilePath, filePathWithExt);
    const audioFile = fs.createReadStream(filePathWithExt);
    const { mode } = req.body;

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1"
    });

    let recognizedText = transcription.text;
    if (mode === "spell" && recognizedText) {
        const spellCheck = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{role: "system", content: "Combine phonetics/letters into one English word. Return ONLY word."}, {role: "user", content: recognizedText}],
          temperature: 0.1
        });
        recognizedText = spellCheck.choices[0].message.content.trim();
    }
    if (fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt);
    res.json({ text: recognizedText || "" });
  } catch (error) {
    if (filePathWithExt && fs.existsSync(filePathWithExt)) fs.unlinkSync(filePathWithExt);
    res.status(500).json({ error: "Failed" });
  }
})

app.listen(3001, () => console.log("Server running on port 3001"))