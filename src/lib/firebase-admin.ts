import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";
import { getAuth, Auth } from "firebase-admin/auth";

let app: App;
let _adminDb: Firestore;
let _adminStorage: Storage;
let _adminAuth: Auth;

function getAdminApp(): App {
  if (!app) {
    if (getApps().length) {
      app = getApps()[0];
    } else {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    }
  }
  return app;
}

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_adminDb) _adminDb = getFirestore(getAdminApp());
    return (_adminDb as any)[prop];
  },
});

export const adminStorage: Storage = new Proxy({} as Storage, {
  get(_, prop) {
    if (!_adminStorage) _adminStorage = getStorage(getAdminApp());
    return (_adminStorage as any)[prop];
  },
});

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_adminAuth) _adminAuth = getAuth(getAdminApp());
    return (_adminAuth as any)[prop];
  },
});
