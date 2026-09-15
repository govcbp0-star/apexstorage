import { ref, push, set, onValue, off } from 'firebase/database';
import { db } from './firebase';

const NEWSLETTER_PATH = 'newsletter';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  subscribedAt: string;
  source: string;
}

/** Subscribe an email to the newsletter via Firebase client SDK */
export async function subscribeNewsletter(email: string, source = 'website-footer'): Promise<string> {
  const newsletterRef = ref(db, NEWSLETTER_PATH);
  const newRef = push(newsletterRef);
  const id = newRef.key || Date.now().toString();
  const subscriber: Omit<NewsletterSubscriber, 'id'> & { id: string } = {
    id,
    email: email.trim().toLowerCase(),
    subscribedAt: new Date().toISOString(),
    source,
  };
  await set(newRef, subscriber);
  return id;
}

export function subscribeToNewsletterSubscribers(
  callback: (subscribers: NewsletterSubscriber[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const newsletterRef = ref(db, NEWSLETTER_PATH);
  const handler = onValue(
    newsletterRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const data = snapshot.val() as Record<string, Partial<NewsletterSubscriber>>;
      const subscribers = Object.entries(data)
        .map(([id, val]) => ({
          id,
          email: val.email || '',
          subscribedAt: val.subscribedAt || '',
          source: val.source || 'website-footer',
        }))
        .filter((subscriber) => subscriber.email)
        .sort((a, b) => (b.subscribedAt || '').localeCompare(a.subscribedAt || ''));

      callback(subscribers);
    },
    (error) => {
      if (onError) onError(error);
    },
  );

  return () => off(newsletterRef, 'value', handler);
}
