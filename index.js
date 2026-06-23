require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const cors = require("cors");

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {}
}

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

mongoose.set("bufferCommands", true);
mongoose.set("bufferTimeoutMS", 30000);

const COMMON_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
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
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });
  questionConn.on("error", () => {});
  questionConn.on("disconnected", () => {});

  await questionConn.asPromise();

  return questionConn;
}
async function connectUserDB() {
  if (userConn && userConn.readyState === 1) return userConn;
  const uri = process.env.USER_DB_URI;
  if (!uri) throw new Error("USER_DB_URI is not defined in environment variables");

  userConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });

  userConn.on("error", () => {});
  userConn.on("disconnected", () => {});

  await userConn.asPromise();
  return userConn;
}
async function connectAllDatabases() {
  await Promise.all([connectQuestionDB(), connectUserDB()]);
}
function getQuestionDB() {
  if (!questionConn || questionConn.readyState !== 1) {
    throw new Error("Question DB not connected");
  }
  return questionConn;
}
function getUserDB() {
  if (!userConn || userConn.readyState !== 1) {
    throw new Error("User DB not connected");
  }
  return userConn;
}
const QuestionSchema = new mongoose.Schema({
  _id: { type: Number },
  exam: { type: String, required: true },
  year: { type: Number, required: true },
  paper: { type: String },
  subject: { type: String, required: true, trim: true },
  topic: { type: String, trim: true },
  imageUrl: { type: String, trim: true, default: null },
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
}, { timestamps: true });

function getQuestionModel(collectionName = "pcsquestions") {
  const conn = getQuestionDB();
  const map = {
    pcsquestions: "PcsQuestion",
    bookquestions: "BookQuestion",
    paragraphquestions: "ParagraphQuestion",
  };
  const modelName = map[collectionName] || "PcsQuestion";
  if (conn.models[modelName]) return conn.models[modelName];
  return conn.model(modelName, QuestionSchema, collectionName in map ? collectionName : "pcsquestions");
}

const collections = {
  pcsquestions: "PcsQuestion",
  bookquestions: "BookQuestion",
  paragraphquestions: "ParagraphQuestion"
};

const USERID_REGEX = /^[a-z0-9_]{4,20}$/;

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  userID: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    minlength: 4,
    maxlength: 20,
    match: USERID_REGEX,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    default: null,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
  },
  examType: {
    type: String,
    enum: [
      "UPSC", "UPPCS", "BPSC", "MPPCS", "RAS", "UKPCS", "CGPCS", "JPSC",
      "HPSC", "WBPCS", "OPSC", "KPSC", "TNPSC",
      "SSC CGL", "SSC CHSL", "SSC MTS", "SSC CPO",
      "IBPS PO", "IBPS CLERK", "SBI PO", "SBI CLERK", "RBI GRADE B",
      "RRB NTPC", "RRB GROUP D"
    ],
    index: true,
  },
}, { timestamps: true });

function getUserModel(connection) {
  if (connection.models.User) return connection.models.User;
  return connection.model("User", UserSchema);
}
function generateUserIDSuggestions(base) {
  const clean = String(base).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15) || "user";
  const suggestions = [];
  for (let i = 0; i < 3; i++) {
    const suffix = Math.floor(10 + Math.random() * 89890);
    suggestions.push(`${clean}${suffix}`.slice(0, 20));
  }
  return suggestions;
}
async function isUserIDAvailable(User, userID, excludeFirebaseUID) {
  const query = { userID };
  if (excludeFirebaseUID) query.userId = { $ne: excludeFirebaseUID };
  const existing = await User.findOne(query).lean();
  return !existing;
}
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
    type: String,
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
  recentSessions: [{
    sessionId: { type: String },
    score: { type: Number },
    total: { type: Number },
    correct: { type: Number },
    incorrect: { type: Number },
    accuracy: { type: Number },
    timeTakenSeconds: { type: Number },
    finishedAt: { type: Date },
    _id: false,
  }],
}, { timestamps: true });

function getAnalyticsModel(connection) {
  if (connection.models.Analytics) return connection.models.Analytics;
  return connection.model("Analytics", AnalyticsSchema);
}
const AttemptHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
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

