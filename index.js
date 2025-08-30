// 🚀 Premium WhatsApp AI Bot with Advanced Features
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const winston = require("winston");
const NodeCache = require("node-cache");
const path = require("path");

// Import Configuration
const config = require("./config");

// Initialize Express App
const app = express();

// Initialize Cache
const cache = new NodeCache({ 
  stdTTL: config.CACHE.TTL, 
  checkperiod: config.CACHE.CHECK_PERIOD 
});

// Initialize Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Middleware Setup
if (config.FEATURES.ENABLE_SECURITY_HEADERS) {
  app.use(helmet());
}

if (config.FEATURES.ENABLE_CORS) {
  app.use(cors({
    origin: config.SERVER.CORS_ORIGIN,
    credentials: true
  }));
}

if (config.FEATURES.ENABLE_COMPRESSION) {
  app.use(compression());
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate Limiting
if (config.FEATURES.ENABLE_RATE_LIMITING) {
  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT.WINDOW_MS,
    max: config.RATE_LIMIT.MAX_REQUESTS,
    message: { error: config.RATE_LIMIT.MESSAGE },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);
}

// Global Variables
let whatsappClient = null;
let botStatus = 'initializing';
let connectedUsers = new Set();

// 🤖 AI Response Function
async function getAIResponse(message, platform = 'whatsapp') {
  const cacheKey = `ai_${platform}_${Buffer.from(message).toString('base64').slice(0, 20)}`;
  
  // Check cache first
  if (config.FEATURES.ENABLE_CACHING) {
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info('Cache hit for AI response');
      return cached;
    }
  }

  try {
    const systemPrompt = config.AI.SYSTEM_PROMPTS[platform] || config.AI.SYSTEM_PROMPTS.default;
    
    const response = await axios.post(config.AI.API_URL, {
      model: config.AI.MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: config.AI.MAX_TOKENS,
      temperature: config.AI.TEMPERATURE
    }, {
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "Premium-AI-Bot/2.0"
      },
      timeout: config.AI.TIMEOUT
    });

    const aiReply = response.data.choices[0].message.content;
    
    // Cache the response
    if (config.FEATURES.ENABLE_CACHING) {
      cache.set(cacheKey, aiReply);
    }
    
    return aiReply;

  } catch (error) {
    logger.error('AI API Error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      throw new Error(config.MESSAGES.ERROR_AI_TIMEOUT);
    }
    
    throw new Error(config.MESSAGES.ERROR_GENERIC);
  }
}

// 📱 WhatsApp Client Setup
const setupWhatsAppClient = () => {
  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.WHATSAPP.SESSION_PATH
    }),
    puppeteer: {
      args: config.WHATSAPP.PUPPETEER_ARGS
    }
  });

  // QR Code Event
  whatsappClient.on("qr", (qr) => {
    console.log('\n🔗 Scan this QR code in WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    botStatus = 'waiting_for_qr';
    logger.info('QR Code generated, waiting for scan');
  });

  // Ready Event
  whatsappClient.on("ready", () => {
    botStatus = 'ready';
    logger.info(config.MESSAGES.BOT_READY);
    console.log(`\n✅ ${config.MESSAGES.BOT_READY}\n`);
  });

  // Authentication Success
  whatsappClient.on("authenticated", () => {
    botStatus = 'authenticated';
    logger.info('WhatsApp authentication successful');
  });

  // Disconnection Event
  whatsappClient.on("disconnected", (reason) => {
    botStatus = 'disconnected';
    logger.warn(`WhatsApp disconnected: ${reason}`);
  });

  // Message Event with Advanced Handling
  whatsappClient.on("message", async (msg) => {
    try {
      // Skip messages from status, groups (optional), or bot itself
      if (msg.from === 'status@broadcast' || msg.fromMe) return;
      
      // Track active users
      connectedUsers.add(msg.from);
      
      logger.info(`📩 Message from ${msg.from}: ${msg.body.substring(0, 50)}...`);

      // Get AI response
      const aiReply = await getAIResponse(msg.body, 'whatsapp');
      
      // Send reply
      await msg.reply(aiReply);
      
      logger.info(`🤖 AI replied to ${msg.from}: ${aiReply.substring(0, 50)}...`);

    } catch (error) {
      logger.error(`Error processing message from ${msg.from}:`, error.message);
      
      try {
        await msg.reply(config.MESSAGES.ERROR_GENERIC);
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError.message);
      }
    }
  });

  // Initialize WhatsApp Client
  whatsappClient.initialize();
};

