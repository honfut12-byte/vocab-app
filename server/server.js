const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 ключи
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.post("/analyze-word", async (req, res) => {
  const { word, userId } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // дешевый и норм для текста
      messages: [
        {
          role: "system",
          content: `You are a dictionary assistant. Return JSON only with:
word, translation, transcription, part_of_speech, level, examples (2 simple sentences)`
        },
        {
          role: "user",
          content: word,
        },
      ],
      temperature: 0.3,
    });

    const data = JSON.parse(completion.choices[0].message.content);

    // 💾 сохраняем в Supabase
    await supabase.from("words").insert({
      user_id: userId,
      word: data.word,
      translation: data.translation,
      transcription: data.transcription,
      part_of_speech: data.part_of_speech,
      level: data.level,
      examples: data.examples,
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(3001, () => console.log("Server running on port 3001"));
