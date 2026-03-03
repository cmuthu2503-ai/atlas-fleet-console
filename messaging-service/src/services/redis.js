/**
 * Redis pub/sub for cross-instance real-time messaging
 */
const Redis = require('ioredis');
const config = require('../config');

let publisher;
let subscriber;

function getPublisher() {
  if (!publisher) {
    publisher = new Redis(config.redis.url, { lazyConnect: true });
  }
  return publisher;
}

function getSubscriber() {
  if (!subscriber) {
    subscriber = new Redis(config.redis.url, { lazyConnect: true });
  }
  return subscriber;
}

const CHANNELS = {
  NEW_MESSAGE: 'messaging:new_message',
  TYPING: 'messaging:typing',
  RECEIPT_UPDATE: 'messaging:receipt_update',
};

async function publishEvent(channel, data) {
  try {
    await getPublisher().publish(channel, JSON.stringify(data));
  } catch (err) {
    console.error('Redis publish error:', err.message);
  }
}

module.exports = { getPublisher, getSubscriber, CHANNELS, publishEvent };
