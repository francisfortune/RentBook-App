// assets/js/auth.js
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   HELPERS
========================= */
function showMessage(msg) {
  alert(msg);
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait..." : "Submit";
}

/* =========================
   BUSINESS MEMBERSHIP LOOKUP
========================= */
async function getBusinessIdByEmail(email) {
  const q = query(
    collection(db, "businessMembers"),
    where("email", "==", email)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  return snap.docs[0].data().businessId;
}

/* =========================
   REGISTER
========================= */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = registerForm.querySelector("button");
    setLoading(btn, true);

    const name = registerForm.registerName.value.trim();
    const email = registerForm.registerEmail.value.trim();
    const password = registerForm.registerPassword.value;

    try {
      // 1️⃣ Create Auth account
      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 2️⃣ Create user profile (not owner of data)
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name,
        email,
        createdAt: serverTimestamp()
      });

      // 3️⃣ Resolve membership
      const businessId = await getBusinessIdByEmail(email);

      // 4️⃣ Redirect
      window.location.href = businessId
        ? "dashboard.html"
        : "setup.html";

    } catch (err) {
      console.error(err);
      showMessage(err.message);
    } finally {
      setLoading(btn, false);
    }
  });
}

/* =========================
   LOGIN
========================= */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = loginForm.querySelector("button");
    setLoading(btn, true);

    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);

      const businessId = await getBusinessIdByEmail(email);

      window.location.href = businessId
        ? "dashboard.html"
        : "setup.html";

    } catch {
      showMessage("Invalid login details");
    } finally {
      setLoading(btn, false);
    }
  });
}
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const inviteRef = doc(db, "invites", user.email);
  const inviteSnap = await getDoc(inviteRef);

  if (inviteSnap.exists()) {
    const invite = inviteSnap.data();

    // add user to businessMembers
    await setDoc(doc(db, "businessMembers", user.uid), {
      email: user.email,
      businessId: invite.businessId,
      role: invite.role,
      joinedAt: serverTimestamp()
    });

    // mark invite accepted
    await updateDoc(inviteRef, { accepted: true });
  }

  window.location.href = "dashboard.html";
});


/* =========================
   PASSWORD RESET
========================= */
window.resetPassword = async function () {
  const email = document.getElementById("loginEmail")?.value.trim();
  if (!email) return showMessage("Enter your email first");

  await sendPasswordResetEmail(auth, email);
  showMessage("Password reset email sent");
};
