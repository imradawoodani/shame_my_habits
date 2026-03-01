import {
  doc, getDoc, setDoc, updateDoc, collection,
  addDoc, onSnapshot, query, where, orderBy,
  arrayUnion, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { getEmbedding, getBalanceScore, getArchetype } from './ml';

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signIn() {
  if (!auth) throw new Error('Firebase auth not available');
  const { user } = await signInAnonymously(auth);
  return user;
}

// ─── USER ─────────────────────────────────────────────────────────────────────
export async function createUser(uid, name) {
  if (!db) throw new Error('Firestore not available');
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const userData = {
    uid,
    name: name.trim(),
    initials,
    circleId: null,
    currentLog: { sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 },
    embedding: getEmbedding({ sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 }),
    balanceScore: 0,
    archetype: 'The Work in Progress',
    history: [],
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), userData);
  return userData;
}

export async function getUser(uid) {
  if (!db) throw new Error('Firestore not available');
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserLog(uid, log) {
  const embedding = getEmbedding(log);
  const balanceScore = getBalanceScore(log);
  const archetype = getArchetype(log).label;
  await updateDoc(doc(db, 'users', uid), { currentLog: log, embedding, balanceScore, archetype });
  return { embedding, balanceScore };
}

export async function commitWeek(uid, log) {
  const weekLabel = getWeekLabel();
  const embedding = getEmbedding(log);
  const balanceScore = getBalanceScore(log);
  const historyEntry = { ...log, week: weekLabel, balanceScore, embedding, ts: Date.now() };
  await updateDoc(doc(db, 'users', uid), {
    history: arrayUnion(historyEntry),
    currentLog: { sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 },
    embedding: getEmbedding({ sugar: 0, ateOut: 0, junk: 0, workouts: 0, sleep: 7 }),
    balanceScore: 0,
  });
}

// ─── CIRCLES ─────────────────────────────────────────────────────────────────
export async function createCircle(uid, circleName) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await setDoc(doc(db, 'circles', code), {
    name: circleName,
    createdBy: uid,
    members: [uid],
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', uid), { circleId: code });
  return code;
}

export async function joinCircle(uid, code) {
  const circleRef = doc(db, 'circles', code.toUpperCase());
  const snap = await getDoc(circleRef);
  if (!snap.exists()) throw new Error('Circle not found');
  await updateDoc(circleRef, { members: arrayUnion(uid) });
  await updateDoc(doc(db, 'users', uid), { circleId: code.toUpperCase() });
  return snap.data();
}

export function onCircleMembers(circleId, cb) {
  const q = query(collection(db, 'users'), where('circleId', '==', circleId));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data())));
}

// ─── FEED ─────────────────────────────────────────────────────────────────────
export async function postToFeed(circleId, uid, name, initials, message) {
  const ref = await addDoc(collection(db, 'posts'), {
    circleId, uid, name, initials, message,
    reactions: {}, replies: [], ts: serverTimestamp(),
  });
  return ref.id;
}

export function onFeed(circleId, cb) {
  const q = query(
    collection(db, 'posts'),
    where('circleId', '==', circleId),
    orderBy('ts', 'desc')
  );
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function toggleReaction(postId, emoji, userName) {
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const reactions = { ...(snap.data().reactions || {}) };
  const users = reactions[emoji] || [];
  if (users.includes(userName)) {
    reactions[emoji] = users.filter(u => u !== userName);
    if (!reactions[emoji].length) delete reactions[emoji];
  } else {
    reactions[emoji] = [...users, userName];
  }
  await updateDoc(ref, { reactions });
}

export async function addReply(postId, userName, text) {
  await updateDoc(doc(db, 'posts', postId), {
    replies: arrayUnion({ name: userName, text, ts: Date.now() }),
  });
}

function getWeekLabel() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
