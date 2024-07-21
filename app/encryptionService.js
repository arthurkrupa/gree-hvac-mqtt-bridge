'use strict'

const crypto = require('crypto')

const genericKey_v1 = 'a3K8Bx%2r8Y7#xDh';
const genericKey_v2 = '{yxAHAY_Lm6pbC/<';
const iv_v2 = Buffer.from([0x54, 0x40, 0x78, 0x44, 0x49, 0x67, 0x5a, 0x51, 0x6c, 0x5e, 0x63, 0x13]);
const aad_v2 = Buffer.from('qualcomm-test');

/**
 * Module containing encryption services
 * @param {String} key AES general key
 */
module.exports = function (defaultKey = genericKey_v1) {
  const EncryptionService = {

    /**
         * Decrypt UDP message
         * @param {object} input Response object
         * @param {string} input.pack Encrypted JSON string
         * @param {string} [key] AES key
         */
    decrypt: (input, key = defaultKey) => {
      const decipher = crypto.createDecipheriv('aes-128-ecb', key, '')
      const str = decipher.update(input.pack, 'base64', 'utf8')
      const response = JSON.parse(str + decipher.final('utf8'))
      return response
    },

    /**
     * Encrypt UDP message
     * @param {object} output Request object
     * @param {string} [key] AES key
     */
    encrypt: (output, key = defaultKey) => {
      const cipher = crypto.createCipheriv('aes-128-ecb', key, '')
      const str = cipher.update(JSON.stringify(output), 'utf8', 'base64')
      const request = str + cipher.final('base64')
      return request
    },

    decrypt_v2: (data, key = genericKey_v2) => {
      const tagbuffer = Buffer.from(data.tag + '', 'base64');
      const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv_v2).setAuthTag(tagbuffer).setAAD(aad_v2);
      return JSON.parse(decipher.update(data.pack + '', 'base64', 'utf8') + decipher.final('utf8'));
    },
    
    encrypt_v2: (data, key = genericKey_v2) => {
      const str = JSON.stringify(data);
      const cipher = crypto.createCipheriv('aes-128-gcm', key, iv_v2).setAAD(aad_v2);
      const pack = cipher.update(str, 'utf8', 'base64') + cipher.final('base64');
      const tag = cipher.getAuthTag().toString('base64');
      return {pack, tag};
    },

  }

  return EncryptionService
}
