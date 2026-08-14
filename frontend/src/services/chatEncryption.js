const bytesToBase64 = (bytes) => {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const base64ToBytes = (value) => {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export const normalizeChatPublicKey = (publicJwk) => ({
  kty: publicJwk?.kty,
  crv: publicJwk?.crv,
  x: publicJwk?.x,
  y: publicJwk?.y,
})

const deriveConversationKey = async (privateKeyOrJwk, peerPublicJwk, conversationId) => {
  const privateKeyPromise = privateKeyOrJwk?.type === 'private'
    ? Promise.resolve(privateKeyOrJwk)
    : crypto.subtle.importKey(
        'jwk',
        privateKeyOrJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      )
  const [privateKey, publicKey] = await Promise.all([
    privateKeyPromise,
    crypto.subtle.importKey(
      'jwk',
      peerPublicJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    ),
  ])
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  )
  const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`equipshare-chat-${conversationId}`),
      info: new TextEncoder().encode('equipshare-e2ee-v1'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const encryptChatMessage = async (
  plaintext,
  privateKey,
  peerPublicJwk,
  conversationId,
) => {
  const key = await deriveConversationKey(privateKey, peerPublicJwk, conversationId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const additionalData = new TextEncoder().encode(`equipshare:${conversationId}`)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  }
}

export const decryptChatMessage = async (
  encryptedMessage,
  privateKey,
  peerPublicJwk,
  conversationId,
) => {
  const key = await deriveConversationKey(privateKey, peerPublicJwk, conversationId)
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(encryptedMessage.iv),
      additionalData: new TextEncoder().encode(`equipshare:${conversationId}`),
    },
    key,
    base64ToBytes(encryptedMessage.ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}
