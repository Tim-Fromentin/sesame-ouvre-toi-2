const OLLAMA_URL = "http://localhost:11434/api/chat";

const menuForModel = menu.map((item) => ({ id: item.id, name: item.name }));

let message = [];

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
      format: {
        type: "object",
        properties: {
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer" },
                quantity: { type: "integer" },
              },
            },
          },
        },
      },
      messages: messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error);
  }
  return JSON.parse(data.message.content);
}

const aiOrderForm = document.querySelector("#ai-order-form");
const aiOrderInput = document.querySelector("#ai-order-input");
const aiOrderMessage = document.querySelector("#ai-order-message");
const aiOrderBtn = document.querySelector("#ai-order-button");

aiOrderForm.addEventListener("submit", handleSubmitOrderForm);
async function handleSubmitOrderForm(e) {
  e.preventDefault();
  let errorMsg = [];
  const value = aiOrderInput.value;
  aiOrderBtn.disabled = true;
  aiOrderMessage.textContent = "Qwen prend la commande…";
  message.push({ role: "system", content: orderPrompt });
  message.push({ role: "user", content: value });
  const response = await askModel(message);
  response.lines.forEach((line) => {
    const product = menu.find((item) => item.id === line.id);
    if (!product) {
      errorMsg.push(`Produit introuvable`);
      return;
    }
    if (!product.available) {
      errorMsg.push(`Produit ${product.name} indisponible`);
      return;
    }
    if (
      line.quantity < 1 ||
      line.quantity > 10 ||
      !Number.isInteger(line.quantity)
    ) {
      errorMsg.push("Quantité invalide");
      return;
    }
    for (let index = 0; index < line.quantity; index++) {
      order.add(product);
    }
  });
  aiOrderMessage.textContent = errorMsg;
  renderTicket();

  aiOrderBtn.disabled = false;
  aiOrderInput.value = "";
  message = [];
}