// 🌐 API Routes

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    botStatus: botStatus,
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    activeUsers: connectedUsers.size
  });
});

// API Status
app.get('/api/status', (req, res) => {
  res.json({
    whatsapp: {
      status: botStatus,
      connectedUsers: connectedUsers.size
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: config.SERVER.ENVIRONMENT
    },
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  });
});

// Chat API for Frontend
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({ 
        error: 'Message too long. Maximum 2000 characters allowed.' 
      });
    }

    logger.info(`🌐 Web chat message: ${message.substring(0, 50)}...`);

    // Get AI response for web platform
    const aiReply = await getAIResponse(message, 'web');
    
    res.json({
      success: true,
      reply: aiReply,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'anonymous'
    });

    logger.info(`🌐 Web AI replied: ${aiReply.substring(0, 50)}...`);

  } catch (error) {
    logger.error('Chat API error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message || config.MESSAGES.ERROR_GENERIC,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook for External Integrations (Future Use)
app.post('/api/webhook', (req, res) => {
  try {
    logger.info('Webhook received:', req.body);
    
    // Process webhook data here
    // Future: Telegram, Discord, Slack integrations
    
    res.json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    });
  } catch (error) {
    logger.error('Webhook error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send Message API (For external apps)
app.post('/api/send', async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!whatsappClient || botStatus !== 'ready') {
      return res.status(503).json({ 
        error: 'WhatsApp bot not ready' 
      });
    }

    if (!number || !message) {
      return res.status(400).json({ 
        error: 'Number and message are required' 
      });
    }

    // Format number (add country code if needed)
    const formattedNumber = number.includes('@') ? number : `${number}@c.us`;
    
    await whatsappClient.sendMessage(formattedNumber, message);
    
    res.json({ 
      success: true, 
      message: 'Message sent successfully' 
    });

    logger.info(`📤 Message sent to ${formattedNumber}: ${message.substring(0, 50)}...`);

  } catch (error) {
    logger.error('Send message error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear Cache API
app.post('/api/cache/clear', (req, res) => {
  try {
    cache.flushAll();
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully' 
    });
    logger.info('Cache cleared manually');
  } catch (error) {
    logger.error('Cache clear error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics API (Future Use)
app.get('/api/analytics', (req, res) => {
  res.json({
    totalUsers: connectedUsers.size,
    uptime: process.uptime(),
    cacheHits: cache.getStats().hits,
    cacheMisses: cache.getStats().misses,
    botStatus: botStatus,
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'GET /api/status',
      'POST /api/chat',
      'POST /api/send',
      'GET /api/analytics'
    ]
  });
});

// Global Error Handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ 
    error: config.MESSAGES.ERROR_GENERIC,
    timestamp: new Date().toISOString()
  });
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (whatsappClient) {
    whatsappClient.destroy();
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (whatsappClient) {
    whatsappClient.destroy();
  }
  
  process.exit(0);
});

// Unhandled Promise Rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start Server
app.listen(config.SERVER.PORT, () => {
  logger.info(`🌐 Premium AI Bot Server running on port ${config.SERVER.PORT}`);
  logger.info(`🔗 Environment: ${config.SERVER.ENVIRONMENT}`);
  
  console.log(`\n🚀 Premium AI Bot Backend Started!`);
  console.log(`📡 Server: http://localhost:${config.SERVER.PORT}`);
  console.log(`🤖 Initializing WhatsApp Bot...\n`);
  
  // Initialize WhatsApp after server starts
  setupWhatsAppClient();
});

// Export for testing
module.exports = { app, cache, logger };
