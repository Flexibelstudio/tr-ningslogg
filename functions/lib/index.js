"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWeeklyHighlights = exports.getAnalyticsData = exports.notifyFriendsOnBooking = exports.callGeminiApi = exports.createLeadFromZapier = exports.calendarFeed = exports.cancelClassInstance = exports.onBookingUpdate = exports.sendSessionReminder = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const functions_1 = require("firebase-admin/functions");
const genai_1 = require("@google/genai");
const webpush = __importStar(require("web-push"));
/* -----------------------------------------------------------------------------
 * Init Admin
 * ---------------------------------------------------------------------------*/
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/* -----------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------*/
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}
function getBearerToken(req) {
    const h = (typeof req.header === "function" ? req.header("authorization") : undefined) ??
        (typeof req.header === "function" ? req.header("Authorization") : undefined) ??
        req.headers?.authorization ??
        req.headers?.Authorization ??
        "";
    return typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : "";
}
function normalizeDateKey(input) {
    const s = String(input ?? "");
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m)
        return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    }
    return s.slice(0, 10);
}
// Skapar ett Date-objekt från en datumsträng (YYYY-MM-DD) och tid (HH:MM)
// Antar att tiderna är i "lokal tid" men skapar UTC-datum för beräkningar
function createDateTime(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = timeStr.split(':').map(Number);
    // Note: We construct it using local time components but let Date object handle it.
    // Ideally we would use a library like luxon for explicit timezone handling (Europe/Stockholm).
    // For now, we assume the server time or simple ISO construction works sufficiently for iCal.
    return new Date(y, m - 1, d, h, min);
}
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
const VAPID_PUBLIC_KEY = "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";
function tryInitWebPush() {
    try {
        const priv = process.env.VAPID_PRIVATE_KEY;
        if (!priv)
            return false;
        webpush.setVapidDetails("mailto:admin@flexibel.se", VAPID_PUBLIC_KEY, priv);
        return true;
    }
    catch (e) {
        logger.warn("[Push] VAPID-setup misslyckades; push avaktiverad.", e);
        return false;
    }
}
/* -----------------------------------------------------------------------------
 * HTTP: Körs av Cloud Tasks för att skicka pass-påminnelse
 * ---------------------------------------------------------------------------*/
exports.sendSessionReminder = (0, https_1.onRequest)({
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
}, async (request, response) => {
    if (!request.headers["x-cloudtasks-queuename"]) {
        logger.error("Unauthorized: Missing Cloud Tasks header.");
        response.status(403).send("Unauthorized");
        return;
    }
    const { orgId, bookingId } = request.body ?? {};
    if (!orgId || !bookingId) {
        logger.error("Bad Request: Missing orgId or bookingId in payload.");
        response.status(400).send("Bad Request");
        return;
    }
    logger.info(`Processing reminder for booking ${bookingId} in org ${orgId}.`);
    try {
        const bookingRef = db
            .collection("organizations")
            .doc(orgId)
            .collection("participantBookings")
            .doc(bookingId);
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            logger.warn(`Booking ${bookingId} not found. Aborting.`);
            response.status(200).send("Booking not found, task ignored.");
            return;
        }
        const booking = bookingDoc.data();
        if (!["BOOKED", "CHECKED-IN"].includes(booking.status)) {
            logger.info(`Booking ${bookingId} is not active (status: ${booking.status}). Skipping reminder.`);
            response.status(200).send("Booking not active.");
            return;
        }
        const { participantId, scheduleId } = booking;
        const participantProfileDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("participantDirectory")
            .doc(participantId)
            .get();
        if (!participantProfileDoc.exists) {
            logger.warn(`Participant profile ${participantId} not found for reminder.`);
            response.status(200).send("Participant profile not found.");
            return;
        }
        const profile = participantProfileDoc.data();
        const settings = profile?.notificationSettings;
        if (settings?.pushEnabled === false || settings?.sessionReminder === false) {
            logger.info(`Reminders disabled for participant ${participantId}. Skipping.`);
            response.status(200).send("Reminders disabled by user.");
            return;
        }
        const subsSnap = await db
            .collection("organizations")
            .doc(orgId)
            .collection("userPushSubscriptions")
            .where("participantId", "==", participantId)
            .get();
        if (subsSnap.empty) {
            logger.info(`No push subscriptions for participant ${participantId}.`);
            response.status(200).send("No subscriptions.");
            return;
        }
        const schedDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassSchedules")
            .doc(scheduleId)
            .get();
        const classDefDoc = schedDoc.exists
            ? await db
                .collection("organizations")
                .doc(orgId)
                .collection("groupClassDefinitions")
                .doc(schedDoc.data().groupClassId)
                .get()
            : null;
        if (!schedDoc.exists || !classDefDoc?.exists) {
            logger.warn(`Schedule or class definition missing for booking ${bookingId}.`);
            response.status(200).send("Class details missing.");
            return;
        }
        const settingsDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("integrationSettings")
            .doc("settings")
            .get();
        const reminderHours = settingsDoc.exists && typeof settingsDoc.data()?.sessionReminderHoursBefore === "number"
            ? settingsDoc.data().sessionReminderHoursBefore
            : 2;
        const payload = JSON.stringify({
            title: `Påminnelse: ${classDefDoc.data().name}`,
            body: `Ditt pass börjar om ${reminderHours} timmar kl ${schedDoc.data().startTime}. Vi ses!`,
        });
        const pushEnabled = tryInitWebPush();
        if (pushEnabled) {
            await Promise.all(subsSnap.docs.map(async (doc) => {
                const sub = doc.data().subscription;
                try {
                    await webpush.sendNotification(sub, payload);
                }
                catch (err) {
                    logger.error(`Push send error (participant ${participantId})`, err);
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await doc.ref.delete();
                        await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
                    }
                }
            }));
        }
        else {
            logger.info("[Push] Skippas i sendSessionReminder (ej initierad).");
        }
        response.status(200).send("Reminder processed.");
    }
    catch (error) {
        logger.error(`Failed to send reminder for booking ${bookingId}:`, error);
        response.status(500).send("Internal Server Error");
    }
});
/* -----------------------------------------------------------------------------
 * Firestore: Reagerar på bokningsuppdateringar
 * ---------------------------------------------------------------------------*/
