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

// ** community
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

// COMMUNITY CHALLENGES

const ChallengeSchema = new mongoose.Schema(
  {
    inviteCode: {
      type: String,
      unique: true,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    shareUrl: {
      type: String,
      required: true,
    },

    ownerId: {
      type: String,
      required: true,
      index: true,
    },

    ownerUserID: {
      type: String,
      default: null,
    },

    ownerName: {
      type: String,
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    exam: {
      type: String,
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      index: true,
    },

    topic: {
      type: String,
      default: null,
    },

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      index: true,
    },

    password: {
      type: String,
      default: null,
    },

    questionSource: {
      type: String,
      enum: [
        "random",
        "manual",
        "bookmarks",
        "wrong",
      ],
      default: "random",
    },

    questionCount: {
      type: Number,
      required: true,
      min: 5,
      max: 30,
    },

    questions: [
      {
        questionId: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },

        order: {
          type: Number,
          required: true,
        },

        marks: {
          type: Number,
          default: 1,
        },

        negativeMarks: {
          type: Number,
          default: 0,
        },
      },
    ],

    collection: {
      type: String,
      enum: [
        "pcsquestions",
        "bookquestions",
        "paragraphquestions",
      ],
      default: "pcsquestions",
    },

    maxParticipants: {
      type: Number,
      default: 10,
      min: 2,
      max: 20,
    },

    participantCount: {
      type: Number,
      default: 1,
    },

    status: {
      type: String,
      enum: [
        "waiting",
        "running",
        "completed",
        "cancelled",
      ],
      default: "waiting",
      index: true,
    },

    allowLateJoin: {
      type: Boolean,
      default: false,
    },

    autoStart: {
      type: Boolean,
      default: false,
    },

    startsAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    totalAttempts: {
      type: Number,
      default: 0,
    },

    winnerId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ChallengeSchema.index({
  visibility: 1,
  status: 1,
  createdAt: -1,
});

ChallengeSchema.index({
  ownerId: 1,
  createdAt: -1,
});

ChallengeSchema.index({
  exam: 1,
  subject: 1,
});

// CHALLENGE PARTICIPANTS

const ChallengeParticipantSchema = new mongoose.Schema(
  {
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    userID: {
      type: String,
      default: null,
    },

    name: {
      type: String,
      default: null,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    finishedAt: {
      type: Date,
      default: null,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    currentQuestion: {
      type: Number,
      default: 0,
    },

    correct: {
      type: Number,
      default: 0,
    },

    incorrect: {
      type: Number,
      default: 0,
    },

    skipped: {
      type: Number,
      default: 0,
    },

    score: {
      type: Number,
      default: 0,
    },

    accuracy: {
      type: Number,
      default: 0,
    },

    totalTimeSeconds: {
      type: Number,
      default: 0,
    },

    rank: {
      type: Number,
      default: 0,
    },

    isOwner: {
      type: Boolean,
      default: false,
    },

    hasLeft: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ChallengeParticipantSchema.index(
  {
    challengeId: 1,
    userId: 1,
  },
  {
    unique: true,
  }
);

ChallengeParticipantSchema.index({
  challengeId: 1,
  score: -1,
  totalTimeSeconds: 1,
});

function getChallengeModel(connection) {
  if (connection.models.Challenge) {
    return connection.models.Challenge;
  }

  return connection.model(
    "Challenge",
    ChallengeSchema,
    "community_challenges"
  );
}

function getChallengeParticipantModel(connection) {
  if (connection.models.ChallengeParticipant) {
    return connection.models.ChallengeParticipant;
  }

  return connection.model(
    "ChallengeParticipant",
    ChallengeParticipantSchema,
    "community_participants"
  );
}

// ** Community **


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

// ** Community **

function generateInviteCode(length = 6) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return code;
}

async function generateUniqueInviteCode() {

  const conn = getUserDB();

  const Challenge =
    getChallengeModel(conn);

  while (true) {

    const code = generateInviteCode();

    const exists =
      await Challenge.exists({
        inviteCode: code,
      });

    if (!exists) {
      return code;
    }

  }

}

function hashRoomPassword(password) {

  if (!password) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

}

function verifyRoomPassword(
  password,
  hash
) {

  if (!hash) {
    return true;
  }

  return (
    hashRoomPassword(password) === hash
  );

}

function generateChallengeLink(
  inviteCode
) {

  return `${APP_BASE_URL}/join/${inviteCode}`;

}

function validateChallenge({
  title,
  questionCount,
  maxParticipants,
}) {

  if (!title?.trim()) {
    return "Title is required.";
  }

  if (
    questionCount < 5 ||
    questionCount > 200
  ) {
    return "Questions must be between 5 and 200.";
  }

  if (
    maxParticipants < 2 ||
    maxParticipants > 500
  ) {
    return "Participants must be between 2 and 500.";
  }

  return null;

}

async function fetchRandomQuestions({
  collection = "pcsquestions",
  exam,
  subject,
  topic,
  count = 10,
}) {
  const numCount = Math.max(1, Math.min(Number(count) || 10, 100));
  const model = getQuestionModel(collection);

  const query = {};
  if (exam) {
    query.exam = buildExamMatch(exam);
  }
  if (subject) {
    query.subject = subject;
  }
  if (topic) {
    query.topic = topic;
  }

  const questions = await model.aggregate([
    { $match: query },
    { $sample: { size: numCount } },
  ]);

  return questions;
}

async function fetchManualQuestions({
  collection = "pcsquestions",
  questionIds,
}) {

  const Question =
    getQuestionModel(collection);

  return await Question.find({
    _id: {
      $in: questionIds,
    },
  });

}

function sortLeaderboard(
  participants
) {

  return participants.sort(
    (a, b) => {

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        a.totalTimeSeconds -
        b.totalTimeSeconds
      );

    }
  );

}

function assignRanks(
  participants
) {

  const sorted =
    sortLeaderboard(participants);

  sorted.forEach((p, index) => {
    p.rank = index + 1;
  });

  return sorted;

}

function isChallengeOwner(
  challenge,
  userId
) {

  return challenge.ownerId === userId;

}

function sanitizeChallenge(
  challenge
) {

  const obj =
    challenge.toObject
      ? challenge.toObject()
      : challenge;

  delete obj.password;

  return obj;

}



// ** Community **


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

// ** Community** 

// CREATE COMMUNITY CHALLENGE
app.post(
  "/community/create",
  firebaseAuth,
  async (req, res) => {
    try {

      const {
        title,
        description = "",
        exam,
        subject,
        topic,
        visibility = "public",
        password = "",
        questionSource = "random",
        questionIds = [],
        questionCount = 20,
        collection = "pcsquestions",
        maxParticipants = 10,
        allowLateJoin = false,
        autoStart = false,
        startsAt = null,
        expiresAt = null,
      } = req.body;

      const validationError = validateChallenge({
        title,
        questionCount,
        maxParticipants,
      });

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      if (
        !["public", "private"].includes(
          visibility
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "visibility must be public or private",
        });
      }

      if (
        ![
          "random",
          "manual",
          "bookmarks",
          "wrong",
        ].includes(questionSource)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid question source",
        });
      }

      if (
        questionSource === "manual" &&
        (!Array.isArray(questionIds) ||
          questionIds.length === 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Manual mode requires questionIds",
        });
      }

      const conn = getUserDB();

      const User =
        getUserModel(conn);

      const Challenge =
        getChallengeModel(conn);

      const ChallengeParticipant =
        getChallengeParticipantModel(conn);

      const owner =
        await User.findOne({
          userId: req.userId,
        });

      if (!owner) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const inviteCode =
        await generateUniqueInviteCode();

      const passwordHash =
        visibility === "private"
          ? hashRoomPassword(password)
          : null;

      const shareUrl =
        generateChallengeLink(inviteCode);

      let selectedQuestions = [];

      let challengeDocument = null;

      let participantDocument = null;

      // Prioritize client-provided questionIds (supports both client-side random and manual selections)
      if (Array.isArray(questionIds) && questionIds.length > 0) {
        selectedQuestions = await fetchManualQuestions({
          collection,
          questionIds,
        });

        if (selectedQuestions.length !== questionIds.length) {
          return res.status(400).json({
            success: false,
            message: "Some selected questions do not exist in the database.",
          });
        }
      } else if (questionSource === "random") {
        // Fallback: If no explicit IDs are sent but source is random, fetch on the backend
        selectedQuestions = await fetchRandomQuestions({
          collection,
          exam,
          subject,
          topic,
          count: Number(questionCount),
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Manual mode requires a valid list of questionIds.",
        });
      }

      if (
        !Array.isArray(selectedQuestions) ||
        selectedQuestions.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "No questions found for this challenge.",
        });
      }

      const challengeQuestions =
        selectedQuestions.map((question, index) => ({
          questionId: question._id,
          order: index + 1,
          marks: 1,
          negativeMarks: 0,
        }));


      challengeDocument = await Challenge.create({
        inviteCode,

        ownerId: req.userId,

        ownerUserID: owner.userID || null,

        ownerName:
          owner.name ||
          owner.displayName ||
          owner.fullName ||
          "Unknown",

        title: title.trim(),

        description,

        exam,

        subject,

        topic,

        visibility,

        password: passwordHash,

        mode: questionSource,

        questionCount,

        questions: challengeQuestions,

        collection,

        maxParticipants,

        participantCount: 1,

        status: autoStart ? "running" : "waiting",

        allowLateJoin,

        autoStart,

        startsAt,

        expiresAt,
      });

      try {

        participantDocument =
          await ChallengeParticipant.create({

            challengeId:
              challengeDocument._id,

            userId: req.userId,

            userID:
              owner.userID || null,

            name:
              owner.name ||
              owner.displayName ||
              owner.fullName ||
              "Unknown",

            joinedAt: new Date(),

            startedAt: null,

            finishedAt: null,

            completed: false,

            currentQuestion: 0,

            correct: 0,

            incorrect: 0,

            skipped: 0,

            score: 0,

            accuracy: 0,

            totalTimeSeconds: 0,

            rank: 0,

            isOwner: true,

            hasLeft: false,
          });

      } catch (err) {

        // Rollback Challenge

        await Challenge.findByIdAndDelete(
          challengeDocument._id,
        );

        throw err;

      }

      return res.status(201).json({

        success: true,

        message:
          "Challenge created successfully.",

        challenge:
          sanitizeChallenge(
            challengeDocument,
          ),

        participant: participantDocument,

        share: {

          inviteCode,

          url: shareUrl,

        },

      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });

    }
  }
);

