import express from "express"
import cors from "cors"
import OpenAI from "openai"

const app = express()
app.use(cors())
app.use(express.json())

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

app.listen(3001, () => console.log("Server running"))
