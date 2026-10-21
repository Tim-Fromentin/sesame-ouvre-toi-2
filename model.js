const OLLAMA_URL = "http://localhost:11434/api/chat";

const menuForModel = menu.map((item) => ({ id: item.id, name: item.name }));
const availableMenuForModel = menu
  .filter((item) => item.available)
  .map((item) => ({ id: item.id, name: item.name }));

let orderMessages = [];
let adviceMessages = [];

const orderSystemPrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(menuForModel)}
Pour chaque produit commandé par le client, renvoie son id (celui de la carte) et sa quantité. Si tu détecte un prénom tu le rajoute a "customer" si il y en a pas tu laisse vide.`;

const adviceSystemPrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(availableMenuForModel)}. Le vendeur va te donner l'envie du client, par exemple (le client aimerais une pâtisserie sucré salé). Tu va donc lui conseiller un carrot cake. Tu va me renvoyer au plus deux id de produit avec une phrase pour expliquer ton choix que tu va mettre dans "explanationSentence". Ce n'est pas une commande que tu fais ici mais juste un conseils.`;

// =======================================================================

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

// =======================================================================


function addMessages(messages, systemPrompt, userContent) {
  messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userContent });
}

const aiOrderForm = document.querySelector("#ai-order-form");
const aiOrderInput = document.querySelector("#ai-order-input");
const aiOrderMessage = document.querySelector("#ai-order-message");
const aiOrderButton = document.querySelector("#ai-order-button");

aiOrderForm.addEventListener("submit", handleSubmitOrderForm);

async function handleSubmitOrderForm(event) {
  event.preventDefault();
  aiOrderMessage.classList.remove("is-error");
  try {
    let errors = [];
    const customerRequest = aiOrderInput.value;
    aiOrderButton.disabled = true;
    aiOrderMessage.textContent = "Qwen prend la commande…";
    addMessages(orderMessages, orderSystemPrompt, customerRequest);
    const orderAnswer = await askModel(orderMessages, {
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

    if (orderAnswer.customer) {
      order.customer = orderAnswer.customer;
    }
    orderAnswer.lines.forEach((line) => {
      const product = menu.find((item) => item.id === line.id);
      if (!product) {
        errors.push(`Produit introuvable`);
        return;
      }
      if (!product.available) {
        errors.push(`Produit ${product.name} indisponible`);
        return;
      }
      if (
        line.quantity < 1 ||
        line.quantity > 10 ||
        !Number.isInteger(line.quantity)
      ) {
        errors.push("Quantité invalide");
        return;
      }
      for (let index = 0; index < line.quantity; index++) {
        order.add(product);
      }
    });
    aiOrderMessage.textContent = errors;
  } catch (error) {
    aiOrderMessage.textContent =
      "L'IA ne répond pas : prends la commande à la main";
    aiOrderMessage.classList.add("is-error");
    console.error(error);
  }
  renderTicket();

  aiOrderButton.disabled = false;
  aiOrderInput.value = "";
  orderMessages = [];
}

// =======================================================================

const aiAdviceForm = document.querySelector("#ai-advice-form");
aiAdviceForm.addEventListener("submit", handleSubmitAdviceForm);
const aiAdviceInput = document.querySelector("#ai-advice-input");
const aiAdviceMessage = document.querySelector("#ai-advice-message");
const aiAdviceButton = document.querySelector("#ai-advice-btn");

function clearSuggestions() {
  document.querySelectorAll(".product").forEach((product) => {
    product.classList.remove("is-suggested");
  });
}

function addSuggestedIds(adviceAnswer) {
  adviceAnswer.lines.slice(0, 2).forEach((productId) => {
    const product = menu.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    if (!product.available) {
      return;
    }
    suggestedIds.push(product.id);
  });
}
function resetAdviceForm() {
  aiAdviceButton.disabled = false;
  aiAdviceInput.value = "";
  adviceMessages = [];
}
async function handleSubmitAdviceForm(event) {
  event.preventDefault();
  suggestedIds = [];
  const activeCategoryButton = document.querySelector(".is-active");
  const customerWish = aiAdviceInput.value;
  aiAdviceButton.disabled = true;

  clearSuggestions();
  addMessages(adviceMessages, adviceSystemPrompt, customerWish);

  try {
    const adviceAnswer = await askModel(adviceMessages, {
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

    addSuggestedIds(adviceAnswer);

    aiAdviceMessage.textContent = adviceAnswer.explanationSentence;
    renderMenu(activeCategoryButton.value);
  } catch (error) {
    aiAdviceMessage.textContent =
      "L'IA ne répond pas : prends la commande à la main";
    console.error(error);
  }
  resetAdviceForm();
}