exports.onBookingUpdate = (0, firestore_2.onDocumentUpdated)({
    document: "organizations/{orgId}/participantBookings/{bookingId}",
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
}, async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) {
        logger.info("No data found in trigger event.");
        return;
    }
    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;
    const orgId = event.params.orgId;
    const bookingId = event.params.bookingId;
    // --- A) Waitlist -> Booked: push-notis (icke-kritisk) ---
    if (beforeStatus === "WAITLISTED" && afterStatus === "BOOKED") {
        const participantId = afterData.participantId;
        const scheduleId = afterData.scheduleId;
        const classDate = afterData.classDate;
        try {
            const participantProfileDoc = await db
                .collection("organizations")
                .doc(orgId)
                .collection("participantDirectory")
                .doc(participantId)
                .get();
            if (!participantProfileDoc.exists) {
                logger.warn(`Waitlist promotion: Participant profile ${participantId} not found.`);
                return;
            }
            const profile = participantProfileDoc.data();
            const settings = profile?.notificationSettings;
            if (settings?.pushEnabled === false || settings?.waitlistPromotion === false) {
                logger.info(`Waitlist promotion notifications disabled for participant ${participantId}. Skipping.`);
                return;
            }
            const subsSnap = await db
                .collection("organizations")
                .doc(orgId)
                .collection("userPushSubscriptions")
                .where("participantId", "==", participantId)
                .get();
            if (!subsSnap.empty) {
                const schedDoc = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("groupClassSchedules")
                    .doc(scheduleId)
                    .get();
                const classDefDoc = schedDoc.exists
                    ? await db
                        .collection("organizations")
                        .doc(orgId)
                        .collection("groupClassDefinitions")
                        .doc(schedDoc.data().groupClassId)
                        .get()
                    : null;
                if (schedDoc.exists && classDefDoc?.exists) {
                    const date = new Date(classDate);
                    const dateString = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });
                    const timeString = schedDoc.data().startTime;
                    const payload = JSON.stringify({
                        title: "Du har fått en plats!",
                        body: `Du har flyttats från kön och har nu en plats på ${classDefDoc.data().name} ${dateString} kl ${timeString}.`,
                    });
                    if (tryInitWebPush()) {
                        await Promise.all(subsSnap.docs.map(async (doc) => {
                            const sub = doc.data().subscription;
                            try {
                                await webpush.sendNotification(sub, payload);
                            }
                            catch (err) {
                                logger.error("Promotion push error:", err);
                                if (err?.statusCode === 404 || err?.statusCode === 410) {
                                    await doc.ref.delete();
                                    await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
                                }
                            }
                        }));
                    }
                    else {
                        logger.info("[Push] Skippas i onBookingUpdate (promotion).");
                    }
                }
            }
        }
        catch (error) {
            logger.error("Error in onBookingUpdate (Promotion):", error);
        }
    }
    // --- B) Ny BOOKED: schemalägg påminnelse ---
    if (afterStatus === "BOOKED" && beforeStatus !== "BOOKED") {
        try {
            const settingsDoc = await db
                .collection("organizations")
                .doc(orgId)
                .collection("integrationSettings")
                .doc("settings")
                .get();
            if (!settingsDoc.exists || !settingsDoc.data()?.enableSessionReminders) {
                logger.info(`Reminders disabled for org ${orgId}. Skipping scheduling.`);
                return;
            }
            const reminderHours = typeof settingsDoc.data()?.sessionReminderHoursBefore === "number"
                ? settingsDoc.data().sessionReminderHoursBefore
                : 2;
            if (reminderHours <= 0)
                return;
            const schedDoc = await db
                .collection("organizations")
                .doc(orgId)
                .collection("groupClassSchedules")
                .doc(afterData.scheduleId)
                .get();
            if (!schedDoc.exists)
                return;
            const [h, m] = String(schedDoc.data().startTime)
                .split(":")
                .map((n) => Number(n));
            const classDateTime = new Date(`${afterData.classDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
            const scheduleTime = new Date(classDateTime.getTime() - reminderHours * 60 * 60 * 1000);
            if (scheduleTime > new Date()) {
                const queue = (0, functions_1.getFunctions)().taskQueue("sendSessionReminder", "europe-west1");
                const project = process.env.GCLOUD_PROJECT;
                const targetUri = `https://europe-west1-${project}.cloudfunctions.net/sendSessionReminder`;
                await queue.enqueue({ orgId, bookingId }, { scheduleTime, uri: targetUri });
                logger.info(`Scheduled reminder for booking ${bookingId}.`);
            }
        }
        catch (error) {
            logger.error(`Failed to schedule reminder for booking ${bookingId}:`, error);
        }
    }
});
/* -----------------------------------------------------------------------------
 * Callable: Ställ in ett helt pass
 * ---------------------------------------------------------------------------*/
