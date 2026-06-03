/**
 * offlineQueue.js
 * IndexedDB-based queue for offline match logging.
 * No external libraries required.
 */

const DB_NAME = 'padel-offline'
const STORE_NAME = 'match-queue'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function queueMatch(matchData, authorId = null) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.add({ ...matchData, authorId, queuedAt: new Date().toISOString() })
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function getAllQueued(authorId = null) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result || []
      // If a user id is provided, only return entries authored by this user (or legacy null-author entries for back-compat)
      resolve(authorId ? all.filter(item => !item.authorId || item.authorId === authorId) : all)
    }
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function clearQueue() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function removeFromQueue(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function getQueueLength() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

/**
 * Flush all queued matches using the provided create function.
 * @param {Function} createFn - async function that accepts match data and returns { error }
 */
export async function flushQueue(createFn, authorId = null) {
  if (!navigator.onLine) return

  const queued = await getAllQueued(authorId)
  for (const item of queued) {
    const { id, queuedAt, authorId: _author, ...matchData } = item
    try {
      const { error } = await createFn(matchData)
      if (!error) {
        await removeFromQueue(id)
      }
    } catch {
      // Leave in queue to retry next time
    }
  }
}
