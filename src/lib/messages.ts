import { ref, push, set, get, remove, update, onValue, off } from 'firebase/database';
import { db } from './firebase';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
  read: boolean;
}

const MESSAGES_PATH = 'contactMessages';

/** Save a new contact message to RTDB */
export async function sendMessage(data: { name: string; email: string; subject: string; message: string }): Promise<string> {
  const messagesRef = ref(db, MESSAGES_PATH);
  const newRef = push(messagesRef);
  const id = newRef.key || Date.now().toString();
  const message: Omit<ContactMessage, 'id'> & { id: string } = {
    id,
    name: data.name.trim(),
    email: data.email.trim(),
    subject: data.subject.trim(),
    message: data.message.trim(),
    date: new Date().toISOString().split('T')[0],
    read: false,
  };
  await set(newRef, message);
  return id;
}

/** Fetch all contact messages from RTDB */
export async function fetchMessages(): Promise<ContactMessage[]> {
  const messagesRef = ref(db, MESSAGES_PATH);
  const snapshot = await get(messagesRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as ContactMessage[];
}

/** Mark a message as read */
export async function markMessageRead(id: string): Promise<void> {
  const msgRef = ref(db, `${MESSAGES_PATH}/${id}`);
  await update(msgRef, { read: true });
}

/** Delete a message */
export async function deleteMessage(id: string): Promise<void> {
  const msgRef = ref(db, `${MESSAGES_PATH}/${id}`);
  await remove(msgRef);
}

/** Subscribe to real-time messages updates */
export function subscribeToMessages(callback: (messages: ContactMessage[]) => void): () => void {
  const messagesRef = ref(db, MESSAGES_PATH);
  const handler = onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const messages = Object.values(data) as ContactMessage[];
    // Sort by date descending (newest first)
    messages.sort((a, b) => b.date.localeCompare(a.date));
    callback(messages);
  });
  return () => off(messagesRef, 'value', handler);
}
