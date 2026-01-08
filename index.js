import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

/** 1) Paste your Firebase config here (Firebase Console → Project settings) */
const firebaseConfig = {
  apiKey: "AIzaSyAnaQ5VJCnGD-M12ckzIsYfKR4DQ8h1L3k",
    authDomain: "propert-ee9fb.firebaseapp.com",
    projectId: "propert-ee9fb",
    storageBucket: "propert-ee9fb.firebasestorage.app",
    messagingSenderId: "109212957192",
    appId: "1:109212957192:web:47cce38e2f36b19fce6fbd",
    measurementId: "G-6QFEFTSLJN"
  // storageBucket, messagingSenderId optional for auth-only pages
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ---- UI elements ----
const year = document.getElementById("year");
year.textContent = String(new Date().getFullYear());

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const msg = document.getElementById("msg");

const signupForm = document.getElementById("signupForm");
const suEmail = document.getElementById("suEmail");
const suPassword = document.getElementById("suPassword");
const suMsg = document.getElementById("suMsg");

const showSignupBtn = document.getElementById("showSignupBtn");
const cancelSignupBtn = document.getElementById("cancelSignupBtn");
const forgotBtn = document.getElementById("forgotBtn");
const demoFillBtn = document.getElementById("demoFillBtn");

const LOGIN_REDIRECT = "rental-tracker.html"; // change to your tool route/page

// If already signed in, go to app
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = LOGIN_REDIRECT;
});

// Toggle signup
showSignupBtn.addEventListener("click", () => {
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  clearMessages();
});
cancelSignupBtn.addEventListener("click", () => {
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  clearMessages();
});

demoFillBtn.addEventListener("click", () => {
  email.value = "demo@example.com";
  password.value = "password123";
});

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  try {
    setMsg(msg, "Signing in…");
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    setMsg(msg, "Success! Redirecting…", "good");
    window.location.href = LOGIN_REDIRECT;
  } catch (err) {
    setMsg(msg, friendlyAuthError(err), "bad");
  }
});

// Signup
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  try {
    setMsg(suMsg, "Creating account…");
    await createUserWithEmailAndPassword(auth, suEmail.value.trim(), suPassword.value);
    setMsg(suMsg, "Account created! Redirecting…", "good");
    window.location.href = LOGIN_REDIRECT;
  } catch (err) {
    setMsg(suMsg, friendlyAuthError(err), "bad");
  }
});

// Forgot password
forgotBtn.addEventListener("click", async () => {
  clearMessages();
  const userEmail = prompt("Enter your email to reset password:", email.value.trim());
  if (!userEmail) return;

  try {
    setMsg(msg, "Sending reset email…");
    await sendPasswordResetEmail(auth, userEmail.trim());
    setMsg(msg, "Password reset email sent. Check your inbox.", "good");
  } catch (err) {
    setMsg(msg, friendlyAuthError(err), "bad");
  }
});

// ---- helpers ----
function setMsg(el, text, tone) {
  el.classList.remove("good", "bad");
  if (tone) el.classList.add(tone);
  el.textContent = text;
}

function clearMessages() {
  setMsg(msg, "");
  setMsg(suMsg, "");
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-email") return "That email address is not valid.";
  if (code === "auth/user-not-found") return "No user found with that email.";
  if (code === "auth/wrong-password") return "Incorrect password.";
  if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
  if (code === "auth/email-already-in-use") return "That email is already in use.";
  if (code === "auth/weak-password") return "Password is too weak (min 6 characters).";
  if (code === "auth/network-request-failed") return "Network error. Check your connection.";
  return `Sign-in error: ${code || "unknown"}`;
}