// JOIN A COMMUNITY CHALLENGE
app.post("/community/:id/join", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);
    const User = getUserModel(conn);

    const id = req.params.id;
    const { password } = req.body;

    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge room not found" });
    }

    // Verify room status
    if (challenge.status === "completed" || challenge.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: `This challenge has already been ${challenge.status}`
      });
    }

    if (challenge.status === "running" && !challenge.allowLateJoin) {
      return res.status(400).json({
        success: false,
        message: "This challenge has already started and late joining is disabled"
      });
    }

    // Verify room capacity
    const activeParticipantCount = await ChallengeParticipant.countDocuments({
      challengeId: challenge._id,
      hasLeft: false
    });

    if (activeParticipantCount >= challenge.maxParticipants) {
      return res.status(400).json({ success: false, message: "This room is full" });
    }

    // Password validation for private rooms
    if (challenge.visibility === "private" && challenge.password) {
      if (!password || !verifyRoomPassword(password, challenge.password)) {
        return res.status(401).json({ success: false, message: "Incorrect password for this private room" });
      }
    }

    // Check if user is already a participant
    let participant = await ChallengeParticipant.findOne({
      challengeId: challenge._id,
      userId: req.userId
    });

    if (participant) {
      if (participant.hasLeft) {
        // Re-join if user previously left
        participant.hasLeft = false;
        await participant.save();
        challenge.participantCount = await ChallengeParticipant.countDocuments({ challengeId: challenge._id, hasLeft: false });
        await challenge.save();
      }
      return res.json({
        success: true,
        message: "You have already joined this room",
        challenge: sanitizeChallenge(challenge),
        participant
      });
    }

    // Fetch user details to save snapshot in participant record
    const user = await User.findOne({ userId: req.userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User profile not found" });
    }

    // Register participant
    participant = await ChallengeParticipant.create({
      challengeId: challenge._id,
      userId: req.userId,
      userID: user.userID || null,
      name: user.name || "Unknown User",
      isOwner: challenge.ownerId === req.userId,
    });

    // Update dynamic participant count on challenge document
    challenge.participantCount = await ChallengeParticipant.countDocuments({
      challengeId: challenge._id,
      hasLeft: false
    });
    await challenge.save();

    return res.status(201).json({
      success: true,
      message: "Joined challenge successfully",
      challenge: sanitizeChallenge(challenge),
      participant
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// START THE CHALLENGE (MANUAL START BY OWNER)
app.post("/community/:id/start", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);

    const id = req.params.id;
    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    if (challenge.ownerId !== req.userId) {
      return res.status(403).json({ success: false, message: "Only the challenge host can start the room" });
    }

    if (challenge.status !== "waiting") {
      return res.status(400).json({ success: false, message: `Challenge has already started or finished` });
    }

    challenge.status = "running";
    challenge.startsAt = new Date();
    await challenge.save();

    return res.json({
      success: true,
      message: "Challenge has successfully started",
      challenge: sanitizeChallenge(challenge)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// START THE TIMER FOR A SPECIFIC PARTICIPANT ATTEMPT
app.post("/community/:id/start-attempt", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);

    const id = req.params.id;
    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    const participant = await ChallengeParticipant.findOne({ challengeId: challenge._id, userId: req.userId });
    if (!participant) {
      return res.status(403).json({ success: false, message: "You are not registered in this challenge" });
    }

    if (participant.startedAt) {
      return res.json({ success: true, message: "Timer already running", participant });
    }

    participant.startedAt = new Date();
    await participant.save();

    return res.json({
      success: true,
      message: "Attempt timer started",
      participant
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET QUESTIONS FOR A CHALLENGE ROOM
app.get("/community/:id/questions", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);

    const id = req.params.id;
    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    // Enforce membership checks
    const isMember = await ChallengeParticipant.exists({
      challengeId: challenge._id,
      userId: req.userId,
      hasLeft: false
    });

    if (!isMember && challenge.ownerId !== req.userId) {
      return res.status(403).json({ success: false, message: "You must join this room to fetch questions" });
    }

    const questionIds = challenge.questions.map(q => q.questionId);
    const QuestionModel = getQuestionModel(challenge.collection || "pcsquestions");

    const rawQuestions = await QuestionModel.find({ _id: { $in: questionIds } }).lean();

    // Re-map to preserve original manual or randomized order and assign custom challenge weights
    const orderedQuestions = challenge.questions.map(challengeQ => {
      const match = rawQuestions.find(q => String(q._id) === String(challengeQ.questionId));
      if (match) {
        return {
          ...match,
          marks: challengeQ.marks,
          negativeMarks: challengeQ.negativeMarks,
          order: challengeQ.order
        };
      }
      return null;
    }).filter(q => q !== null);

    return res.json({
      success: true,
      questions: orderedQuestions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// SUBMIT FINISHED QUIZ (AND RE-RANK LEADERBOARD)
app.post("/community/:id/finish", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);

    const id = req.params.id;
    const { answers, totalTimeSeconds } = req.body;

    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    let participant = await ChallengeParticipant.findOne({ challengeId: challenge._id, userId: req.userId });
    if (!participant) {
      return res.status(404).json({ success: false, message: "Participant entry not found" });
    }

    if (participant.completed) {
      return res.status(400).json({ success: false, message: "You have already completed this challenge" });
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let calculatedScore = 0;

    // Secure calculations via the verification of provided answer data
    if (Array.isArray(answers)) {
      answers.forEach(ans => {
        const challengeQ = challenge.questions.find(cq => String(cq.questionId) === String(ans.questionId));
        if (challengeQ) {
          if (ans.isSkipped) {
            skippedCount++;
          } else if (ans.isCorrect) {
            correctCount++;
            calculatedScore += (challengeQ.marks || 1);
          } else {
            incorrectCount++;
            calculatedScore -= (challengeQ.negativeMarks || 0);
          }
        }
      });
    } else {
      // Fallback fallback parameters
      correctCount = Number(req.body.correct) || 0;
      incorrectCount = Number(req.body.incorrect) || 0;
      skippedCount = Number(req.body.skipped) || 0;
      calculatedScore = Number(req.body.score) || 0;
    }

    const totalCalculated = correctCount + incorrectCount + skippedCount;
    const denominator = totalCalculated > 0 ? totalCalculated : challenge.questionCount;
    const accuracy = Math.round((correctCount / denominator) * 100);

    participant.completed = true;
    participant.correct = correctCount;
    participant.incorrect = incorrectCount;
    participant.skipped = skippedCount;
    participant.score = Number(calculatedScore.toFixed(2));
    participant.accuracy = isNaN(accuracy) ? 0 : accuracy;
    participant.totalTimeSeconds = Number(totalTimeSeconds) || 0;
    participant.finishedAt = new Date();

    await participant.save();

    // Increment overall room attempt counts
    challenge.totalAttempts = (challenge.totalAttempts || 0) + 1;

    // Recalculate global ranks dynamically for completed users inside this room
    const allParticipants = await ChallengeParticipant.find({ challengeId: challenge._id, hasLeft: false });
    const completedParticipants = allParticipants.filter(p => p.completed);

    const sortedParticipants = assignRanks(completedParticipants);

    // Persist finalized dynamic rankings
    for (const p of sortedParticipants) {
      await ChallengeParticipant.updateOne(
        { _id: p._id },
        { $set: { rank: p.rank } }
      );
    }

    // Set or update current room winner
    if (sortedParticipants.length > 0) {
      challenge.winnerId = sortedParticipants[0].userId;
    }

    // Autoupdate room status to completed if all active participants have completed
    const unfinishedCount = allParticipants.filter(p => !p.completed).length;
    if (unfinishedCount === 0 && challenge.status === "running") {
      challenge.status = "completed";
    }

    await challenge.save();

    return res.json({
      success: true,
      message: "Quiz submitted successfully",
      participant,
      rank: participant.rank
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// LEAVE A COMMUNITY CHALLENGE
app.post("/community/:id/leave", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);

    const id = req.params.id;
    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    const participant = await ChallengeParticipant.findOne({ challengeId: challenge._id, userId: req.userId });
    if (!participant) {
      return res.status(404).json({ success: false, message: "You are not registered in this room" });
    }

    if (participant.isOwner) {
      return res.status(400).json({
        success: false,
        message: "Room hosts cannot leave. Delete the challenge room instead."
      });
    }

    if (challenge.status === "waiting") {
      // Hard delete from collection prior to quiz initialization
      await ChallengeParticipant.deleteOne({ _id: participant._id });
    } else {
      // Soft leave to maintain participant data integrity for current leaderboard results
      participant.hasLeft = true;
      await participant.save();
    }

    // Sync updated room counts
    challenge.participantCount = await ChallengeParticipant.countDocuments({
      challengeId: challenge._id,
      hasLeft: false
    });
    await challenge.save();

    return res.json({
      success: true,
      message: "Successfully left the challenge room"
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE A COMMUNITY CHALLENGE
app.delete("/community/:id", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);

    const id = req.params.id;
    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    if (challenge.ownerId !== req.userId) {
      return res.status(403).json({ success: false, message: "Only the host can delete this room" });
    }

    // Delete challenge document and clean up participant entries
    await Promise.all([
      Challenge.deleteOne({ _id: challenge._id }),
      ChallengeParticipant.deleteMany({ challengeId: challenge._id })
    ]);

    return res.json({
      success: true,
      message: "Challenge room has been deleted"
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// SEARCH QUESTIONS FOR MANUAL SELECTION
app.get("/community/questions/search", firebaseAuth, async (req, res) => {
  try {
    const { collection = "pcsquestions", exam, subject, topic, search, limit = 20, skip = 0 } = req.query;
    const query = {};

    if (exam) query.exam = buildExamMatch(exam);
    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (search) {
      // Searches English question text
      query["english.question"] = { $regex: search, $options: "i" };
    }

    const QuestionModel = getQuestionModel(collection);
    const [questions, total] = await Promise.all([
      QuestionModel.find(query).skip(Number(skip)).limit(Number(limit)).lean(),
      QuestionModel.countDocuments(query)
    ]);

    // Return streamlined projections to keep payloads light
    const candidateList = questions.map(q => ({
      id: q._id,
      exam: q.exam,
      subject: q.subject,
      topic: q.topic,
      questionText: q.english?.question || q.hindi?.question || ""
    }));

    res.json({
      success: true,
      total,
      count: candidateList.length,
      questions: candidateList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE USER PROGRESS IN THE ACTIVE CHALLENGE
app.patch("/community/:id/progress", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const ChallengeParticipant = getChallengeParticipantModel(conn);
    const Challenge = getChallengeModel(conn);

    const id = req.params.id;
    const { currentQuestionIndex } = req.body; // e.g., index of the question the user is on

    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    if (challenge.status !== "running") {
      return res.status(400).json({ success: false, message: "Progress can only be updated while the challenge is running" });
    }

    const participant = await ChallengeParticipant.findOneAndUpdate(
      { challengeId: challenge._id, userId: req.userId },
      { $set: { currentQuestion: Number(currentQuestionIndex) } },
      { new: true }
    );

    if (!participant) {
      return res.status(404).json({ success: false, message: "You are not an active participant of this challenge" });
    }

    res.json({
      success: true,
      currentQuestion: participant.currentQuestion
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FETCH CHALLENGE LEADERBOARD & REAL-TIME STANDINGS
app.get("/community/:id/leaderboard", firebaseAuth, async (req, res) => {
  try {
    const conn = getUserDB();
    const Challenge = getChallengeModel(conn);
    const ChallengeParticipant = getChallengeParticipantModel(conn);

    const id = req.params.id;
    let challenge = await Challenge.findById(mongoose.Types.ObjectId.isValid(id) ? id : null);
    if (!challenge) {
      challenge = await Challenge.findOne({ inviteCode: String(id).toUpperCase() });
    }

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    // Retrieve active participants who haven't permanently abandoned/left the room
    const participants = await ChallengeParticipant.find({
      challengeId: challenge._id,
      hasLeft: false
    }).lean();

    // Sort participants according to completion status, score, and completion speed
    const sortedList = participants.sort((a, b) => {
      // Completed users are sorted above incomplete users
      if (a.completed !== b.completed) {
        return b.completed ? 1 : -1;
      }
      // Primary Sort: Highest score
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary Sort: Fastest time (ascending)
      if (a.totalTimeSeconds !== b.totalTimeSeconds) {
        return a.totalTimeSeconds - b.totalTimeSeconds;
      }
      // Tertiary Sort: Highest accuracy
      return b.accuracy - a.accuracy;
    });

    // Structure leaderboard response payload
    const leaderboard = sortedList.map((p, index) => ({
      rank: p.completed ? p.rank || (index + 1) : null, // Display rank only once completed
      userId: p.userId,
      userID: p.userID,
      name: p.name,
      score: p.score,
      accuracy: p.accuracy,
      completed: p.completed,
      currentQuestion: p.currentQuestion,
      totalTimeSeconds: p.totalTimeSeconds,
      isOwner: p.isOwner
    }));

    res.json({
      success: true,
      challengeId: challenge._id,
      status: challenge.status,
      questionCount: challenge.questionCount,
      totalParticipants: leaderboard.length,
      leaderboard
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//** Community **

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

// ** Community **

app.get(
  "/community/public",
  firebaseAuth,
  async (req, res) => {
    try {

      const {
        page = 1,
        limit = 20,
        exam,
        subject,
        search,
      } = req.query;

      const conn = getUserDB();

      const Challenge =
        getChallengeModel(conn);

      const Participant =
        getChallengeParticipantModel(conn);

      const filter = {
        visibility: "public",
        status: {
          $in: [
            "waiting",
            "running",
          ],
        },
      };

      if (exam) {
        filter.exam = exam;
      }

      if (subject) {
        filter.subject = subject;
      }

      if (search) {
        filter.title = {
          $regex: search,
          $options: "i",
        };
      }

      const pageNumber =
        Math.max(1, Number(page));

      const pageLimit =
        Math.min(
          Math.max(Number(limit), 1),
          50,
        );

      const skip =
        (pageNumber - 1) * pageLimit;

      const [
        challenges,
        total,
      ] = await Promise.all([

        Challenge.find(filter)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(pageLimit)
          .lean(),

        Challenge.countDocuments(
          filter,
        ),

      ]);

      const challengeIds =
        challenges.map((c) => c._id);

      const joinedRooms =
        await Participant.find(
          {
            userId: req.userId,
            challengeId: {
              $in: challengeIds,
            },
          },
          {
            challengeId: 1,
          },
        ).lean();

      const joinedSet =
        new Set(
          joinedRooms.map((p) =>
            String(p.challengeId),
          ),
        );

      const cards =
        challenges.map((challenge) => ({

          id: challenge._id,

          inviteCode: challenge.inviteCode,

          title: challenge.title,

          description: challenge.description,

          ownerName: challenge.ownerName,

          exam: challenge.exam,

          subject: challenge.subject,

          topic: challenge.topic,

          visibility: challenge.visibility,

          questionCount:
            challenge.questionCount,

          participantCount:
            challenge.participantCount,

          maxParticipants:
            challenge.maxParticipants,

          status:
            challenge.status,

          createdAt:
            challenge.createdAt,

          joined:
            joinedSet.has(
              String(challenge._id),
            ),

        }));

      return res.json({

        success: true,

        page:
          pageNumber,

        total,

        totalPages:
          Math.ceil(
            total / pageLimit,
          ),

        count:
          cards.length,

        challenges:
          cards,

      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false,

        message:
          err.message,

      });

    }
  }
);

app.get(
  "/community/my",
  firebaseAuth,
  async (req, res) => {
    try {

      const conn = getUserDB();

      const Challenge =
        getChallengeModel(conn);

      const Participant =
        getChallengeParticipantModel(conn);

      const hosted =
        await Challenge.find({
          ownerId: req.userId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      const joinedEntries =
        await Participant.find({
          userId: req.userId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      const joinedChallengeIds =
        joinedEntries.map(
          (p) => p.challengeId
        );

      const joinedChallenges =
        joinedChallengeIds.length
          ? await Challenge.find({
            _id: {
              $in: joinedChallengeIds,
            },
          }).lean()
          : [];

      const participantMap =
        new Map();

      for (const participant of joinedEntries) {

        participantMap.set(
          String(participant.challengeId),
          participant,
        );

      }

      const hostedCards =
        hosted.map((challenge) => ({

          id: challenge._id,

          inviteCode:
            challenge.inviteCode,

          title:
            challenge.title,

          description:
            challenge.description,

          exam:
            challenge.exam,

          subject:
            challenge.subject,

          topic:
            challenge.topic,

          visibility:
            challenge.visibility,

          questionCount:
            challenge.questionCount,

          participantCount:
            challenge.participantCount,

          maxParticipants:
            challenge.maxParticipants,

          status:
            challenge.status,

          createdAt:
            challenge.createdAt,

          role: "owner",

          isOwner: true,

        }));

      const joinedCards =
        joinedChallenges.map(
          (challenge) => {

            const participant =
              participantMap.get(
                String(
                  challenge._id,
                ),
              );

            return {

              id:
                challenge._id,

              inviteCode:
                challenge.inviteCode,

              title:
                challenge.title,

              description:
                challenge.description,

              ownerName:
                challenge.ownerName,

              exam:
                challenge.exam,

              subject:
                challenge.subject,

              topic:
                challenge.topic,

              visibility:
                challenge.visibility,

              questionCount:
                challenge.questionCount,

              participantCount:
                challenge.participantCount,

              maxParticipants:
                challenge.maxParticipants,

              status:
                challenge.status,

              createdAt:
                challenge.createdAt,

              role:
                participant?.isOwner
                  ? "owner"
                  : "participant",

              joinedAt:
                participant?.joinedAt,

              completed:
                participant?.completed,

              score:
                participant?.score,

              rank:
                participant?.rank,

            };

          },
        );

      const completedEntries = joinedEntries.filter(
        (p) => p.completed === true
      );

      const completedCount = completedEntries.length;

      const winsCount = completedEntries.filter(
        (p) => p.rank === 1
      ).length;

      const runningCount = [...hostedCards, ...joinedCards]
        .filter((c) => c.status === "running").length;

      const waitingCount = [...hostedCards, ...joinedCards]
        .filter((c) => c.status === "waiting").length;

      const totalScore = completedEntries.reduce(
        (sum, p) => sum + (p.score || 0),
        0
      );

      const totalAccuracy = completedEntries.reduce(
        (sum, p) => sum + (p.accuracy || 0),
        0
      );

      const totalRank = completedEntries.reduce(
        (sum, p) => sum + (p.rank || 0),
        0
      );

      const bestScore = completedEntries.length
        ? Math.max(
          ...completedEntries.map((p) => p.score || 0)
        )
        : 0;

      const validRanks = completedEntries
        .map((p) => p.rank)
        .filter((r) => r > 0);

      const bestRank = validRanks.length
        ? Math.min(...validRanks)
        : 0;

      const averageAccuracy = completedEntries.length
        ? Number(
          (
            totalAccuracy /
            completedEntries.length
          ).toFixed(1)
        )
        : 0;

      const averageRank = validRanks.length
        ? Number(
          (
            totalRank /
            validRanks.length
          ).toFixed(1)
        )
        : 0;

      const streakEntries = [...completedEntries]
        .sort(
          (a, b) =>
            new Date(a.finishedAt) -
            new Date(b.finishedAt)
        );

      let currentStreak = 0;
      let longestWinStreak = 0;
      let runningStreak = 0;

      for (const entry of streakEntries) {

        if (entry.rank === 1) {

          runningStreak++;

          if (runningStreak > longestWinStreak) {
            longestWinStreak = runningStreak;
          }

        } else {

          runningStreak = 0;

        }

      }

      for (let i = streakEntries.length - 1; i >= 0; i--) {

        if (streakEntries[i].rank === 1) {
          currentStreak++;
        } else {
          break;
        }

      }

      return res.json({

        success: true,

        stats: {

          hosted: hostedCards.length,

          joined: joinedCards.length,

          wins: winsCount,

          completed: completedCount,

          running: runningCount,

          waiting: waitingCount,

          totalScore,

          averageRank,

          averageAccuracy,

          bestScore,

          bestRank,

          currentStreak,

          longestWinStreak,

        },

        hosted: hostedCards,

        joined: joinedCards,

      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false,

        message:
          err.message,

      });

    }
  }
);

app.get(
  "/community/:id",
  firebaseAuth,
  async (req, res) => {
    try {

      const conn = getUserDB();

      const Challenge =
        getChallengeModel(conn);

      const Participant =
        getChallengeParticipantModel(conn);

      const id = req.params.id;

      let challenge;

      if (mongoose.Types.ObjectId.isValid(id)) {

        challenge = await Challenge.findById(id).lean();

      }

      if (!challenge) {

        challenge = await Challenge.findOne({
          inviteCode: String(id).toUpperCase(),
        }).lean();

      }

      if (!challenge) {

        return res.status(404).json({
          success: false,
          message: "Challenge not found",
        });

      }

      const participants =
        await Participant.find({
          challengeId: challenge._id,
        })
          .sort({
            score: -1,
            totalTimeSeconds: 1,
          })
          .lean();

      const currentUser =
        participants.find(
          (p) => p.userId === req.userId
        ) || null;

      const leaderboard =
        participants
          .map((p) => ({
            userId: p.userId,
            userID: p.userID,
            name: p.name,
            score: p.score,
            accuracy: p.accuracy,
            rank: p.rank,
            completed: p.completed,
            totalTimeSeconds:
              p.totalTimeSeconds,
            isOwner: p.isOwner,
          }))
          .sort((a, b) => {

            if (b.score !== a.score) {
              return b.score - a.score;
            }

            return (
              a.totalTimeSeconds -
              b.totalTimeSeconds
            );

          });

      const completed =
        participants.filter(
          (p) => p.completed
        ).length;

      const averageScore =
        participants.length
          ? Number(
            (
              participants.reduce(
                (s, p) =>
                  s + (p.score || 0),
                0,
              ) / participants.length
            ).toFixed(1),
          )
          : 0;

      const averageAccuracy =
        participants.length
          ? Number(
            (
              participants.reduce(
                (s, p) =>
                  s +
                  (p.accuracy || 0),
                0,
              ) / participants.length
            ).toFixed(1),
          )
          : 0;

      const permissions = {

        isOwner:
          challenge.ownerId ===
          req.userId,

        hasJoined:
          !!currentUser,

        canJoin:
          !currentUser &&
          challenge.status ===
          "waiting" &&
          challenge.participantCount <
          challenge.maxParticipants,

        canStart:
          challenge.ownerId ===
          req.userId &&
          challenge.status ===
          "waiting",

        canDelete:
          challenge.ownerId ===
          req.userId,

        canLeave:
          !!currentUser &&
          !currentUser.isOwner,

      };

      return res.json({

        success: true,

        challenge: {

          id:
            challenge._id,

          inviteCode:
            challenge.inviteCode,

          title:
            challenge.title,

          description:
            challenge.description,

          ownerId:
            challenge.ownerId,

          ownerName:
            challenge.ownerName,

          exam:
            challenge.exam,

          subject:
            challenge.subject,

          topic:
            challenge.topic,

          visibility:
            challenge.visibility,

          status:
            challenge.status,

          questionCount:
            challenge.questionCount,

          participantCount:
            challenge.participantCount,

          maxParticipants:
            challenge.maxParticipants,

          allowLateJoin:
            challenge.allowLateJoin,

          autoStart:
            challenge.autoStart,

          startsAt:
            challenge.startsAt,

          expiresAt:
            challenge.expiresAt,

          createdAt:
            challenge.createdAt,

        },

        currentUser,

        participants,

        leaderboard,

        permissions,

        stats: {

          completed,

          totalParticipants:
            participants.length,

          averageScore,

          averageAccuracy,

        },

        share: {

          inviteCode:
            challenge.inviteCode,

          url:
            generateChallengeLink(
              challenge.inviteCode,
            ),

        },

      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({

        success: false,

        message: err.message,

      });

    }
  }
);

// ** Community **

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
    const profileMap = new Map(profiles.map((p) => [p.userId.toLowerCase(), p]));
    const publicLeaderboard = leaderboard.map((entry, i) => {
      const profile = profileMap.get(entry.userId.toLowerCase());
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

app.get("/current-affairs", async (req, res) => {
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
app.get("/current-affairs/subjects", async (req, res) => {
  try {
    const CurrentAffair = getCAModel();
    const subjects = await CurrentAffair.distinct("subject");
    res.json({ success: true, subjects: subjects.sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/current-affairs/:id", async (req, res) => {
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

// Razorpay Webhook

app.post(
  "/subscription/webhook",
  async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"];

      if (
        !signature ||
        !verifyWebhookSignature(req.rawBody, signature)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature",
        });
      }

      const payload = req.body;

      const event = payload.event;

      const subscription =
        payload.payload?.subscription?.entity;

      if (!subscription) {
        return res.json({ success: true });
      }

      const conn = getUserDB();
      const User = getUserModel(conn);

      let user = null;

      const firebaseUid =
        subscription.notes?.firebase_uid;

      if (firebaseUid) {
        user = await User.findOne({
          userId: firebaseUid,
        });
      }

      if (!user) {
        user = await User.findOne({
          subscriptionId: subscription.id,
        });
      }

      if (!user) {
        return res.json({
          success: true,
          message: "User not found",
        });
      }

      user.subscriptionId = subscription.id;
      user.subscriptionStatus = subscription.status;

      switch (event) {

        case "subscription.activated":

          user.isPremium = true;

          break;

        case "subscription.charged":

          user.isPremium = true;

          if (subscription.current_end) {
            user.premiumExpiry = new Date(
              subscription.current_end * 1000
            );
          }

          if (
            payload.payload.payment &&
            payload.payload.payment.entity
          ) {
            user.lastPaymentId =
              payload.payload.payment.entity.id;
          }

          break;

        case "subscription.completed":

          user.isPremium = false;
          user.subscriptionId = null;
          user.subscriptionStatus = null;

          break;

        case "subscription.cancelled":

          user.isPremium = false;
          user.subscriptionId = null;
          user.subscriptionStatus = null;

          break;

        case "subscription.halted":

          user.isPremium = false;
          user.subscriptionId = null;
          user.subscriptionStatus = null;

          break;

        case "subscription.paused":

          user.isPremium = false;

          break;

        case "payment.failed":

          user.isPremium = false;

          break;

        default:
          break;
      }

      await user.save();

      return res.json({
        success: true,
      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({
        success: false,
        message: err.message,
      });

    }
  }
);

// ** razorpay webhook **

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