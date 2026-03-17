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
You are a vocabulary teacher for kids. User input is a word, a short phrase, or a full sentence.

CRITICAL SAFETY RULE: If the input contains profanity, adult content, violence, insults, or inappropriate words, you MUST reject it.
If rejected, respond EXACTLY with this JSON:
{
  "word": "Oops! 🙈",
  "transcription": "no-no",
  "translation": "Это слово не подходит для нашего словарика",
  "examples": ["Let's learn something else!", "Давай выучим другое слово!"]
}

CRITICAL TRANSLATION RULE:
- The "word" field MUST ALWAYS BE IN ENGLISH. If the user speaks English, keep it exactly as they said it. If Russian, translate the ENTIRE phrase to English.
- The "translation" field MUST ALWAYS BE IN RUSSIAN. If the user speaks Russian, keep it exactly as they said it. If English, translate the ENTIRE phrase to Russian.
- Provide transcription (without brackets) for the English text, and 2 simple English example sentences.
Respond ONLY in JSON.
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

// --- ОБНОВЛЕННЫЙ МАРШРУТ: ТЕПЕРЬ ИЩЕТ ГИФКИ ВМЕСТО DALL-E ---
app.post("/generate-image", async (req, res) => {
  const { word } = req.body
  if (!word) return res.status(400).json({ error: "No word provided" });

  try {
    const giphyApiKey = process.env.GIPHY_API_KEY;
    if (!giphyApiKey) {
      return res.status(500).json({ error: "GIPHY API key is missing on the server" });
    }

    // Идем в GIPHY: ищем английское слово, берем 1 результат, строго детский рейтинг (rating=g)
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(word)}&limit=1&rating=g&lang=en`);
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      // Берем оптимизированную по размеру гифку, чтобы телефон не тормозил
      const imageUrl = data.data[0].images.downsized.url; 
      res.json({ imageUrl }); 
    } else {
      res.status(404).json({ error: "No GIF found for this word" });
    }
  } catch (error) {
    console.error("GIPHY error:", error);
    res.status(500).json({ error: "GIF fetch failed" });
  }
});

app.post("/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", 
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