const OLLAMA_URL = "http://localhost:11434/api/chat";

const menuForModel = menu.map((item) => ({ id: item.id, name: item.name }));
const menuForModelOnlyAvailable = menu
  .filter((item) => item.available)
  .map((item) => ({ id: item.id, name: item.name }));

let message = [];
let messageAdvice = [];

const orderPrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(menuForModel)}
Pour chaque produit commandé par le client, renvoie son id (celui de la carte) et sa quantité. Si tu détecte un prénom tu le rajoute a "customer" si il y en a pas tu laisse vide.`;

const advicePrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(menuForModelOnlyAvailable)}. Le vendeur va te donner l'envie du client, par exemple (le client aimerais une pâtisserie sucré salé). Tu va donc lui conseiller un carrot cake. Tu va me renvoyer au plus deux id de produit avec une phrase pour expliquer ton choix que tu va mettre dans "explanationSentence". Ce n'est pas une commande que tu fais ici mais juste un conseils.`;

async function askModel(messages, format) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5:4b",
      think: false,
      stream: false,
      format: format,
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
  aiOrderMessage.classList.remove("is-error");
  try {
    let errorMsg = [];
    const value = aiOrderInput.value;
    aiOrderBtn.disabled = true;
    aiOrderMessage.textContent = "Qwen prend la commande…";
    message.push({ role: "system", content: orderPrompt });
    message.push({ role: "user", content: value });
    const response = await askModel(message, {
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
            required: ["id", "quantity"],
          },
        },
        customer: { type: "string" },
      },
      required: ["lines", "customer"],
    });

    if (response.customer) {
      order.customer = response.customer;
    }
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
  } catch (e) {
    aiOrderMessage.textContent =
      "L'IA ne répond pas : prends la commande à la main";
    aiOrderMessage.classList.add("is-error");
    console.error(e);
  }
  renderTicket();

  aiOrderBtn.disabled = false;
  aiOrderInput.value = "";
  message = [];
}

const aiAdviceForm = document.querySelector("#ai-advice-form");
aiAdviceForm.addEventListener("submit", handleSubmitAdviceForm);
const aiAdviceInput = document.querySelector("#ai-advice-input");
const aiAdviceMessage = document.querySelector("#ai-advice-message");
const aiAdviceBtn = document.querySelector("#ai-advice-btn");

async function handleSubmitAdviceForm(e) {
  e.preventDefault();
  const activeCategorie = document.querySelector(".is-active");
  document.querySelectorAll(".product").forEach((product) => {
    product.classList.remove("is-suggested");
  });
  suggestedIds = [];
  const value = aiAdviceInput.value;
  try {
    aiAdviceBtn.disabled = true;
    messageAdvice.push({ role: "system", content: advicePrompt });
    messageAdvice.push({ role: "user", content: value });
    const response = await askModel(messageAdvice, {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: { type: "integer" },
        },
        explanationSentence: { type: "string" },
      },
      required: ["lines", "explanationSentence"],
    });
    console.log(response);

    response.lines.slice(0, 2).forEach((line) => {
      const product = menu.find((item) => item.id === line);
      if (!product) {
        return;
      }
      if (!product.available) {
        return;
      }
      suggestedIds.push(product.id);
    });
    aiAdviceMessage.textContent = response.explanationSentence;
    renderMenu(activeCategorie.value);
  } catch (e) {
    aiAdviceMessage.textContent =
      "L'IA ne répond pas : prends la commande à la main";
    console.error(e);
  }
  aiAdviceBtn.disabled = false;
  aiAdviceInput.value = "";
  messageAdvice = [];
}