AttemptHistorySchema.index({ userId: 1, questionId: 1 });
function getAttemptHistoryModel(connection) {
  if (connection.models.AttemptHistory) return connection.models.AttemptHistory;
  return connection.model("AttemptHistory", AttemptHistorySchema);
}

const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.user = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

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

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildExamMatch(examType) {
  const keyword = String(examType).trim();
  return { $regex: new RegExp("^" + escapeRegex(keyword) + "(\\s|$)", "i") };
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
  const weakSubjects = sorted.slice(-3).reverse().filter((s) => s.accuracy < 50).map((s) => s.key);
  return { strongSubjects, weakSubjects };
}

function updateStreak(analytics, today, yesterday) {
  if (analytics.lastStudyDate === today) {
  } else if (analytics.lastStudyDate === yesterday) {
    analytics.currentStreak = (analytics.currentStreak || 0) + 1;
  } else {
    analytics.currentStreak = 1;
  }
  if (analytics.currentStreak > (analytics.longestStreak || 0)) {
    analytics.longestStreak = analytics.currentStreak;
  }
}

async function updateAnalyticsOnSubmit({
  userId,
  questionId,
  questionMeta,
  selectedOption,
  isCorrect,
  isSkipped,
  marksEarned,
  timeTakenSeconds,
  sessionId,
}) {
  const conn = getUserDB();
  const Analytics = getAnalyticsModel(conn);
  const AttemptHistory = getAttemptHistoryModel(conn);
  const today = todayIST();
  const yesterday = yesterdayIST();

  await AttemptHistory.create({
    userId,
    questionId,
    exam: questionMeta?.exam,
    subject: questionMeta?.subject,
    topic: questionMeta?.topic,
    subtopic: questionMeta?.subtopic,
    paper: questionMeta?.paper,
    year: questionMeta?.year,
    difficulty: questionMeta?.difficulty,
    selectedOption,
    isCorrect,
    isSkipped: isSkipped || false,
    marksEarned,
    timeTakenSeconds: timeTakenSeconds || 0,
    sessionId,
    attemptedAt: new Date(),
  });

  let analytics = await Analytics.findOne({ userId });
  if (!analytics) {
    analytics = new Analytics({ userId });
  }

  analytics.totalAttempted++;
  if (isSkipped) analytics.totalSkipped++;
  else if (isCorrect) analytics.totalCorrect++;
  else analytics.totalIncorrect++;

  analytics.totalStudyTimeSeconds += timeTakenSeconds || 0;
  analytics.overallAccuracy = analytics.totalAttempted > 0
    ? Math.round((analytics.totalCorrect / analytics.totalAttempted) * 100)
    : 0;
  analytics.avgResponseTimeSeconds = analytics.totalAttempted > 0
    ? Math.round(analytics.totalStudyTimeSeconds / analytics.totalAttempted)
    : 0;

  if (questionMeta?.subject) {
    updateBreakdown(analytics.subjectAccuracy, questionMeta.subject, isCorrect);
  }
  if (questionMeta?.topic) {
    updateBreakdown(analytics.topicAccuracy, questionMeta.topic, isCorrect);
  }
  if (questionMeta?.year) {
    updateBreakdown(analytics.yearAccuracy, String(questionMeta.year), isCorrect);
  }

  const { strongSubjects, weakSubjects } = computeStrongWeak(analytics.subjectAccuracy);
  analytics.strongSubjects = strongSubjects;
  analytics.weakSubjects = weakSubjects;

  if (analytics.goalResetDate !== today) {
    analytics.todayAttempted = 0;
    analytics.goalResetDate = today;
  }
  analytics.todayAttempted = (analytics.todayAttempted || 0) + 1;

  updateStreak(analytics, today, yesterday);
  analytics.lastStudyDate = today;

  const dayEntry = analytics.dailyActivity.find((d) => d.date === today);
  if (dayEntry) {
    dayEntry.attempted++;
    if (isCorrect) dayEntry.correct++;
    dayEntry.timeSpentSeconds += timeTakenSeconds || 0;
  } else {
    analytics.dailyActivity.push({
      date: today,
      attempted: 1,
      correct: isCorrect ? 1 : 0,
      timeSpentSeconds: timeTakenSeconds || 0,
    });
  }
  if (analytics.dailyActivity.length > 90) {
    analytics.dailyActivity = analytics.dailyActivity.slice(-90);
  }

  await analytics.save();
  return analytics;
}

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

