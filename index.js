require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const crypto = require("crypto");
const cors = require("cors");
const { log } = require("console");
const { type } = require("os");

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

app.use(
  express.json({
    limit: "10mb",

    verify: (req, res, buf) => {
      if (req.originalUrl === "/subscription/webhook") {
        req.rawBody = buf.toString("utf8");
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));
mongoose.set("bufferCommands", true);
mongoose.set("bufferTimeoutMS", 30000);

const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  "https://prepswipe.app";

// ** Razorpay **
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_PLAN_ID = process.env.RAZORPAY_PLAN_ID;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// **Razorpay **

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
    options: { type: Object, required: true },
    english_explanation: { type: String, trim: true, default: '' }
  },
  hindi: {
    question: { type: String, required: true },
    options: { type: Object, required: true },
    hindi_explanation: { type: String, trim: true, default: '' }
  },
  marks: { type: Number, default: 2 },
  negativeMarks: { type: Number, default: 0.66 },
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
  isPremium: {
    type: Boolean,
    default: false
  },

  subscriptionId: {
    type: String,
    default: null
  },

  subscriptionStatus: {
    type: String,
    default: null
  },

  premiumExpiry: {
    type: Date,
    default: null
  },

  lastPaymentId: {
    type: String,
    default: null
  }
}, { timestamps: true });


function getUserModel(connection) {
  if (connection.models.User) return connection.models.User;
  return connection.model("User", UserSchema);
}

// ** subscription helpers **

function subscriptionIsPremium(user) {
  return !!user?.isPremium;
}

async function updatePremiumStatus(userId) {

  const conn = getUserDB();
  const User = getUserModel(conn);

  const user = await User.findOne({ userId });

  if (!user) return null;

  return {
    premium: user.isPremium,
    expiry: user.premiumExpiry,
    status: user.subscriptionStatus,
  };
}

async function fetchSubscription(subscriptionId) {
  return await razorpay.subscriptions.fetch(subscriptionId);
}

function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

function mapSubscriptionStatus(status) {
  switch (status) {
    case "active":
    case "authenticated":
    case "pending":
      return true;

    default:
      return false;
  }
}


async function syncSubscription(userId) {
  const conn = getUserDB();
  const User = getUserModel(conn);

  const user = await User.findOne({ userId });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.subscriptionId) {
    throw new Error("No subscription found");
  }

  const subscription = await razorpay.subscriptions.fetch(
    user.subscriptionId
  );

  user.subscriptionStatus = subscription.status;

  await user.save();

  return {
    premium: user.isPremium,
    status: user.subscriptionStatus,
    expiry: user.premiumExpiry,
    subscriptionId: user.subscriptionId,
  };
}

// ** subscription helpers **

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
  collectionname: {
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

BookmarkSchema.index({ userId: 1, questionId: 1, collectionname: 1 }, { unique: true });

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

app.get("/subscription/config", firebaseAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      key: RAZORPAY_KEY_ID,
      planId: RAZORPAY_PLAN_ID,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/subscription/create", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const User = getUserModel(conn);

    const user = await User.findOne({ userId: req.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't create another active subscription
    if (user.subscriptionId) {
      try {
        const existing = await razorpay.subscriptions.fetch(
          user.subscriptionId
        );

        // Keep local DB in sync
        user.subscriptionStatus = existing.status;
        await user.save();

        const reusableStatuses = [
          "created",
          "authenticated",
          "active",
          "pending",
        ];

        if (reusableStatuses.includes(existing.status)) {
          return res.json({
            success: true,
            alreadyExists: true,
            subscriptionId: existing.id,
            status: existing.status,
            key: RAZORPAY_KEY_ID,
          });
        }
      } catch (e) {
        return res.json({
          success: false,
          error: e,
        })
      }
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: RAZORPAY_PLAN_ID,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: {
        firebase_uid: req.userId,
      },
    });

    user.subscriptionId = subscription.id;
    user.subscriptionStatus = subscription.status;

    await user.save();

    res.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      key: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/subscription/status", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const User = getUserModel(conn);

    const user = await User.findOne({ userId: req.userId });

    if (!user) {
      return res.json({
        success: true,
        premium: false,
      });
    }

    const premium = user.isPremium;

    res.json({
      success: true,

      premium: user.isPremium,

      status: user.subscriptionStatus,

      expiry: user.premiumExpiry,

      subscriptionId: user.subscriptionId,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post(
  "/subscription/refresh",
  firebaseAuth,
  async (req, res) => {
    try {
      const result = await syncSubscription(req.userId);

      res.json({
        success: true,
        ...result,
      });

    } catch (err) {

      res.status(500).json({
        success: false,
        message: err.message,
      });

    }
  }
);

app.post(
  "/subscription/verify",
  firebaseAuth,
  async (req, res) => {
    try {
      const {
        razorpay_payment_id,
        razorpay_subscription_id,
        razorpay_signature,
      } = req.body;

      const generated = crypto
        .createHmac(
          "sha256",
          RAZORPAY_KEY_SECRET
        )
        .update(
          razorpay_payment_id +
          "|" +
          razorpay_subscription_id
        )
        .digest("hex");

      if (generated !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Invalid signature",
        });
      }

      res.json({
        success: true,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// ** Razorpay **

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
  getUserModel,
  getAnalyticsModel,
  getAttemptHistoryModel,
  getBookmarkModel,
};