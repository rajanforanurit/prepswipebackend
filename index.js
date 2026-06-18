require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const COMMON_OPTIONS = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  maxPoolSize: 20,
  minPoolSize: 5,
  heartbeatFrequencyMS: 10000,
};

let questionConn = null;
let userConn = null;

async function connectQuestionDB() {
  if (questionConn && questionConn.readyState === 1) return questionConn;
  const uri = process.env.QUESTION_DB_URI;
  if (!uri) throw new Error("QUESTION_DB_URI is not defined in environment variables");
  
  questionConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    readPreference: "secondaryPreferred",
  });

  questionConn.on("connected", () => console.log("Question DB (Cluster 1) connected"));
  questionConn.on("error", (err) => console.error("Question DB error:", err.message));
  questionConn.on("disconnected", () => console.warn("Question DB disconnected, reconnecting"));
  
  await questionConn.asPromise();
  return questionConn;
}

async function connectUserDB() {
  if (userConn && userConn.readyState === 1) return userConn;
  const uri = process.env.USER_DB_URI;
  if (!uri) throw new Error("USER_DB_URI is not defined in environment variables");
  
  userConn = mongoose.createConnection(uri, COMMON_OPTIONS);
  
  userConn.on("connected", () => console.log("User DB (Cluster 2) connected"));
  userConn.on("error", (err) => console.error("User DB error:", err.message));
  userConn.on("disconnected", () => console.warn("User DB disconnected, reconnecting"));
  
  await userConn.asPromise();
  return userConn;
}

async function connectAllDatabases() {
  await Promise.all([connectQuestionDB(), connectUserDB()]);
  console.log("Both database clusters connected");
}

function getQuestionDB() {
  if (!questionConn || questionConn.readyState !== 1) {
    throw new Error("Question DB not connected. Call connectQuestionDB() first.");
  }
  return questionConn;
}

function getUserDB() {
  if (!userConn || userConn.readyState !== 1) {
    throw new Error("User DB not connected. Call connectUserDB() first.");
  }
  return userConn;
}

// ==================== QUESTION SCHEMA (Simplified & Matches Admin) ====================
const QuestionSchema = new mongoose.Schema({
  _id: { type: Number },
  exam: { type: String, required: true },
  year: { type: Number, required: true },
  paper: { type: String },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  topic: { type: String, trim: true },
  imageUrl: {
    type: String,
    trim: true,
    default: null
  },
  english: {
    question: { type: String, required: true },
    options: { type: Object, required: true }
  },
  hindi: {
    question: { type: String, required: true },
    options: { type: Object, required: true }
  },
  marks: { type: Number, default: 2 },
  negativeMarks: { type: Number, default: 0.66 },
  correct_answer: { type: Number, required: true },
  batchId: { type: String }
}, {
  timestamps: true,
});

// Three separate collections
const PcsQuestion = mongoose.model('PcsQuestion', QuestionSchema, 'pcsquestions');
const BookQuestion = mongoose.model('BookQuestion', QuestionSchema, 'bookquestions');
const ParagraphQuestion = mongoose.model('ParagraphQuestion', QuestionSchema, 'paragraphquestions');

const collections = {
  pcsquestions: PcsQuestion,
  bookquestions: BookQuestion,
  paragraphquestions: ParagraphQuestion
};

// Helper to get model by collection name
function getQuestionModel(collectionName = 'pcsquestions') {
  return collections[collectionName] || PcsQuestion;
}

// Get all question models (useful when you want to query across collections)
function getAllQuestionModels() {
  return [PcsQuestion, BookQuestion, ParagraphQuestion];
}

// ==================== USER SCHEMA (Minimal as requested) ====================
const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  examType: {
    type: String,
    enum: [
      "UPSC", "UPPCS", "BPSC", "MPPCS", "RAS", "UKPCS", "CGPCS", "JPSC",
      "HPSC", "WBPCS", "OPSC", "KPSC", "TNPSC",
      "SSC CGL", "SSC CHSL", "SSC MTS", "SSC CPO",
      "IBPS PO", "IBPS CLERK", "SBI PO", "SBI CLERK", "RBI GRADE B",
      "RRB NTPC", "RRB GROUP D", "RRB ALP",
      "NDA", "CDS", "AFCAT", "CAPF", "OTHER"
    ],
    index: true,
  },
}, { timestamps: true });

function getUserModel(connection) {
  if (connection.models.User) return connection.models.User;
  return connection.model("User", UserSchema);
}

// ==================== ANALYTICS & ATTEMPT HISTORY (Kept as they are used) ====================
const AccuracyBreakdownSchema = new mongoose.Schema({
  key: { type: String, required: true },
  attempted: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  incorrect: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
}, { _id: false });

const DailyEntrySchema = new mongoose.Schema({
  date: { type: String, required: true },
  attempted: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  timeSpentSeconds: { type: Number, default: 0 },
}, { _id: false });

const AnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  totalAttempted: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  totalIncorrect: { type: Number, default: 0 },
  totalSkipped: { type: Number, default: 0 },
  overallAccuracy: { type: Number, default: 0 },
  totalStudyTimeSeconds: { type: Number, default: 0 },
  avgResponseTimeSeconds: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastStudyDate: { type: String, default: null },
  subjectAccuracy: [AccuracyBreakdownSchema],
  topicAccuracy: [AccuracyBreakdownSchema],
  subtopicAccuracy: [AccuracyBreakdownSchema],
  paperAccuracy: [AccuracyBreakdownSchema],
  difficultyAccuracy: [AccuracyBreakdownSchema],
  yearAccuracy: [AccuracyBreakdownSchema],
  todayAttempted: { type: Number, default: 0 },
  weekAttempted: { type: Number, default: 0 },
  monthAttempted: { type: Number, default: 0 },
  goalResetDate: { type: String, default: null },
  dailyActivity: [DailyEntrySchema],
  bookmarkCount: { type: Number, default: 0 },
  strongSubjects: [{ type: String }],
  weakSubjects: [{ type: String }],
  performanceTrend: [{
    date: { type: String },
    accuracy: { type: Number },
    attempted: { type: Number },
    _id: false,
  }],
}, { timestamps: true });

function getAnalyticsModel(connection) {
  if (connection.models.Analytics) return connection.models.Analytics;
  return connection.model("Analytics", AnalyticsSchema);
}

const AttemptHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  questionId: { type: mongoose.Schema.Types.Mixed, required: true },
  exam: { type: String, index: true },
  subject: { type: String, index: true },
  topic: { type: String, index: true },
  subtopic: { type: String },
  paper: { type: String },
  year: { type: Number },
  difficulty: { type: String },
  selectedOption: { type: mongoose.Schema.Types.Mixed, default: null },
  isCorrect: { type: Boolean, default: false },
  isSkipped: { type: Boolean, default: false },
  marksEarned: { type: Number, default: 0 },
  timeTakenSeconds: { type: Number, default: 0 },
  sessionId: { type: String, index: true },
  attemptedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

function getAttemptHistoryModel(connection) {
  if (connection.models.AttemptHistory) return connection.models.AttemptHistory;
  return connection.model("AttemptHistory", AttemptHistorySchema);
}

// ==================== MIDDLEWARE & HELPERS ====================
const optionalAuth = async (req, res, next) => {
  // Firebase Auth should be handled in your route handlers or a separate Firebase middleware
  next();
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(", ");
  }
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `${field} already exists`;
  }
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  console.error("Error:", err.message);
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const validate = (req, res, next) => {
  next(); // Stub - use if you add express-validator later
};

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Date helpers
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function yesterdayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS - 86400000);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0")
  ].join("-");
}

// Analytics helper functions (kept)
function updateBreakdown(array, key, isCorrect) {
  if (!key) return array;
  const entry = array.find(e => e.key === key);
  if (entry) {
    entry.attempted++;
    if (isCorrect) entry.correct++;
    else entry.incorrect++;
    entry.accuracy = entry.attempted > 0 ? Math.round((entry.correct / entry.attempted) * 100) : 0;
  } else {
    array.push({
      key,
      attempted: 1,
      correct: isCorrect ? 1 : 0,
      incorrect: isCorrect ? 0 : 1,
      accuracy: isCorrect ? 100 : 0,
    });
  }
  return array;
}

function computeStrongWeak(subjectAccuracy) {
  const qualified = subjectAccuracy.filter(s => s.attempted >= 5);
  const sorted = [...qualified].sort((a, b) => b.accuracy - a.accuracy);
  const strongSubjects = sorted.slice(0, 3).filter(s => s.accuracy >= 70).map(s => s.key);
  const weakSubjects = sorted.slice(-3).reverse().filter(s => s.accuracy < 50).map(s => s.key);
  return { strongSubjects, weakSubjects };
}

// updateAnalyticsOnSubmit function remains the same (omitted for brevity - copy from previous version if needed)

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// Example route to test getting questions from all collections
app.get("/questions", async (req, res) => {
  try {
    const { limit = 10, collection = null } = req.query;
    
    let questions = [];
    if (collection && collections[collection]) {
      questions = await collections[collection].find().limit(Number(limit));
    } else {
      // Fetch from all three collections
      const results = await Promise.all(
        Object.values(collections).map(model => model.find().limit(Math.floor(Number(limit)/3)))
      );
      questions = results.flat();
    }

    res.json({ success: true, count: questions.length, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await connectAllDatabases();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();

module.exports = {
  app,
  connectQuestionDB,
  connectUserDB,
  connectAllDatabases,
  getQuestionDB,
  getUserDB,
  getQuestionModel,
  getAllQuestionModels,
  getUserModel,
  getAnalyticsModel,
  getAttemptHistoryModel,
  collections,
  optionalAuth,
  errorHandler,
  notFound,
  validate,
  AppError,
  todayIST,
  // updateAnalyticsOnSubmit,  // Add if need it in future
};
