require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const crypto = require("crypto");
const cors = require("cors");
const { log } = require("console");

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) { }
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

// ** Razorpay **
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// **Razorpay **

console.log("Connecting to MongoDB databases...");

log("Connecting to MongoDB databases... log");

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
let caConn = null;
let itConn = null;
let dykConn = null;
let tipConn = null;

async function connectQuestionDB() {
  if (questionConn && questionConn.readyState === 1) return questionConn;
  const uri = process.env.QUESTION_DB_URI;
  if (!uri) throw new Error("QUESTION_DB_URI is not defined in environment variables");
  questionConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });
  questionConn.on("error", () => { });
  questionConn.on("disconnected", () => { });
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
  userConn.on("error", () => { });
  userConn.on("disconnected", () => { });
  await userConn.asPromise();
  return userConn;
}

async function connectCADB() {
  if (caConn && caConn.readyState === 1) return caConn;
  const uri = process.env.CAMONGODB_URI;
  if (!uri) throw new Error("CAMONGODB_URI is not defined in environment variables");
  caConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });
  caConn.on("error", () => { });
  caConn.on("disconnected", () => { });
  await caConn.asPromise();
  return caConn;
}

async function connectITDB() {
  if (itConn && itConn.readyState === 1) return itConn;
  const uri = process.env.ITMONGODB_URI;
  if (!uri) throw new Error("ITMONGODB_URI is not defined in environment variables");
  itConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });
  itConn.on("error", () => { });
  itConn.on("disconnected", () => { });
  await itConn.asPromise();
  return itConn;
}

async function connectDYKDB() {
  if (dykConn && dykConn.readyState === 1) return dykConn;
  const uri = process.env.DYKMONGODB_URI;
  if (!uri) throw new Error("DYKMONGODB_URI is not defined in environment variables");
  dykConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });
  dykConn.on("error", () => { });
  dykConn.on("disconnected", () => { });
  await dykConn.asPromise();
  return dykConn;
}

async function connectTIPDB() {
  if (tipConn && tipConn.readyState === 1) return tipConn;
  const uri = process.env.TIPMONGODB_URI;
  if (!uri) throw new Error("TIPMONGODB_URI is not defined in environment variables");
  tipConn = mongoose.createConnection(uri, {
    ...COMMON_OPTIONS,
    bufferCommands: true,
    bufferTimeoutMS: 30000,
  });
  tipConn.on("error", () => { });
  tipConn.on("disconnected", () => { });
  await tipConn.asPromise();
  return tipConn;
}

async function connectAllDatabases() {
  await Promise.all([
    connectQuestionDB(),
    connectUserDB(),
    connectCADB(),
    connectITDB(),
    connectDYKDB(),
    connectTIPDB(),
  ]);
}

function getQuestionDB() {
  if (!questionConn || questionConn.readyState !== 1) throw new Error("Question DB not connected");
  return questionConn;
}

function getUserDB() {
  if (!userConn || userConn.readyState !== 1) throw new Error("User DB not connected");
  return userConn;
}

function getCADB() {
  if (!caConn || caConn.readyState !== 1) throw new Error("Current Affairs DB not connected");
  return caConn;
}

function getITDB() {
  if (!itConn || itConn.readyState !== 1) throw new Error("Important Topics DB not connected");
  return itConn;
}

function getDYKDB() {
  if (!dykConn || dykConn.readyState !== 1) throw new Error("Did You Know DB not connected");
  return dykConn;
}

function getTIPDB() {
  if (!tipConn || tipConn.readyState !== 1) throw new Error("Today In Past DB not connected");
  return tipConn;
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
  explanation: { type: String, trim: true, default: null },
  correct_answer: { type: Number, required: true },
  batchId: { type: String }
}, { timestamps: true });

const CurrentAffairSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: String, required: true },
  subject: { type: String, required: true, trim: true },
  imgUrl: { type: String, trim: true, default: null },
  overview: { type: String, required: true },
  highlights: { type: [String], default: [] }
}, { timestamps: true });

const ImportantTopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  points: [{ type: String, required: true }]
}, { timestamps: true });

const DidYouKnowSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  explanation: { type: String, required: true },
  subject: { type: String, required: true }
}, { timestamps: true });

const TodayInPastSchema = new mongoose.Schema({
  date: { type: String, required: true },
  year: { type: String, required: true },
  event: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true }
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

function getCAModel() {
  const conn = getCADB();
  if (conn.models.CurrentAffair) return conn.models.CurrentAffair;
  return conn.model("CurrentAffair", CurrentAffairSchema, "ca_articles");
}

function getITModel() {
  const conn = getITDB();
  if (conn.models.ImportantTopic) return conn.models.ImportantTopic;
  return conn.model("ImportantTopic", ImportantTopicSchema, "important_topics");
}

function getDYKModel() {
  const conn = getDYKDB();
  if (conn.models.DidYouKnow) return conn.models.DidYouKnow;
  return conn.model("DidYouKnow", DidYouKnowSchema, "did_you_know");
}

function getTIPModel() {
  const conn = getTIPDB();
  if (conn.models.TodayInPast) return conn.models.TodayInPast;
  return conn.model("TodayInPast", TodayInPastSchema, "today_in_past");
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
      "HPSC", "WBPCS", "OPSC", "KPSC", "TNPCS",
      "SSC CGL", "SSC CHSL", "SSC MTS", "SSC CPO",
      "IBPS PO", "IBPS CLERK", "SBI PO", "SBI CLERK", "RBI GRADE B",
      "RRB NTPC", "RRB GROUP D"
    ],
    index: true,
  },
  // subscription: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Subscription",
  //   default: null
  // },
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

const BookmarkSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  questionId: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  collection: {
    type: String,
    required: true,
    enum: ["pcsquestions", "bookquestions", "paragraphquestions"],
    default: "pcsquestions",
  },
  bookmarkedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: false });

BookmarkSchema.index({ userId: 1, questionId: 1, collection: 1 }, { unique: true });

