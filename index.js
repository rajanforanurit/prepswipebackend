require("dotenv").config();
const path = require("path");
const fs = require("fs");
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

// Question Schema (unchanged)
const QuestionSchema = new mongoose.Schema(
  {
    question_id: { type: String, index: true },
    exam: { type: String, index: true },
    state: { type: String, index: true },
    paper: { type: String, index: true },
    subject: { type: String, index: true },
    topic: { type: String, index: true },
    subtopic: { type: String, index: true },
    year: { type: Number, index: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], index: true },
    language: { type: String, index: true },
    question: { type: mongoose.Schema.Types.Mixed },
    options: { type: mongoose.Schema.Types.Mixed },
    correct_answer: { type: mongoose.Schema.Types.Mixed },
    solution: { type: String },
    explanation: { type: mongoose.Schema.Types.Mixed },
    negative_marks: { type: Number, default: 0 },
    marks: { type: Number, default: 1 },
    tags: [{ type: String, index: true }],
    imageUrl: { type: String, default: null },
  },
  { timestamps: true }
);

QuestionSchema.index({ exam: 1, subject: 1, year: 1 });
QuestionSchema.index({ exam: 1, topic: 1, difficulty: 1 });
QuestionSchema.index({ exam: 1, paper: 1, year: 1 });
QuestionSchema.index({ exam: 1, state: 1 });
QuestionSchema.index({ tags: 1 });

function getQuestionModel(connection) {
  if (connection.models.Question) return connection.models.Question;
  return connection.model("Question", QuestionSchema);
}

// Simplified User Schema - Only userId and examType
const UserSchema = new mongoose.Schema(
  {
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
        "NDA", "CDS", "AFCAT", "CAPF",
        "OTHER",
      ],
      index: true,
    },
  },
  { timestamps: true }
);

function getUserModel(connection) {
  if (connection.models.User) return connection.models.User;
  return connection.model("User", UserSchema);
}

// Keep other schemas (Analytics & AttemptHistory) as they may be used by other parts of the app
const AccuracyBreakdownSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
  },
  { _id: false }
);

const DailyEntrySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const AnalyticsSchema = new mongoose.Schema(
  {
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
    performanceTrend: [
      {
        date: { type: String },
        accuracy: { type: Number },
        attempted: { type: Number },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

function getAnalyticsModel(connection) {
  if (connection.models.Analytics) return connection.models.Analytics;
  return connection.model("Analytics", AnalyticsSchema);
}

const AttemptHistorySchema = new mongoose.Schema(
  {
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
  },
  { timestamps: false }
);

function getAttemptHistoryModel(connection) {
  if (connection.models.AttemptHistory) return connection.models.AttemptHistory;
  return connection.model("AttemptHistory", AttemptHistorySchema);
}

// Simple optional auth placeholder (Firebase handles real auth)
const optionalAuth = async (req, res, next) => {
  // Firebase auth should be handled in middleware or route level
  // You can attach decoded Firebase user here if needed
  next();
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
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
  // If using express-validator elsewhere, keep this stub
  next();
};

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function yesterdayIST() {
  const ist = new Date(Date.now() + IST_OFFSET_MS - 86400000);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function updateBreakdown(array, key, isCorrect) {
  if (!key) return array;
  const entry = array.find((e) => e.key === key);
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
  const qualified = subjectAccuracy.filter((s) => s.attempted >= 5);
  const sorted = [...qualified].sort((a, b) => b.accuracy - a.accuracy);
  const strongSubjects = sorted.slice(0, 3).filter((s) => s.accuracy >= 70).map((s) => s.key);
  const weakSubjects = sorted
    .slice(-3)
    .reverse()
    .filter((s) => s.accuracy < 50)
    .map((s) => s.key);
  return { strongSubjects, weakSubjects };
}

async function updateAnalyticsOnSubmit({
  userId,
  questionMeta,
  selectedOption,
  isCorrect,
  isSkipped,
  marksEarned,
  timeTakenSeconds,
  sessionId,
  questionId,
}) {
  const conn = getUserDB();
  const Analytics = getAnalyticsModel(conn);
  const AttemptHistory = getAttemptHistoryModel(conn);
  const today = todayIST();
  const yesterday = yesterdayIST();

  try {
    await AttemptHistory.create({
      userId,
      questionId,
      exam: questionMeta.exam,
      subject: questionMeta.subject,
      topic: questionMeta.topic,
      subtopic: questionMeta.subtopic,
      paper: questionMeta.paper,
      year: questionMeta.year,
      difficulty: questionMeta.difficulty,
      selectedOption,
      isCorrect,
      isSkipped,
      marksEarned,
      timeTakenSeconds,
      sessionId,
      attemptedAt: new Date(),
    });

    let analytics = await Analytics.findOne({ userId });
    if (!analytics) {
      analytics = new Analytics({ userId });
    }

    analytics.totalAttempted++;
    if (isCorrect) analytics.totalCorrect++;
    else if (isSkipped) analytics.totalSkipped++;
    else analytics.totalIncorrect++;

    analytics.totalStudyTimeSeconds += timeTakenSeconds || 0;
    analytics.overallAccuracy =
      analytics.totalAttempted > 0
        ? Math.round((analytics.totalCorrect / analytics.totalAttempted) * 100)
        : 0;
    analytics.avgResponseTimeSeconds = Math.round(
      analytics.totalStudyTimeSeconds / analytics.totalAttempted
    );

    const lastDate = analytics.lastStudyDate;
    if (lastDate !== today) {
      if (lastDate === yesterday) {
        analytics.currentStreak++;
      } else {
        analytics.currentStreak = 1;
      }
      analytics.lastStudyDate = today;
      if (analytics.currentStreak > analytics.longestStreak) {
        analytics.longestStreak = analytics.currentStreak;
      }
    }

    if (analytics.goalResetDate !== today) {
      analytics.todayAttempted = 0;
      const todayDate = new Date(today);
      const resetDate = analytics.goalResetDate ? new Date(analytics.goalResetDate) : null;
      const daysDiff = resetDate
        ? Math.floor((todayDate - resetDate) / 86400000)
        : 99;
      if (daysDiff >= 7) analytics.weekAttempted = 0;
      if (
        !resetDate ||
        todayDate.getUTCMonth() !== resetDate.getUTCMonth() ||
        todayDate.getUTCFullYear() !== resetDate.getUTCFullYear()
      ) {
        analytics.monthAttempted = 0;
      }
      analytics.goalResetDate = today;
    }

    analytics.todayAttempted++;
    analytics.weekAttempted++;
    analytics.monthAttempted++;

    if (questionMeta.subject)
      analytics.subjectAccuracy = updateBreakdown(analytics.subjectAccuracy, questionMeta.subject, isCorrect);
    if (questionMeta.topic)
      analytics.topicAccuracy = updateBreakdown(analytics.topicAccuracy, questionMeta.topic, isCorrect);
    if (questionMeta.subtopic)
      analytics.subtopicAccuracy = updateBreakdown(analytics.subtopicAccuracy, questionMeta.subtopic, isCorrect);
    if (questionMeta.paper)
      analytics.paperAccuracy = updateBreakdown(analytics.paperAccuracy, questionMeta.paper, isCorrect);
    if (questionMeta.difficulty)
      analytics.difficultyAccuracy = updateBreakdown(analytics.difficultyAccuracy, questionMeta.difficulty, isCorrect);
    if (questionMeta.year)
      analytics.yearAccuracy = updateBreakdown(analytics.yearAccuracy, String(questionMeta.year), isCorrect);

    const { strongSubjects, weakSubjects } = computeStrongWeak(analytics.subjectAccuracy);
    analytics.strongSubjects = strongSubjects;
    analytics.weakSubjects = weakSubjects;

    let todayEntry = analytics.dailyActivity.find((d) => d.date === today);
    if (todayEntry) {
      todayEntry.attempted++;
      if (isCorrect) todayEntry.correct++;
      todayEntry.timeSpentSeconds += timeTakenSeconds || 0;
    } else {
      analytics.dailyActivity.push({
        date: today,
        attempted: 1,
        correct: isCorrect ? 1 : 0,
        timeSpentSeconds: timeTakenSeconds || 0,
      });
      if (analytics.dailyActivity.length > 365) {
        analytics.dailyActivity = analytics.dailyActivity.slice(-365);
      }
    }

    const lastTrend = analytics.performanceTrend[analytics.performanceTrend.length - 1];
    if (!lastTrend || lastTrend.date !== today) {
      analytics.performanceTrend.push({
        date: today,
        accuracy: analytics.overallAccuracy,
        attempted: analytics.totalAttempted,
      });
      if (analytics.performanceTrend.length > 30) {
        analytics.performanceTrend = analytics.performanceTrend.slice(-30);
      }
    } else {
      lastTrend.accuracy = analytics.overallAccuracy;
      lastTrend.attempted = analytics.totalAttempted;
    }

    await analytics.save();
  } catch (err) {
    console.error("Analytics update failed:", { userId, questionId, error: err.message });
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
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
  getUserModel,
  getAnalyticsModel,
  getAttemptHistoryModel,
  optionalAuth,
  errorHandler,
  notFound,
  validate,
  AppError,
  updateAnalyticsOnSubmit,
  todayIST,
};
