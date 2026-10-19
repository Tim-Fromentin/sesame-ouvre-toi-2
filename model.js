const OLLAMA_URL = "http://localhost:11434/api/chat";

async function askModel(messages) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5:4b",
      think: false,
      stream: false,
      messages: messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error);
  }
  return data.message.content;
}
