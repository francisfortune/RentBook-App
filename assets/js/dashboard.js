import { auth, db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* =========================
   BUSINESS LOOKUP
========================= */
async function getBusinessIdByEmail(email) {
  const q = query(
    collection(db, "businessMembers"),
    where("email", "==", email)
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("No business");
  return snap.docs[0].data().businessId;
}
function setUserAvatar(businessName) {
  const avatar = document.getElementById("user-avatar");
  if (!avatar || !businessName) return;

  avatar.textContent = businessName.charAt(0).toUpperCase();
}


/* =========================
   LOAD DASHBOARD UI
========================= */
async function loadDashboardUI(businessId) {
  const businessSnap = await getDoc(
    doc(db, "businesses", businessId)
  );

  if (!businessSnap.exists()) {
    throw new Error("Business not found");
  }

  const business = businessSnap.data();

  document.getElementById("welcome-text").textContent =
    `Welcome ${business.name}`;

  document.getElementById("brand-name").textContent = business.name;

  document.getElementById("user-avatar").textContent =
    business.name.charAt(0).toUpperCase();
}

/* =========================
   INVENTORY COUNT (SAFE)
========================= */
function listenToInventoryCount(businessId) {
  const inventoryRef =
    collection(db, "businesses", businessId, "inventory");

  onSnapshot(inventoryRef, (snap) => {
    document.getElementById("total-inventory").textContent =
      snap.size;
  });
}

/* =========================
   BOOKING STATS (REALTIME)
========================= */
function listenToBookingStats(businessId) {
  const bookingsRef =
    collection(db, "businesses", businessId, "bookings");

  onSnapshot(bookingsRef, async (snap) => {
    let active = 0;
    let returned = 0;
    let overdue = 0;

    const today = new Date();

    for (const d of snap.docs) {
      const data = d.data();

      // Auto mark overdue
      if (
        data.status === "active" &&
        data.event?.returnDate
      ) {
        const returnDate = new Date(data.event.returnDate);
        if (today > returnDate) {
          await updateDoc(d.ref, { status: "overdue" });
          overdue++;
          continue;
        }
      }

      if (data.status === "active") active++;
      else if (data.status === "returned") returned++;
      else if (data.status === "overdue") overdue++;
    }

    document.getElementById("active-bookings").textContent = active;
    document.getElementById("returned-bookings").textContent = returned;
    document.getElementById("overdue-bookings").textContent = overdue;
  });
}

 /* RECENT BOOKINGS (THIS WEEK) */
 const bookingsBody =
 document.getElementById("recent-bookings");

const bookingsQ = query(
 collection(db, "businesses", businessId, "bookings"),
 orderBy("event.date", "asc"),
 limit(10)
);

const bookingsSnap = await getDocs(bookingsQ);
bookingsBody.innerHTML = "";

let hasEvent = false;

bookingsSnap.forEach(doc => {
 const b = doc.data();

 if (!isWithinThisWeek(b.event.date)) return;

 hasEvent = true;

 bookingsBody.innerHTML += `
   <tr>
     <td>${b.items[0]?.name || "-"}</td>
     <td>${b.client.name}</td>
     <td>${b.items.reduce((t,i)=>t+i.qty,0)}</td>
     <td>
       <span class="status inProgress">
         active
       </span>
     </td>
   </tr>
 `;
});

if (!hasEvent) {
 bookingsBody.innerHTML = `
   <tr>
     <td colspan="4"
       style="text-align:center; opacity:.6;">
       No events for this week
     </td>
   </tr>
 `;
}

/* RECENT CUSTOMERS (INVENTORY ITEMS) */
const customersBody =
 document.getElementById("recent-customers");

const invQ = query(
 collection(db, "businesses", businessId, "inventory"),
 orderBy("createdAt", "desc"),
 limit(5)
);

const invSnap = await getDocs(invQ);
customersBody.innerHTML = "";

if (invSnap.empty) {
 customersBody.innerHTML = `
   <tr>
     <td colspan="2"
       style="text-align:center; opacity:.6;">
       No items yet
     </td>
   </tr>
 `;
}

invSnap.forEach(doc => {
 const i = doc.data();

 customersBody.innerHTML += `
   <tr>
     <td>
       <h4>
         ${i.name}<br>
         <span>₦${i.price} per unit</span>
       </h4>
     </td>
   </tr>
 `;
});

/* =========================
   AUTH GUARD
========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "signup.html";
    return;
  }

  let businessId;

  try {
    businessId = await getBusinessIdByEmail(user.email);
  } catch {
    // only redirect if business truly does not exist
    window.location.href = "setup.html";
    return;
  }

  try {
    await loadDashboardUI(businessId);
    listenToInventoryCount(businessId);
    listenToBookingStats(businessId);
  } catch (err) {
    console.error("Dashboard error:", err);
    alert("Failed to load dashboard");
  }
});
