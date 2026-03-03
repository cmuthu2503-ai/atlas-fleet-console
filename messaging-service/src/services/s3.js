/**
 * S3-compatible storage service for file attachments
 */
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

let s3Client;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

async function uploadFile(key, body, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });
  return getS3Client().send(cmd);
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });
  return getSignedUrl(getS3Client(), cmd, { expiresIn });
}

module.exports = { getS3Client, uploadFile, getSignedDownloadUrl };