exports.cancelClassInstance = (0, https_1.onCall)({
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
}, async (request) => {
    const uid = request.auth?.uid;
    const name = request.auth?.token?.name || "Coach";
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Funktionen måste anropas som inloggad användare.");
    const { orgId, scheduleId, classDate } = (request.data ?? {});
    if (!orgId || !scheduleId || !classDate) {
        throw new https_1.HttpsError("invalid-argument", "Nödvändiga parametrar saknas (orgId, scheduleId, classDate).");
    }
    try {
        // 1) Skapa exception
        const exceptionRef = db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassScheduleExceptions")
            .doc();
        await exceptionRef.set({
            scheduleId,
            date: classDate,
            createdBy: { uid, name },
            createdAt: new Date().toISOString(),
        });
        // 2) Hitta bokningar
        const dateKey = normalizeDateKey(String(classDate));
        const bookingsRef = db.collection("organizations").doc(orgId).collection("participantBookings");
        let bookingsSnap = await bookingsRef
            .where("scheduleId", "==", scheduleId)
            .where("classDate", "==", dateKey)
            .where("status", "in", ["BOOKED", "CHECKED-IN", "CONFIRMED", "ACTIVE"])
            .get();
        if (bookingsSnap.empty) {
            return { success: true, message: "Class cancelled, no active bookings found." };
        }
        // 3) Uppdatera bokningar + ev. refund
        const batch = db.batch();
        const participantIdsToRefundClips = new Set();
        const affectedParticipantIds = new Set();
        const membershipsSnap = await db.collection("organizations").doc(orgId).collection("memberships").get();
        const memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const nowTs = firestore_1.Timestamp.now();
        for (const doc of bookingsSnap.docs) {
            const booking = doc.data();
            affectedParticipantIds.add(booking.participantId);
            if (["BOOKED", "CHECKED-IN", "CONFIRMED", "ACTIVE"].includes(booking.status)) {
                const participantDoc = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("participantDirectory")
                    .doc(booking.participantId)
                    .get();
                if (participantDoc.exists) {
                    const participant = participantDoc.data();
                    const membership = memberships.find((m) => m.id === participant?.membershipId);
                    if (membership?.type === "clip_card") {
                        participantIdsToRefundClips.add(booking.participantId);
                    }
                }
            }
            batch.update(doc.ref, {
                status: "CANCELLED",
                cancelReason: "coach_cancelled",
                cancelledAt: nowTs,
                updatedAt: nowTs,
            });
        }
        for (const participantId of participantIdsToRefundClips) {
            const participantRef = db
                .collection("organizations")
                .doc(orgId)
                .collection("participantDirectory")
                .doc(participantId);
            batch.update(participantRef, { "clipCardStatus.remainingClips": firestore_1.FieldValue.increment(1) });
        }
        // 4) In-app notiser och flödeshändelse
        const scheduleDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassSchedules")
            .doc(scheduleId)
            .get();
        const classDefDoc = scheduleDoc.exists
            ? await db
                .collection("organizations")
                .doc(orgId)
                .collection("groupClassDefinitions")
                .doc(scheduleDoc.data().groupClassId)
                .get()
            : null;
        let className = "passet";
        let classTime = "";
        let locationName = "din studio";
        if (scheduleDoc.exists) {
            classTime = scheduleDoc.data().startTime;
            const locationDoc = await db
                .collection("organizations")
                .doc(orgId)
                .collection("locations")
                .doc(scheduleDoc.data().locationId)
                .get();
            if (locationDoc.exists)
                locationName = locationDoc.data().name;
        }
        if (classDefDoc?.exists)
            className = classDefDoc.data().name;
        const date = new Date(String(classDate));
        const dateString = `${date.getDate()} ${date.toLocaleString("sv-SE", { month: "long" })}`;
        const eventTitle = `INSTÄLLT: ${className}`;
        const eventDescription = `Passet ${className} (${locationName}) den ${dateString} kl ${classTime} är tyvärr inställt.`;
        const studioTarget = locationName.toLowerCase().includes("salem")
            ? "salem"
            : locationName.toLowerCase().includes("kärra") || locationName.toLowerCase().includes("karra")
                ? "karra"
                : "all";
        const eventRef = db.collection("organizations").doc(orgId).collection("coachEvents").doc();
        batch.set(eventRef, {
            title: eventTitle,
            description: eventDescription,
            type: "news",
            studioTarget,
            targetParticipantIds: Array.from(affectedParticipantIds),
            createdDate: new Date().toISOString(),
        });
        for (const participantId of affectedParticipantIds) {
            const notifRef = db
                .collection("organizations")
                .doc(orgId)
                .collection("participantDirectory")
                .doc(participantId)
                .collection("user_notifications")
                .doc();
            batch.set(notifRef, {
                type: "CLASS_CANCELLED",
                scheduleId,
                classDate: dateKey,
                title: "Pass inställt",
                body: "Ditt bokade pass har ställts in av en coach.",
                createdAt: nowTs,
                read: false,
            });
        }
        await batch.commit();
        // 5) Push Notiser
        const payload = JSON.stringify({
            title: `Pass inställt: ${className}`,
            body: `Ditt pass ${className} den ${dateString} kl ${classTime} har tyvärr ställts in.`,
        });
        let notificationsSent = 0;
        if (tryInitWebPush()) {
            for (const participantId of affectedParticipantIds) {
                const participantProfileDoc = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("participantDirectory")
                    .doc(participantId)
                    .get();
                if (!participantProfileDoc.exists)
                    continue;
                const profile = participantProfileDoc.data();
                const settings = profile?.notificationSettings;
                if (settings?.pushEnabled === false || settings?.classCancellation === false) {
                    continue;
                }
                const subsSnap = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("userPushSubscriptions")
                    .where("participantId", "==", participantId)
                    .get();
                if (!subsSnap.empty) {
                    await Promise.all(subsSnap.docs.map(async (doc) => {
                        const sub = doc.data().subscription;
                        try {
                            await webpush.sendNotification(sub, payload);
                            notificationsSent++;
                        }
                        catch (err) {
                            if (err?.statusCode === 404 || err?.statusCode === 410) {
                                await doc.ref.delete();
                            }
                        }
                    }));
                }
            }
        }
        return { success: true, cancelledCount: bookingsSnap.size, notificationsSent };
    }
    catch (error) {
        logger.error(`Error in cancelClassInstance for schedule ${scheduleId}:`, error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "An unexpected error occurred while cancelling the class.");
    }
});
/* -----------------------------------------------------------------------------
 * HTTP: Calendar Feed (iCal) - UPDATED AND FIXED
 * ---------------------------------------------------------------------------*/
