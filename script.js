/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const loadingIndicator = document.getElementById("loadingIndicator");
const sendBtn = document.getElementById("sendBtn");

/* Initialize chat */
let conversationHistory = [];
let currentUserQuestion = "";

// Set initial welcome message
function initializeChat() {
  const welcomeMessage = createMessage(
    "ai",
    "Hello! I'm your L'Oréal beauty advisor. I can help you find the perfect products and routines for your skin, hair, and makeup needs. What would you like to know?"
  );
  chatWindow.appendChild(welcomeMessage);
}

/* Create message element */
function createMessage(type, content) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `msg ${type}`;
  messageDiv.textContent = content;
  return messageDiv;
}

/* Add message to chat */
function addMessage(type, content) {
  const messageElement = createMessage(type, content);
  chatWindow.appendChild(messageElement);
  
  // Clear floats after adding message
  const clearDiv = document.createElement("div");
  clearDiv.style.clear = "both";
  chatWindow.appendChild(clearDiv);
  
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Add user question above AI response */
function addUserQuestionAboveResponse(question) {
  // Create a container for the user question reminder
  const questionReminder = document.createElement("div");
  questionReminder.className = "user-question-reminder";
  questionReminder.textContent = `You asked: "${question}"`;
  chatWindow.appendChild(questionReminder);
}

/* Show/hide loading indicator */
function showLoading(show) {
  if (show) {
    loadingIndicator.classList.remove("hidden");
    sendBtn.disabled = true;
  } else {
    loadingIndicator.classList.add("hidden");
    sendBtn.disabled = false;
  }
}

/* Debug conversation history */
function debugConversationHistory() {
  console.log("Current conversation history:", conversationHistory);
  console.log("History length:", conversationHistory.length);
}

/* Cloudflare Worker API call */
async function callChatAPI(userMessage) {
  // Add user message to conversation history
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  const systemPrompt = {
    role: "system",
    content: `You are a knowledgeable L'Oréal beauty advisor. Help customers discover the perfect beauty routine and products from L'Oréal's catalog.

IMPORTANT: Remember personal information shared by customers throughout our conversation (names, skin types, preferences, concerns, etc.) and reference it naturally in future responses.

Guidelines:
- ONLY answer questions about L'Oréal products, beauty routines, skincare, makeup, and haircare
- If asked about non-beauty topics, politely redirect: "I'm here to help with L'Oréal beauty products and routines. What can I help you with regarding skincare, makeup, or haircare?"
- Focus on L'Oréal brands (L'Oréal Paris, Lancôme, Urban Decay, YSL Beauty, Giorgio Armani Beauty, Maybelline, Garnier, etc.)
- Provide personalized recommendations based on skin type, concerns, and preferences
- Include specific product names and benefits when recommending
- Ask follow-up questions to understand customer needs better
- Keep responses concise and helpful
- If asked about competitors, redirect to L'Oréal alternatives
- Remember and use customer names and personal details they share with you

Remember L'Oréal's motto: "Because You're Worth It."`
  };

  try {
    const WORKER_URL = 'https://loreal-bot.morusup1.workers.dev/';
    
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [systemPrompt, ...conversationHistory]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Handle specific API errors
      if (response.status === 401) {
        throw new Error("Authentication error. Please check the API configuration.");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment before trying again.");
      } else if (response.status === 402) {
        throw new Error("Service temporarily unavailable. Please try again later.");
      } else {
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from API");
    }
    
    const aiResponse = data.choices[0].message.content;

    // Add AI response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: aiResponse
    });

    // Keep conversation history manageable
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    // Debug: Log updated conversation history
    debugConversationHistory();

    return aiResponse;

  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/* Handle form submission */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const message = userInput.value.trim();
  if (!message) return;

  // Store the current user question
  currentUserQuestion = message;

  // Add user message to chat
  addMessage("user", message);
  
  // Clear input immediately
  userInput.value = "";
  
  // Show loading
  showLoading(true);

  try {
    // Call Chat API through Cloudflare Worker
    const aiResponse = await callChatAPI(message);
    
    // Add user question reminder above AI response
    addUserQuestionAboveResponse(currentUserQuestion);
    
    // Add AI response to chat
    addMessage("ai", aiResponse);
    
  } catch (error) {
    // Handle errors gracefully
    let errorMessage = "I apologize, but I'm having trouble connecting right now. ";
    
    if (error.message.includes("Authentication")) {
      errorMessage = "There seems to be an issue with the service configuration. Please try again later.";
    } else if (error.message.includes("rate limit")) {
      errorMessage = "Too many requests. Please wait a moment before trying again.";
    } else if (error.message.includes("unavailable")) {
      errorMessage = "Service is temporarily unavailable. Please try again later.";
    } else {
      errorMessage = "Something went wrong. Please try again in a moment.";
    }
    
    addMessage("ai", errorMessage);
  } finally {
    // Hide loading
    showLoading(false);
  }
});

/* Handle Enter key in input */
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event("submit"));
  }
});

/* Initialize chat when page loads */
document.addEventListener("DOMContentLoaded", () => {
  initializeChat();
  userInput.focus();
});