function getBookmarkModel(connection) {
  if (connection.models.Bookmark) return connection.models.Bookmark;
  return connection.model("Bookmark", BookmarkSchema);
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

function todayMMDD() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return [
    String(ist.getUTCDate()).padStart(2, "0"),
    String(ist.getUTCMonth() + 1).padStart(2, "0")
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

async function updateBookmarkCount(userId, delta) {
  try {
    const conn = getUserDB();
    const Analytics = getAnalyticsModel(conn);
    await Analytics.findOneAndUpdate(
      { userId },
      { $inc: { bookmarkCount: delta } },
      { upsert: true }
    );
  } catch (e) { }
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

    // await Usage.findOneAndUpdate(
    //   { userId: req.userId },
    //   { $setOnInsert: { userId: req.userId } },
    //   { upsert: true }
    // );

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

// ** Razorpay **

app.post('/subscription/create', firebaseAuth, async (req, res) => {
  try {
    console.log('Creating subscription for user:', req.userId);
    const options = {
      plan_id: "rzp_test_T7KlMba6nKjFRr",
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
    };

    const subscription = await razorpay.subscriptions.create(options);

    console.log('Subscription created:', subscription);
    console.log('Subscription ID:', subscription.id);

    res.status(200).json({ success: true, subscription_id: subscription.id });
  } catch (error) {
    console.log('Error creating subscription:', error);
    res.status(500).json({ success: false, error: error.message, details: error });
  }
});

app.post('/subscription/verify', firebaseAuth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

    // Generate expected signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      // TODO: Update subscription status to "ACTIVE" in your database
      res.status(200).json({ success: true, message: "Subscription verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature verification failed" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ** Razorpay **

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
      } catch (e) { }
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
      } catch (e) { }
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
    } catch (e) { }

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
      const marksEarned = isCorrect
        ? (a.questionMeta?.marks || 2)
        : (isSkipped ? 0 : -(a.questionMeta?.negativeMarks || 0));

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
    } catch (e) { }

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

app.post("/bookmark", firebaseAuth, async (req, res) => {
  try {
    const { questionId, collection: col = "pcsquestions" } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, message: "questionId is required" });
    }

    const validCollections = ["pcsquestions", "bookquestions", "paragraphquestions"];
    if (!validCollections.includes(col)) {
      return res.status(400).json({
        success: false,
        message: `collection must be one of: ${validCollections.join(", ")}`,
      });
    }

    const conn = getUserDB();
    const Bookmark = getBookmarkModel(conn);

    const existing = await Bookmark.findOne({
      userId: req.userId,
      questionId,
      collection: col,
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Question is already bookmarked",
        bookmark: existing,
      });
    }

    const bookmark = await Bookmark.create({
      userId: req.userId,
      questionId,
      collection: col,
      bookmarkedAt: new Date(),
    });

    await updateBookmarkCount(req.userId, 1);

    res.status(201).json({ success: true, bookmark });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Question is already bookmarked" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/bookmarks", firebaseAuth, async (req, res) => {
  try {
    const { collection: colFilter, limit = 50, skip = 0 } = req.query;

    const conn = getUserDB();
    const Bookmark = getBookmarkModel(conn);

    const bookmarkQuery = { userId: req.userId };
    if (colFilter) bookmarkQuery.collection = colFilter;

    const bookmarks = await Bookmark.find(bookmarkQuery)
      .sort({ bookmarkedAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    if (bookmarks.length === 0) {
      return res.json({ success: true, count: 0, bookmarks: [] });
    }

    const byCollection = {};
    for (const bm of bookmarks) {
      if (!byCollection[bm.collection]) byCollection[bm.collection] = [];
      byCollection[bm.collection].push(bm.questionId);
    }

    const questionMap = new Map();
    await Promise.all(
      Object.entries(byCollection).map(async ([col, ids]) => {
        try {
          const model = getQuestionModel(col);
          const questions = await model.find({ _id: { $in: ids } }).lean();
          for (const q of questions) {
            questionMap.set(`${col}::${q._id}`, q);
          }
        } catch (e) { }
      })
    );

    const enrichedBookmarks = bookmarks.map((bm) => ({
      bookmarkId: bm._id,
      bookmarkedAt: bm.bookmarkedAt,
      collection: bm.collection,
      question: questionMap.get(`${bm.collection}::${bm.questionId}`) || null,
    }));

    res.json({
      success: true,
      count: enrichedBookmarks.length,
      bookmarks: enrichedBookmarks,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/bookmark/:questionId", firebaseAuth, async (req, res) => {
  try {
    const { questionId } = req.params;
    const col = req.query.collection || "pcsquestions";

    const conn = getUserDB();
    const Bookmark = getBookmarkModel(conn);

    let deleted = await Bookmark.findOneAndDelete({
      userId: req.userId,
      questionId,
      collection: col,
    });

    if (!deleted) {
      const numericId = Number(questionId);
      if (!isNaN(numericId)) {
        deleted = await Bookmark.findOneAndDelete({
          userId: req.userId,
          questionId: numericId,
          collection: col,
        });
      }
    }

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Bookmark not found" });
    }

    await updateBookmarkCount(req.userId, -1);

    res.json({ success: true, message: "Bookmark removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/current-affairs", firebaseAuth, async (req, res) => {
  try {
    const { limit = 20, skip = 0, subject, date, search } = req.query;

    const CurrentAffair = getCAModel();
    const filter = {};
    if (subject) filter.subject = subject;
    if (date) filter.date = date;
    if (search) filter.title = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      CurrentAffair.find(filter).sort({ date: -1, createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
      CurrentAffair.countDocuments(filter)
    ]);

    res.json({ success: true, total, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/current-affairs/subjects", firebaseAuth, async (req, res) => {
  try {
    const CurrentAffair = getCAModel();
    const subjects = await CurrentAffair.distinct("subject");
    res.json({ success: true, subjects: subjects.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/current-affairs/:id", firebaseAuth, async (req, res) => {
  try {
    const CurrentAffair = getCAModel();
    const item = await CurrentAffair.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Current affair not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/important-topics", firebaseAuth, async (req, res) => {
  try {
    const { limit = 20, skip = 0, subject, search } = req.query;

    const ImportantTopic = getITModel();
    const filter = {};
    if (subject) filter.subject = subject;
    if (search) filter.title = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      ImportantTopic.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
      ImportantTopic.countDocuments(filter)
    ]);

    res.json({ success: true, total, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/important-topics/subjects", firebaseAuth, async (req, res) => {
  try {
    const ImportantTopic = getITModel();
    const subjects = await ImportantTopic.distinct("subject");
    res.json({ success: true, subjects: subjects.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/important-topics/:id", firebaseAuth, async (req, res) => {
  try {
    const ImportantTopic = getITModel();
    const item = await ImportantTopic.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Important topic not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/did-you-know", firebaseAuth, async (req, res) => {
  try {
    const { limit = 20, skip = 0, subject, search } = req.query;

    const DidYouKnow = getDYKModel();
    const filter = {};
    if (subject) filter.subject = subject;
    if (search) filter.question = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      DidYouKnow.find(filter).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
      DidYouKnow.countDocuments(filter)
    ]);

    res.json({ success: true, total, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/did-you-know/random", firebaseAuth, async (req, res) => {
  try {
    const { subject, count = 1 } = req.query;
    const numCount = Math.max(1, Math.min(Number(count) || 1, 50));

    const DidYouKnow = getDYKModel();
    const match = {};
    if (subject) match.subject = subject;

    const items = await DidYouKnow.aggregate([
      { $match: match },
      { $sample: { size: numCount } },
    ]);

    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/did-you-know/subjects", firebaseAuth, async (req, res) => {
  try {
    const DidYouKnow = getDYKModel();
    const subjects = await DidYouKnow.distinct("subject");
    res.json({ success: true, subjects: subjects.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/did-you-know/:id", firebaseAuth, async (req, res) => {
  try {
    const DidYouKnow = getDYKModel();
    const item = await DidYouKnow.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Did You Know item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/today-in-past/today", firebaseAuth, async (req, res) => {
  try {
    const TodayInPast = getTIPModel();
    const mmdd = todayMMDD();

    const [items, total] = await Promise.all([
      TodayInPast.find({ date: mmdd }).sort({ year: 1 }).lean(),
      TodayInPast.countDocuments({ date: mmdd })
    ]);

    res.json({ success: true, date: mmdd, total, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/today-in-past/subjects", firebaseAuth, async (req, res) => {
  try {
    const TodayInPast = getTIPModel();
    const subjects = await TodayInPast.distinct("subject");
    res.json({ success: true, subjects: subjects.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/today-in-past/random", firebaseAuth, async (req, res) => {
  try {
    const { subject, count = 5 } = req.query;
    const numCount = Math.max(1, Math.min(Number(count) || 5, 50));

    const TodayInPast = getTIPModel();
    const match = {};
    if (subject) match.subject = subject;

    const items = await TodayInPast.aggregate([
      { $match: match },
      { $sample: { size: numCount } },
    ]);

    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/today-in-past", firebaseAuth, async (req, res) => {
  try {
    const { limit = 20, skip = 0, subject, date, search } = req.query;

    const TodayInPast = getTIPModel();
    const filter = {};
    if (subject) filter.subject = subject;
    if (date) filter.date = date;
    if (search) filter.event = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      TodayInPast.find(filter).sort({ date: 1, year: 1 }).skip(Number(skip)).limit(Number(limit)).lean(),
      TodayInPast.countDocuments(filter)
    ]);

    res.json({ success: true, total, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/today-in-past/:id", firebaseAuth, async (req, res) => {
  try {
    const TodayInPast = getTIPModel();
    const item = await TodayInPast.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: "Today In Past item not found" });
    res.json({ success: true, data: item });
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
    app.listen(PORT, () => { });
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
  getCADB,
  getITDB,
  getDYKDB,
  getTIPDB,
  getQuestionModel,
  getCAModel,
  getITModel,
  getDYKModel,
  getTIPModel,
  collections,
  getUserModel,
  getAnalyticsModel,
  getAttemptHistoryModel,
  getBookmarkModel,
};
