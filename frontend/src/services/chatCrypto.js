import api from './api.js'
import { normalizeChatPublicKey } from './chatEncryption.js'

export { decryptChatMessage, encryptChatMessage } from './chatEncryption.js'

const DATABASE_NAME = 'equipshare-secure-chat'
const STORE_NAME = 'identities'
const DATABASE_VERSION = 1
const identityPromises = new Map()

const openIdentityDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'userId' })
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const readIdentity = async (userId) => {
  const database = await openIdentityDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(String(userId))
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

const storeIdentity = async (identity) => {
  const database = await openIdentityDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(identity)
    transaction.oncomplete = () => {
      database.close()
      resolve(identity)
    }
    transaction.onerror = () => reject(transaction.error)
  })
}

const generateIdentity = async (userId) => {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
  ])
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
  return storeIdentity({
    userId: String(userId),
    publicJwk: normalizeChatPublicKey(publicJwk),
    privateKey,
  })
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` })

export const ensureChatIdentity = async (userId, token) => {
  const cacheKey = String(userId)
  if (identityPromises.has(cacheKey)) return identityPromises.get(cacheKey)

  const identityPromise = (async () => {
    let identity = await readIdentity(userId)
    if (identity?.privateJwk && !identity.privateKey) {
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        identity.privateJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      )
      identity = await storeIdentity({
        userId: String(userId),
        publicJwk: identity.publicJwk,
        privateKey,
      })
    }
    const serverKeyResponse = await api.get('/chats/key', {
      headers: authHeaders(token),
    })
    const serverPublicKey = serverKeyResponse.data?.public_key

    if (!identity && serverPublicKey) {
      throw new Error(
        'Secure chat was initialized in another browser. This device does not have the private key needed to read those messages.',
      )
    }

    if (!identity) identity = await generateIdentity(userId)

    const normalizedPublicJwk = normalizeChatPublicKey(identity.publicJwk)
    if (JSON.stringify(identity.publicJwk) !== JSON.stringify(normalizedPublicJwk)) {
      identity = await storeIdentity({ ...identity, publicJwk: normalizedPublicJwk })
    }

    await api.put('/chats/key', { public_key: normalizedPublicJwk }, {
      headers: authHeaders(token),
    })
    return identity
  })()

  identityPromises.set(cacheKey, identityPromise)
  try {
    return await identityPromise
  } catch (error) {
    identityPromises.delete(cacheKey)
    throw error
  }
}
