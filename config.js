// Advanced AI Bot Configuration
require('dotenv').config();

module.exports = {
  // AI Configuration
  AI: {
    API_URL: process.env.AI_API_URL || "https://api.puter.com/v2/chat/completions",
    MODEL: process.env.AI_MODEL || "gpt-4o-mini",
    MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS) || 1000,
    TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    TIMEOUT: parseInt(process.env.AI_TIMEOUT) || 30000, // 30 seconds
    
    SYSTEM_PROMPTS: {
      whatsapp: "You are a friendly, helpful WhatsApp AI assistant. Keep responses conversational and under 500 characters for WhatsApp compatibility.",
      web: "You are a smart, professional AI assistant. Provide detailed and helpful responses.",
      default: "You are a helpful AI assistant."
    }
  },

  // Server Configuration
  SERVER: {
    PORT: process.env.PORT || 3000,
    ENVIRONMENT: process.env.NODE_ENV || 'production',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
  },

  // WhatsApp Configuration
  WHATSAPP: {
    SESSION_PATH: './.wwebjs_auth',
    PUPPETEER_ARGS: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    MESSAGE: "Too many requests, please try again later."
  },

  // Caching
  CACHE: {
    TTL: 300, // 5 minutes
    CHECK_PERIOD: 600 // 10 minutes
  },

  // Feature Flags
  FEATURES: {
    ENABLE_LOGGING: true,
    ENABLE_CACHING: true,
    ENABLE_RATE_LIMITING: true,
    ENABLE_CORS: true,
    ENABLE_COMPRESSION: true,
    ENABLE_SECURITY_HEADERS: true
  },

  // Messages
  MESSAGES: {
    BOT_READY: "🤖 Premium AI Bot is now online!",
    ERROR_GENERIC: "Sorry, something went wrong. Please try again! 🙏",
    ERROR_AI_TIMEOUT: "AI response timeout. Please try with a shorter message.",
    ERROR_RATE_LIMIT: "You're sending messages too fast. Please wait a moment.",
    WELCOME: "Welcome to Premium AI! How can I help you today? 😊"
  }
};
