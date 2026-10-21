const OLLAMA_URL = "http://localhost:11434/api/chat";

const menuForModel = menu
  .filter((item) => item.available)
  .map((item) => ({ id: item.id, name: item.name }));

let orderMessages = [];
let adviceMessages = [];

const orderSystemPrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(menuForModel)}
Pour chaque produit commandé par le client, renvoie son id (celui de la carte) et sa quantité. Si tu détecte un prénom tu le rajoute a "customer" si il y en a pas tu laisse vide.`;

const adviceSystemPrompt = `Tu prends les commandes du café Sésame, qui vend des cafés, des thés et des pâtisseries.
Voici la carte : ${JSON.stringify(menuForModel)}. Le vendeur va te donner l'envie du client, par exemple (le client aimerais une pâtisserie sucré salé). Tu va donc lui conseiller un carrot cake. Tu va me renvoyer au plus deux id de produit avec une phrase pour expliquer ton choix que tu va mettre dans "explanationSentence". Ce n'est pas une commande que tu fais ici mais juste un conseils.`;

const adviceAnswerFormat = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: { type: "integer" },
    },
    explanationSentence: { type: "string" },
  },
  required: ["lines", "explanationSentence"],
};

const orderAnswerFormat = {
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
};

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
  const responseBody = await response.json();
  if (!response.ok) {
    throw new Error(responseBody.error);
  }
  return JSON.parse(responseBody.message.content);
}

// =======================================================================

function addMessages(messages, systemPrompt, userContent) {
  messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userContent });
}

function constructErrorMsg(target) {
  target.classList.add("is-error");
  target.textContent = "L'IA ne répond pas : prends la commande à la main";
}

function findProduct(id) {
  return menu.find((item) => item.id === id);
}

function getProductError(product) {
  if (!product) {
    return "Produit introuvable";
  }
  if (!product.available) {
    return `Produit ${product.name} indisponible`;
  }
}

const aiOrderForm = document.querySelector("#ai-order-form");
const aiOrderInput = document.querySelector("#ai-order-input");
const aiOrderMessage = document.querySelector("#ai-order-message");
const aiOrderButton = document.querySelector("#ai-order-button");

aiOrderForm.addEventListener("submit", handleSubmitOrderForm);

function getOrderLineError(product, line) {
  const productError = getProductError(product);
  if (productError) {
    return productError;
  }
  if (
    line.quantity < 1 ||
    line.quantity > 10 ||
    !Number.isInteger(line.quantity)
  ) {
    return "Quantité invalide";
  }
}

function applyOrderAnswer(orderAnswer) {
  const errors = [];
  if (orderAnswer.customer) {
    order.customer = orderAnswer.customer;
  }
  orderAnswer.lines.forEach((line) => {
    const product = findProduct(line.id);
    const lineError = getOrderLineError(product, line);
    if (lineError) {
      errors.push(lineError);
      return;
    }
    for (let index = 0; index < line.quantity; index++) {
      order.add(product);
    }
  });
  return errors;
}

function resetOrderForm() {
  aiOrderButton.disabled = false;
  aiOrderInput.value = "";
  orderMessages = [];
}

async function handleSubmitOrderForm(event) {
  event.preventDefault();
  const customerRequest = aiOrderInput.value;
  aiOrderMessage.classList.remove("is-error");
  aiOrderButton.disabled = true;
  aiOrderMessage.textContent = "Qwen prend la commande…";
  addMessages(orderMessages, orderSystemPrompt, customerRequest);

  let orderAnswer;
  try {
    orderAnswer = await askModel(orderMessages, orderAnswerFormat);
  } catch (error) {
    constructErrorMsg(aiOrderMessage);
    console.error(error);
    return;
  } finally {
    resetOrderForm();
  }

  aiOrderMessage.textContent = applyOrderAnswer(orderAnswer);
  renderTicket();
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
    const product = findProduct(productId);
    if (getProductError(product)) {
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
  aiAdviceMessage.classList.remove("is-error");
  aiAdviceButton.disabled = true;

  clearSuggestions();
  addMessages(adviceMessages, adviceSystemPrompt, customerWish);

  let adviceAnswer;
  try {
    adviceAnswer = await askModel(adviceMessages, adviceAnswerFormat);
  } catch (error) {
    constructErrorMsg(aiAdviceMessage);
    console.error(error);
    return;
  } finally {
    resetAdviceForm();
  }

  addSuggestedIds(adviceAnswer);
  aiAdviceMessage.textContent = adviceAnswer.explanationSentence;
  renderMenu(activeCategoryButton.value);
}
