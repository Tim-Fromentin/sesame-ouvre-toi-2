const OLLAMA_URL = "http://localhost:11434/api/chat";

const menuForModel = menu.map((item) => ({ id: item.id, name: item.name }));

const orderPrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(menuForModel)}
Pour chaque produit commandé par le client, renvoie son id (celui de la carte) et sa quantité.`;

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
