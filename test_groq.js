require('dotenv').config();
const { generateText } = require('ai');
const { createGroq } = require('@ai-sdk/groq');

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

async function run() {
  const models = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  for (const m of models) {
    try {
      const { text } = await generateText({
        model: groq(m), 
        prompt: 'Say hi!',
      });
      console.log(`Success with ${m}:`, text);
    } catch(e) {
      console.log(`Error with ${m}:`, e.message);
    }
  }
}
run();