app.get("/user/check-userid", firebaseAuth, async (req, res) => {
  try {
    const requested = String(req.query.userID || "").trim().toLowerCase();
    if (!USERID_REGEX.test(requested)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "userID must be 4-20 characters, lowercase letters, numbers, and underscore only",
      });
    }
    const conn = getUserDB();
    const User = getUserModel(conn);
    const available = await isUserIDAvailable(User, requested, req.userId);
    if (available) {
      return res.json({ success: true, available: true });
    }
    res.json({
      success: true,
      available: false,
      suggestions: generateUserIDSuggestions(requested),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/profile", firebaseAuth, async (req, res) => {
  try {
    const { userID, name, examType, email } = req.body;
    const requested = String(userID || "").trim().toLowerCase();

    if (!USERID_REGEX.test(requested)) {
      return res.status(400).json({
        success: false,
        message: "userID must be 4-20 characters, lowercase letters, numbers, and underscore only",
      });
    }

    const conn = getUserDB();
    const User = getUserModel(conn);

    const existingByUid = await User.findOne({ userId: req.userId });
    if (existingByUid?.userID) {
      return res.status(409).json({
        success: false,
        message: "Profile already exists for this account",
        user: existingByUid,
      });
    }

    const available = await isUserIDAvailable(User, requested, req.userId);
    if (!available) {
      return res.status(409).json({
        success: false,
        message: "userID is already taken",
        suggestions: generateUserIDSuggestions(requested),
      });
    }

    const update = { userID: requested };
    if (name) update.name = name;
    if (email) update.email = String(email).trim().toLowerCase();
    if (examType) update.examType = examType;

    const user = await User.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "userID is already taken" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch("/user/userid", firebaseAuth, async (req, res) => {
  try {
    const requested = String(req.body.userID || "").trim().toLowerCase();
    if (!USERID_REGEX.test(requested)) {
      return res.status(400).json({
        success: false,
        message: "userID must be 4-20 characters, lowercase letters, numbers, and underscore only",
      });
    }

    const conn = getUserDB();
    const User = getUserModel(conn);

    const available = await isUserIDAvailable(User, requested, req.userId);
    if (!available) {
      return res.status(409).json({
        success: false,
        message: "userID is already taken",
        suggestions: generateUserIDSuggestions(requested),
      });
    }

    const user = await User.findOneAndUpdate(
      { userId: req.userId },
      { $set: { userID: requested } },
      { new: true, upsert: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "userID is already taken" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/questions", firebaseAuth, async (req, res) => {
  try {
    const { collection = "pcsquestions", exam, subject, topic, year, limit = 50, skip = 0 } = req.query;

    const query = {};
    let examLabel = "all";

    if (!exam) {
      try {
        const conn = getUserDB();
        const User = getUserModel(conn);
        const userProfile = await User.findOne({ userId: req.userId });
        if (userProfile?.examType) {
          query.exam = buildExamMatch(userProfile.examType);
          examLabel = userProfile.examType;
        }
      } catch (e) {}
    } else {
      query.exam = buildExamMatch(exam);
      examLabel = exam;
    }

    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (year) query.year = Number(year);

    const model = getQuestionModel(collection);
    const questions = await model.find(query)
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      count: questions.length,
      exam: examLabel,
      questions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/questions/random", firebaseAuth, async (req, res) => {
  try {
    const { collection = "pcsquestions", exam, subject, topic, year, count = 10 } = req.query;
    const numCount = Math.max(1, Math.min(Number(count) || 10, 100));

    const query = {};
    let examLabel = "all";

    if (!exam) {
      try {
        const userConnLocal = getUserDB();
        const User = getUserModel(userConnLocal);
        const userProfile = await User.findOne({ userId: req.userId });
        if (userProfile?.examType) {
          query.exam = buildExamMatch(userProfile.examType);
          examLabel = userProfile.examType;
        }
      } catch (e) {}
    } else {
      query.exam = buildExamMatch(exam);
      examLabel = exam;
    }

    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (year) query.year = Number(year);

    let attemptedIds = [];
    try {
      const conn = getUserDB();
      const AttemptHistory = getAttemptHistoryModel(conn);
      const attemptedDocs = await AttemptHistory.find({ userId: req.userId }, { questionId: 1 }).lean();
      attemptedIds = attemptedDocs.map((d) => d.questionId);
    } catch (e) {}

    const model = getQuestionModel(collection);

    const baseMatch = { ...query };
    let excludeMatch = { ...baseMatch };
    if (attemptedIds.length > 0) {
      excludeMatch._id = { $nin: attemptedIds };
    }

    let questions = await model.aggregate([
      { $match: excludeMatch },
      { $sample: { size: numCount } },
    ]);

    let usedFallback = false;
    if (questions.length < numCount) {
      usedFallback = true;
      const stillNeeded = numCount - questions.length;
      const alreadyPickedIds = questions.map((q) => q._id);
      const fallbackMatch = { ...baseMatch };
      if (alreadyPickedIds.length > 0) {
        fallbackMatch._id = { $nin: alreadyPickedIds };
      }
      const fallbackQuestions = await model.aggregate([
        { $match: fallbackMatch },
        { $sample: { size: stillNeeded } },
      ]);
      questions = [...questions, ...fallbackQuestions];
    }

    res.json({
      success: true,
      count: questions.length,
      exam: examLabel,
      exhaustedPool: usedFallback,
      questions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/attempt/submit", firebaseAuth, async (req, res) => {
  try {
    const { questionId, selectedOption, isCorrect, isSkipped, timeTakenSeconds, sessionId, questionMeta } = req.body;
    await updateAnalyticsOnSubmit({
      userId: req.userId,
      questionId,
      questionMeta: questionMeta || {},
      selectedOption,
      isCorrect: !!isCorrect,
      isSkipped: !!isSkipped,
      marksEarned: isCorrect ? (questionMeta?.marks || 2) : 0,
      timeTakenSeconds: timeTakenSeconds || 0,
      sessionId,
    });
    res.json({ success: true, message: "Attempt saved successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/test/finish", firebaseAuth, async (req, res) => {
  try {
    const { sessionId, attempts } = req.body;
    if (!Array.isArray(attempts) || attempts.length === 0) {
      return res.status(400).json({ success: false, message: "attempts array is required" });
    }

    const finalSessionId = sessionId || `session-${Date.now()}`;
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let totalMarks = 0;
    let totalTimeSeconds = 0;
    const subjectTally = {};

    for (const a of attempts) {
      const isCorrect = !!a.isCorrect;
      const isSkipped = !!a.isSkipped;
      const marksEarned = isCorrect ? (a.questionMeta?.marks || 2) : (isSkipped ? 0 : -(a.questionMeta?.negativeMarks || 0));

      await updateAnalyticsOnSubmit({
        userId: req.userId,
        questionId: a.questionId,
        questionMeta: a.questionMeta || {},
        selectedOption: a.selectedOption,
        isCorrect,
        isSkipped,
        marksEarned,
        timeTakenSeconds: a.timeTakenSeconds || 0,
        sessionId: finalSessionId,
      });

      if (isSkipped) skipped++;
      else if (isCorrect) correct++;
      else incorrect++;

      totalMarks += marksEarned;
      totalTimeSeconds += a.timeTakenSeconds || 0;

      const subj = a.questionMeta?.subject || "General";
      if (!subjectTally[subj]) subjectTally[subj] = { attempted: 0, correct: 0 };
      subjectTally[subj].attempted++;
      if (isCorrect) subjectTally[subj].correct++;
    }

    const total = attempts.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const subjectBreakdown = Object.entries(subjectTally).map(([subject, v]) => ({
      subject,
      attempted: v.attempted,
      correct: v.correct,
      accuracy: v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
    }));

    try {
      const conn = getUserDB();
      const Analytics = getAnalyticsModel(conn);
      const analytics = await Analytics.findOne({ userId: req.userId });
      if (analytics) {
        analytics.recentSessions = analytics.recentSessions || [];
        analytics.recentSessions.unshift({
          sessionId: finalSessionId,
          score: Math.round(totalMarks * 100) / 100,
          total,
          correct,
          incorrect,
          accuracy,
          timeTakenSeconds: totalTimeSeconds,
          finishedAt: new Date(),
        });
        analytics.recentSessions = analytics.recentSessions.slice(0, 20);
        await analytics.save();
      }
    } catch (e) {}

    res.json({
      success: true,
      sessionId: finalSessionId,
      result: {
        total,
        correct,
        incorrect,
        skipped,
        accuracy,
        totalMarks: Math.round(totalMarks * 100) / 100,
        timeTakenSeconds: totalTimeSeconds,
        subjectBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/user/profile", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const User = getUserModel(conn);
    const Analytics = getAnalyticsModel(conn);
    const [user, analytics] = await Promise.all([
      User.findOne({ userId: req.userId }),
      Analytics.findOne({ userId: req.userId })
    ]);
    res.json({
      success: true,
      profile: user || { userId: req.userId },
      analytics: analytics || {
        totalAttempted: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        overallAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        subjectAccuracy: [],
        recentSessions: [],
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch("/user/profile", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const User = getUserModel(conn);
    const updates = { ...req.body };
    delete updates.userId;
    delete updates.userID;
    const user = await User.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, upsert: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/user/overall-rank", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const AttemptHistory = getAttemptHistoryModel(conn);
    const User = getUserModel(conn);
    const [userAttempts, userProfile] = await Promise.all([
      AttemptHistory.find({ userId: req.userId }).lean(),
      User.findOne({ userId: req.userId }).lean(),
    ]);
    if (userAttempts.length === 0) {
      return res.json({
        success: true,
        hasRank: false,
        message: "Complete at least one test to see your rank.",
        totalMarks: 0,
        totalCorrect: 0,
        attempts: 0,
      });
    }
    let totalMarks = 0;
    let totalCorrect = 0;
    userAttempts.forEach(a => {
      totalCorrect += a.isCorrect ? 1 : 0;
      totalMarks += a.isCorrect ? (a.marksEarned || 2) : 0;
    });
    const betterUsers = await AttemptHistory.aggregate([
      {
        $group: {
          _id: "$userId",
          totalMarks: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, { $ifNull: ["$marksEarned", 2] }, 0] } }
        }
      },
      { $match: { totalMarks: { $gt: totalMarks } } },
      { $count: "count" }
    ]);
    const rank = (betterUsers[0]?.count || 0) + 1;
    const totalParticipants = await AttemptHistory.distinct("userId").then(ids => new Set(ids).size);
    res.json({
      success: true,
      hasRank: true,
      userID: userProfile?.userID || null,
      name: userProfile?.name || null,
      rank,
      totalMarks: Math.round(totalMarks * 100) / 100,
      totalCorrect,
      attempts: userAttempts.length,
      totalParticipants,
      percentile: totalParticipants > 0 ? Math.round(((totalParticipants - rank) / totalParticipants) * 100) : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/leaderboard/global", async (req, res) => {
  try {
    const conn = getUserDB();
    const AttemptHistory = getAttemptHistoryModel(conn);
    const User = getUserModel(conn);
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await AttemptHistory.aggregate([
      {
        $group: {
          _id: "$userId",
          totalMarks: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, { $ifNull: ["$marksEarned", 2] }, 0] } },
          totalCorrect: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
          attempts: { $sum: 1 }
        }
      },
      { $sort: { totalMarks: -1 } },
      { $limit: limit },
      { $project: { userId: "$_id", totalMarks: 1, totalCorrect: 1, attempts: 1, rank: { $literal: 0 } } }
    ]);
    const uids = leaderboard.map((entry) => entry.userId);
    const profiles = await User.find({ userId: { $in: uids } }, { userId: 1, userID: 1, name: 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const publicLeaderboard = leaderboard.map((entry, i) => {
      const profile = profileMap.get(entry.userId);
      return {
        rank: i + 1,
        userID: profile?.userID || "anonymous",
        name: profile?.name || null,
        totalMarks: entry.totalMarks,
        totalCorrect: entry.totalCorrect,
        attempts: entry.attempts,
      };
    });
    res.json({
      success: true,
      leaderboard: publicLeaderboard,
      totalParticipants: await AttemptHistory.distinct("userId").then(ids => new Set(ids).size)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await connectAllDatabases();
    app.listen(PORT, () => {});
  } catch (err) {
    process.exit(1);
  }
}
startServer();
module.exports = {
  app,
  firebaseAuth,
  connectAllDatabases,
  getQuestionDB,
  getUserDB,
  getQuestionModel,
  collections,
  getUserModel,
  getAnalyticsModel,
  getAttemptHistoryModel,
};
