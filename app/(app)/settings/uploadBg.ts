import { firebaseAuth, getFirebaseApp } from "@/lib/firebase/client";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadBackground(file: File) {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("로그인 필요");

  const ext  = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${user.uid}/bg.${ext}`;

  const storage = getStorage(getFirebaseApp());
  const ref     = storageRef(storage, path);
  await uploadBytes(ref, file);
  return await getDownloadURL(ref);
}