exports.calendarFeed = (0, https_1.onRequest)({ region: "europe-west1" }, async (req, res) => {
    const { userId, type } = req.query;
    if (!userId || typeof userId !== "string") {
        res.status(400).send("Bad Request: Missing userId.");
        return;
    }
    try {
        // 1. Hitta org + profil utifrån userId
        const orgsSnap = await db.collection("organizations").get();
        let foundOrgId = "";
        let userProfile = null;
        for (const orgDoc of orgsSnap.docs) {
            if (type === "coach") {
                const staffRef = orgDoc.ref.collection("staffMembers").doc(userId);
                const staffSnap = await staffRef.get();
                if (staffSnap.exists) {
                    foundOrgId = orgDoc.id;
                    userProfile = staffSnap.data();
                    break;
                }
            }
            else {
                const partRef = orgDoc.ref.collection("participantDirectory").doc(userId);
                const partSnap = await partRef.get();
                if (partSnap.exists) {
                    foundOrgId = orgDoc.id;
                    userProfile = partSnap.data();
                    break;
                }
            }
        }
        if (!foundOrgId || !userProfile) {
            res.status(404).send("User not found.");
            return;
        }
        let events = [];
        const now = new Date();
        // Tidsintervall för export (t.ex. 3 månader bakåt, 6 månader framåt)
        const exportStart = new Date(now);
        exportStart.setMonth(exportStart.getMonth() - 3);
        const exportEnd = new Date(now);
        exportEnd.setMonth(exportEnd.getMonth() + 6);
        // Hämta klass-definitioner och plats-info en gång för prestanda
        const classDefsSnap = await db.collection("organizations").doc(foundOrgId).collection("groupClassDefinitions").get();
        const classDefs = new Map(); // id -> name
        classDefsSnap.forEach(d => classDefs.set(d.id, d.data().name));
        const locationsSnap = await db.collection("organizations").doc(foundOrgId).collection("locations").get();
        const locations = new Map();
        locationsSnap.forEach(l => locations.set(l.id, l.data().name));
        if (type === "coach") {
            // ---------------- COACH LOGIC ----------------
            // Hämta återkommande scheman för coachen
            const schedulesSnap = await db
                .collection("organizations")
                .doc(foundOrgId)
                .collection("groupClassSchedules")
                .where("coachId", "==", userId)
                .get();
            // Hämta exceptions för hela org (kan optimeras, men datasetet är oftast litet)
            const exceptionsSnap = await db
                .collection("organizations")
                .doc(foundOrgId)
                .collection("groupClassScheduleExceptions")
                .get();
            const exceptionsMap = new Map(); // scheduleId-date -> exception
            exceptionsSnap.forEach(doc => {
                const ex = doc.data();
                exceptionsMap.set(`${ex.scheduleId}-${ex.date}`, ex);
            });
            // Loopa igenom scheman och expandera
            schedulesSnap.forEach(doc => {
                const schedule = doc.data();
                const className = classDefs.get(schedule.groupClassId) || "Pass";
                const locationName = locations.get(schedule.locationId) || "Studio";
                // Bestäm datumintervall för just detta schema
                const schedStart = new Date(schedule.startDate);
                const schedEnd = new Date(schedule.endDate);
                // Loopa varje dag i export-intervallet
                let loopDate = new Date(Math.max(exportStart.getTime(), schedStart.getTime()));
                const loopEnd = new Date(Math.min(exportEnd.getTime(), schedEnd.getTime()));
                loopEnd.setHours(23, 59, 59);
                // Skapa datum för att loopa
                while (loopDate <= loopEnd) {
                    // Kolla veckodag (JS: 0=Sun, App: 1=Mon, 7=Sun)
                    const jsDay = loopDate.getDay();
                    const appDay = jsDay === 0 ? 7 : jsDay;
                    if (schedule.daysOfWeek.includes(appDay)) {
                        const dateStr = normalizeDateKey(loopDate.toISOString());
                        const exception = exceptionsMap.get(`${doc.id}-${dateStr}`);
                        // Om passet är DELETED eller CANCELLED, hoppa över
                        if (exception && (exception.status === 'DELETED' || exception.status === 'CANCELLED')) {
                            // Skapa INTE eventet
                        }
                        else {
                            // Hantera MODIFIED eller normalt
                            const startTimeStr = exception?.newStartTime || schedule.startTime;
                            const duration = exception?.newDurationMinutes || schedule.durationMinutes;
                            // Bygg start- och slutdatum
                            // Använd datumsträngen + tiden för att skapa ett datumobjekt
                            const startDt = createDateTime(dateStr, startTimeStr);
                            const endDt = new Date(startDt.getTime() + duration * 60000);
                            events.push(createVEVENT(className, `Gruppass på ${locationName}`, startDt, endDt, `coach-sched-${doc.id}-${dateStr}`));
                        }
                    }
                    // Gå till nästa dag
                    loopDate = addDays(loopDate, 1);
                }
            });
            // Lägg till 1-on-1 sessions
            const sessionsSnap = await db
                .collection("organizations")
                .doc(foundOrgId)
                .collection("oneOnOneSessions")
                .where("coachId", "==", userId)
                .where("startTime", ">=", exportStart.toISOString())
                .get();
            sessionsSnap.forEach((sessionDoc) => {
                const s = sessionDoc.data();
                // Filtrera bort sessions som ligger för långt fram
                if (new Date(s.startTime) <= exportEnd) {
                    events.push(createVEVENT(s.title, s.purpose || "1-on-1 Coaching", new Date(s.startTime), new Date(s.endTime), `session-${sessionDoc.id}`));
                }
            });
        }
        else {
            // ---------------- PARTICIPANT LOGIC ----------------
            const bookingsSnap = await db
                .collection("organizations")
                .doc(foundOrgId)
                .collection("participantBookings")
                .where("participantId", "==", userId)
                .where("status", "in", ["BOOKED", "CHECKED-IN"])
                .where("classDate", ">=", normalizeDateKey(exportStart.toISOString()))
                .get();
            // Hämta exceptions en gång
            const exceptionsSnap = await db
                .collection("organizations")
                .doc(foundOrgId)
                .collection("groupClassScheduleExceptions")
                .get();
            const exceptionsMap = new Map();
            exceptionsSnap.forEach(doc => {
                const ex = doc.data();
                exceptionsMap.set(`${ex.scheduleId}-${ex.date}`, ex);
            });
            // Vi måste hämta alla relevanta schedules för att veta tiderna
            // Optimering: Hämta unika scheduleIds först
            const scheduleIds = new Set();
            bookingsSnap.forEach(b => scheduleIds.add(b.data().scheduleId));
            const scheduleMap = new Map();
            if (scheduleIds.size > 0) {
                // Firestore 'in' limit is 10. Split if needed, but for simplicity fetching individually or in chunks.
                // Since this is iCal export, prestanda är inte superkritisk (händer sällan).
                // Loopa och hämta.
                for (const sId of Array.from(scheduleIds)) {
                    const sDoc = await db.collection("organizations").doc(foundOrgId).collection("groupClassSchedules").doc(sId).get();
                    if (sDoc.exists) {
                        scheduleMap.set(sId, { id: sDoc.id, ...sDoc.data() });
                    }
                }
            }
            for (const bookingDoc of bookingsSnap.docs) {
                const b = bookingDoc.data();
                // Filtrera bort bokningar som ligger för långt fram
                if (new Date(b.classDate) > exportEnd)
                    continue;
                const schedule = scheduleMap.get(b.scheduleId);
                if (schedule) {
                    // Kolla exceptions
                    const exception = exceptionsMap.get(`${schedule.id}-${b.classDate}`);
                    // Om passet är inställt men bokningen fortfarande finns som BOOKED (borde inte hända om logik funkar, men för säkerhets skull)
                    if (exception && (exception.status === 'CANCELLED' || exception.status === 'DELETED')) {
                        continue;
                    }
                    const startTimeStr = exception?.newStartTime || schedule.startTime;
                    const duration = exception?.newDurationMinutes || schedule.durationMinutes;
                    const className = classDefs.get(schedule.groupClassId) || "Pass";
                    const locationName = locations.get(schedule.locationId) || "Studio";
                    const startDt = createDateTime(b.classDate, startTimeStr);
                    const endDt = new Date(startDt.getTime() + duration * 60000);
                    events.push(createVEVENT(className, `Bokat pass på ${locationName}`, startDt, endDt, `booking-${bookingDoc.id}`));
                }
            }
            const sessionsSnap = await db
                .collection("organizations")
                .doc(foundOrgId)
                .collection("oneOnOneSessions")
                .where("participantId", "==", userId)
                .where("startTime", ">=", exportStart.toISOString())
                .get();
            sessionsSnap.forEach((sessionDoc) => {
                const s = sessionDoc.data();
                if (new Date(s.startTime) <= exportEnd) {
                    events.push(createVEVENT(s.title, s.purpose || "Personligt möte", new Date(s.startTime), new Date(s.endTime), `session-${sessionDoc.id}`));
                }
            });
        }
        // 3. Skapa ICS
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Flexibel//Träningslogg//SV
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Flexibel Träning
${events.join("\n")}
END:VCALENDAR`;
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="calendar.ics"');
        res.send(icsContent);
    }
    catch (e) {
        logger.error("Calendar feed error", e);
        res.status(500).send("Internal Server Error");
    }
});
function createVEVENT(summary, description, start, end, uidPrefix) {
    const formatDate = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    // Använd en deterministisk UID om möjligt för att undvika dubbletter vid uppdatering, men random funkar.
    // Här använder vi uidPrefix om det skickas in.
    const uid = uidPrefix ? `${uidPrefix}@flexibel.se` : `${Math.random().toString(36).substr(2)}@flexibel.se`;
    return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT`;
}
/* -----------------------------------------------------------------------------
 * Zapier → skapa lead
 * ---------------------------------------------------------------------------*/
exports.createLeadFromZapier = (0, https_1.onRequest)({
    region: "europe-west1",
    secrets: ["ZAPIER_SECRET_KEY"],
    cors: true,
}, async (request, response) => {
    if (request.method !== "POST") {
        logger.warn("Method Not Allowed:", request.method);
        response.status(405).send("Method Not Allowed");
        return;
    }
    const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;
    const presented = getBearerToken(request);
    if (!ZAPIER_SECRET_KEY || presented !== ZAPIER_SECRET_KEY) {
        logger.warn("Unauthorized attempt to access webhook.");
        response.status(401).json({ error: "Unauthorized" });
        return;
    }
    const { firstName, lastName, email, phone, locationName, orgId, source } = (request.body ?? {});
    const missing = [
        !firstName && "firstName",
        !lastName && "lastName",
        !email && "email",
        !locationName && "locationName",
        !orgId && "orgId",
    ]
        .filter(Boolean)
        .join(", ");
    if (missing) {
        logger.error("Bad Request: Missing required fields:", missing);
        response.status(400).json({ error: `Bad Request: Missing fields: ${missing}` });
        return;
    }
    try {
        const locationsSnapshot = await db
            .collection("organizations")
            .doc(String(orgId))
            .collection("locations")
            .get();
        const locations = locationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        const targetLocation = locations.find((l) => typeof l.name === "string" && l.name.toLowerCase().includes(String(locationName).toLowerCase()));
        if (!targetLocation) {
            logger.error(`Location named '${locationName}' could not be found.`);
            response.status(400).json({ error: `Bad Request: Location '${locationName}' not found.` });
            return;
        }
        const newLead = {
            firstName: String(firstName),
            lastName: String(lastName),
            email: String(email).toLowerCase(),
            phone: phone ? String(phone) : "",
            locationId: targetLocation.id,
            source: source ? String(source) : "Meta",
            createdDate: new Date().toISOString(),
            status: "new",
        };
        const leadRef = await db.collection("organizations").doc(String(orgId)).collection("leads").add(newLead);
        logger.info(`Successfully created lead with ID: ${leadRef.id} for org ${orgId}`);
        response.status(201).json({ success: true, leadId: leadRef.id });
    }
    catch (error) {
        logger.error("Error creating lead:", error);
        response.status(500).json({ error: "Internal Server Error" });
    }
});
/* -----------------------------------------------------------------------------
 * Callable: Gemini proxy
 * ---------------------------------------------------------------------------*/
exports.callGeminiApi = (0, https_1.onCall)({
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
}, async (request) => {
    try {
        const { model, contents, config, action, context } = (request.data ?? {});
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logger.error("GEMINI_API_KEY secret not found on the server.");
            return { error: "API key is not configured on the server." };
        }
        const ai = new genai_1.GoogleGenAI({ apiKey });
        let targetModel = model || "gemini-2.5-flash";
        let targetContents = contents;
        let targetConfig = config;
        if (action) {
            switch (action) {
                case "generate_goal_prognosis": {
                    const { fitnessGoals, workoutsPerWeekTarget, targetDate, preferences } = context || {};
                    targetContents = `
Du är en expert PT och coach. En klient har satt upp följande träningsmål:
- Mål: "${fitnessGoals}"
- Målfrekvens: ${workoutsPerWeekTarget} pass/vecka
- Måldatum: ${targetDate || "Ej satt"}
- Preferenser/Övrigt: "${preferences || "Inga"}"

Ge en kort, peppande och realistisk prognos.
1. Är målet realistiskt med tanke på frekvensen?
2. Ge 2-3 konkreta tips på vad klienten bör fokusera på för att lyckas.
3. Om måldatum saknas eller verkar orimligt, ge ett förslag.

Svara direkt till klienten ("Du..."). Håll det under 150 ord. Använd Markdown.
            `;
                    break;
                }
                case "generate_smart_goal": {
                    targetContents = `Du är en expert på att formulera SMART-mål för träning.\nAnvändaren har skrivit: "${context?.goalInput}"\n\nFormulera om detta till ett tydligt, inspirerande SMART-mål (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet) på svenska.\nSvara ENDAST med själva målformuleringen, ingen inledning eller förklaring.`;
                    break;
                }
                case "chat_with_coach": {
                    targetContents = `
Du är en vänlig, peppande och kunnig AI-coach för Flexibel Hälsostudio. Du pratar med ${context?.participant?.name || "en medlem"}.

**Profil:**
- Mål: ${context?.goal}
- Senaste träning: ${JSON.stringify(context?.recentWorkouts)}
- Övrig aktivitet: ${JSON.stringify(context?.recentActivities)}

**Användarens meddelande:** "${context?.userMessage}"

Svara hjälpsamt, kortfattat och engagerande på svenska. Om de frågar om passförslag, utgå från: ${JSON.stringify(context?.availableWorkouts)}.
            `;
                    break;
                }
                case "generate_workout_tips": {
                    targetContents = `
Du är en expertcoach. Ge korta, peppande tips inför passet "${context?.workoutTitle}" för ${context?.participantName}.
${context?.aiInstruction ? `Coach-instruktion: ${context?.aiInstruction}` : ""}
${context?.previousLog ? `Förra gången: ${JSON.stringify(context?.previousLog)}` : "Första gången detta pass loggas."}
Övningar: ${context?.exercisesList}

Svara med strikt JSON: { "generalTips": "...", "exerciseTips": [{ "exerciseName": "...", "tip": "..." }] }
            `;
                    targetConfig = { ...targetConfig, responseMimeType: "application/json" };
                    break;
                }
                case "generate_checkin_summary": {
                    targetContents = `
Du är en coach. Skapa en kort sammanfattning av medlemmens aktivitet för ett avstämningssamtal.
Namn: ${context?.participantName}
Mål: ${context?.goal} (Mål: ${context?.goalTarget} pass/v)
Senaste avstämning: ${context?.lastCheckinDate || "Aldrig"}

Data:
${context?.logSummary}

Instruktioner:
1. Beröm medlemmen för den TOTALA historiken (långsiktighet) om den siffran är imponerande.
2. Analysera den AKTUELLA PERIODEN för att ge feedback på nuläget (trender, snitt vs mål).
3. Om aktiviteten i perioden är låg men totalen hög, uppmuntra att hitta tillbaka till rutinen.
4. Föreslå 1-2 framåtblickande frågor.
Använd Markdown. Håll det koncist.
            `;
                    break;
                }
                case "analyze_business_insights": {
                    const { dataSnapshot, question } = context;
                    targetContents = `Analysera denna data: ${dataSnapshot}. Svara på frågan: "${question}"`;
                    break;
                }
                case "analyze_member_insights": {
                    const { recentComments, avgMoodRating } = context;
                    targetContents = `Analysera medlemmens data för att hitta mönster.\nKommentarer: ${recentComments}. Mående: ${avgMoodRating}. Mål: ${context?.goal}\n\nGe en kort insikt om medlemmens mentala inställning och progression.`;
                    break;
                }
                case "generate_weekly_highlights": {
                    const { pbs, totalLogs } = context;
                    targetContents = `Skriv ett inlägg om veckans höjdpunkter. ${totalLogs} pass loggade. PBs: ${JSON.stringify(pbs)}.`;
                    break;
                }
                case "generate_workout_program": {
                    targetContents = `
Du är en expertcoach som skapar träningsprogram.
Medlem: ${context?.participantName} (${context?.age} år, ${context?.gender})
Mål: ${context?.goal}
Coach-recept: ${context?.coachPrescription}
Specifika önskemål: ${context?.specificRequests}
Tillgängliga baslyft: ${context?.availableBaseLifts}

Skapa ett pass i Markdown-format.
Struktur:
**Titel:** [Passets namn]
**Coachanteckning:** [Kort intro]

### [Blocknamn 1]
* [Övning 1]: [Set] x [Reps] @ [Vikt/RPE] (Baslyft: [Valfritt baslyft från listan])
* [Övning 2]...

Var kreativ men följ önskemålen.
            `;
                    break;
                }
                case "analyze_activity_trends": {
                    const { summaryOfLogs } = context;
                    targetContents = `Analysera följande träningsloggar och ge en kort sammanfattning av trender, styrkor och vad som kan förbättras. Tilltala medlemmen direkt.\n\nLoggar: ${summaryOfLogs}`;
                    break;
                }
                case "identify_silent_heroes": {
                    const { candidates } = context;
                    targetContents = `Identifiera "Tysta hjältar" (hög aktivitet men lite interaktion) från listan. Returnera JSON array: [{ "participantId": "...", "name": "...", "reason": "..." }].\nLista: ${JSON.stringify(candidates)}`;
                    targetConfig = { ...targetConfig, responseMimeType: "application/json" };
                    break;
                }
                case "identify_churn_risks": {
                    const { candidates } = context;
                    targetContents = `Identifiera "Churn risk" (minskande aktivitet) från listan. Returnera JSON array: [{ "participantId": "...", "name": "...", "reason": "..." }].\nLista: ${JSON.stringify(candidates)}`;
                    targetConfig = { ...targetConfig, responseMimeType: "application/json" };
                    break;
                }
                default:
                    if (!targetContents && context?.prompt)
                        targetContents = context.prompt;
                    break;
            }
        }
        if (!targetContents) {
            logger.error("Bad Request: Missing 'contents' or valid 'action'");
            return { error: "Bad Request: Missing 'contents' or valid 'action'." };
        }
        const resp = (await ai.models.generateContent({
            model: targetModel,
            contents: targetContents,
            config: targetConfig,
        }));
        const text = resp.text;
        if (!text) {
            const pf = resp.promptFeedback;
            if (pf?.blockReason) {
                const safetyRatings = pf.safetyRatings?.map((r) => `${r.category}: ${r.probability}`).join(", ");
                const errorMessage = `Request blocked by Gemini API. Reason: ${pf.blockReason}. Ratings: ${safetyRatings || "N/A"}`;
                logger.error(errorMessage, { fullResponse: resp });
                throw new Error(errorMessage);
            }
            logger.warn("Gemini API returned empty text.", JSON.stringify(resp, null, 2));
            throw new Error("Received empty response from AI, but not due to safety blocking.");
        }
        return { text };
    }
    catch (error) {
        logger.error("Error calling Gemini API:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return { error: `Internal Server Error: ${msg}` };
    }
});
/* -----------------------------------------------------------------------------
 * Callable: Vänbokningsnotis (icke-kritisk push)
 * ---------------------------------------------------------------------------*/
exports.notifyFriendsOnBooking = (0, https_1.onCall)({
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Funktionen måste anropas som inloggad användare.");
    }
    const { orgId, participantId, scheduleId, classDate } = (request.data ?? {});
    if (!orgId || !participantId || !scheduleId || !classDate) {
        throw new https_1.HttpsError("invalid-argument", "Nödvändiga parametrar saknas (orgId, participantId, scheduleId, classDate).");
    }
    try {
        const bookerProfileRef = db
            .collection("organizations")
            .doc(orgId)
            .collection("participantDirectory")
            .doc(participantId);
        const bookerProfileDoc = await bookerProfileRef.get();
        if (!bookerProfileDoc.exists || !bookerProfileDoc.data()?.shareMyBookings) {
            return { success: true, message: "Sharing disabled." };
        }
        const bookerName = bookerProfileDoc.data()?.name || "En kompis";
        const connectionsSnap = await db.collection("organizations").doc(orgId).collection("connections").get();
        const friendIds = new Set();
        connectionsSnap.forEach((doc) => {
            const conn = doc.data();
            if (conn.status === "accepted") {
                if (conn.requesterId === participantId)
                    friendIds.add(conn.receiverId);
                if (conn.receiverId === participantId)
                    friendIds.add(conn.requesterId);
            }
        });
        if (friendIds.size === 0)
            return { success: true, message: "No friends." };
        const friendsToNotify = [];
        const participantDirectoryRef = db.collection("organizations").doc(orgId).collection("participantDirectory");
        const friendProfilePromises = Array.from(friendIds).map((id) => participantDirectoryRef.doc(id).get());
        const friendProfileDocs = await Promise.all(friendProfilePromises);
        for (const doc of friendProfileDocs) {
            if (doc.exists) {
                const friendProfile = doc.data();
                if (friendProfile &&
                    (friendProfile.receiveFriendBookingNotifications ?? true) &&
                    friendProfile.notificationSettings?.pushEnabled !== false) {
                    friendsToNotify.push({ id: doc.id, doc: doc.ref });
                }
            }
        }
        if (friendsToNotify.length === 0)
            return { success: true, message: "No friends with notifications enabled." };
        const scheduleDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassSchedules")
            .doc(scheduleId)
            .get();
        if (!scheduleDoc.exists)
            return { success: false, message: "Schedule not found." };
        const schedule = scheduleDoc.data();
        const classDefDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassDefinitions")
            .doc(schedule.groupClassId)
            .get();
        if (!classDefDoc.exists)
            return { success: false, message: "Class definition not found." };
        const className = classDefDoc.data()?.name || "ett pass";
        const payload = JSON.stringify({
            title: "Träningsdags?",
            body: `${String(bookerName).split(" ")[0]} har bokat ${className}, ska du haka på?`,
        });
        let notificationsSent = 0;
        if (tryInitWebPush()) {
            for (const friend of friendsToNotify) {
                const subsSnap = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("userPushSubscriptions")
                    .where("participantId", "==", friend.id)
                    .get();
                if (!subsSnap.empty) {
                    await Promise.all(subsSnap.docs.map(async (doc) => {
                        const sub = doc.data().subscription;
                        try {
                            await webpush.sendNotification(sub, payload);
                            notificationsSent++;
                        }
                        catch (err) {
                            logger.error(`Push send error for friend ${friend.id}:`, err);
                            if (err?.statusCode === 404 || err?.statusCode === 410) {
                                await doc.ref.delete();
                                await friend.doc.update({ "notificationSettings.pushEnabled": false });
                            }
                        }
                    }));
                }
            }
        }
        else {
            logger.info("[Push] Skippas i notifyFriendsOnBooking (ej initierad).");
        }
        return { success: true, notificationsSent };
    }
    catch (error) {
        logger.error(`Error in notifyFriendsOnBooking for participant ${participantId}:`, error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "An unexpected error occurred.");
    }
});
/* -----------------------------------------------------------------------------
 * Callable: Analytics 30 dagar
 * ---------------------------------------------------------------------------*/
exports.getAnalyticsData = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { orgId } = request.data || {};
    if (!orgId) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with an 'orgId'.");
    }
    try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        since.setHours(0, 0, 0, 0);
        const sinceTs = firestore_1.Timestamp.fromDate(since);
        const daily = new Map();
        for (let i = 0; i <= 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split("T")[0];
            daily.set(key, { bookings: 0, cancellations: 0, checkins: 0 });
        }
        const makeQuery = (type) => db
            .collection("analyticsEvents")
            .where("orgId", "==", orgId)
            .where("type", "==", type)
            .where("timestamp", ">=", sinceTs)
            .orderBy("timestamp", "asc")
            .get();
        const [q1, q2, q3] = await Promise.all([makeQuery("BOOKING_CREATED"), makeQuery("BOOKING_CANCELLED"), makeQuery("CHECKIN")]);
        const toKey = (ts) => {
            const dt = ts.toDate();
            return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString().split("T")[0];
        };
        q1.forEach((doc) => {
            const ts = doc.get("timestamp");
            if (ts) {
                const key = toKey(ts);
                const r = daily.get(key);
                if (r)
                    r.bookings += 1;
            }
        });
        q2.forEach((doc) => {
            const ts = doc.get("timestamp");
            if (ts) {
                const key = toKey(ts);
                const r = daily.get(key);
                if (r)
                    r.cancellations += 1;
            }
        });
        q3.forEach((doc) => {
            const ts = doc.get("timestamp");
            if (ts) {
                const key = toKey(ts);
                const r = daily.get(key);
                if (r)
                    r.checkins += 1;
            }
        });
        const data = Array.from(daily.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));
        return { data };
    }
    catch (err) {
        logger.error("getAnalyticsData failed:", err);
        throw new https_1.HttpsError("internal", "Failed to retrieve analytics data.");
    }
});
/* -----------------------------------------------------------------------------
 * Cron: Weekly Highlights (Gemini)
 * ---------------------------------------------------------------------------*/
