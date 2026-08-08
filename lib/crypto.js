const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const crypto = require('crypto');

// Curve25519 keypair
function keypair() {
  const kp = nacl.box.keyPair();
  return { publicKey: util.encodeBase64(kp.publicKey), secretKey: util.encodeBase64(kp.secretKey) };
}

// derive shared symmetric key via ECDH (before hashing)
function sharedKey(mySecretKeyB64, theirPublicKeyB64) {
  const sk = util.decodeBase64(mySecretKeyB64);
  const pk = util.decodeBase64(theirPublicKeyB64);
  const shared = nacl.box.before(pk, sk);
  return util.encodeBase64(shared);
}

// AEAD encrypt with pre-shared secretbox key (32 bytes)
function encrypt(sharedKeyB64, plaintext) {
  const key = util.decodeBase64(sharedKeyB64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msg = typeof plaintext === 'string' ? util.decodeUTF8(plaintext) : plaintext;
  const box = nacl.secretbox(msg, nonce, key);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce); out.set(box, nonce.length);
  return util.encodeBase64(out);
}

function decrypt(sharedKeyB64, cipherB64) {
  const key = util.decodeBase64(sharedKeyB64);
  const bytes = util.decodeBase64(cipherB64);
  const nonce = bytes.slice(0, nacl.secretbox.nonceLength);
  const box = bytes.slice(nacl.secretbox.nonceLength);
  const plain = nacl.secretbox.open(box, nonce, key);
  if (!plain) throw new Error('decrypt failed (bad key or tampered)');
  return util.encodeUTF8(plain);
}

// HMAC for auth tokens (not encrypted)
function hmac(sharedKeyB64, message) {
  const key = Buffer.from(util.decodeBase64(sharedKeyB64));
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

module.exports = { keypair, sharedKey, encrypt, decrypt, hmac };