exports.generateWeeklyHighlights = (0, scheduler_1.onSchedule)({
    schedule: "every 1 hours",
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
    timeZone: "Europe/Stockholm",
}, async () => {
    logger.info("Running scheduled job: generateWeeklyHighlights");
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1, Sun=7
    const currentHour = now.getHours();
    const currentWeek = getISOWeek(now);
    const orgsSnapshot = await db.collection("organizations").get();
    for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const settingsRef = db.collection("organizations").doc(orgId).collection("weeklyHighlightSettings").doc("settings");
        const settingsDoc = await settingsRef.get();
        if (!settingsDoc.exists)
            continue;
        const settings = settingsDoc.data();
        if (!settings.isEnabled)
            continue;
        const lastGenTimestamp = settings.lastGeneratedTimestamp ? new Date(settings.lastGeneratedTimestamp) : null;
        if (lastGenTimestamp && getISOWeek(lastGenTimestamp) === currentWeek)
            continue;
        const scheduledDay = settings.dayOfWeek; // 1-7
        const scheduledHour = parseInt(String(settings.time).split(":")[0], 10);
        if (currentDay !== scheduledDay || currentHour !== scheduledHour)
            continue;
        try {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const locationsSnapshot = await db.collection("organizations").doc(orgId).collection("locations").get();
            const locations = locationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const targets = [];
            if (settings.studioTarget === "separate") {
                targets.push({ studioTarget: "salem", locationName: "Salem" });
                targets.push({ studioTarget: "karra", locationName: "Kärra" });
            }
            else {
                targets.push({ studioTarget: settings.studioTarget, locationName: "Alla" });
            }
            for (const target of targets) {
                let participantQuery = db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("participantDirectory")
                    .where("enableLeaderboardParticipation", "==", true);
                if (target.studioTarget !== "all") {
                    const location = locations.find((l) => l.name.toLowerCase().includes(target.studioTarget));
                    if (location) {
                        participantQuery = participantQuery.where("locationId", "==", location.id);
                    }
                }
                const participantsSnapshot = await participantQuery.get();
                const targetParticipants = participantsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                const targetParticipantIds = targetParticipants.map((p) => p.id);
                if (targetParticipantIds.length === 0)
                    continue;
                const workoutLogsSnapshot = await db
                    .collection("organizations")
                    .doc(orgId)
                    .collection("workoutLogs")
                    .where("participantId", "in", targetParticipantIds)
                    .where("completedDate", ">=", oneWeekAgo.toISOString())
                    .get();
                const logsLastWeek = workoutLogsSnapshot.docs.map((doc) => doc.data());
                const pbsLastWeek = logsLastWeek
                    .flatMap((log) => {
                    const participant = targetParticipants.find((p) => p.id === log.participantId);
                    return (log.postWorkoutSummary?.newPBs || []).map((pb) => ({
                        ...pb,
                        participantName: participant?.name || "Okänd",
                    }));
                })
                    .slice(0, 10);
                const prompt = `Du är "Flexibot", en AI-assistent för Flexibel Hälsostudio. Din uppgift är att skapa ett "Veckans Höjdpunkter"-inlägg för community-flödet. Svaret MÅSTE vara på svenska och formaterat med Markdown.

**Data från den gångna veckan:**
- Totalt antal loggade pass: ${logsLastWeek.length}
- Antal medlemmar som tränat: ${new Set(logsLastWeek.map((l) => l.participantId)).size}
- Några av veckans personliga rekord (PBs):
${pbsLastWeek.length > 0
                    ? pbsLastWeek.map((pb) => `  * ${pb.participantName} slog PB i ${pb.exerciseName} med ${pb.value}!`).join("\n")
                    : "  * Inga nya PBs loggade denna vecka."}

**Ditt uppdrag:**
1. Skapa en titel i formatet: Veckans Höjdpunkter - v${getISOWeek(new Date())}.
2. Skriv en kort, peppande sammanfattning av veckans aktivitet.
3. Lyft fram 2–3 av de mest imponerande PBs från listan.
4. Avsluta med en uppmuntrande fras om att fortsätta kämpa.
5. Formatera hela texten med Markdown. Kombinera titel och beskrivning till en enda textsträng.`;
                const apiKey = process.env.GEMINI_API_KEY;
                const ai = new genai_1.GoogleGenAI({ apiKey });
                const resp = (await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                }));
                const text = resp.text;
                if (!text)
                    throw new Error("Empty AI response for weekly highlights.");
                const lines = text.split("\n");
                const title = lines.find((l) => l.trim().length > 0)?.replace(/#/g, "").trim() || `Veckans Höjdpunkter - v${currentWeek}`;
                const description = lines.slice(1).join("\n").trim();
                const newEvent = {
                    title,
                    description,
                    type: "news",
                    studioTarget: target.studioTarget,
                    createdDate: now.toISOString(),
                };
                await db.collection("organizations").doc(orgId).collection("coachEvents").add(newEvent);
            }
            await settingsRef.update({ lastGeneratedTimestamp: now.toISOString() });
        }
        catch (error) {
            logger.error(`Failed to generate highlights for org ${orgId}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map